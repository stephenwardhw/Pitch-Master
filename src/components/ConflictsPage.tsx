import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Conflict, Game } from '../types';
import { detectConflicts, getAvailableFieldsAtSlot, getAvailableRefereesAtSlot } from '../utils/conflictDetector';
import { ConflictSummaryWidget, ConflictCategory, getConflictCategory } from './ConflictSummaryWidget';
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
  Users,
  UserCheck,
  Layers,
  Filter,
  X,
  ExternalLink,
  ChevronDown,
  UserX,
} from 'lucide-react';

export interface ConflictsPageProps {
  appData: AppData;
  conflicts: Conflict[];
  initialCategory?: 'all' | ConflictCategory;
  initialDivisionId?: string;
  onUpdateGame: (updatedGame: Game) => void;
  onEditGame: (game: Game) => void;
  onRecheckConflicts: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ConflictsPage: React.FC<ConflictsPageProps> = ({
  appData,
  conflicts,
  initialCategory = 'all',
  initialDivisionId = 'all',
  onUpdateGame,
  onEditGame,
  onRecheckConflicts,
  onNavigateToTab,
}) => {
  const [resolutionNotice, setResolutionNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ConflictCategory>(initialCategory);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(initialDivisionId);
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'error' | 'warning'>('all');
  const [showSummaryWidget, setShowSummaryWidget] = useState<boolean>(true);

  // Sync state if props change (e.g. from direct navigation clicks in the dashboard widget)
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (initialDivisionId) {
      setSelectedDivisionId(initialDivisionId);
    }
  }, [initialDivisionId]);

  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);
  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const gameMap = useMemo(() => new Map(appData.games.map((g) => [g.id, g])), [appData.games]);
  const refMap = useMemo(() => new Map((appData.referees || []).map((r) => [r.id, r])), [appData.referees]);

  // Categorize conflicts
  const categorized = useMemo(() => {
    let fieldCount = 0;
    let teamCount = 0;
    let refereeCount = 0;

    for (const c of conflicts) {
      const cat = getConflictCategory(c.type);
      if (cat === 'field') fieldCount++;
      else if (cat === 'team') teamCount++;
      else if (cat === 'referee') refereeCount++;
    }

    return {
      field: fieldCount,
      team: teamCount,
      referee: refereeCount,
    };
  }, [conflicts]);

  // Filtered conflicts list based on active category, division, and severity
  const filteredConflicts = useMemo(() => {
    return conflicts.filter((conflict) => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const cat = getConflictCategory(conflict.type);
        if (cat !== selectedCategory) return false;
      }

      // 2. Division Filter
      if (selectedDivisionId !== 'all') {
        const touchesDivision = conflict.gameIds.some((gId) => {
          const game = gameMap.get(gId);
          return game && game.divisionId === selectedDivisionId;
        });
        if (!touchesDivision) return false;
      }

      // 3. Severity Filter
      if (selectedSeverity !== 'all' && conflict.severity !== selectedSeverity) {
        return false;
      }

      return true;
    });
  }, [conflicts, selectedCategory, selectedDivisionId, selectedSeverity, gameMap]);

  // Quick automated resolution for field conflicts:
  // "If there is a conflict on the field, try choosing one of the teams alternate fields"
  const handleAutoResolveField = (conflict: Conflict) => {
    if (conflict.gameIds.length === 0) return;

    // Pick the second game or the game causing the conflict to move
    const gameToMoveId = conflict.gameIds.length > 1 ? conflict.gameIds[1] : conflict.gameIds[0];
    const targetGame = gameMap.get(gameToMoveId);
    if (!targetGame) return;

    const homeTeam = teamMap.get(targetGame.homeTeamId);

    // 1. Try home team's alternate fields first
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

    // 2. If no home alternate field was open, check any open division field
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
      setResolutionNotice({
        message: `Field conflict resolved: Reassigned match "${homeTeam?.name || 'Home'}" to alternate pitch "${chosenFieldName}".`,
        type: 'success',
      });
      setTimeout(() => onRecheckConflicts(), 100);
    } else {
      // Prompt user to edit manually
      onEditGame(targetGame);
    }
  };

  // Quick automated resolution for referee conflicts:
  // Assign available unbooked certified official or clear referee assignment
  const handleAutoResolveReferee = (conflict: Conflict) => {
    if (conflict.gameIds.length === 0) return;

    // Target game to adjust
    const gameToAdjustId = conflict.gameIds.length > 1 ? conflict.gameIds[1] : conflict.gameIds[0];
    const targetGame = gameMap.get(gameToAdjustId);
    if (!targetGame) return;

    const availableRefs = getAvailableRefereesAtSlot(
      appData,
      targetGame.date,
      targetGame.time,
      targetGame.divisionId,
      targetGame.id
    ).filter((r) => !r.isBusy && !r.isBlackout);

    if (availableRefs.length > 0) {
      // Choose preferred first
      const candidate = availableRefs.find((r) => r.isPreferred) || availableRefs[0];
      const updatedGame: Game = {
        ...targetGame,
        refereeId: candidate.referee.id,
      };
      onUpdateGame(updatedGame);
      setResolutionNotice({
        message: `Referee conflict resolved: Assigned available official "${candidate.referee.name}" to match slot on ${targetGame.date} at ${targetGame.time}.`,
        type: 'success',
      });
      setTimeout(() => onRecheckConflicts(), 100);
    } else {
      // Unassign the conflicted referee to eliminate double-booking
      const updatedGame: Game = {
        ...targetGame,
        refereeId: undefined,
      };
      onUpdateGame(updatedGame);
      setResolutionNotice({
        message: `Referee collision cleared: Unassigned official from match on ${targetGame.date} to remove double-booking. Assign a replacement at your convenience.`,
        type: 'info',
      });
      setTimeout(() => onRecheckConflicts(), 100);
    }
  };

  // Handle widget category filter jump
  const handleWidgetNavigate = (cat?: ConflictCategory, divId?: string) => {
    setSelectedCategory(cat || 'all');
    if (divId) {
      setSelectedDivisionId(divId);
    } else {
      setSelectedDivisionId('all');
    }
  };

  return (
    <div className="space-y-6">
      {/* Conflict Summary Dashboard Widget */}
      {showSummaryWidget && (
        <ConflictSummaryWidget
          appData={appData}
          conflicts={conflicts}
          onNavigateToConflictResolution={handleWidgetNavigate}
          onNavigateToTab={onNavigateToTab}
          onRecheckConflicts={onRecheckConflicts}
        />
      )}

      {/* Main Resolution Controls Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Schedule Conflict Resolution Engine
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Filter by conflict type (field, team, or referee) and division to resolve scheduling collisions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSummaryWidget((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{showSummaryWidget ? 'Hide Summary Widget' : 'Show Summary Widget'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResolutionNotice(null);
                onRecheckConflicts();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Re-scan Schedule</span>
            </button>
          </div>
        </div>

        {/* Resolution Toast Notification */}
        {resolutionNotice && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
              resolutionNotice.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : resolutionNotice.type === 'info'
                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{resolutionNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setResolutionNotice(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Conflict Type & Division Interactive Filter Tabs */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs: All | Field | Team | Referee */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>All Conflicts</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {conflicts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('field')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === 'field'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : categorized.field > 0
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Field Conflicts</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'field' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {categorized.field}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('team')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === 'team'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : categorized.team > 0
                  ? 'text-amber-800 hover:bg-amber-50'
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Conflicts</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'team' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {categorized.team}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('referee')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === 'referee'
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : categorized.referee > 0
                  ? 'text-purple-800 hover:bg-purple-50'
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Referee Conflicts</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'referee' ? 'bg-white text-purple-800' : 'bg-purple-100 text-purple-900'
                }`}
              >
                {categorized.referee}
              </span>
            </button>
          </div>

          {/* Division & Severity Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="conflict-div-select" className="font-medium text-slate-700">Division:</label>
              <select
                id="conflict-div-select"
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
              >
                <option value="all">All Divisions ({conflicts.length})</option>
                {appData.divisions.map((div) => {
                  const divConflicts = conflicts.filter((c) =>
                    c.gameIds.some((gId) => gameMap.get(gId)?.divisionId === div.id)
                  );
                  return (
                    <option key={div.id} value={div.id}>
                      {div.name} ({divConflicts.length})
                    </option>
                  );
                })}
              </select>
            </div>

            {(selectedCategory !== 'all' || selectedDivisionId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedDivisionId('all');
                  setSelectedSeverity('all');
                }}
                className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline px-1.5 py-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Zero Conflicts State */}
      {conflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Zero Conflicts Detected across All Divisions
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Every pitch assignment, kickoff time slot, team rest schedule, and referee assignment is completely aligned.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRecheckConflicts}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Re-scan League Schedule</span>
            </button>
          </div>
        </div>
      ) : filteredConflicts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            No conflicts match the active filters
          </h3>
          <p className="text-xs text-slate-500">
            Category: <strong className="text-slate-700 uppercase">{selectedCategory}</strong> · Division:{' '}
            <strong className="text-slate-700">
              {selectedDivisionId === 'all'
                ? 'All'
                : divisionMap.get(selectedDivisionId)?.name || selectedDivisionId}
            </strong>
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedDivisionId('all');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              <span>Clear filters to view all {conflicts.length} conflicts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Conflicts List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span className="font-bold text-rose-700">
              Showing {filteredConflicts.length} of {conflicts.length} unresolved schedule{' '}
              {conflicts.length === 1 ? 'conflict' : 'conflicts'}
            </span>
            <span className="text-slate-400">Click automated resolve buttons or edit match directly</span>
          </div>

          <div className="space-y-3.5">
            {filteredConflicts.map((conflict) => {
              const affectedGames = conflict.gameIds
                .map((id) => gameMap.get(id))
                .filter(Boolean) as Game[];
              const field = conflict.fieldId ? fieldMap.get(conflict.fieldId) : null;
              const category = getConflictCategory(conflict.type);

              return (
                <div
                  key={conflict.id}
                  className={`bg-white rounded-xl border p-4 sm:p-5 shadow-xs space-y-3.5 ${
                    category === 'field'
                      ? 'border-rose-200 hover:border-rose-300'
                      : category === 'team'
                      ? 'border-amber-200 hover:border-amber-300'
                      : 'border-purple-200 hover:border-purple-300'
                  }`}
                >
                  {/* Title & Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          category === 'field'
                            ? 'bg-rose-100 text-rose-700'
                            : category === 'team'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {category === 'field' && <MapPin className="w-4 h-4" />}
                        {category === 'team' && <Users className="w-4 h-4" />}
                        {category === 'referee' && <UserCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 leading-tight">
                            {conflict.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                              category === 'field'
                                ? 'bg-rose-100 text-rose-800'
                                : category === 'team'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {category} Conflict
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          {conflict.date} at {conflict.time} {field && `· ${field.name}`}
                        </p>
                      </div>
                    </div>

                    <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-md self-start sm:self-auto font-mono">
                      {conflict.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {conflict.description}
                  </p>

                  {/* Conflicting Games details */}
                  <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-600 uppercase text-[10px] tracking-wider block">
                      Involved Match{affectedGames.length > 1 ? 'es' : ''} ({affectedGames.length}):
                    </span>
                    <div className="space-y-1.5">
                      {affectedGames.map((g) => {
                        const hTeam = teamMap.get(g.homeTeamId);
                        const aTeam = teamMap.get(g.awayTeamId);
                        const div = divisionMap.get(g.divisionId);
                        const f = fieldMap.get(g.fieldId);
                        const ref = g.refereeId ? refMap.get(g.refereeId) : null;

                        return (
                          <div
                            key={g.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-slate-200"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900">
                                {hTeam?.name || 'Home'} vs {g.isByePractice ? 'Bye (Practice)' : aTeam?.name || 'Away'}
                              </span>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700">{div?.name}</span>
                                <span>·</span>
                                <span>Pitch: {f?.name} ({f?.size})</span>
                                {ref && (
                                  <>
                                    <span>·</span>
                                    <span className="text-purple-700 font-medium">Official: {ref.name}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onEditGame(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md self-start sm:self-auto cursor-pointer transition-colors"
                            >
                              <Edit className="w-3 h-3 text-slate-500" />
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
                      <strong className="text-slate-800">Recommendation:</strong>{' '}
                      {conflict.suggestedResolution || 'Reassign venue, change time slot, or reassign referee.'}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {category === 'field' && (
                        <button
                          type="button"
                          onClick={() => handleAutoResolveField(conflict)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          <span>Auto-Resolve (Use Alternate Pitch)</span>
                        </button>
                      )}

                      {category === 'referee' && (
                        <button
                          type="button"
                          onClick={() => handleAutoResolveReferee(conflict)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-white" />
                          <span>Auto-Assign Open Official</span>
                        </button>
                      )}

                      {category === 'team' && affectedGames.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onEditGame(affectedGames[0])}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-white" />
                          <span>Reschedule Team Slot</span>
                        </button>
                      )}

                      {onNavigateToTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateToTab(category === 'field' ? 'fields' : category === 'team' ? 'teams' : 'referees')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <span>Open {category === 'field' ? 'Fields' : category === 'team' ? 'Teams' : 'Referees'} Config</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      )}
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
