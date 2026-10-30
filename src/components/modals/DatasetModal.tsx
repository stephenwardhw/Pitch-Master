import React, { useState, useRef, useEffect } from 'react';
import { AppData } from '../../types';
import {
  COOKIE_NAME,
  getCookie,
  setCookie,
  getInitialAppData,
  saveManualLocalJsonBackup,
  loadManualLocalJsonBackup,
  getManualLocalBackupMetadata,
  clearManualLocalBackup,
} from '../../utils/cookieStorage';
import { publishScheduleToServer, downloadLeagueScheduleJson } from '../../utils/serverSync';
import { saveOrExportJson, isFileSystemAccessSupported } from '../../utils/fileExport';
import {
  X,
  Download,
  Upload,
  RefreshCw,
  FileText,
  CheckCircle2,
  Cookie,
  AlertCircle,
  Globe,
  FileDown,
  Save,
  Info,
  FileSpreadsheet,
  Users,
  Calendar,
  MapPin,
  UserCheck,
  Database,
  Lock,
  Eye,
  FolderOpen,
  Trash2,
  HardDrive,
} from 'lucide-react';
import { AdminUser, canPublishSchedule, isViewerRole } from '../../utils/authClient';
import {
  exportTeamsToCsv,
  exportScheduleToCsv,
  exportFieldsToCsv,
  exportRefereesToCsv,
  downloadCsv,
} from '../../utils/csvImporter';

interface DatasetModalProps {
  appData: AppData;
  adminUser?: AdminUser | null;
  onUpdateData: (newData: AppData) => void;
  onClose: () => void;
  onOpenCsvImport?: (type?: 'teams' | 'fields' | 'schedule' | 'referees') => void;
  onOpenMySqlBackupModal?: () => void;
  onCreateLocalBackupJson?: () => Promise<void>;
  onLoadLocalBackupJson?: () => void;
  onFetchLatestMySql?: () => Promise<void>;
  isLoadingMySql?: boolean;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({
  appData,
  adminUser,
  onUpdateData,
  onClose,
  onOpenCsvImport,
  onOpenMySqlBackupModal,
  onCreateLocalBackupJson,
  onLoadLocalBackupJson,
  onFetchLatestMySql,
  isLoadingMySql = false,
}) => {
  const canPublish = canPublishSchedule(adminUser);
  const isViewer = isViewerRole(adminUser);
  const [fileNameInput, setFileNameInput] = useState(appData.fileName || 'soccer_schedule.json');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fsSupported = isFileSystemAccessSupported();
  const [overwriteMode, setOverwriteMode] = useState<boolean>(true);
  const [localBackupMeta, setLocalBackupMeta] = useState(() => getManualLocalBackupMetadata());

  const refreshLocalBackupMeta = () => {
    setLocalBackupMeta(getManualLocalBackupMetadata());
  };

  const handleManualCreateLocal = async () => {
    try {
      const res = saveManualLocalJsonBackup(appData);
      refreshLocalBackupMeta();
      setStatusMessage({
        text: `Manual local JSON backup created in browser storage (${new Date(res.savedAt).toLocaleTimeString()}).`,
        type: 'success',
      });
      if (onCreateLocalBackupJson) {
        await onCreateLocalBackupJson();
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to create local backup: ${err.message}`,
        type: 'error',
      });
    }
  };

  const handleManualLoadLocal = () => {
    const record = loadManualLocalJsonBackup();
    if (!record || !record.data) {
      setStatusMessage({
        text: 'No manual local backup found in browser storage.',
        type: 'error',
      });
      return;
    }
    if (
      window.confirm(
        `Load manual local JSON backup saved on ${new Date(record.savedAt).toLocaleString()} (${record.fileName})?\n\nThis will replace the current view with your local backup.`
      )
    ) {
      onUpdateData(record.data);
      setStatusMessage({
        text: `Successfully loaded manual local backup "${record.fileName}" (saved ${new Date(record.savedAt).toLocaleString()}).`,
        type: 'success',
      });
    }
  };

  const handleManualClearLocal = () => {
    if (window.confirm('Delete the manual local JSON backup stored in this browser?')) {
      clearManualLocalBackup();
      refreshLocalBackupMeta();
      setStatusMessage({
        text: 'Manual local storage backup cleared.',
        type: 'success',
      });
    }
  };

  const currentCookieVal = getCookie(COOKIE_NAME);

  // Handle Publish to Server (league_schedule.json)
  const handlePublishToServer = async () => {
    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const res = await publishScheduleToServer(appData);
      setStatusMessage({
        text:
          res.message ||
          'Successfully published current schedule to server file "league_schedule.json"! Public Coach & Parent portal is immediately up to date.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Server publish error: ${err.message || 'Failed to update league_schedule.json on server.'}`,
        type: 'error',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Export / Download / In-Place Overwrite
  const handleExport = async (forceStandardDownload: boolean = false) => {
    try {
      const cleanName = fileNameInput.trim().endsWith('.json')
        ? fileNameInput.trim()
        : `${fileNameInput.trim()}.json`;

      const exportData: AppData = {
        ...appData,
        fileName: cleanName,
        lastModified: new Date().toISOString(),
      };

      const result = await saveOrExportJson(exportData, cleanName, {
        preferOverwrite: forceStandardDownload ? false : overwriteMode,
      });

      if (result.success) {
        // Update cookie and app state
        setCookie(COOKIE_NAME, cleanName);
        onUpdateData(exportData);
        setStatusMessage({
          text: result.message,
          type: 'success',
        });
      } else if (result.method !== 'cancelled') {
        setStatusMessage({ text: result.message || 'Failed to generate JSON export file.', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to generate JSON export file.', type: 'error' });
    }
  };

  // Handle Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.divisions || !parsed.teams || !parsed.fields) {
          throw new Error('Invalid format: Missing divisions, teams, or fields array in JSON.');
        }

        const importedName = file.name || parsed.fileName || 'imported_soccer_schedule.json';
        parsed.fileName = importedName;

        // Update cookie
        setCookie(COOKIE_NAME, importedName);
        onUpdateData(parsed);

        setStatusMessage({
          text: `Successfully imported "${importedName}" (${parsed.teams.length} teams, ${parsed.divisions.length} divisions, ${parsed.games?.length || 0} games). Cookie updated!`,
          type: 'success',
        });
        setFileNameInput(importedName);
      } catch (err: any) {
        setStatusMessage({
          text: `Import error: ${err.message || 'Invalid JSON file structure.'}`,
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Handle Rename / Save As
  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fileNameInput.trim().endsWith('.json')
      ? fileNameInput.trim()
      : `${fileNameInput.trim()}.json`;

    const updatedData: AppData = {
      ...appData,
      fileName: cleanName,
      lastModified: new Date().toISOString(),
    };

    setCookie(COOKIE_NAME, cleanName);
    onUpdateData(updatedData);
    setStatusMessage({
      text: `File name changed to "${cleanName}". Stored in cookie for subsequent sessions.`,
      type: 'success',
    });
  };

  // Handle Reset to Demo
  const handleResetDemo = () => {
    if (window.confirm('Reset all schedule, teams, and field data to the initial Metro League sample dataset?')) {
      const demoData = getInitialAppData();
      setCookie(COOKIE_NAME, demoData.fileName);
      onUpdateData(demoData);
      setFileNameInput(demoData.fileName);
      setStatusMessage({
        text: 'Dataset successfully restored to Spring Metro Youth Soccer Championship.',
        type: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                Dataset & File Manager
              </h3>
              <p className="text-xs text-slate-500">
                Client-side cookie tracking & backup file export / import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* MySQL Authoritative Storage Card */}
          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">MySQL Server (Primary Authoritative Source)</span>
                    {appData.mysqlBackupSync ? (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-semibold border border-emerald-200">
                        Synced
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] rounded-full font-semibold border border-indigo-200">
                        Priority #1
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {appData.mysqlBackupSync
                      ? `Linked to "${appData.mysqlBackupSync.backupName}" (Rev: ${appData.mysqlBackupSync.syncToken.substring(0, 16)}...). The browser always fetches and prioritizes MySQL data on admin access.`
                      : 'The browser queries MySQL first when accessing the admin area, prioritizing server data over any local JSON files.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onFetchLatestMySql && (
                  <button
                    type="button"
                    onClick={onFetchLatestMySql}
                    disabled={isLoadingMySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-900 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                    title="Grab the most recent copy of data from the MySQL server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isLoadingMySql ? 'animate-spin' : ''}`} />
                    <span>{isLoadingMySql ? 'Fetching...' : 'Fetch Latest'}</span>
                  </button>
                )}

                {onOpenMySqlBackupModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMySqlBackupModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    {appData.mysqlBackupSync ? 'Manage MySQL' : 'Open MySQL'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Manual Local Storage Backup Card */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Manual Local JSON Backup (Browser Storage)</span>
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full font-semibold border border-amber-300">
                      On-Demand Only
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Local JSON files are <strong className="text-slate-800">never automatically loaded on page start</strong> and are <strong className="text-slate-800">never saved automatically on save</strong>. You can manually snapshot your schedule here, or restore it on demand.
                  </p>
                </div>
              </div>
            </div>

            {/* Local backup status details */}
            <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                {localBackupMeta.exists ? (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Stored Local Backup:</span>
                      <code className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 text-[11px]">
                        {localBackupMeta.fileName}
                      </code>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Saved: {localBackupMeta.savedAt ? new Date(localBackupMeta.savedAt).toLocaleString() : 'Unknown'} · {localBackupMeta.teamsCount || 0} teams · {localBackupMeta.gamesCount || 0} games
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 italic text-[11px]">
                    No manual local storage backup exists currently. Click "Create Local Backup" to take a snapshot.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isViewer && (
                  <button
                    type="button"
                    onClick={handleManualCreateLocal}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                    title="Snapshot current schedule to local browser storage"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Create Local Backup</span>
                  </button>
                )}

                {localBackupMeta.exists && !isViewer && (
                  <button
                    type="button"
                    onClick={handleManualLoadLocal}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors cursor-pointer"
                    title="Load the manual local JSON backup stored in this browser"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>Load This Backup</span>
                  </button>
                )}

                {localBackupMeta.exists && !isViewer && (
                  <button
                    type="button"
                    onClick={handleManualClearLocal}
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    title="Delete stored local backup"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Browser Cookie State Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Cookie className="w-4 h-4 text-amber-600" />
              <span>Browser Cookie State</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                Active Filename Label in Cookie: <strong className="font-mono text-slate-900">{currentCookieVal || fileNameInput}</strong>
              </div>
              <p className="text-[11px] text-slate-500">
                Used as the default label when exporting JSON files manually. Startup loading prioritizes MySQL database backups as the authoritative source.
              </p>
            </div>
          </div>

          {/* Active File Name & Rename */}
          <form onSubmit={handleRename} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Active Data File Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileNameInput}
                onChange={(e) => setFileNameInput(e.target.value)}
                placeholder="e.g. spring_league_2026.json"
                className="flex-1 text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                required
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Set File Name
              </button>
            </div>
          </form>

          {/* Export & Import actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Export */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-slate-900">Create Local Backup JSON (File Export)</h4>
                  </div>
                  {fsSupported && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Direct Overwrite API
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Export your current schedule to a local JSON file on your computer. (Manual choice, not executed automatically on save).
                </p>

                {/* Overwrite option toggle */}
                <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwriteMode}
                      onChange={(e) => setOverwriteMode(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div>
                      <span className="font-semibold text-slate-800">
                        Prompt to replace / overwrite file directly
                      </span>
                      <p className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
                        Overwrites existing file in-place instead of browser auto-incrementing <code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded">(1).json</code>.
                      </p>
                    </div>
                  </label>
                  {!fsSupported && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                      <Info className="w-3 h-3 shrink-0" />
                      <span>Direct overwrite requires Chrome, Edge, or Brave. In this browser, standard downloads are used.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleExport(false)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {!isViewer && overwriteMode && fsSupported ? 'Save & Overwrite JSON' : 'Export & Download JSON'}
                  </span>
                </button>
                {!isViewer && overwriteMode && fsSupported && (
                  <button
                    type="button"
                    onClick={() => handleExport(true)}
                    className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800 underline transition-colors"
                  >
                    Or standard download (allow (1) numbering)
                  </button>
                )}
              </div>
            </div>

            {/* Import */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Import Dataset</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isViewer
                    ? 'Dataset importing is disabled for Read-Only Viewer accounts.'
                    : 'Load a previously exported JSON dataset into the scheduler.'}
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
                disabled={isViewer}
              />
              <button
                type="button"
                disabled={isViewer}
                onClick={() => !isViewer && fileInputRef.current?.click()}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  isViewer
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 cursor-pointer'
                }`}
              >
                {isViewer ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{isViewer ? 'Import Disabled (Viewer)' : 'Choose JSON File'}</span>
              </button>
            </div>
          </div>

          {/* CSV Migration Section */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-slate-900">CSV Spreadsheet Migration & Export</h4>
              </div>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                Excel & Google Sheets
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export and import datasets in standard CSV format with full format symmetry between import and export.
            </p>

            {/* Export Section */}
            <div className="space-y-1.5 pt-1 border-t border-emerald-200/60">
              <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                Export Current Data to CSV:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csv = exportTeamsToCsv(appData);
                    const today = new Date().toISOString().slice(0, 10);
                    downloadCsv(`pitchmaster_teams_${today}.csv`, csv);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Export teams, rosters, and coaches to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Teams CSV ({appData.teams.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportFieldsToCsv(appData);
                    const today = new Date().toISOString().slice(0, 10);
                    downloadCsv(`pitchmaster_fields_${today}.csv`, csv);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Export pitches, venues, and availability to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Fields CSV ({appData.fields.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportScheduleToCsv(appData);
                    const today = new Date().toISOString().slice(0, 10);
                    downloadCsv(`pitchmaster_schedule_${today}.csv`, csv);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Export match schedule and games to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Schedule CSV ({appData.games.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const csv = exportRefereesToCsv(appData);
                    const today = new Date().toISOString().slice(0, 10);
                    downloadCsv(`pitchmaster_referees_${today}.csv`, csv);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Export referees and match officials roster to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Referees CSV ({(appData.referees || []).length})</span>
                </button>
              </div>
            </div>

            {/* Import Section */}
            {onOpenCsvImport && !isViewer && (
              <div className="space-y-1.5 pt-2 border-t border-emerald-200/60">
                <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                  Import New or Migrated Data from CSV:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCsvImport('teams');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Import Teams (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCsvImport('fields');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Import Fields (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCsvImport('schedule');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Import Schedule (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCsvImport('referees');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Import Referees (CSV)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Publish to Server File league_schedule.json */}
          <div className="p-4 rounded-lg border border-purple-200 bg-purple-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-700" />
                <h4 className="text-sm font-semibold text-purple-950">Publish to Server File (league_schedule.json)</h4>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                Live Public Portal
              </span>
            </div>
            <p className="text-xs text-purple-900/80 leading-relaxed">
              Push your updated divisions, teams, and schedule directly into <code className="font-mono text-purple-950 bg-white/80 px-1 py-0.5 rounded">league_schedule.json</code> on the server. Referee personal contact details (phone, email, notes) are automatically stripped to safeguard referee privacy on the public portal, while remaining completely intact in your downloaded JSON and database backups.
            </p>
            {canPublish ? (
              <button
                type="button"
                onClick={handlePublishToServer}
                disabled={isPublishing}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-700 rounded-lg hover:bg-purple-800 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <Globe className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                <span>{isPublishing ? 'Publishing to Server...' : 'Publish to Server (league_schedule.json)'}</span>
              </button>
            ) : (
              <div className="p-3 bg-purple-100/70 rounded-lg border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Publishing Restricted</span>
                  <span>Server publishing is restricted to Scheduler, Admin, and Superadmin accounts. Viewer accounts have read-only access.</span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                const res = await downloadLeagueScheduleJson(appData, 'league_schedule.json', overwriteMode);
                if (res.success) {
                  setStatusMessage({ text: res.message, type: 'success' });
                } else if (res.method !== 'cancelled') {
                  setStatusMessage({ text: res.message, type: 'error' });
                }
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-900 bg-purple-100/80 hover:bg-purple-200/80 border border-purple-200 rounded-lg transition-colors"
              title="Save or download league_schedule.json directly to place into your Apache DocumentRoot (/var/www/pitchmaster/)"
            >
              <FileDown className="w-3.5 h-3.5 text-purple-700" />
              <span>
                {overwriteMode && fsSupported ? 'Save & Overwrite league_schedule.json' : 'Download league_schedule.json'} (For Static Host / Manual Upload)
              </span>
            </button>
          </div>

          {/* Reset button - Hidden for Viewer */}
          {!isViewer && (
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetDemo}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to default sample league dataset</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
