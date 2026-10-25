import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { AppData, MySqlBackupMetadata, MySqlConfig } from '../types';

const FALLBACK_STORAGE_FILE = path.resolve(process.cwd(), 'league_backups_nosql.json');

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
async function getPool(): Promise<mysql.Pool | null> {
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
    return {
      isLiveMySql: true,
      message: `Connected to MySQL database "${activeConfig.database}" and verified table "${tableName}".`,
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
    const record = store[id] || null;
    let appData: AppData | null = null;
    if (record) {
      try {
        appData = JSON.parse(record.data_json);
      } catch {}
    }
    return { record, appData, isLiveMySql: false };
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number FROM \`${tableName}\` WHERE id = ? LIMIT 1`,
      [id]
    );
    const list = rows as any[];
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
    const record = store[id] || null;
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

  // 1. Fetch existing record to check concurrency
  const existing = await getBackup(id);

  if (existing.record && !forceOverwrite && checkSyncToken) {
    if (existing.record.sync_token !== checkSyncToken) {
      // CONFLICT DETECTED!
      return {
        success: false,
        conflict: true,
        remoteData: existing.appData || undefined,
        remoteSyncToken: existing.record.sync_token,
        remoteModifier: existing.record.last_modified_by,
        remoteModifiedAt: existing.record.last_modified_at,
        isLiveMySql: existing.isLiveMySql,
        message: `Concurrency conflict: Backup was modified by "${existing.record.last_modified_by}" at ${existing.record.last_modified_at}.`,
      };
    }
  }

  // Generate new unique syncToken
  const now = new Date();
  const nowIso = now.toISOString();
  const mysqlDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
  const newSyncToken = `mysql_sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const nextVersion = (existing.record?.version_number || 0) + 1;

  // Stamp sync token into AppData document
  const finalAppData: AppData = {
    ...appData,
    fileName: name.endsWith('.json') ? name : `${name}.json`,
    lastModified: nowIso,
    syncToken: newSyncToken,
    lastModifiedBy: modifiedBy,
    mysqlBackupSync: {
      backupId: id,
      backupName: name,
      syncToken: newSyncToken,
      lastModifiedAt: nowIso,
      lastModifiedBy: modifiedBy,
      lastSyncedAt: nowIso,
      versionNumber: nextVersion,
    },
  };

  const encodedJson = JSON.stringify(finalAppData);

  if (!pool) {
    // Save to fallback store
    const store = readFallbackStore();
    const record: BackupRecord = {
      id,
      name,
      data_json: encodedJson,
      sync_token: newSyncToken,
      last_modified_by: modifiedBy,
      last_modified_at: nowIso,
      created_at: existing.record?.created_at || nowIso,
      version_number: nextVersion,
    };
    store[id] = record;
    writeFallbackStore(store);

    return {
      success: true,
      isLiveMySql: false,
      updatedAppData: finalAppData,
      savedRecord: {
        id,
        name,
        syncToken: newSyncToken,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: nowIso,
        createdAt: record.created_at,
        versionNumber: nextVersion,
        dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
      },
      message: 'Saved backup using embedded NoSQL store (MySQL server not connected).',
    };
  }

  try {
    await initializeTable();

    const insertOrUpdateSql = `
      INSERT INTO \`${tableName}\` (id, name, data_json, sync_token, last_modified_by, last_modified_at, created_at, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        data_json = VALUES(data_json),
        sync_token = VALUES(sync_token),
        last_modified_by = VALUES(last_modified_by),
        last_modified_at = VALUES(last_modified_at),
        version_number = VALUES(version_number);
    `;

    await pool.query(insertOrUpdateSql, [
      id,
      name,
      encodedJson,
      newSyncToken,
      modifiedBy,
      mysqlDateTime,
      existing.record ? new Date(existing.record.created_at).toISOString().slice(0, 19).replace('T', ' ') : mysqlDateTime,
      nextVersion,
    ]);

    return {
      success: true,
      isLiveMySql: true,
      updatedAppData: finalAppData,
      savedRecord: {
        id,
        name,
        syncToken: newSyncToken,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: nowIso,
        createdAt: existing.record?.created_at || nowIso,
        versionNumber: nextVersion,
        dataSize: Buffer.byteLength(encodedJson, 'utf-8'),
      },
      message: `Successfully saved backup to MySQL NoSQL table "${tableName}".`,
    };
  } catch (err: any) {
    // Fallback save if query failed
    const store = readFallbackStore();
    store[id] = {
      id,
      name,
      data_json: encodedJson,
      sync_token: newSyncToken,
      last_modified_by: modifiedBy,
      last_modified_at: nowIso,
      created_at: existing.record?.created_at || nowIso,
      version_number: nextVersion,
    };
    writeFallbackStore(store);

    return {
      success: true,
      isLiveMySql: false,
      updatedAppData: finalAppData,
      message: `MySQL Error (${err.message}). Saved into embedded fallback storage.`,
    };
  }
}
