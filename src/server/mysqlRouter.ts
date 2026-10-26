import express from 'express';
import {
  initializeTable,
  testConnection,
  listBackups,
  getBackup,
  saveBackup,
  getActivityLog,
  getMySqlConfig,
  setMySqlConfig,
} from './mysqlService';

export const mysqlRouter = express.Router();

// 1. Status & Table verification
mysqlRouter.get('/status', async (_req, res) => {
  try {
    const status = await initializeTable();
    res.json({
      ...status,
      config: getMySqlConfig(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Test connection with optional custom credentials
mysqlRouter.post('/test-connection', async (req, res) => {
  try {
    const result = await testConnection(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Update server connection configuration
mysqlRouter.post('/config', async (req, res) => {
  try {
    setMySqlConfig(req.body);
    const status = await initializeTable();
    res.json({
      success: true,
      message: 'Configuration updated. ' + status.message,
      config: getMySqlConfig(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. List all backups
mysqlRouter.get('/backups', async (_req, res) => {
  try {
    const list = await listBackups();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get a specific backup by ID
mysqlRouter.get('/backups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await getBackup(id);
    if (!backup.record || !backup.appData) {
      return res.status(404).json({ error: `Backup "${id}" not found.` });
    }
    res.json({
      appData: backup.appData,
      metadata: {
        id: backup.record.id,
        name: backup.record.name,
        syncToken: backup.record.sync_token,
        lastModifiedBy: backup.record.last_modified_by,
        lastModifiedAt: backup.record.last_modified_at,
        createdAt: backup.record.created_at,
        versionNumber: backup.record.version_number,
      },
      isLiveMySql: backup.isLiveMySql,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Save/Update a backup (with concurrency check)
mysqlRouter.post('/backups', async (req, res) => {
  try {
    const { id, name, appData, checkSyncToken, modifiedBy, forceOverwrite } = req.body;
    if (!id || !name || !appData) {
      return res.status(400).json({ error: 'Missing required fields (id, name, appData).' });
    }

    const result = await saveBackup({
      id,
      name,
      appData,
      checkSyncToken,
      modifiedBy,
      forceOverwrite,
    });

    if (result.conflict) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Activity Log (last 10 modifications)
mysqlRouter.get('/activity-log', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const result = await getActivityLog(limit);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
