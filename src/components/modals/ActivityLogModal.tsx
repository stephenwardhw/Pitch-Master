import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScheduleActivityItem } from '../../types';
import { fetchScheduleActivityLog, getMySqlBackup } from '../../utils/mysqlBackupClient';
import {
  History,
  X,
  RefreshCw,
  Clock,
  User as UserIcon,
  Database,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ArrowDownToLine,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface ActivityLogModalProps {
  onClose: () => void;
  onLoadBackup?: (backupId: string) => Promise<void> | void;
  onOpenMySqlBackupModal?: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  onClose,
  onLoadBackup,
  onOpenMySqlBackupModal,
}) => {
  const [activities, setActivities] = useState<ScheduleActivityItem[]>([]);
  const [isLiveMySql, setIsLiveMySql] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchScheduleActivityLog(10);
      setActivities(res.activities || []);
      setIsLiveMySql(res.isLiveMySql);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedule activity log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedToken(id);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleConfirmRestore = async (backupId: string) => {
    if (!onLoadBackup) return;
    setRestoringId(backupId);
    try {
      await onLoadBackup(backupId);
      onClose();
    } catch (err: any) {
      setError(`Failed to load backup: ${err.message}`);
      setRestoringId(null);
      setConfirmRestoreId(null);
    }
  };

  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return activities;
    const term = searchTerm.toLowerCase();
    return activities.filter(
      (a) =>
        a.modifiedBy.toLowerCase().includes(term) ||
        a.backupName.toLowerCase().includes(term) ||
        a.action.toLowerCase().includes(term) ||
        a.syncToken.toLowerCase().includes(term)
    );
  }, [activities, searchTerm]);

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 45) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Formatted exact time helper
  const getFormattedTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs border border-indigo-200">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">Schedule Activity Log</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                  Last 10 Modifications
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    isLiveMySql
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  <span>{isLiveMySql ? 'MySQL: schedule_backups' : 'Embedded NoSQL'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail tracking who modified the schedule, what changed, and exact timestamps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh Activity Log"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by admin name, backup, or token..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{filteredActivities.length}</strong> of{' '}
              <strong className="text-slate-800">{activities.length}</strong> modifications
            </span>
            {onOpenMySqlBackupModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMySqlBackupModal();
                }}
                className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer ml-1"
              >
                <span>Backups Manager</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Activity Log Notice</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-3">
          {loading && activities.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">
                Fetching last 10 modifications from MySQL table...
              </p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {searchTerm ? 'No matching modification logs' : 'No modification history recorded yet'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {searchTerm
                  ? 'Try clearing the search filter to see all recorded modifications.'
                  : 'Whenever an admin saves or updates a schedule backup, an entry is recorded in MySQL schedule_backups.'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {filteredActivities.map((act, index) => {
                const isRestoring = restoringId === act.backupId;
                const isConfirming = confirmRestoreId === act.id;

                // Color accent based on version number
                const isFirst = index === 0;

                return (
                  <div
                    key={act.id}
                    className={`relative rounded-xl border p-4 transition-all ${
                      isFirst
                        ? 'bg-linear-to-r from-indigo-50/50 to-white border-indigo-200 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-[30px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        isFirst
                          ? 'bg-indigo-600 border-white text-white shadow-xs'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Who & What */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Modifier Avatar & Name */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold text-xs border border-slate-200">
                            <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{act.modifiedBy}</span>
                          </div>

                          {/* Action Badge */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                              act.versionNumber > 1
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {act.action}
                          </span>

                          {/* Version Pill */}
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            v{act.versionNumber}
                          </span>

                          {/* Relative Time */}
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 ml-auto sm:ml-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{getRelativeTime(act.modifiedAt)}</span>
                          </span>
                        </div>

                        {/* Backup Name & Full Timestamp */}
                        <div className="flex items-baseline gap-2 flex-wrap text-xs">
                          <span className="font-semibold text-slate-900 truncate">
                            {act.backupName}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({getFormattedTime(act.modifiedAt)})
                          </span>
                        </div>

                        {/* Snapshot Metrics Chips */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
                            <Layers className="w-3 h-3 text-slate-500" />
                            <span>{act.divisionsCount} Divisions</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span>{act.teamsCount} Teams</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{act.gamesCount} Games</span>
                          </span>
                        </div>

                        {/* Sync Token Traceability */}
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400 font-mono">
                          <span>Token:</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-600 truncate max-w-[220px]">
                            {act.syncToken}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(act.syncToken, act.id)}
                            className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-sm transition-colors cursor-pointer"
                            title="Copy sync token"
                          >
                            {copiedToken === act.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      {onLoadBackup && (
                        <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isRestoring}
                                onClick={() => handleConfirmRestore(act.backupId)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                              >
                                {isRestoring ? 'Loading...' : 'Confirm Load'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreId(act.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium text-xs shadow-2xs transition-all cursor-pointer"
                              title="Load this backup snapshot into the workspace"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Load Snapshot</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Audit trail automatically synchronizes on every schedule save</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
