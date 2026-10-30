import React, { useState, useEffect, useCallback } from 'react';
import { AppData, MySqlBackupMetadata, MySqlConfig } from '../../types';
import {
  fetchMySqlStatus,
  testMySqlConnection,
  updateMySqlConfigOnServer,
  listMySqlBackups,
  getMySqlBackup,
  saveMySqlBackup,
  checkForMySqlConflict,
  MySqlSaveResult,
} from '../../utils/mysqlBackupClient';
import { ConflictMergeModal } from './ConflictMergeModal';
import { AdminUser, isViewerRole } from '../../utils/authClient';
import {
  Database,
  X,
  RefreshCw,
  Save,
  Plus,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  FileJson,
  ShieldCheck,
  Clock,
  User as UserIcon,
  Settings,
  ArrowRight,
  FolderOpen,
  Unlink,
  Check,
  Server,
  Layers,
  Sparkles,
  BookOpen,
  Copy,
  Code,
  Terminal,
  History,
} from 'lucide-react';

interface MySqlBackupModalProps {
  appData: AppData;
  onUpdateAppData: (newData: AppData) => void;
  onClose: () => void;
  onOpenActivityLog?: () => void;
  adminUser?: AdminUser | null;
  isReadOnly?: boolean;
}

export const MySqlBackupModal: React.FC<MySqlBackupModalProps> = ({
  appData,
  onUpdateAppData,
  onClose,
  onOpenActivityLog,
  adminUser,
  isReadOnly,
}) => {
  const isViewer = isReadOnly ?? isViewerRole(adminUser);
  // MySQL Status
  const [isLiveMySql, setIsLiveMySql] = useState(false);
  const [statusText, setStatusText] = useState('Connecting to MySQL service...');
  const [config, setConfig] = useState<MySqlConfig>({
    host: 'localhost',
    port: 3306,
    user: 'root',
    database: 'pitchmaster',
    tableName: 'schedule_backups',
  });

  // Navigation Tab: 'backups' or 'guide'
  const [activeTab, setActiveTab] = useState<'backups' | 'guide'>('backups');
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Settings Panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<MySqlConfig>(config);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connTestResult, setConnTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const copyEnvToClipboard = () => {
    const text = `# MySQL NoSQL Document Backup Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here
MYSQL_DATABASE=pitchmaster
MYSQL_TABLE=schedule_backups`;
    navigator.clipboard.writeText(text);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const copySqlToClipboard = () => {
    const text = `-- Step 1: Create Database
CREATE DATABASE IF NOT EXISTS \`pitchmaster\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE \`pitchmaster\`;

-- Step 2: Create NoSQL Document Table for JSON Payloads
CREATE TABLE IF NOT EXISTS \`schedule_backups\` (
  \`id\` VARCHAR(128) NOT NULL,
  \`name\` VARCHAR(255) NOT NULL,
  \`data_json\` LONGTEXT NOT NULL COMMENT 'JSON-encoded complete AppData payload',
  \`sync_token\` VARCHAR(128) NOT NULL COMMENT 'Optimistic concurrency revision token',
  \`last_modified_by\` VARCHAR(255) NOT NULL,
  \`last_modified_at\` DATETIME NOT NULL,
  \`created_at\` DATETIME NOT NULL,
  \`version_number\` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  INDEX \`idx_last_modified_at\` (\`last_modified_at\`),
  INDEX \`idx_sync_token\` (\`sync_token\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create Admin Users Table for MySQL Authentication
CREATE TABLE IF NOT EXISTS \`admin_users\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`username\` VARCHAR(64) NOT NULL UNIQUE,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`display_name\` VARCHAR(128) NOT NULL,
  \`role\` VARCHAR(32) NOT NULL DEFAULT 'admin',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`last_login_at\` DATETIME NULL,
  INDEX \`idx_username\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Seed Initial Administrator (Default: admin / pitchmaster)
INSERT INTO \`admin_users\` (\`username\`, \`password_hash\`, \`display_name\`, \`role\`)
VALUES ('admin', SHA2('pitchmaster', 256), 'League Administrator', 'superadmin')
ON DUPLICATE KEY UPDATE \`display_name\` = VALUES(\`display_name\`);`;
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Backups list state
  const [backups, setBackups] = useState<MySqlBackupMetadata[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Backup form state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newBackupName, setNewBackupName] = useState(appData.fileName ? appData.fileName.replace(/\.json$/i, '') : 'main_schedule');
  const [editorName, setEditorName] = useState(appData.lastModifiedBy || 'League Admin');

  // Messages and notifications
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // Concurrency Conflict state
  const [activeConflict, setActiveConflict] = useState<{
    remoteData: AppData;
    remoteModifier?: string;
    remoteModifiedTime?: string;
  } | null>(null);

  // Confirmation dialog for loading / overwriting
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const linkedSync = appData.mysqlBackupSync;

  // Load Status and Backups on mount
  const refreshBackupsList = useCallback(async () => {
    setIsLoadingBackups(true);
    try {
      const res = await listBackupsApi();
      setBackups(res.backups);
      setIsLiveMySql(res.isLiveMySql);
    } catch (err: any) {
      console.error('Failed to list backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  }, []);

  const checkStatusAndLoad = useCallback(async () => {
    try {
      const status = await fetchMySqlStatus();
      setIsLiveMySql(status.isLiveMySql);
      setStatusText(status.message);
      setConfig(status.config);
      setTempConfig(status.config);
      await refreshBackupsList();
    } catch (err: any) {
      setIsLiveMySql(false);
      setStatusText('Using local NoSQL fallback store.');
      await refreshBackupsList();
    }
  }, [refreshBackupsList]);

  const listBackupsApi = useCallback(async () => {
    return await listMySqlBackups();
  }, []);

  useEffect(() => {
    checkStatusAndLoad();
  }, [checkStatusAndLoad]);

  // Test Connection
  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnTestResult(null);
    try {
      const result = await testMySqlConnection(tempConfig);
      setConnTestResult(result);
    } catch (err: any) {
      setConnTestResult({
        success: false,
        message: err.message || 'Connection failed',
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  // Save Settings
  const handleSaveConfig = async () => {
    setIsTestingConn(true);
    try {
      const res = await updateMySqlConfigOnServer(tempConfig);
      setConfig(tempConfig);
      setIsSettingsOpen(false);
      setStatusMessage({
        text: res.message,
        type: res.success ? 'success' : 'warning',
      });
      await checkStatusAndLoad();
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to update configuration: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  // -------------------------------------------------------------
  // SAVE CURRENT LINKED SCHEDULE REVISION (WITH CONFLICT DETECTION)
  // -------------------------------------------------------------
  const handleSaveToMySql = async (forceOverwrite = false) => {
    // If schedule is already linked, update that specific backup ID
    const backupId = linkedSync
      ? linkedSync.backupId
      : newBackupName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const backupName = linkedSync ? linkedSync.backupName : newBackupName.trim();

    if (!backupId || !backupName) {
      setStatusMessage({ text: 'Please specify a valid backup name.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMessage({ text: 'Verifying concurrent edits in MySQL...', type: 'info' });

    try {
      const saveResult: MySqlSaveResult = await saveMySqlBackup({
        id: backupId,
        name: backupName,
        appData,
        checkSyncToken: forceOverwrite ? undefined : linkedSync?.syncToken,
        modifiedBy: editorName.trim() || 'League Admin',
        forceOverwrite,
      });

      if (saveResult.conflict && saveResult.remoteData) {
        setIsSaving(false);
        setActiveConflict({
          remoteData: saveResult.remoteData,
          remoteModifier: saveResult.remoteModifier,
          remoteModifiedTime: saveResult.remoteModifiedAt,
        });
        return;
      }

      if (saveResult.success && saveResult.updatedAppData) {
        onUpdateAppData(saveResult.updatedAppData);
        setIsCreatingNew(false);
        const revToken = saveResult.savedRecord?.syncToken || saveResult.updatedAppData?.mysqlBackupSync?.syncToken || '';
        setStatusMessage({
          text: saveResult.message || `Successfully updated backup "${backupName}" ${revToken ? `(Rev: ${revToken.substring(0, 10)}...)` : ''} in MySQL!`,
          type: 'success',
        });
        await refreshBackupsList();
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error saving backup: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // CREATE A BRAND NEW BACKUP ENTRY IN MYSQL (NEVER OVERWRITE)
  // -------------------------------------------------------------
  const handleSaveNewBackup = async () => {
    const backupName = newBackupName.trim();
    if (!backupName) {
      setStatusMessage({ text: 'Please specify a title for the new backup.', type: 'error' });
      return;
    }

    // Clean slug for ID
    let baseSlug = backupName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!baseSlug) baseSlug = 'backup';

    // If an existing record already has this exact ID, append a timestamp suffix to ensure a brand-new entry
    const idExists = backups.some((b) => b.id.toLowerCase() === baseSlug.toLowerCase());
    const finalBackupId = idExists ? `${baseSlug}_${Date.now()}` : baseSlug;

    setIsSaving(true);
    setStatusMessage({ text: `Creating new backup entry "${backupName}" in MySQL...`, type: 'info' });

    try {
      const saveResult: MySqlSaveResult = await saveMySqlBackup({
        id: finalBackupId,
        name: backupName,
        appData: {
          ...appData,
          // Clear old sync info so it saves cleanly as brand-new root
          mysqlBackupSync: undefined,
        },
        checkSyncToken: undefined, // New document: no check on old token!
        modifiedBy: editorName.trim() || 'League Admin',
        forceOverwrite: true,
      });

      if (saveResult.success && saveResult.updatedAppData) {
        onUpdateAppData(saveResult.updatedAppData);
        setIsCreatingNew(false);
        setStatusMessage({
          text: `Created new backup entry "${backupName}" (ID: ${finalBackupId}) in MySQL!`,
          type: 'success',
        });
        await refreshBackupsList();
      } else {
        setStatusMessage({
          text: saveResult.message || 'Failed to create new backup record.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error creating backup: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // CHECK FOR CONCURRENT UPDATES IN MYSQL
  // -------------------------------------------------------------
  const handleCheckUpdates = async () => {
    if (!linkedSync) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const conflictCheck = await checkForMySqlConflict(linkedSync.backupId, linkedSync.syncToken);

      if (conflictCheck.hasConflict && conflictCheck.remoteData) {
        setActiveConflict({
          remoteData: conflictCheck.remoteData,
          remoteModifier: conflictCheck.remoteRecord?.lastModifiedBy,
          remoteModifiedTime: conflictCheck.remoteRecord?.lastModifiedAt,
        });
      } else {
        setStatusMessage({
          text: `Your schedule is up to date with MySQL. No concurrent modifications found.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to check for remote updates: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // LOAD BACKUP FROM MYSQL
  // -------------------------------------------------------------
  const handleLoadBackup = (b: MySqlBackupMetadata) => {
    setPendingConfirm({
      title: `Load Backup "${b.name}"?`,
      description: `This will retrieve the JSON document from the MySQL database and replace your current working schedule. Any unsaved modifications in this session will be overwritten.`,
      confirmText: 'Load Backup',
      onConfirm: async () => {
        setIsSaving(true);
        setStatusMessage(null);
        try {
          const res = await getMySqlBackup(b.id);
          onUpdateAppData(res.appData);
          setStatusMessage({
            text: `Successfully loaded backup "${b.name}" (Revision: ${b.syncToken}) from MySQL!`,
            type: 'success',
          });
        } catch (err: any) {
          setStatusMessage({
            text: `Failed to load backup: ${err.message}`,
            type: 'error',
          });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  // -------------------------------------------------------------
  // UNLINK BACKUP
  // -------------------------------------------------------------
  const handleUnlink = () => {
    const unlinked: AppData = {
      ...appData,
      mysqlBackupSync: undefined,
    };
    onUpdateAppData(unlinked);
    setStatusMessage({
      text: 'Unlinked from MySQL backup document. Working copy remains saved in browser storage.',
      type: 'info',
    });
  };

  // -------------------------------------------------------------
  // CONFLICT RESOLUTION
  // -------------------------------------------------------------
  const handleApplyMerge = async (
    mergedData: AppData,
    strategy: 'smart' | 'overwrite_remote' | 'accept_remote'
  ) => {
    if (!linkedSync) return;
    setActiveConflict(null);
    setIsSaving(true);

    try {
      if (strategy === 'accept_remote') {
        onUpdateAppData(mergedData);
        setStatusMessage({
          text: 'Loaded the latest version from MySQL successfully.',
          type: 'success',
        });
      } else {
        // Smart merge or force overwrite
        const saveResult = await saveMySqlBackup({
          id: linkedSync.backupId,
          name: linkedSync.backupName,
          appData: mergedData,
          modifiedBy: editorName.trim() || 'League Admin',
          forceOverwrite: true,
        });

        if (saveResult.success && saveResult.updatedAppData) {
          onUpdateAppData(saveResult.updatedAppData);
          setStatusMessage({
            text:
              strategy === 'smart'
                ? 'Smart merge applied! Unified changes successfully stored to MySQL.'
                : 'Remote MySQL document successfully overwritten with your changes.',
            type: 'success',
          });
          await refreshBackupsList();
        }
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to save merge into MySQL: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  MySQL NoSQL Schedule Backup & Recovery
                </h3>
                <p className="text-[11px] text-slate-500">
                  JSON-encoded document storage with optimistic locking and multi-user conflict detection
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center px-6 border-b border-slate-200 bg-slate-50/60 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('backups')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'backups'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Backups & Storage</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'guide'
                  ? 'border-indigo-600 text-indigo-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Setup Guide & SQL Schema</span>
            </button>

            {onOpenActivityLog && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenActivityLog();
                }}
                className="ml-auto py-1 px-2.5 my-auto text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="View last 10 modifications to the schedule"
              >
                <History className="w-3.5 h-3.5 text-indigo-600" />
                <span>Activity Log</span>
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
            {/* Viewer Read-Only Banner */}
            {isViewer && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between text-xs shadow-2xs">
                <span className="font-medium">
                  <strong>Read-Only Mode:</strong> Your account has Viewer access. You can view backups, version metadata, and SQL schema. Creating backups, saving, or restoring snapshots requires Scheduler role or above.
                </span>
              </div>
            )}

            {/* Status Message Alert */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs animate-in fade-in ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : statusMessage.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <span>{statusMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ACTIVE TAB: BACKUPS & STORAGE */}
            {activeTab === 'backups' ? (
              <>
                {/* SECTION 1: CONNECTION STATUS BAR */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${isLiveMySql ? 'bg-emerald-500' : 'bg-amber-500'} shrink-0`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {isLiveMySql ? 'MySQL Live Database Connected' : 'Embedded NoSQL Backup Store Active'}
                    </span>
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-semibold ${isLiveMySql ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {isLiveMySql ? 'Live MySQL' : 'NoSQL Fallback'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Host: <code className="font-mono">{config.host}:{config.port}</code> · Database: <code className="font-mono">{config.database}</code> · Table: <code className="font-mono">{config.tableName || 'schedule_backups'}</code>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configure DB</span>
                </button>
              </div>
            </div>

            {/* EXPANDABLE MYSQL CONFIGURATION PANEL */}
            {isSettingsOpen && (
              <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-indigo-600" />
                    <span>MySQL Connection Settings</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Set environment variables or edit below
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Host</label>
                    <input
                      type="text"
                      value={tempConfig.host}
                      onChange={(e) => setTempConfig({ ...tempConfig, host: e.target.value })}
                      placeholder="localhost or 127.0.0.1"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={tempConfig.port}
                      onChange={(e) => setTempConfig({ ...tempConfig, port: Number(e.target.value) || 3306 })}
                      placeholder="3306"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Database Name</label>
                    <input
                      type="text"
                      value={tempConfig.database}
                      onChange={(e) => setTempConfig({ ...tempConfig, database: e.target.value })}
                      placeholder="pitchmaster"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Table Name</label>
                    <input
                      type="text"
                      value={tempConfig.tableName || 'schedule_backups'}
                      onChange={(e) => setTempConfig({ ...tempConfig, tableName: e.target.value })}
                      placeholder="schedule_backups"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={tempConfig.user}
                      onChange={(e) => setTempConfig({ ...tempConfig, user: e.target.value })}
                      placeholder="root"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={tempConfig.password || ''}
                      onChange={(e) => setTempConfig({ ...tempConfig, password: e.target.value })}
                      placeholder="Optional"
                      className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                {connTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      connTestResult.success
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {connTestResult.message}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConn}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors disabled:opacity-60"
                  >
                    {isTestingConn ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={isTestingConn}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-60"
                  >
                    Save & Reconnect
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 2: CURRENTLY LINKED BACKUP DOCUMENT */}
            {linkedSync && (
              <div className="p-4 border-2 border-indigo-500/30 bg-indigo-50/40 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <FileJson className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">
                          {linkedSync.backupName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono">
                          ID: {linkedSync.backupId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Version: {linkedSync.versionNumber ? `v${linkedSync.versionNumber}` : 'v1'} · Last editor: {linkedSync.lastModifiedBy}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckUpdates}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs disabled:opacity-60"
                      title="Check if another administrator modified this document"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSaving ? 'animate-spin' : ''}`} />
                      <span>Check Updates</span>
                    </button>

                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => handleSaveToMySql(false)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-60"
                        title="Update MySQL record with your changes"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save to MySQL</span>
                      </button>
                    )}

                    {!isViewer && (
                      <button
                        type="button"
                        onClick={handleUnlink}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Unlink backup connection"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata & Token Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-indigo-200/60 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Last Synced:</span>
                    <span className="font-mono">
                      {new Date(linkedSync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Concurrency Token:</span>
                    <span className="font-mono truncate block" title={linkedSync.syncToken}>
                      {linkedSync.syncToken.substring(0, 18)}...
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Storage Mode:</span>
                    <span>JSON encoded in <code className="font-mono">data_json</code></span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: SAVE AS NEW BACKUP RECORD */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Backup Documents in MySQL NoSQL Store
                </span>

                <div className="flex items-center gap-2">
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(!isCreatingNew)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Create New Backup</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={refreshBackupsList}
                    disabled={isLoadingBackups}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Refresh list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {isCreatingNew && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3 animate-in fade-in">
                  <span className="font-bold text-slate-900 text-xs block">
                    Save Schedule as New MySQL NoSQL Backup
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Backup Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Spring 2026 Season"
                        value={newBackupName}
                        onChange={(e) => setNewBackupName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Your Name / Modifier ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Stephen Ward"
                        value={editorName}
                        onChange={(e) => setEditorName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveNewBackup()}
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-60"
                    >
                      {isSaving ? 'Creating...' : 'Create & Link New Backup'}
                    </button>
                  </div>
                </div>
              )}

              {/* Backups List Table */}
              {isLoadingBackups ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                  <p>Querying MySQL database for stored backups...</p>
                </div>
              ) : backups.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <Database className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="text-slate-500 text-xs">No backups stored in MySQL yet.</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create first backup now</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2">Backup Document</th>
                        <th className="px-3.5 py-2">Modified</th>
                        <th className="px-3.5 py-2">Editor</th>
                        <th className="px-3.5 py-2">Version</th>
                        <th className="px-3.5 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {backups.map((b) => {
                        const isCurrent = linkedSync?.backupId === b.id;
                        const formattedTime = new Date(b.lastModifiedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3.5 py-2.5 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                                <div>
                                  <span className="font-semibold block">{b.name}</span>
                                  <span className="font-mono text-[10px] text-slate-400">ID: {b.id}</span>
                                </div>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-full ml-1">
                                    Current
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">
                              {formattedTime}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-500 text-[11px] truncate max-w-[120px]">
                              {b.lastModifiedBy}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px]">
                              v{b.versionNumber}
                            </td>
                            <td className="px-3.5 py-2.5 text-right space-x-1.5">
                              {!isViewer ? (
                                <button
                                  type="button"
                                  onClick={() => handleLoadBackup(b)}
                                  disabled={isSaving}
                                  className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-semibold transition-colors disabled:opacity-60"
                                  title="Load this backup document into PitchMaster"
                                >
                                  Load
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Snapshot</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ACTIVE TAB: SETUP GUIDE & SQL SCHEMA */
          <div className="space-y-6 animate-in fade-in">
            {/* Overview Banner */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-xs">
                    NoSQL JSON Document Architecture in MySQL
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Document Store
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  PitchMaster stores full league schedules as serialized JSON documents inside MySQL's <code className="font-mono text-indigo-900 font-bold">data_json LONGTEXT</code> column.
                  This provides NoSQL-like flexibility for complex nested scheduling data (teams, divisions, game slots, referee certifications, constraints) while maintaining relational ACID durability and multi-user conflict detection via optimistic revision tokens (<code className="font-mono text-indigo-900 font-bold">sync_token</code>).
                </p>
              </div>
            </div>

            {/* SECTION 1: ENVIRONMENT VARIABLES */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-xs">
                    1. Environment Variables Configuration (<code className="text-slate-700">.env</code>)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={copyEnvToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                >
                  {copiedEnv ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied .env!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy .env Template</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Add the following variables to your project's <code className="font-mono font-semibold text-slate-800">.env</code> file or runtime server environment:
                </p>

                <div className="relative group">
                  <pre className="p-3.5 bg-slate-900 text-indigo-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`# MySQL Connection for NoSQL Schedule Backups
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=pitchmaster
MYSQL_TABLE=schedule_backups`}
                  </pre>
                </div>

                {/* Variable Breakdown Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Variable</th>
                        <th className="py-2 px-3">Default</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_HOST</td>
                        <td className="py-2 px-3 font-mono">localhost</td>
                        <td className="py-2 px-3">Hostname or IP address of the MySQL server.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_PORT</td>
                        <td className="py-2 px-3 font-mono">3306</td>
                        <td className="py-2 px-3">Port on which MySQL is listening (default: 3306).</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_USER</td>
                        <td className="py-2 px-3 font-mono">root</td>
                        <td className="py-2 px-3">Database user with permissions on target database.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_PASSWORD</td>
                        <td className="py-2 px-3 font-mono">"" (empty)</td>
                        <td className="py-2 px-3">Password for the specified MySQL user.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_DATABASE</td>
                        <td className="py-2 px-3 font-mono">pitchmaster</td>
                        <td className="py-2 px-3">Target database name. Will be auto-created if permitted.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">MYSQL_TABLE</td>
                        <td className="py-2 px-3 font-mono">schedule_backups</td>
                        <td className="py-2 px-3">Table name for storing serialized JSON schedule documents.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Runtime UI Overrides:</strong> You can also modify these credentials on the fly without restarting the app using the <strong>Configure DB</strong> button on the Backups tab.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: SQL SCHEMA (CREATE TABLE) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-xs">
                    2. SQL Schema Script (<code className="text-slate-700">schedule_backups</code>)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied SQL!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  PitchMaster automatically runs <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">CREATE TABLE IF NOT EXISTS</code> when it connects. To create the database and table manually, execute the following script in MySQL Workbench, phpMyAdmin, or the MySQL CLI:
                </p>

                <div className="relative group">
                  <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`-- Step 1: Create Database with UTF-8 Unicode Support
CREATE DATABASE IF NOT EXISTS \`pitchmaster\`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE \`pitchmaster\`;

-- Step 2: Create NoSQL Document Table for JSON Payloads
CREATE TABLE IF NOT EXISTS \`schedule_backups\` (
  \`id\` VARCHAR(128) NOT NULL,
  \`name\` VARCHAR(255) NOT NULL,
  \`data_json\` LONGTEXT NOT NULL COMMENT 'JSON-encoded complete AppData payload',
  \`sync_token\` VARCHAR(128) NOT NULL COMMENT 'Optimistic concurrency revision token',
  \`last_modified_by\` VARCHAR(255) NOT NULL,
  \`last_modified_at\` DATETIME NOT NULL,
  \`created_at\` DATETIME NOT NULL,
  \`version_number\` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  INDEX \`idx_last_modified_at\` (\`last_modified_at\`),
  INDEX \`idx_sync_token\` (\`sync_token\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create Admin Users Table for MySQL Authentication
CREATE TABLE IF NOT EXISTS \`admin_users\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`username\` VARCHAR(64) NOT NULL UNIQUE,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`display_name\` VARCHAR(128) NOT NULL,
  \`role\` VARCHAR(32) NOT NULL DEFAULT 'admin',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`last_login_at\` DATETIME NULL,
  INDEX \`idx_username\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Seed Initial Administrator (Default: admin / pitchmaster)
INSERT INTO \`admin_users\` (\`username\`, \`password_hash\`, \`display_name\`, \`role\`)
VALUES ('admin', SHA2('pitchmaster', 256), 'League Administrator', 'superadmin')
ON DUPLICATE KEY UPDATE \`display_name\` = VALUES(\`display_name\`);`}
                  </pre>
                </div>

                {/* Schema Column Breakdown */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Column</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Purpose & JSON Storage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">id</td>
                        <td className="py-2 px-3 font-mono">VARCHAR(128)</td>
                        <td className="py-2 px-3">Unique document identifier (Primary Key, e.g. <code className="font-mono">main_schedule</code>).</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">name</td>
                        <td className="py-2 px-3 font-mono">VARCHAR(255)</td>
                        <td className="py-2 px-3">Human-readable schedule backup name displayed in the UI.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">data_json</td>
                        <td className="py-2 px-3 font-mono">LONGTEXT / JSON</td>
                        <td className="py-2 px-3">
                          <strong>Full AppData payload:</strong> Stores complete serialized JSON structure (teams, games, referees, slots, certifications, and rules). Supports up to 4GB in MySQL <code className="font-mono">LONGTEXT</code>.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">sync_token</td>
                        <td className="py-2 px-3 font-mono">VARCHAR(128)</td>
                        <td className="py-2 px-3">
                          <strong>Optimistic Concurrency Lock:</strong> Cryptographic token updated on every save. If another user saves first, the token mismatch triggers the 3-way smart merge modal instead of overwriting.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">last_modified_by</td>
                        <td className="py-2 px-3 font-mono">VARCHAR(255)</td>
                        <td className="py-2 px-3">User display name or email who committed the revision.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">last_modified_at</td>
                        <td className="py-2 px-3 font-mono">DATETIME</td>
                        <td className="py-2 px-3">Timestamp of the most recent modification.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono font-semibold text-indigo-700">version_number</td>
                        <td className="py-2 px-3 font-mono">INT</td>
                        <td className="py-2 px-3">Incremental revision counter (v1, v2, v3...).</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* SECTION 3: USER PRIVILEGES & QUICK VERIFICATION */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-xs">
                    3. MySQL User Permissions & Quick Verification
                  </h4>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  To create a dedicated MySQL user with permissions for the backup table:
                </p>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`CREATE USER IF NOT EXISTS 'pitch_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON \`pitchmaster\`.* TO 'pitch_user'@'%';
FLUSH PRIVILEGES;`}
                </pre>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-500">
                    Full offline guide also available at <code className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">/MYSQL_SETUP.md</code> in the repository.
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConn}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isTestingConn ? 'animate-spin' : ''}`} />
                      <span>{isTestingConn ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('backups')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      <span>Go to Backups</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {connTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium ${
                      connTestResult.success
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {connTestResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Optimistic concurrency check active on all saves</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{pendingConfirm.title}</h3>
                <p className="text-xs text-slate-500">MySQL NoSQL Document Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {pendingConfirm.description}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  await action();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
              >
                {pendingConfirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT MERGE MODAL (SAME PROVEN CONFLICT LOGIC!) */}
      {activeConflict && (
        <ConflictMergeModal
          localData={appData}
          remoteData={activeConflict.remoteData}
          remoteModifier={activeConflict.remoteModifier}
          remoteModifiedTime={activeConflict.remoteModifiedTime}
          onApplyMerge={handleApplyMerge}
          onClose={() => setActiveConflict(null)}
        />
      )}
    </>
  );
};
