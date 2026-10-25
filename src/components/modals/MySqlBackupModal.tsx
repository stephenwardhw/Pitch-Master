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
} from 'lucide-react';

interface MySqlBackupModalProps {
  appData: AppData;
  onUpdateAppData: (newData: AppData) => void;
  onClose: () => void;
}

export const MySqlBackupModal: React.FC<MySqlBackupModalProps> = ({
  appData,
  onUpdateAppData,
  onClose,
}) => {
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

  // Settings Panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<MySqlConfig>(config);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connTestResult, setConnTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
  // SAVE CURRENT SCHEDULE TO MYSQL (WITH CONFLICT DETECTION)
  // -------------------------------------------------------------
  const handleSaveToMySql = async (forceOverwrite = false) => {
    const backupId = linkedSync ? linkedSync.backupId : newBackupName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
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
        setStatusMessage({
          text: saveResult.message || `Successfully saved backup "${backupName}" into MySQL!`,
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

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
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

                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Unlink backup connection"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
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
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(!isCreatingNew)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Create New Backup</span>
                  </button>

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
                      onClick={() => handleSaveToMySql(false)}
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save & Link Backup'}
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
                              <button
                                type="button"
                                onClick={() => handleLoadBackup(b)}
                                disabled={isSaving}
                                className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-semibold transition-colors disabled:opacity-60"
                                title="Load this backup document into PitchMaster"
                              >
                                Load
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
