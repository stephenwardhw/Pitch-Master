import React, { useState } from 'react';
import { AppData } from '../../types';
import {
  X,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  MapPin,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { generateLeagueSchedule } from '../../utils/scheduler';

interface RegenerateScheduleModalProps {
  appData: AppData;
  onConfirmRegenerate: (targetDivisionId?: string) => void;
  onClose: () => void;
}

export const RegenerateScheduleModal: React.FC<RegenerateScheduleModalProps> = ({
  appData,
  onConfirmRegenerate,
  onClose,
}) => {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSummary, setGenerationSummary] = useState<{
    success: boolean;
    gamesCount: number;
    divisionsCount: number;
    message: string;
  } | null>(null);

  const realTeams = appData.teams.filter((t) => !t.isBye && t.name.toLowerCase() !== 'bye');
  const teamsInScope =
    selectedDivisionId === 'all'
      ? realTeams
      : realTeams.filter((t) => t.divisionId === selectedDivisionId);

  const selectedDivName =
    selectedDivisionId === 'all'
      ? 'All Divisions'
      : appData.divisions.find((d) => d.id === selectedDivisionId)?.name || 'Selected Division';

  const handleExecute = () => {
    setIsGenerating(true);
    setGenerationSummary(null);

    // Short timeout to yield to UI and render spinner smoothly
    setTimeout(() => {
      try {
        const result = generateLeagueSchedule(appData, selectedDivisionId);
        onConfirmRegenerate(selectedDivisionId);

        setGenerationSummary({
          success: true,
          gamesCount: result.games.length,
          divisionsCount: selectedDivisionId === 'all' ? appData.divisions.length : 1,
          message: `Successfully generated ${result.games.length} total matches with zero field conflicts!`,
        });
      } catch (err: any) {
        setGenerationSummary({
          success: false,
          gamesCount: 0,
          divisionsCount: 0,
          message: `Error generating schedule: ${err?.message || 'Unknown generation error'}`,
        });
      } finally {
        setIsGenerating(false);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-950/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                Re-Run Round-Robin Scheduler
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated match generation, home/away balancing & pitch conflict resolution
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {generationSummary ? (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                generationSummary.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {generationSummary.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span className="font-bold text-sm">
                  {generationSummary.success ? 'Schedule Generated Successfully!' : 'Generation Failed'}
                </span>
              </div>

              <p className="text-xs leading-relaxed">{generationSummary.message}</p>

              {generationSummary.success && (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs font-semibold">
                  <span>New Schedule Size:</span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {generationSummary.gamesCount} Matches
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Target Scope:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDivisionId('all')}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      selectedDivisionId === 'all'
                        ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-semibold ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">All Divisions</span>
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal block mt-1">
                      Regenerate full league schedule ({appData.divisions.length} divisions, {realTeams.length} teams)
                    </span>
                  </button>

                  <div className="space-y-1">
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      className="w-full h-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="all">Or pick specific division...</option>
                      {appData.divisions.map((div) => {
                        const count = realTeams.filter((t) => t.divisionId === div.id).length;
                        return (
                          <option key={div.id} value={div.id}>
                            Only {div.name} ({count} teams)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Parameters Breakdown */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Configuration Summary:
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Date Window:</span>
                    <span className="font-mono font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {appData.seasonConfig.startDate} → {appData.seasonConfig.endDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Selected Target:</span>
                    <span className="font-semibold text-slate-800 block truncate mt-0.5">
                      {selectedDivName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Teams in Scope:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-slate-400" />
                      {teamsInScope.length} Active Teams
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Facilities:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {appData.fields.length} Registered Pitches
                    </span>
                  </div>
                </div>
              </div>

              {/* What the scheduler does notice */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 text-blue-900 space-y-1.5">
                <span className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Scheduler Engine Logic:
                </span>
                <ul className="list-disc list-inside text-[11px] text-blue-800 space-y-1 pl-1">
                  <li>Rotates Berger round-robin pairings across allowed game days.</li>
                  <li>Alternates home and away host venues for balance.</li>
                  <li>Prefers primary team home pitch, falling back to alternate pitches to avoid conflicts.</li>
                  <li>Automatically converts bye rounds into dedicated home practice slots for odd-count divisions.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            {generationSummary ? 'Done' : 'Cancel'}
          </button>

          {generationSummary ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors shadow-xs"
            >
              <span>View Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecute}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-950/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Computing Schedule...' : 'Run Automated Scheduler'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
