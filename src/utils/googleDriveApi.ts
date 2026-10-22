import { AppData, GoogleDriveSyncInfo } from '../types';

export interface SharedDriveItem {
  id: string;
  name: string;
  colorRgb?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  headRevisionId?: string;
  driveId?: string;
  lastModifyingUser?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  };
  webViewLink?: string;
}

/**
 * Generate a unique token for tracking concurrent file revisions.
 */
export function generateSyncToken(userEmailOrName?: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const userTag = userEmailOrName ? `_${userEmailOrName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)}` : '';
  return `sync_${timestamp}_${rand}${userTag}`;
}

/**
 * Lists Shared Drives accessible to the user
 */
export async function listSharedDrives(accessToken: string): Promise<SharedDriveItem[]> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/drives?pageSize=50&fields=drives(id,name,colorRgb)',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Failed to fetch shared drives (${res.status})`);
    }

    const data = await res.json();
    return data.drives || [];
  } catch (err: any) {
    console.error('Error listing shared drives:', err);
    throw err;
  }
}

/**
 * Lists JSON schedule files in Google Drive or a specific Shared Drive
 */
export async function listDriveFiles(
  accessToken: string,
  options?: {
    driveId?: string; // If set, scopes to this Shared Drive
    searchQuery?: string;
  }
): Promise<DriveFileItem[]> {
  const { driveId, searchQuery } = options || {};

  let q = "(mimeType = 'application/json' or name contains '.json') and trashed = false";
  if (searchQuery && searchQuery.trim()) {
    const safeTerm = searchQuery.trim().replace(/['\\]/g, '');
    q += ` and name contains '${safeTerm}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: '50',
    fields: 'files(id,name,modifiedTime,size,headRevisionId,driveId,lastModifyingUser,webViewLink)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  if (driveId) {
    params.set('corpora', 'drive');
    params.set('driveId', driveId);
  } else {
    params.set('corpora', 'allDrives');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to list files from Google Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Retrieves file metadata from Google Drive
 */
export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileItem> {
  const params = new URLSearchParams({
    fields: 'id,name,modifiedTime,headRevisionId,size,driveId,lastModifyingUser,webViewLink',
    supportsAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to retrieve file metadata (${res.status})`);
  }

  return await res.json();
}

/**
 * Downloads and parses AppData JSON from Google Drive
 */
export async function getDriveFileContent(
  accessToken: string,
  fileId: string
): Promise<{ appData: AppData; metadata: DriveFileItem }> {
  // 1. Fetch metadata first to get modifiedTime & revision
  const metadata = await getDriveFileMetadata(accessToken, fileId);

  // 2. Fetch content
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to download file content (${res.status})`);
  }

  const rawJson = await res.json();

  // Validate minimum structure
  if (!rawJson || typeof rawJson !== 'object' || !Array.isArray(rawJson.games)) {
    throw new Error('Downloaded file does not match a valid PitchMaster soccer league schedule schema.');
  }

  // Stamp sync metadata onto AppData
  const syncToken = rawJson.syncToken || metadata.headRevisionId || `rev-${metadata.modifiedTime}`;
  const appDataWithSync: AppData = {
    ...rawJson,
    fileName: metadata.name,
    syncToken,
    googleDriveSync: {
      fileId: metadata.id,
      fileName: metadata.name,
      driveId: metadata.driveId,
      modifiedTime: metadata.modifiedTime,
      headRevisionId: metadata.headRevisionId,
      syncToken,
      lastSyncedAt: new Date().toISOString(),
      lastModifiedBy: metadata.lastModifyingUser?.displayName || metadata.lastModifyingUser?.emailAddress,
    },
  };

  return { appData: appDataWithSync, metadata };
}

/**
 * Saves a new JSON file to Google Drive or a Shared Drive
 */
export async function createDriveFile(
  accessToken: string,
  appData: AppData,
  fileName: string,
  options?: {
    driveId?: string;
    userName?: string;
  }
): Promise<{ appData: AppData; metadata: DriveFileItem }> {
  const { driveId, userName } = options || {};
  const cleanName = fileName.trim().endsWith('.json') ? fileName.trim() : `${fileName.trim()}.json`;

  const syncToken = generateSyncToken(userName);
  const nowIso = new Date().toISOString();

  const preparedData: AppData = {
    ...appData,
    fileName: cleanName,
    lastModified: nowIso,
    syncToken,
    lastModifiedBy: userName || 'Admin',
  };

  const fileMetadata: Record<string, any> = {
    name: cleanName,
    mimeType: 'application/json',
    description: 'PitchMaster Soccer League Schedule data file',
  };

  if (driveId) {
    fileMetadata.parents = [driveId];
  }

  const boundary = '-------pitchmaster_drive_boundary_' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(preparedData, null, 2) +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime,headRevisionId,size,driveId,lastModifyingUser,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to create file in Google Drive (${res.status})`);
  }

  const createdMeta: DriveFileItem = await res.json();

  const finalAppData: AppData = {
    ...preparedData,
    googleDriveSync: {
      fileId: createdMeta.id,
      fileName: createdMeta.name,
      driveId: createdMeta.driveId || driveId,
      modifiedTime: createdMeta.modifiedTime,
      headRevisionId: createdMeta.headRevisionId,
      syncToken,
      lastSyncedAt: nowIso,
      lastModifiedBy: userName || 'Admin',
    },
  };

  return { appData: finalAppData, metadata: createdMeta };
}

/**
 * Updates an existing file on Google Drive with new AppData content
 */
export async function updateDriveFile(
  accessToken: string,
  fileId: string,
  appData: AppData,
  options?: {
    userName?: string;
    newFileName?: string;
  }
): Promise<{ appData: AppData; metadata: DriveFileItem }> {
  const { userName, newFileName } = options || {};
  const syncToken = generateSyncToken(userName);
  const nowIso = new Date().toISOString();

  const targetFileName = (newFileName || appData.fileName || 'soccer_schedule.json').trim();
  const cleanName = targetFileName.endsWith('.json') ? targetFileName : `${targetFileName}.json`;

  const preparedData: AppData = {
    ...appData,
    fileName: cleanName,
    lastModified: nowIso,
    syncToken,
    lastModifiedBy: userName || appData.lastModifiedBy || 'Admin',
  };

  // 1. Update media content
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(preparedData, null, 2),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to save changes to Google Drive file (${res.status})`);
  }

  // 2. Fetch updated metadata (and update name if requested)
  let updatedMeta: DriveFileItem;
  if (newFileName && newFileName !== appData.fileName) {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,modifiedTime,headRevisionId,size,driveId,lastModifyingUser,webViewLink`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: cleanName }),
      }
    );
    updatedMeta = await metaRes.json();
  } else {
    updatedMeta = await getDriveFileMetadata(accessToken, fileId);
  }

  const finalAppData: AppData = {
    ...preparedData,
    googleDriveSync: {
      fileId: updatedMeta.id,
      fileName: updatedMeta.name,
      driveId: updatedMeta.driveId || appData.googleDriveSync?.driveId,
      modifiedTime: updatedMeta.modifiedTime,
      headRevisionId: updatedMeta.headRevisionId,
      syncToken,
      lastSyncedAt: nowIso,
      lastModifiedBy: userName || 'Admin',
    },
  };

  return { appData: finalAppData, metadata: updatedMeta };
}

/**
 * Checks if the remote file has been modified by another collaborator
 * since the last time it was fetched.
 */
export async function checkForRemoteConflict(
  accessToken: string,
  fileId: string,
  localSyncInfo: GoogleDriveSyncInfo
): Promise<{
  hasConflict: boolean;
  remoteMeta: DriveFileItem;
  remoteData?: AppData;
  remoteLastModifiedBy?: string;
  reason?: string;
}> {
  const remoteMeta = await getDriveFileMetadata(accessToken, fileId);

  // If timestamps or head revision IDs match exactly, no conflict
  if (
    remoteMeta.modifiedTime === localSyncInfo.modifiedTime &&
    (!remoteMeta.headRevisionId || remoteMeta.headRevisionId === localSyncInfo.headRevisionId)
  ) {
    return { hasConflict: false, remoteMeta };
  }

  // Remote metadata has changed. Fetch remote content to check syncToken
  try {
    const { appData: remoteData } = await getDriveFileContent(accessToken, fileId);

    // If syncToken matches local syncToken, it's our own save from another turn/window
    if (remoteData.syncToken && remoteData.syncToken === localSyncInfo.syncToken) {
      return { hasConflict: false, remoteMeta, remoteData };
    }

    const modifier =
      remoteData.lastModifiedBy ||
      remoteMeta.lastModifyingUser?.displayName ||
      remoteMeta.lastModifyingUser?.emailAddress ||
      'Another user';

    return {
      hasConflict: true,
      remoteMeta,
      remoteData,
      remoteLastModifiedBy: modifier,
      reason: `Modified by ${modifier} at ${new Date(remoteMeta.modifiedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };
  } catch (err: any) {
    console.warn('Could not inspect remote content during conflict check:', err);
    return {
      hasConflict: true,
      remoteMeta,
      reason: 'Remote file timestamp was updated on Google Drive.',
    };
  }
}
