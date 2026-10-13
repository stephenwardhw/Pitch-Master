import React, { useState } from 'react';
import { AppData, Conflict, Game } from '../types';
import { detectConflicts, getAvailableFieldsAtSlot } from '../utils/conflictDetector';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Edit,
  Sparkles,
} from 'lucide-react';

interface ConflictsPageProps {
  appData: AppData;
  conflicts: Conflict[];
  onUpdateGame: (updatedGame: Game) => void;
  onEditGame: (game: Game) => void;
  onRecheckConflicts: () => void;
}

export const ConflictsPage: React.FC<ConflictsPageProps> = ({
  appData,
  conflicts,
  onUpdateGame,
  onEditGame,
  onRecheckConflicts,
}) => {
  const [resolutionNotice, setResolutionNotice] = useState<string | null>(null);

  const fieldMap = new Map(appData.fields.map((f) => [f.id, f]));
  const teamMap = new Map(appData.teams.map((t) => [t.id, t]));
  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d]));
  const gameMap = new Map(appData.games.map((g) => [g.id, g]));

  // Quick automated resolution for field conflicts:
  // "If there is a conflict on the field, try choosing one of the teams alternate fields"
  const handleAutoResolveField = (conflict: Conflict) => {
    if (conflict.gameIds.length === 0) return;

    // Pick the second game or the game causing the conflict to move
    const gameToMoveId = conflict.gameIds.length > 1 ? conflict.gameIds[1] : conflict.gameIds[0];
    const targetGame = gameMap.get(gameToMoveId);
    if (!targetGame) return;

    const homeTeam = teamMap.get(targetGame.homeTeamId);

    // 1. Try home team's alternate fields first!
    let candidateFieldId: string | null = null;
    if (homeTeam?.alternateHomeFieldIds) {
      for (const altId of homeTeam.alternateHomeFieldIds) {
        if (altId !== conflict.fieldId) {
          const available = getAvailableFieldsAtSlot(
            appData,
            targetGame.date,
            targetGame.time,
            targetGame.divisionId,
            targetGame.id
          );
          if (available.some((f) => f.id === altId)) {
            candidateFieldId = altId;
            break;
          }
        }
      }
    }

    // 2. If no home alternate field was completely open, check any open division field
    if (!candidateFieldId) {
      const openFields = getAvailableFieldsAtSlot(
        appData,
        targetGame.date,
        targetGame.time,
        targetGame.divisionId,
        targetGame.id
      );
      if (openFields.length > 0) {
        candidateFieldId = openFields[0].id;
      }
    }

    if (candidateFieldId) {
      const updatedGame: Game = {
        ...targetGame,
        fieldId: candidateFieldId,
      };
      onUpdateGame(updatedGame);
      const chosenFieldName = fieldMap.get(candidateFieldId)?.name || candidateFieldId;
      setResolutionNotice(
        `Resolved: Reassigned match "${homeTeam?.name || 'Home'}" to alternate pitch "${chosenFieldName}".`
      );
      setTimeout(() => onRecheckConflicts(), 100);
    } else {
      // Prompt user to edit manually
      onEditGame(targetGame);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Conflict Detection & Resolution Engine
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated scanning for double-booked pitches, blackout date violations, and team schedule overlaps.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setResolutionNotice(null);
                onRecheckConflicts();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Recheck for Conflicts</span>
            </button>
          </div>
        </div>

        {resolutionNotice && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{resolutionNotice}</span>
          </div>
        )}
      </div>

      {/* Zero Conflicts State */}
      {conflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Zero Conflicts Detected
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Every pitch assignment, kickoff time slot, and team roster is perfectly aligned. No double-bookings or blackout violations found across the entire season.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onRecheckConflicts}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Again</span>
            </button>
          </div>
        </div>
      ) : (
        /* Conflicts List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span className="font-semibold text-rose-700">
              {conflicts.length} active schedule {conflicts.length === 1 ? 'conflict' : 'conflicts'} detected
            </span>
            <span className="text-slate-400">Click "Auto-Resolve" or "Edit" to adjust</span>
          </div>

          <div className="space-y-3">
            {conflicts.map((conflict) => {
              const affectedGames = conflict.gameIds
                .map((id) => gameMap.get(id))
                .filter(Boolean) as Game[];
              const field = conflict.fieldId ? fieldMap.get(conflict.fieldId) : null;

              return (
                <div
                  key={conflict.id}
                  className="bg-white rounded-xl border border-rose-200 p-4 sm:p-5 shadow-xs space-y-3.5"
                >
                  {/* Title & Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 pb-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {conflict.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          {conflict.date} at {conflict.time} {field && `· ${field.name}`}
                        </p>
                      </div>
                    </div>

                    <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-full self-start sm:self-auto">
                      {conflict.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {conflict.description}
                  </p>

                  {/* Conflicting Games details */}
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-600 uppercase text-[10px] tracking-wider block">
                      Involved Game(s):
                    </span>
                    <div className="space-y-1.5">
                      {affectedGames.map((g) => {
                        const hTeam = teamMap.get(g.homeTeamId);
                        const aTeam = teamMap.get(g.awayTeamId);
                        const div = divisionMap.get(g.divisionId);
                        const f = fieldMap.get(g.fieldId);

                        return (
                          <div
                            key={g.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900">
                                {hTeam?.name || 'Home'} vs {g.isByePractice ? 'Bye (Practice)' : aTeam?.name || 'Away'}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                {div?.name} · Pitch: {f?.name} ({f?.size})
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onEditGame(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded self-start sm:self-auto"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit Match</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution Recommendations & Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                    <div className="text-xs text-slate-600">
                      <strong>Suggestion:</strong> {conflict.suggestedResolution || 'Reassign field or move slot.'}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAutoResolveField(conflict)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Auto-Resolve (Use Alternate Pitch)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
