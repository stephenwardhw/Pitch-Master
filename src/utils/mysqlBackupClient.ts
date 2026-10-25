import { AppData, MySqlBackupMetadata, MySqlConfig } from '../types';

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

export async function fetchMySqlStatus(): Promise<{
  isLiveMySql: boolean;
  message: string;
  config: MySqlConfig;
}> {
  const res = await fetch('/api/mysql/status');
  if (!res.ok) {
    throw new Error(`Failed to check MySQL status (${res.status})`);
  }
  return await res.json();
}

export async function testMySqlConnection(testCfg?: Partial<MySqlConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch('/api/mysql/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCfg || {}),
  });
  return await res.json();
}

export async function updateMySqlConfigOnServer(config: Partial<MySqlConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch('/api/mysql/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return await res.json();
}

export async function listMySqlBackups(): Promise<{
  isLiveMySql: boolean;
  backups: MySqlBackupMetadata[];
}> {
  const res = await fetch('/api/mysql/backups');
  if (!res.ok) {
    throw new Error(`Failed to list backups (${res.status})`);
  }
  return await res.json();
}

export async function getMySqlBackup(id: string): Promise<{
  appData: AppData;
  metadata: MySqlBackupMetadata;
  isLiveMySql: boolean;
}> {
  const res = await fetch(`/api/mysql/backups/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch backup "${id}" (${res.status})`);
  }
  return await res.json();
}

export async function saveMySqlBackup(params: {
  id: string;
  name: string;
  appData: AppData;
  checkSyncToken?: string;
  modifiedBy?: string;
  forceOverwrite?: boolean;
}): Promise<MySqlSaveResult> {
  const res = await fetch('/api/mysql/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const body = await res.json();
  if (res.status === 409) {
    // Conflict detected by server optimistic locking
    return {
      success: false,
      conflict: true,
      remoteData: body.remoteData,
      remoteSyncToken: body.remoteSyncToken,
      remoteModifier: body.remoteModifier,
      remoteModifiedAt: body.remoteModifiedAt,
      isLiveMySql: body.isLiveMySql,
      message: body.message,
    };
  }

  if (!res.ok) {
    throw new Error(body.error || body.message || `Failed to save backup (${res.status})`);
  }

  return body;
}

/**
 * Checks if the backup has been updated on the server since our last sync
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
  } catch (err: any) {
    return { hasConflict: false };
  }
}
