import { AppData, MySqlBackupMetadata, MySqlConfig, ScheduleActivityItem } from '../types';
import { getStoredToken } from './authClient';

export interface MySqlSaveResult {
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
}

const LOCAL_STORAGE_CONFIG_KEY = 'pitchmaster_mysql_config';
const LOCAL_STORAGE_BACKUPS_KEY = 'pitchmaster_mysql_local_backups';

export function getSavedLocalConfig(): MySqlConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    host: 'localhost',
    port: 3306,
    user: 'root',
    database: 'pitchmaster',
    tableName: 'schedule_backups',
  };
}

export function saveLocalConfig(cfg?: Partial<MySqlConfig>) {
  try {
    const current = getSavedLocalConfig();
    if (!cfg) return current;
    const updated = { ...current, ...cfg };
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return (cfg as MySqlConfig) || getSavedLocalConfig();
  }
}

interface StoredBackupItem {
  id: string;
  name: string;
  data_json: string;
  sync_token: string;
  last_modified_by: string;
  last_modified_at: string;
  created_at: string;
  version_number: number;
}

function getStoredLocalBackups(): Record<string, StoredBackupItem> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUPS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

function saveStoredLocalBackups(items: Record<string, StoredBackupItem>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUPS_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Robust fetch wrapper that guarantees no unhandled HTML JSON.parse crashes
 */
async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  isHtml: boolean;
  error?: string;
}> {
  try {
    const token = getStoredToken();
    const headers = new Headers(options?.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const isHtml =
      contentType.includes('text/html') ||
      rawText.trim().startsWith('<!DOCTYPE') ||
      rawText.trim().startsWith('<html') ||
      rawText.trim().startsWith('<head');

    if (isHtml) {
      return {
        ok: false,
        status: res.status,
        isHtml: true,
        error: `Server endpoint "${url}" returned HTML (index.html) instead of API JSON. The backend Node server may not be running on port 3000, or your web server (Apache/Nginx) requires a reverse proxy rule for /api.`,
      };
    }

    try {
      const data = JSON.parse(rawText || '{}');
      return {
        ok: res.ok,
        status: res.status,
        data,
        isHtml: false,
        error: !res.ok ? data.error || data.message || `HTTP ${res.status}` : undefined,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        isHtml: false,
        error: `Server response was not valid JSON (${rawText.slice(0, 100)})`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      isHtml: false,
      error: err.message || 'Network connection failed',
    };
  }
}

/**
 * 1. Fetch MySQL Status
 */
export async function fetchMySqlStatus(): Promise<{
  isLiveMySql: boolean;
  message: string;
  config: MySqlConfig;
}> {
  const result = await safeFetchJson<{
    isLiveMySql: boolean;
    message: string;
    config: MySqlConfig;
  }>('/api/mysql/status');

  if (result.ok && result.data) {
    const safeConfig = result.data.config || getSavedLocalConfig();
    saveLocalConfig(safeConfig);
    return {
      ...result.data,
      config: safeConfig,
    };
  }

  const localCfg = getSavedLocalConfig();
  if (result.isHtml) {
    return {
      isLiveMySql: false,
      message:
        'Client-only web server mode active (API returned HTML). Local browser backup storage active.',
      config: localCfg,
    };
  }

  return {
    isLiveMySql: false,
    message: result.error || 'Backend service unreachable. Using local storage.',
    config: localCfg,
  };
}

/**
 * 2. Test Connection
 */
export async function testMySqlConnection(testCfg?: Partial<MySqlConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  if (testCfg) {
    saveLocalConfig(testCfg);
  }

  const result = await safeFetchJson<{ success: boolean; message: string }>(
    '/api/mysql/test-connection',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCfg || {}),
    }
  );

  if (result.ok && result.data) {
    return result.data;
  }

  if (result.isHtml) {
    return {
      success: false,
      message:
        'The /api/mysql endpoint returned HTML (index.html). If running in production with Apache or Nginx, enable ProxyPass for /api to your Node server (e.g., http://localhost:3000/api).',
    };
  }

  return {
    success: false,
    message: result.error || 'Failed to connect to MySQL backend.',
  };
}

/**
 * 3. Update Configuration on Server (with local fallback)
 */
export async function updateMySqlConfigOnServer(config: Partial<MySqlConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  const updatedLocal = saveLocalConfig(config);

  const result = await safeFetchJson<{ success: boolean; message: string; config?: MySqlConfig }>(
    '/api/mysql/config',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }
  );

  if (result.ok && result.data) {
    return result.data;
  }

  if (result.isHtml) {
    return {
      success: true,
      message:
        'Configuration saved in browser storage. Note: Backend API is returning HTML (ensure Node server is running on port 3000 and proxied via Apache/Nginx).',
    };
  }

  return {
    success: true,
    message: `Configuration saved to local browser storage (${updatedLocal.host}:${updatedLocal.port}/${updatedLocal.database}). Backend message: ${result.error || 'Offline'}`,
  };
}

/**
 * 4. Fetch the Most Recent Schedule from MySQL Server (Authoritative Source)
 */
export async function fetchLatestMySqlSchedule(): Promise<{
  exists: boolean;
  appData?: AppData;
  metadata?: MySqlBackupMetadata;
  isLiveMySql: boolean;
  message?: string;
}> {
  const result = await safeFetchJson<{
    exists: boolean;
    appData?: AppData;
    metadata?: MySqlBackupMetadata;
    isLiveMySql: boolean;
    message?: string;
  }>('/api/mysql/latest');

  if (result.ok && result.data) {
    return result.data;
  }

  // Fallback to local stored backups if MySQL backend is unreachable
  const localStore = getStoredLocalBackups();
  const records = Object.values(localStore);
  if (records.length > 0) {
    records.sort(
      (a, b) => new Date(b.last_modified_at).getTime() - new Date(a.last_modified_at).getTime()
    );
    const top = records[0];
    try {
      const appData = JSON.parse(top.data_json);
      return {
        exists: true,
        appData,
        metadata: {
          id: top.id,
          name: top.name,
          syncToken: top.sync_token,
          lastModifiedBy: top.last_modified_by,
          lastModifiedAt: top.last_modified_at,
          createdAt: top.created_at,
          versionNumber: top.version_number,
        },
        isLiveMySql: false,
      };
    } catch {}
  }

  return {
    exists: false,
    isLiveMySql: false,
    message: result.error || 'No backups found on MySQL server.',
  };
}

/**
 * 5. List All Backups
 */
export async function listMySqlBackups(): Promise<{
  isLiveMySql: boolean;
  backups: MySqlBackupMetadata[];
}> {
  const result = await safeFetchJson<{
    isLiveMySql: boolean;
    backups: MySqlBackupMetadata[];
  }>('/api/mysql/backups');

  if (result.ok && result.data) {
    return result.data;
  }

  // Fallback to locally stored backups
  const localStore = getStoredLocalBackups();
  const backups: MySqlBackupMetadata[] = Object.values(localStore).map((item) => ({
    id: item.id,
    name: item.name,
    syncToken: item.sync_token,
    lastModifiedBy: item.last_modified_by,
    lastModifiedAt: item.last_modified_at,
    createdAt: item.created_at,
    versionNumber: item.version_number,
  }));

  backups.sort(
    (a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
  );

  return {
    isLiveMySql: false,
    backups,
  };
}

/**
 * 5. Retrieve Specific Backup by ID
 */
export async function getMySqlBackup(id: string): Promise<{
  appData: AppData;
  metadata: MySqlBackupMetadata;
  isLiveMySql: boolean;
}> {
  const result = await safeFetchJson<{
    appData: AppData;
    metadata: MySqlBackupMetadata;
    isLiveMySql: boolean;
  }>(`/api/mysql/backups/${encodeURIComponent(id)}`);

  if (result.ok && result.data) {
    return result.data;
  }

  // Fallback to local storage
  const localStore = getStoredLocalBackups();
  const item = localStore[id];
  if (item) {
    try {
      const appData = JSON.parse(item.data_json);
      return {
        appData,
        metadata: {
          id: item.id,
          name: item.name,
          syncToken: item.sync_token,
          lastModifiedBy: item.last_modified_by,
          lastModifiedAt: item.last_modified_at,
          createdAt: item.created_at,
          versionNumber: item.version_number,
        },
        isLiveMySql: false,
      };
    } catch {}
  }

  throw new Error(result.error || `Backup "${id}" not found.`);
}

/**
 * 6. Save Backup with Optimistic Concurrency
 */
export async function saveMySqlBackup(params: {
  id: string;
  name: string;
  appData: AppData;
  checkSyncToken?: string;
  modifiedBy?: string;
  forceOverwrite?: boolean;
}): Promise<MySqlSaveResult> {
  const result = await safeFetchJson<any>('/api/mysql/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (result.status === 409 && result.data) {
    // Conflict detected by server optimistic locking
    return {
      success: false,
      conflict: true,
      remoteData: result.data.remoteData,
      remoteSyncToken: result.data.remoteSyncToken,
      remoteModifier: result.data.remoteModifier,
      remoteModifiedAt: result.data.remoteModifiedAt,
      isLiveMySql: result.data.isLiveMySql,
      message: result.data.message,
    };
  }

  if (result.ok && result.data) {
    return result.data;
  }

  // Fallback to local browser store with optimistic locking
  const localStore = getStoredLocalBackups();
  const existing = localStore[params.id];
  const now = new Date().toISOString();
  const modifier = params.modifiedBy || 'League Admin';

  if (existing && !params.forceOverwrite && params.checkSyncToken) {
    if (existing.sync_token !== params.checkSyncToken) {
      let remoteData: AppData = params.appData;
      try {
        remoteData = JSON.parse(existing.data_json);
      } catch {}

      return {
        success: false,
        conflict: true,
        remoteData,
        remoteSyncToken: existing.sync_token,
        remoteModifier: existing.last_modified_by,
        remoteModifiedAt: existing.last_modified_at,
        isLiveMySql: false,
        message: `Conflict detected: Document was modified by ${existing.last_modified_by} at ${new Date(existing.last_modified_at).toLocaleTimeString()}`,
      };
    }
  }

  const newSyncToken = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const nextVersion = existing ? (existing.version_number || 1) + 1 : 1;

  const updatedAppData: AppData = {
    ...params.appData,
    lastModifiedBy: modifier,
    lastModified: now,
    mysqlBackupSync: {
      backupId: params.id,
      backupName: params.name,
      syncToken: newSyncToken,
      lastModifiedAt: now,
      lastSyncedAt: now,
      versionNumber: nextVersion,
      lastModifiedBy: modifier,
    },
  };

  const storedItem: StoredBackupItem = {
    id: params.id,
    name: params.name,
    data_json: JSON.stringify(updatedAppData),
    sync_token: newSyncToken,
    last_modified_by: modifier,
    last_modified_at: now,
    created_at: existing ? existing.created_at : now,
    version_number: nextVersion,
  };

  localStore[params.id] = storedItem;
  saveStoredLocalBackups(localStore);

  return {
    success: true,
    savedRecord: {
      id: storedItem.id,
      name: storedItem.name,
      syncToken: storedItem.sync_token,
      lastModifiedBy: storedItem.last_modified_by,
      lastModifiedAt: storedItem.last_modified_at,
      createdAt: storedItem.created_at,
      versionNumber: storedItem.version_number,
    },
    updatedAppData,
    isLiveMySql: false,
    message: result.isHtml
      ? 'Backup saved to local storage (Backend API returned HTML). Node server may need reverse proxy.'
      : 'Backup saved successfully to local document store.',
  };
}

/**
 * 7. Check for remote conflict
 */
export async function checkForMySqlConflict(
  backupId: string,
  localSyncToken?: string
): Promise<{
  hasConflict: boolean;
  remoteRecord?: MySqlBackupMetadata;
  remoteData?: AppData;
  reason?: string;
}> {
  if (!localSyncToken) return { hasConflict: false };

  try {
    const result = await getMySqlBackup(backupId);
    if (result.metadata.syncToken && result.metadata.syncToken !== localSyncToken) {
      return {
        hasConflict: true,
        remoteRecord: result.metadata,
        remoteData: result.appData,
        reason: `Modified by ${result.metadata.lastModifiedBy} at ${new Date(result.metadata.lastModifiedAt).toLocaleTimeString()}`,
      };
    }
    return { hasConflict: false, remoteRecord: result.metadata };
  } catch {
    return { hasConflict: false };
  }
}

/**
 * 8. Fetch Schedule Activity Log (last 10 modifications)
 */
export async function fetchScheduleActivityLog(limit: number = 10): Promise<{
  isLiveMySql: boolean;
  activities: ScheduleActivityItem[];
}> {
  const result = await safeFetchJson<{
    isLiveMySql: boolean;
    activities: ScheduleActivityItem[];
  }>(`/api/mysql/activity-log?limit=${limit}`);

  if (result.ok && result.data && Array.isArray(result.data.activities)) {
    return result.data;
  }

  // Fallback to local storage
  const localStore = getStoredLocalBackups();
  const activities: ScheduleActivityItem[] = Object.values(localStore).map((item) => {
    let divisionsCount = 0;
    let teamsCount = 0;
    let gamesCount = 0;
    try {
      const parsed = JSON.parse(item.data_json);
      divisionsCount = parsed.divisions?.length || 0;
      teamsCount = parsed.teams?.length || 0;
      gamesCount = parsed.games?.length || 0;
    } catch {}

    return {
      id: `local_${item.id}_${item.version_number}`,
      backupId: item.id,
      backupName: item.name,
      versionNumber: item.version_number,
      action: item.version_number > 1 ? `Updated Schedule (v${item.version_number})` : 'Created Schedule Backup',
      modifiedBy: item.last_modified_by || 'Admin',
      modifiedAt: item.last_modified_at || item.created_at,
      summary: `${divisionsCount} divisions, ${teamsCount} teams, ${gamesCount} games`,
      divisionsCount,
      teamsCount,
      gamesCount,
      syncToken: item.sync_token,
      dataSize: item.data_json ? item.data_json.length : 0,
    };
  });

  activities.sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  return {
    isLiveMySql: false,
    activities: activities.slice(0, limit),
  };
}
