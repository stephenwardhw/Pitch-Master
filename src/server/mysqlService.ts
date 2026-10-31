import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { AppData, MySqlBackupMetadata, MySqlConfig, ScheduleActivityItem } from '../types';

const FALLBACK_STORAGE_FILE = path.resolve(process.cwd(), 'league_backups_nosql.json');
const FALLBACK_ACTIVITY_FILE = path.resolve(process.cwd(), 'league_activity_nosql.json');

function readFallbackActivityStore(): ScheduleActivityItem[] {
  try {
    if (fs.existsSync(FALLBACK_ACTIVITY_FILE)) {
      const content = fs.readFileSync(FALLBACK_ACTIVITY_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading fallback activity store:', err);
  }
  return [];
}

function writeFallbackActivityStore(items: ScheduleActivityItem[]) {
  try {
    fs.writeFileSync(FALLBACK_ACTIVITY_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing fallback activity store:', err);
  }
}

export interface BackupRecord {
  id: string;
  name: string;
  data_json: string;
  sync_token: string;
  last_modified_by: string;
  last_modified_at: string;
  created_at: string;
  version_number: number;
}

export function getDefaultMySqlConfig(): MySqlConfig {
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'pitchmaster',
    tableName: process.env.MYSQL_TABLE || 'schedule_backups',
  };
}

let activeConfig: MySqlConfig = getDefaultMySqlConfig();

export function setMySqlConfig(newConfig: Partial<MySqlConfig>) {
  activeConfig = {
    ...activeConfig,
    ...newConfig,
  };
}

export function getMySqlConfig(): MySqlConfig {
  return { ...activeConfig };
}

/**
 * Creates connection pool or returns null if connection fails
 */
export async function getPool(): Promise<mysql.Pool | null> {
  try {
    const pool = mysql.createPool({
      host: activeConfig.host,
      port: activeConfig.port,
      user: activeConfig.user,
      password: activeConfig.password,
      database: activeConfig.database,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 4000,
    });
    // Test connection
    const conn = await pool.getConnection();
    conn.release();
    return pool;
  } catch (err: any) {
    return null;
  }
}

/**
 * Reads fallback JSON backups if MySQL is not reachable
 */
function readFallbackStore(): Record<string, BackupRecord> {
  try {
    if (fs.existsSync(FALLBACK_STORAGE_FILE)) {
      const content = fs.readFileSync(FALLBACK_STORAGE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading fallback store:', err);
  }
  return {};
}

function writeFallbackStore(data: Record<string, BackupRecord>) {
  try {
    fs.writeFileSync(FALLBACK_STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing fallback store:', err);
  }
}

/**
 * Initializes the MySQL NoSQL schedule_backups table
 */
export async function initializeTable(): Promise<{ isLiveMySql: boolean; message: string }> {
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  if (!pool) {
    return {
      isLiveMySql: false,
      message: `MySQL server at ${activeConfig.host}:${activeConfig.port}/${activeConfig.database} not reachable. Using embedded NoSQL file fallback.`,
    };
  }

  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` VARCHAR(128) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`data_json\` LONGTEXT NOT NULL,
        \`sync_token\` VARCHAR(128) NOT NULL,
        \`last_modified_by\` VARCHAR(255) NOT NULL,
        \`last_modified_at\` DATETIME NOT NULL,
        \`created_at\` DATETIME NOT NULL,
        \`version_number\` INT NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createTableSql);

    const createActivityTableSql = `
      CREATE TABLE IF NOT EXISTS \`schedule_activity_log\` (
        \`id\` VARCHAR(128) PRIMARY KEY,
        \`backup_id\` VARCHAR(128) NOT NULL,
        \`backup_name\` VARCHAR(255) NOT NULL,
        \`version_number\` INT NOT NULL DEFAULT 1,
        \`action\` VARCHAR(64) NOT NULL,
        \`modified_by\` VARCHAR(255) NOT NULL,
        \`modified_at\` DATETIME NOT NULL,
        \`summary\` VARCHAR(255) NOT NULL,
        \`divisions_count\` INT NOT NULL DEFAULT 0,
        \`teams_count\` INT NOT NULL DEFAULT 0,
        \`games_count\` INT NOT NULL DEFAULT 0,
        \`sync_token\` VARCHAR(128) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createActivityTableSql);

    return {
      isLiveMySql: true,
      message: `Connected to MySQL database "${activeConfig.database}" and verified tables "${tableName}" & "schedule_activity_log".`,
    };
  } catch (err: any) {
    return {
      isLiveMySql: false,
      message: `MySQL Error: ${err.message}. Using embedded NoSQL file fallback.`,
    };
  }
}

/**
 * Tests connection to MySQL server
 */
export async function testConnection(testCfg?: MySqlConfig): Promise<{ success: boolean; message: string }> {
  const cfg = testCfg || activeConfig;
  try {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: 4000,
    });
    await conn.ping();
    await conn.end();
    return {
      success: true,
      message: `Successfully connected to MySQL database "${cfg.database}" on ${cfg.host}:${cfg.port}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to MySQL: ${err.message || 'Connection refused'}`,
    };
  }
}

/**
 * List all backup documents stored in MySQL NoSQL table
 */
export async function listBackups(): Promise<{
  isLiveMySql: boolean;
  backups: MySqlBackupMetadata[];
}> {
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  if (!pool) {
    const store = readFallbackStore();
    const backups = Object.values(store).map((r) => ({
      id: r.id,
      name: r.name,
      syncToken: r.sync_token,
      lastModifiedBy: r.last_modified_by,
      lastModifiedAt: r.last_modified_at,
      createdAt: r.created_at,
      versionNumber: r.version_number,
      dataSize: Buffer.byteLength(r.data_json, 'utf-8'),
    }));
    return { isLiveMySql: false, backups };
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name, sync_token, last_modified_by, last_modified_at, created_at, version_number, LENGTH(data_json) as data_size FROM \`${tableName}\` ORDER BY last_modified_at DESC`
    );

    const backups: MySqlBackupMetadata[] = (rows as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      syncToken: r.sync_token,
      lastModifiedBy: r.last_modified_by,
      lastModifiedAt: new Date(r.last_modified_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString(),
      versionNumber: Number(r.version_number) || 1,
      dataSize: Number(r.data_size) || 0,
    }));

    return { isLiveMySql: true, backups };
  } catch (err) {
    const store = readFallbackStore();
    const backups = Object.values(store).map((r) => ({
      id: r.id,
      name: r.name,
      syncToken: r.sync_token,
      lastModifiedBy: r.last_modified_by,
      lastModifiedAt: r.last_modified_at,
      createdAt: r.created_at,
      versionNumber: r.version_number,
      dataSize: Buffer.byteLength(r.data_json, 'utf-8'),
    }));
    return { isLiveMySql: false, backups };
  }
}

/**
 * Retrieves the most recent backup document from MySQL (or fallback store)
 */
export async function getLatestBackup(): Promise<{
  record: BackupRecord | null;
  appData: AppData | null;
  isLiveMySql: boolean;
}> {
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  if (!pool) {
    const store = readFallbackStore();
    const records = Object.values(store);
    if (records.length === 0) {
      return { record: null, appData: null, isLiveMySql: false };
    }
    records.sort((a, b) => new Date(b.last_modified_at).getTime() - new Date(a.last_modified_at).getTime());
    const top = records[0];
    try {
      const appData = JSON.parse(top.data_json);
      return { record: top, appData, isLiveMySql: false };
    } catch {
      return { record: null, appData: null, isLiveMySql: false };
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number FROM \`${tableName}\` ORDER BY last_modified_at DESC LIMIT 1`
    );
    const rowList = rows as any[];
    if (rowList.length === 0) {
      return { record: null, appData: null, isLiveMySql: true };
    }
    const r = rowList[0];
    const record: BackupRecord = {
      id: r.id,
      name: r.name,
      data_json: r.data_json,
      sync_token: r.sync_token,
      last_modified_by: r.last_modified_by,
      last_modified_at: new Date(r.last_modified_at).toISOString(),
      created_at: new Date(r.created_at).toISOString(),
      version_number: Number(r.version_number) || 1,
    };
    const appData = JSON.parse(r.data_json);
    return { record, appData, isLiveMySql: true };
  } catch (err) {
    console.error('Error fetching latest backup from MySQL:', err);
    const store = readFallbackStore();
    const records = Object.values(store);
    if (records.length === 0) {
      return { record: null, appData: null, isLiveMySql: false };
    }
    records.sort((a, b) => new Date(b.last_modified_at).getTime() - new Date(a.last_modified_at).getTime());
    const top = records[0];
    try {
      const appData = JSON.parse(top.data_json);
      return { record: top, appData, isLiveMySql: false };
    } catch {
      return { record: null, appData: null, isLiveMySql: false };
    }
  }
}

/**
 * Retrieves a single backup document by ID
 */
export async function getBackup(id: string): Promise<{
  record: BackupRecord | null;
  appData: AppData | null;
  isLiveMySql: boolean;
}> {
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  if (!pool) {
    const store = readFallbackStore();
    // 1. Direct match on id
    let record: BackupRecord | null = store[id] || null;
    // 2. Match by sync_token or activity log ID
    if (!record) {
      record = Object.values(store).find((r) => r.sync_token === id || r.id === id) || null;
    }
    if (!record) {
      const actList = readFallbackActivityStore();
      const matchedAct = actList.find((a) => a.id === id || a.backupId === id || a.syncToken === id);
      if (matchedAct && store[matchedAct.backupId]) {
        record = store[matchedAct.backupId];
      }
    }
    // 3. Match by name or base slug
    if (!record) {
      const matching = Object.values(store).filter(
        (r) => r.name === id || r.id.toLowerCase().includes(id.toLowerCase())
      );
      if (matching.length > 0) {
        matching.sort((a, b) => (b.version_number || 1) - (a.version_number || 1));
        record = matching[0];
      }
    }
    let appData: AppData | null = null;
    if (record) {
      try {
        appData = JSON.parse(record.data_json);
      } catch {}
    }
    return { record, appData, isLiveMySql: false };
  }

  try {
    // 1. Search by exact ID or sync_token
    let [rows] = await pool.query(
      `SELECT id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number FROM \`${tableName}\` WHERE id = ? OR sync_token = ? ORDER BY (id = ?) DESC, last_modified_at DESC LIMIT 1`,
      [id, id, id]
    );
    let list = rows as any[];

    // 2. If not found, check schedule_activity_log for activity ID, sync token, or backup ID
    if (list.length === 0) {
      try {
        const [actRows] = await pool.query(
          `SELECT backup_id, sync_token FROM \`schedule_activity_log\` WHERE id = ? OR sync_token = ? OR backup_id = ? ORDER BY modified_at DESC LIMIT 1`,
          [id, id, id]
        );
        const actList = actRows as any[];
        if (actList.length > 0) {
          const actItem = actList[0];
          const [foundRows] = await pool.query(
            `SELECT id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number FROM \`${tableName}\` WHERE id = ? OR sync_token = ? LIMIT 1`,
            [actItem.backup_id, actItem.sync_token]
          );
          list = foundRows as any[];
        }
      } catch {}
    }

    // 3. If still not found, search by name or ID pattern for latest version
    if (list.length === 0) {
      const cleanSlug = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const [nameRows] = await pool.query(
        `SELECT id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number FROM \`${tableName}\` WHERE name = ? OR id LIKE ? ORDER BY version_number DESC, last_modified_at DESC LIMIT 1`,
        [id, `%${cleanSlug}%`]
      );
      list = nameRows as any[];
    }

    if (list.length === 0) {
      return { record: null, appData: null, isLiveMySql: true };
    }

    const r = list[0];
    const record: BackupRecord = {
      id: r.id,
      name: r.name,
      data_json: r.data_json,
      sync_token: r.sync_token,
      last_modified_by: r.last_modified_by,
      last_modified_at: new Date(r.last_modified_at).toISOString(),
      created_at: new Date(r.created_at).toISOString(),
      version_number: Number(r.version_number) || 1,
    };
    const appData = JSON.parse(record.data_json);
    return { record, appData, isLiveMySql: true };
  } catch (err) {
    const store = readFallbackStore();
    let record: BackupRecord | null = store[id] || null;
    if (!record) {
      record = Object.values(store).find((r) => r.sync_token === id || r.id === id) || null;
    }
    let appData: AppData | null = null;
    if (record) {
      try {
        appData = JSON.parse(record.data_json);
      } catch {}
    }
    return { record, appData, isLiveMySql: false };
  }
}

/**
 * Saves a backup document in MySQL with Optimistic Concurrency / Conflict Check
 */
export async function saveBackup(params: {
  id: string;
  name: string;
  appData: AppData;
  checkSyncToken?: string;
  modifiedBy?: string;
  forceOverwrite?: boolean;
}): Promise<{
  success: boolean;
  conflict?: boolean;
  remoteData?: AppData;
  remoteSyncToken?: string;
  remoteModifier?: string;
  remoteModifiedAt?: string;
  savedRecord?: MySqlBackupMetadata;
  updatedAppData?: AppData;
  isLiveMySql: boolean;
  message?: string;
}> {
  const { id, name, appData, checkSyncToken, modifiedBy = 'Admin', forceOverwrite = false } = params;
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  // 1. Optimistic Concurrency Check: If checkSyncToken provided, check against the latest backup in DB
  if (!forceOverwrite && checkSyncToken) {
    const latest = await getLatestBackup();
    if (
      latest.record &&
      latest.record.sync_token !== checkSyncToken &&
      (latest.record.version_number || 1) >= (appData.mysqlBackupSync?.versionNumber || 1)
    ) {
      // CONFLICT DETECTED!
      return {
        success: false,
        conflict: true,
        remoteData: latest.appData || undefined,
        remoteSyncToken: latest.record.sync_token,
        remoteModifier: latest.record.last_modified_by,
        remoteModifiedAt: latest.record.last_modified_at,
        isLiveMySql: latest.isLiveMySql,
        message: `Concurrency conflict: A newer backup (v${latest.record.version_number}) was saved by "${latest.record.last_modified_by}" at ${latest.record.last_modified_at}.`,
      };
    }
  }

  // 2. Calculate next version number across existing backups for this schedule
  const cleanBaseSlug = (name || id || 'schedule')
    .toLowerCase()
    .replace(/\.json$/i, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '') || 'schedule';

  let currentMaxVersion = appData.mysqlBackupSync?.versionNumber || 0;
  if (pool) {
    try {
      const [vRows] = await pool.query(
        `SELECT MAX(version_number) as max_v FROM \`${tableName}\` WHERE name = ? OR id LIKE ?`,
        [name, `%${cleanBaseSlug}%`]
      );
      const maxV = (vRows as any[])[0]?.max_v;
      if (maxV && Number(maxV) > currentMaxVersion) {
        currentMaxVersion = Number(maxV);
      }
    } catch {}
  } else {
    const store = readFallbackStore();
    for (const r of Object.values(store)) {
      if ((r.name === name || r.id.toLowerCase().includes(cleanBaseSlug)) && (r.version_number || 0) > currentMaxVersion) {
        currentMaxVersion = r.version_number;
      }
    }
  }
  const nextVersion = currentMaxVersion + 1;

  // 3. Generate a distinct new backup ID for this snapshot in schedule_backups table
  const newBackupId = `backup_${cleanBaseSlug}_v${nextVersion}_${Date.now()}`;
  const backupName = name || 'Schedule Backup';

  // Generate new unique syncToken and timestamps
  const now = new Date();
  const nowIso = now.toISOString();
  const mysqlDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
  const newSyncToken = `mysql_sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 4. Link the newest version of the data to this new backup in mysqlBackupSync
  const finalAppData: AppData = {
    ...appData,
    fileName: backupName.endsWith('.json') ? backupName : `${backupName}.json`,
    lastModified: nowIso,
    syncToken: newSyncToken,
    lastModifiedBy: modifiedBy,
    mysqlBackupSync: {
      backupId: newBackupId,
      backupName,
      syncToken: newSyncToken,
      lastModifiedAt: nowIso,
      lastModifiedBy: modifiedBy,
      lastSyncedAt: nowIso,
      versionNumber: nextVersion,
    },
  };

  const encodedJson = JSON.stringify(finalAppData);

  const divisionsCount = Array.isArray(appData.divisions) ? appData.divisions.length : 0;
  const teamsCount = Array.isArray(appData.teams) ? appData.teams.length : 0;
  const gamesCount = Array.isArray(appData.games) ? appData.games.length : 0;
  const action = nextVersion === 1 ? 'Created Schedule Backup' : `Updated Schedule (v${nextVersion})`;
  const summary = `${divisionsCount} divisions, ${teamsCount} teams, ${gamesCount} games`;
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!pool) {
    // Save new backup to fallback store
    const store = readFallbackStore();
    const record: BackupRecord = {
      id: newBackupId,
      name: backupName,
      data_json: encodedJson,
      sync_token: newSyncToken,
      last_modified_by: modifiedBy,
      last_modified_at: nowIso,
      created_at: nowIso,
      version_number: nextVersion,
    };
    store[newBackupId] = record;
    writeFallbackStore(store);

    // Save to fallback activity store
    const activityItem: ScheduleActivityItem = {
      id: activityId,
      backupId: newBackupId,
      backupName,
      versionNumber: nextVersion,
      action,
      modifiedBy,
      modifiedAt: nowIso,
      summary,
      divisionsCount,
      teamsCount,
      gamesCount,
      syncToken: newSyncToken,
      dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
    };
    const actList = readFallbackActivityStore();
    actList.unshift(activityItem);
    writeFallbackActivityStore(actList.slice(0, 50));

    return {
      success: true,
      isLiveMySql: false,
      updatedAppData: finalAppData,
      savedRecord: {
        id: newBackupId,
        name: backupName,
        syncToken: newSyncToken,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: nowIso,
        createdAt: nowIso,
        versionNumber: nextVersion,
        dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
      },
      message: `Created new backup (v${nextVersion}) in embedded store.`,
    };
  }

  try {
    await initializeTable();

    // Insert new backup record into schedule_backups table
    const insertSql = `
      INSERT INTO \`${tableName}\` (id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(insertSql, [
      newBackupId,
      backupName,
      encodedJson,
      newSyncToken,
      modifiedBy,
      mysqlDateTime,
      mysqlDateTime,
      nextVersion,
    ]);

    // Record activity in schedule_activity_log table linked to this new backup
    try {
      await pool.query(
        `INSERT INTO \`schedule_activity_log\` (id, backup_id, backup_name, version_number, action, modified_by, modified_at, summary, divisions_count, teams_count, games_count, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [activityId, newBackupId, backupName, nextVersion, action, modifiedBy, mysqlDateTime, summary, divisionsCount, teamsCount, gamesCount, newSyncToken]
      );
    } catch (actErr) {
      console.warn('Could not record activity in schedule_activity_log:', actErr);
    }

    // Mirror to fallback activity store
    const activityItem: ScheduleActivityItem = {
      id: activityId,
      backupId: newBackupId,
      backupName,
      versionNumber: nextVersion,
      action,
      modifiedBy,
      modifiedAt: nowIso,
      summary,
      divisionsCount,
      teamsCount,
      gamesCount,
      syncToken: newSyncToken,
      dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
    };
    const actList = readFallbackActivityStore();
    actList.unshift(activityItem);
    writeFallbackActivityStore(actList.slice(0, 50));

    return {
      success: true,
      isLiveMySql: true,
      updatedAppData: finalAppData,
      savedRecord: {
        id: newBackupId,
        name: backupName,
        syncToken: newSyncToken,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: nowIso,
        createdAt: nowIso,
        versionNumber: nextVersion,
        dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
      },
      message: `Successfully created new backup (v${nextVersion}) in MySQL table "${tableName}".`,
    };
  } catch (err: any) {
    // Fallback save if MySQL query failed
    const store = readFallbackStore();
    store[newBackupId] = {
      id: newBackupId,
      name: backupName,
      data_json: encodedJson,
      sync_token: newSyncToken,
      last_modified_by: modifiedBy,
      last_modified_at: nowIso,
      created_at: nowIso,
      version_number: nextVersion,
    };
    writeFallbackStore(store);

    const activityItem: ScheduleActivityItem = {
      id: activityId,
      backupId: newBackupId,
      backupName,
      versionNumber: nextVersion,
      action,
      modifiedBy,
      modifiedAt: nowIso,
      summary,
      divisionsCount,
      teamsCount,
      gamesCount,
      syncToken: newSyncToken,
      dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
    };
    const actList = readFallbackActivityStore();
    actList.unshift(activityItem);
    writeFallbackActivityStore(actList.slice(0, 50));

    return {
      success: true,
      isLiveMySql: false,
      updatedAppData: finalAppData,
      savedRecord: {
        id: newBackupId,
        name: backupName,
        syncToken: newSyncToken,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: nowIso,
        createdAt: nowIso,
        versionNumber: nextVersion,
        dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
      },
      message: `MySQL Error (${err.message}). Saved new backup into embedded fallback storage.`,
    };
  }
}

/**
 * Fetches the last 10 modifications to the schedule from schedule_backups and schedule_activity_log
 */
export async function getActivityLog(limit: number = 10): Promise<{
  isLiveMySql: boolean;
  activities: ScheduleActivityItem[];
}> {
  const pool = await getPool();
  const tableName = activeConfig.tableName || 'schedule_backups';

  if (!pool) {
    const fallbackActivities = readFallbackActivityStore();
    const fallbackBackups = readFallbackStore();

    // Also derive activities from fallback backups if not already present
    const backupDerived: ScheduleActivityItem[] = Object.values(fallbackBackups).map((b) => {
      let divisionsCount = 0;
      let teamsCount = 0;
      let gamesCount = 0;
      try {
        const parsed = JSON.parse(b.data_json);
        divisionsCount = parsed.divisions?.length || 0;
        teamsCount = parsed.teams?.length || 0;
        gamesCount = parsed.games?.length || 0;
      } catch {}

      return {
        id: `backup_${b.id}_v${b.version_number}`,
        backupId: b.id,
        backupName: b.name,
        versionNumber: b.version_number || 1,
        action: (b.version_number || 1) > 1 ? `Updated Schedule (v${b.version_number})` : 'Created Schedule Backup',
        modifiedBy: b.last_modified_by || 'Admin',
        modifiedAt: b.last_modified_at || b.created_at,
        summary: `${divisionsCount} divisions, ${teamsCount} teams, ${gamesCount} games`,
        divisionsCount,
        teamsCount,
        gamesCount,
        syncToken: b.sync_token,
        dataSize: Buffer.byteLength(b.data_json || '', 'utf-8'),
      };
    });

    const combined = [...fallbackActivities];
    const seenTokens = new Set(combined.map((a) => a.syncToken || a.id));
    for (const item of backupDerived) {
      if (!seenTokens.has(item.syncToken) && !seenTokens.has(item.id)) {
        combined.push(item);
        seenTokens.add(item.syncToken);
      }
    }

    combined.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    return {
      isLiveMySql: false,
      activities: combined.slice(0, limit),
    };
  }

  try {
    await initializeTable();

    // 1. Fetch from schedule_activity_log table
    let activityLogRows: any[] = [];
    try {
      const [rows] = await pool.query(
        `SELECT id, backup_id, backup_name, version_number, action, modified_by, modified_at, summary, divisions_count, teams_count, games_count, sync_token
         FROM \`schedule_activity_log\`
         ORDER BY modified_at DESC
         LIMIT ?`,
        [limit]
      );
      activityLogRows = rows as any[];
    } catch {}

    const activities: ScheduleActivityItem[] = activityLogRows.map((r) => ({
      id: r.id,
      backupId: r.backup_id,
      backupName: r.backup_name,
      versionNumber: Number(r.version_number) || 1,
      action: r.action,
      modifiedBy: r.modified_by,
      modifiedAt: new Date(r.modified_at).toISOString(),
      summary: r.summary,
      divisionsCount: Number(r.divisions_count) || 0,
      teamsCount: Number(r.teams_count) || 0,
      gamesCount: Number(r.games_count) || 0,
      syncToken: r.sync_token,
    }));

    // 2. Query schedule_backups table to ensure any backups are represented
    const [backupRows] = await pool.query(
      `SELECT id, name, last_modified_by, last_modified_at, created_at, version_number, sync_token, data_json, LENGTH(data_json) as data_size
       FROM \`${tableName}\`
       ORDER BY last_modified_at DESC
       LIMIT ?`,
      [limit]
    );

    const existingSyncTokens = new Set(activities.map((a) => a.syncToken));

    for (const r of backupRows as any[]) {
      if (!existingSyncTokens.has(r.sync_token)) {
        let divCount = 0;
        let tmCount = 0;
        let gmCount = 0;
        try {
          const parsed = JSON.parse(r.data_json);
          divCount = parsed.divisions?.length || 0;
          tmCount = parsed.teams?.length || 0;
          gmCount = parsed.games?.length || 0;
        } catch {}

        activities.push({
          id: `mod_${r.id}_v${r.version_number}`,
          backupId: r.id,
          backupName: r.name,
          versionNumber: Number(r.version_number) || 1,
          action: (Number(r.version_number) || 1) > 1 ? `Updated Schedule (v${r.version_number})` : 'Created Schedule Backup',
          modifiedBy: r.last_modified_by || 'Admin',
          modifiedAt: new Date(r.last_modified_at).toISOString(),
          summary: `${divCount} divisions, ${tmCount} teams, ${gmCount} games`,
          divisionsCount: divCount,
          teamsCount: tmCount,
          gamesCount: gmCount,
          syncToken: r.sync_token,
          dataSize: Number(r.data_size) || 0,
        });
        existingSyncTokens.add(r.sync_token);
      }
    }

    activities.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return {
      isLiveMySql: true,
      activities: activities.slice(0, limit),
    };
  } catch (err: any) {
    console.error('Error fetching activity log from MySQL:', err);
    const fallbackActivities = readFallbackActivityStore();
    return {
      isLiveMySql: false,
      activities: fallbackActivities.slice(0, limit),
    };
  }
}
