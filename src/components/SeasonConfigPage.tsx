import React, { useState } from 'react';
import { AppData, SeasonConfig } from '../types';
import {
  Settings,
  Calendar,
  Sparkles,
  Save,
  Plus,
  Trash2,
  X,
  ShieldAlert,
  Info,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface SeasonConfigPageProps {
  appData: AppData;
  onSaveSeasonConfig: (config: SeasonConfig) => void;
  onRegenerateSchedule: () => void;
  canEdit?: boolean;
}

export const SeasonConfigPage: React.FC<SeasonConfigPageProps> = ({
  appData,
  onSaveSeasonConfig,
  onRegenerateSchedule,
  canEdit = true,
}) => {
  const [seasonName, setSeasonName] = useState(appData.seasonConfig.seasonName);
  const [startDate, setStartDate] = useState(appData.seasonConfig.startDate);
  const [endDate, setEndDate] = useState(appData.seasonConfig.endDate);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([
    ...(appData.seasonConfig.blackoutDates || []),
  ]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAddBlackoutDate = () => {
    if (!canEdit || !newBlackoutDate || blackoutDates.includes(newBlackoutDate)) return;
    setBlackoutDates([...blackoutDates, newBlackoutDate].sort());
    setNewBlackoutDate('');
  };

  const handleRemoveBlackoutDate = (date: string) => {
    if (!canEdit) return;
    setBlackoutDates(blackoutDates.filter((d) => d !== date));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const updated: SeasonConfig = {
      seasonName: seasonName.trim(),
      startDate,
      endDate,
      blackoutDates,
    };
    onSaveSeasonConfig(updated);
    setStatusMessage('Season calendar settings saved successfully.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Calculate duration in weeks
  const getWeeksCount = () => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.round(diffDays / 7);
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Season Setup & Blackout Calendar
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specify season starting and ending dates, league holiday blackout dates, and round-robin scheduler parameters.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={onRegenerateSchedule}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Regenerate League Schedule</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Editing Locked (Admins Only)</span>
          </div>
        )}
      </div>

      {/* View-Only Mode Banner for Regular Users */}
      {!canEdit && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold block">View-Only Access Mode</span>
              <span className="text-[11px] text-amber-800">
                Season calendar parameters, dates, and holiday blackouts can only be edited by <strong>Admin</strong> or <strong>Superadmin</strong> accounts.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase font-mono tracking-wider shrink-0 border border-amber-300">
            Read Only
          </span>
        </div>
      )}

      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Season Dates & Configuration
            </h2>
            {!canEdit && (
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Season / Championship Name
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className={`w-full text-sm rounded-lg border border-slate-300 p-2.5 ${
                !canEdit ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Season Start Date
              </label>
              <input
                type="date"
                disabled={!canEdit}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full text-sm rounded-lg border border-slate-300 p-2.5 font-mono ${
                  !canEdit ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white'
                }`}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                First allowable match date for round 1
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Season End Date
              </label>
              <input
                type="date"
                disabled={!canEdit}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full text-sm rounded-lg border border-slate-300 p-2.5 font-mono ${
                  !canEdit ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white'
                }`}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Final cutoff date for regular season games (~{getWeeksCount()} weeks)
              </p>
            </div>
          </div>
        </div>

        {/* Season Blackout Dates */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Season Holiday & No-Game Blackout Dates
              </h2>
            </div>
            {!canEdit && (
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dates when games are NOT to be scheduled (e.g. Easter weekend, Memorial Day break, school holidays). The scheduler skips these dates.
          </p>

          {/* List of current blackout dates */}
          <div className="flex flex-wrap gap-2">
            {blackoutDates.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono tabular-nums text-amber-900 bg-amber-50 rounded-lg border border-amber-200"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>{date}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBlackoutDate(date)}
                    className="p-0.5 text-amber-500 hover:text-rose-600 hover:bg-amber-100 rounded cursor-pointer"
                    title="Remove blackout date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
            {blackoutDates.length === 0 && (
              <span className="text-xs text-slate-400 italic">No season blackout dates set</span>
            )}
          </div>

          {/* Add blackout date input (only for Admin/Superadmin) */}
          {canEdit && (
            <div className="flex gap-2 pt-2">
              <input
                type="date"
                value={newBlackoutDate}
                onChange={(e) => setNewBlackoutDate(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 p-2 font-mono bg-slate-50 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleAddBlackoutDate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Season Blackout Date</span>
              </button>
            </div>
          )}
        </div>

        {/* Save button (only for Admin/Superadmin) */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Season Calendar Settings</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
