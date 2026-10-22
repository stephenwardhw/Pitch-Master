import React, { useState } from 'react';
import { AppData } from '../../types';
import { computeDataDifferences, DiffReport, smartMergeAppData } from '../../utils/dataMerger';
import {
  AlertTriangle,
  GitMerge,
  ArrowRight,
  CheckCircle2,
  X,
  RefreshCw,
  Layers,
  Calendar,
  Users,
  UserCheck,
  MapPin,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface ConflictMergeModalProps {
  localData: AppData;
  remoteData: AppData;
  remoteModifier?: string;
  remoteModifiedTime?: string;
  onApplyMerge: (mergedData: AppData, strategy: 'smart' | 'overwrite_remote' | 'accept_remote') => void;
  onClose: () => void;
}

export const ConflictMergeModal: React.FC<ConflictMergeModalProps> = ({
  localData,
  remoteData,
  remoteModifier = 'Another administrator',
  remoteModifiedTime,
  onApplyMerge,
  onClose,
}) => {
  const [diffReport] = useState<DiffReport>(() => computeDataDifferences(localData, remoteData));
  const [selectedStrategy, setSelectedStrategy] = useState<'smart' | 'local' | 'remote'>('smart');
  const [conflictingGameChoice, setConflictingGameChoice] = useState<'local' | 'remote'>('local');
  const [expandedSection, setExpandedSection] = useState<'games' | 'teams' | 'referees' | 'fields' | null>('games');
  const [isConfirmingOverwrite, setIsConfirmingOverwrite] = useState(false);

  const formattedRemoteTime = remoteModifiedTime
    ? new Date(remoteModifiedTime).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'recently';

  const handleExecuteResolution = () => {
    if (selectedStrategy === 'smart') {
      const merged = smartMergeAppData(localData, remoteData, { conflictingGameChoice });
      onApplyMerge(merged, 'smart');
    } else if (selectedStrategy === 'local') {
      // Overwrite remote with local
      onApplyMerge(localData, 'overwrite_remote');
    } else if (selectedStrategy === 'remote') {
      // Overwrite local with remote
      onApplyMerge(remoteData, 'accept_remote');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200">
        {/* Header Alert Banner */}
        <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Concurrency Conflict Detected in Google Drive
              </h2>
              <p className="text-xs text-amber-100">
                This schedule was modified by <strong>{remoteModifier}</strong> at {formattedRemoteTime} while you were working on it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Conflicting Games
              </span>
              <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
                {diffReport.games.modified.length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Remote Additions
              </span>
              <div className="text-xl font-bold text-blue-600 mt-1 font-mono">
                {diffReport.games.addedRemotely.length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Local Additions
              </span>
              <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                {diffReport.games.addedLocally.length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Other Entities
              </span>
              <div className="text-xl font-bold text-slate-700 mt-1 font-mono">
                {diffReport.teams.modified.length + diffReport.referees.modified.length + diffReport.fields.modified.length}
              </div>
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Select Resolution & Merge Strategy
            </label>

            <div className="space-y-2.5">
              {/* Option 1: Smart Merge (Recommended) */}
              <div
                onClick={() => setSelectedStrategy('smart')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedStrategy === 'smart'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mergeStrategy"
                    checked={selectedStrategy === 'smart'}
                    onChange={() => setSelectedStrategy('smart')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Smart Merge (Recommended)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Zero Data Loss
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Automatically combines non-conflicting changes from both you and {remoteModifier}. All newly scheduled games, teams, and referee assignments from both sides are preserved.
                    </p>

                    {selectedStrategy === 'smart' && diffReport.games.modified.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center gap-3 text-[11px]">
                        <span className="font-medium text-slate-700">For conflicting game fields, prefer:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictGameChoice"
                            checked={conflictingGameChoice === 'local'}
                            onChange={() => setConflictingGameChoice('local')}
                            className="text-emerald-600"
                          />
                          <span>My Local Edits</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictGameChoice"
                            checked={conflictingGameChoice === 'remote'}
                            onChange={() => setConflictingGameChoice('remote')}
                            className="text-emerald-600"
                          />
                          <span>Remote Edits ({remoteModifier})</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 2: Overwrite Remote */}
              <div
                onClick={() => setSelectedStrategy('local')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedStrategy === 'local'
                    ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mergeStrategy"
                    checked={selectedStrategy === 'local'}
                    onChange={() => setSelectedStrategy('local')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">
                      Keep My Local Changes & Overwrite Google Drive
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Replaces the remote file in Google Drive with your current browser state. Changes made by {remoteModifier} will be superseded.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 3: Accept Remote */}
              <div
                onClick={() => setSelectedStrategy('remote')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedStrategy === 'remote'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mergeStrategy"
                    checked={selectedStrategy === 'remote'}
                    onChange={() => setSelectedStrategy('remote')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">
                      Discard Local & Accept Latest from Google Drive
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Replaces your working session with the version saved by {remoteModifier}. Any unsaved local edits will be discarded.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Differences Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setExpandedSection(expandedSection === 'games' ? null : 'games')}
              className="w-full flex items-center justify-between p-3.5 text-left font-bold text-xs text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>View Detailed Differences ({diffReport.totalDiffCount} items)</span>
              </div>
              {expandedSection === 'games' ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection === 'games' && (
              <div className="p-4 pt-1 border-t border-slate-200 bg-white space-y-3 max-h-60 overflow-y-auto">
                {diffReport.games.modified.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-600 text-[11px] block">
                      Modified Games on Both Sides:
                    </span>
                    {diffReport.games.modified.map((item) => (
                      <div
                        key={item.gameId}
                        className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-slate-800 text-[11px] space-y-1 font-mono"
                      >
                        <div className="font-bold text-amber-900 font-sans">{item.gameLabel}</div>
                        <ul className="list-disc list-inside text-slate-600 text-[10px] space-y-0.5">
                          {item.diffs.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {diffReport.games.addedRemotely.length > 0 && (
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-600 text-[11px] block">
                      Games added remotely ({diffReport.games.addedRemotely.length}):
                    </span>
                    <div className="text-[11px] text-slate-500">
                      {diffReport.games.addedRemotely.slice(0, 5).map((g) => (
                        <div key={g.id}>Match ID {g.id} ({g.date} at {g.time})</div>
                      ))}
                      {diffReport.games.addedRemotely.length > 5 && (
                        <div>...and {diffReport.games.addedRemotely.length - 5} more</div>
                      )}
                    </div>
                  </div>
                )}

                {diffReport.referees.modified.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="font-semibold text-slate-600 text-[11px] block">
                      Referees updated:
                    </span>
                    {diffReport.referees.modified.map((r) => (
                      <div key={r.id} className="text-[11px] text-slate-600">
                        {r.name} (details updated)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
          >
            Cancel / Keep Working Locally
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExecuteResolution}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-colors ${
                selectedStrategy === 'smart'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : selectedStrategy === 'local'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <GitMerge className="w-4 h-4" />
              <span>
                {selectedStrategy === 'smart'
                  ? 'Apply Smart Merge & Save'
                  : selectedStrategy === 'local'
                  ? 'Confirm Overwrite Remote'
                  : 'Accept Remote Version'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
