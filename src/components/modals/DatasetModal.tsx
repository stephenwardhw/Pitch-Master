import React, { useState, useRef } from 'react';
import { AppData } from '../../types';
import { COOKIE_NAME, getCookie, setCookie, getInitialAppData } from '../../utils/cookieStorage';
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
} from 'lucide-react';

interface DatasetModalProps {
  appData: AppData;
  onUpdateData: (newData: AppData) => void;
  onClose: () => void;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({
  appData,
  onUpdateData,
  onClose,
}) => {
  const [fileNameInput, setFileNameInput] = useState(appData.fileName || 'soccer_schedule.json');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fsSupported = isFileSystemAccessSupported();
  const [overwriteMode, setOverwriteMode] = useState<boolean>(true);

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

          {/* Cookie Tracking Badge */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Cookie className="w-4 h-4 text-amber-600" />
              <span>Browser Cookie State</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                Cookie Name: <code className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">{COOKIE_NAME}</code>
              </div>
              <div>
                Last Used File in Cookie: <strong className="font-mono text-slate-900">{currentCookieVal || 'None'}</strong>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                On page load, the application inspects this cookie to automatically reload your last exported or active schedule file.
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
                    <h4 className="text-sm font-semibold text-slate-900">Export Dataset</h4>
                  </div>
                  {fsSupported && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Direct Overwrite API
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Save current divisions, teams, pitches, and schedule as a JSON file.
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
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {overwriteMode && fsSupported ? 'Save & Overwrite JSON' : 'Export & Download JSON'}
                  </span>
                </button>
                {overwriteMode && fsSupported && (
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
                  Load a previously exported JSON dataset into the scheduler.
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose JSON File</span>
              </button>
            </div>
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
              Push your updated divisions, teams, and schedule directly into <code className="font-mono text-purple-950 bg-white/80 px-1 py-0.5 rounded">league_schedule.json</code> on the server. Coaches and parents on the read-only portal will instantly view this schedule.
            </p>
            <button
              type="button"
              onClick={handlePublishToServer}
              disabled={isPublishing}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-700 rounded-lg hover:bg-purple-800 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Globe className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>{isPublishing ? 'Publishing to Server...' : 'Publish to Server (league_schedule.json)'}</span>
            </button>
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

          {/* Reset button */}
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
