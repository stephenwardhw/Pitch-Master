import React, { useMemo } from 'react';
import { AppData, Conflict, ConflictType } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Users,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Layers,
  ChevronRight,
} from 'lucide-react';

export type ConflictCategory = 'field' | 'team' | 'referee';

export interface ConflictSummaryWidgetProps {
  appData: AppData;
  conflicts: Conflict[];
  onNavigateToConflictResolution: (category?: ConflictCategory, divisionId?: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onRecheckConflicts?: () => void;
  compact?: boolean;
}

export function getConflictCategory(type: ConflictType): ConflictCategory {
  switch (type) {
    case 'field_double_booked':
    case 'field_blackout':
    case 'field_not_in_division':
      return 'field';
    case 'team_double_booked':
    case 'team_blackout':
    case 'season_blackout':
      return 'team';
    case 'referee_double_booked':
    case 'referee_blackout':
      return 'referee';
    default:
      return 'field';
  }
}

export const ConflictSummaryWidget: React.FC<ConflictSummaryWidgetProps> = ({
  appData,
  conflicts,
  onNavigateToConflictResolution,
  onNavigateToTab,
  onRecheckConflicts,
  compact = false,
}) => {
  // Build lookup maps
  const gameMap = useMemo(() => new Map(appData.games.map((g) => [g.id, g])), [appData.games]);
  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);

  // Aggregate conflicts by type
  const {
    fieldConflicts,
    teamConflicts,
    refereeConflicts,
    errorCount,
    warningCount,
    divisionConflictCounts,
    fieldBreakdown,
    teamBreakdown,
    refereeBreakdown,
  } = useMemo(() => {
    const fields: Conflict[] = [];
    const teams: Conflict[] = [];
    const referees: Conflict[] = [];
    let errors = 0;
    let warnings = 0;

    const divCounts: Record<string, { total: number; field: number; team: number; referee: number }> = {};
    appData.divisions.forEach((div) => {
      divCounts[div.id] = { total: 0, field: 0, team: 0, referee: 0 };
    });

    const fBreakdown = { doubleBooked: 0, blackout: 0, unassignedField: 0 };
    const tBreakdown = { doubleBooked: 0, blackout: 0, seasonBlackout: 0 };
    const rBreakdown = { doubleBooked: 0, blackout: 0 };

    for (const c of conflicts) {
      if (c.severity === 'error') errors++;
      else warnings++;

      const category = getConflictCategory(c.type);

      if (category === 'field') {
        fields.push(c);
        if (c.type === 'field_double_booked') fBreakdown.doubleBooked++;
        else if (c.type === 'field_blackout') fBreakdown.blackout++;
        else if (c.type === 'field_not_in_division') fBreakdown.unassignedField++;
      } else if (category === 'team') {
        teams.push(c);
        if (c.type === 'team_double_booked') tBreakdown.doubleBooked++;
        else if (c.type === 'team_blackout') tBreakdown.blackout++;
        else if (c.type === 'season_blackout') tBreakdown.seasonBlackout++;
      } else {
        referees.push(c);
        if (c.type === 'referee_double_booked') rBreakdown.doubleBooked++;
        else if (c.type === 'referee_blackout') rBreakdown.blackout++;
      }

      // Attribute to division(s)
      const touchedDivisions = new Set<string>();
      for (const gId of c.gameIds) {
        const game = gameMap.get(gId);
        if (game?.divisionId) {
          touchedDivisions.add(game.divisionId);
        }
      }

      touchedDivisions.forEach((divId) => {
        if (!divCounts[divId]) {
          divCounts[divId] = { total: 0, field: 0, team: 0, referee: 0 };
        }
        divCounts[divId].total++;
        if (category === 'field') divCounts[divId].field++;
        else if (category === 'team') divCounts[divId].team++;
        else divCounts[divId].referee++;
      });
    }

    return {
      fieldConflicts: fields,
      teamConflicts: teams,
      refereeConflicts: referees,
      errorCount: errors,
      warningCount: warnings,
      divisionConflictCounts: divCounts,
      fieldBreakdown: fBreakdown,
      teamBreakdown: tBreakdown,
      refereeBreakdown: rBreakdown,
    };
  }, [conflicts, gameMap, appData.divisions]);

  const totalConflicts = conflicts.length;

  // Render Zero-Conflict State
  if (totalConflicts === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-linear-to-r from-emerald-50/80 via-white to-emerald-50/40 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Schedule Conflict Summary: 100% Conflict-Free
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero unresolved pitch overlaps, team double-bookings, or referee collisions across all{' '}
                <strong className="text-slate-700">{appData.divisions.length} divisions</strong> ({appData.games.length} scheduled matches).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRecheckConflicts && (
              <button
                type="button"
                onClick={onRecheckConflicts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Re-run automated collision scan"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Re-scan Schedule</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateToConflictResolution()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <span>Resolution Engine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Conflicts Summary Dashboard Widget
  return (
    <div className="rounded-xl border border-rose-200 bg-white shadow-xs overflow-hidden">
      {/* Widget Header */}
      <div className="px-5 py-3.5 bg-linear-to-r from-rose-50/90 via-white to-amber-50/40 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Conflict Summary Dashboard
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                {totalConflicts} {totalConflicts === 1 ? 'Conflict' : 'Conflicts'} Unresolved
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>({errorCount} critical, {warningCount} warnings)</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated across all {appData.divisions.length} divisions. Click any category or division to resolve.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRecheckConflicts && (
            <button
              type="button"
              onClick={onRecheckConflicts}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Recheck all match slots"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Re-check</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateToConflictResolution()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <span>Resolve All ({totalConflicts})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3 Main Categories Grid */}
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Field Conflicts Card */}
        <div
          className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
            fieldConflicts.length > 0
              ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
              : 'bg-slate-50/60 border-slate-200 opacity-80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    fieldConflicts.length > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Field Conflicts
                  </h4>
                  <span className="text-[11px] text-slate-500">Pitches & Venues</span>
                </div>
              </div>

              <span
                className={`text-base font-extrabold ${
                  fieldConflicts.length > 0 ? 'text-rose-700' : 'text-emerald-600'
                }`}
              >
                {fieldConflicts.length}
              </span>
            </div>

            {/* Breakdown Details */}
            <div className="space-y-1 my-3 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Double Bookings:</span>
                <strong className={fieldBreakdown.doubleBooked > 0 ? 'text-rose-700' : 'text-slate-700'}>
                  {fieldBreakdown.doubleBooked}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Blackout Dates:</span>
                <strong className={fieldBreakdown.blackout > 0 ? 'text-rose-700' : 'text-slate-700'}>
                  {fieldBreakdown.blackout}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Unassigned to Division:</span>
                <strong className={fieldBreakdown.unassignedField > 0 ? 'text-amber-700' : 'text-slate-700'}>
                  {fieldBreakdown.unassignedField}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('fields')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                title="Jump to Fields Page"
              >
                <span>Fields Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateToConflictResolution('field')}
              disabled={fieldConflicts.length === 0}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                fieldConflicts.length > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-400 cursor-default'
              }`}
            >
              <span>{fieldConflicts.length > 0 ? 'Resolve Fields' : 'No Field Conflicts'}</span>
              {fieldConflicts.length > 0 && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2. Team Conflicts Card */}
        <div
          className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
            teamConflicts.length > 0
              ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
              : 'bg-slate-50/60 border-slate-200 opacity-80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    teamConflicts.length > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Team Conflicts
                  </h4>
                  <span className="text-[11px] text-slate-500">Clubs & Rosters</span>
                </div>
              </div>

              <span
                className={`text-base font-extrabold ${
                  teamConflicts.length > 0 ? 'text-amber-800' : 'text-emerald-600'
                }`}
              >
                {teamConflicts.length}
              </span>
            </div>

            {/* Breakdown Details */}
            <div className="space-y-1 my-3 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Simultaneous Bookings:</span>
                <strong className={teamBreakdown.doubleBooked > 0 ? 'text-amber-800' : 'text-slate-700'}>
                  {teamBreakdown.doubleBooked}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Team Blackout Dates:</span>
                <strong className={teamBreakdown.blackout > 0 ? 'text-amber-800' : 'text-slate-700'}>
                  {teamBreakdown.blackout}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Season Break / Holidays:</span>
                <strong className={teamBreakdown.seasonBlackout > 0 ? 'text-amber-800' : 'text-slate-700'}>
                  {teamBreakdown.seasonBlackout}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px] opacity-75">
                <span className="text-slate-500">Status:</span>
                <span>{teamConflicts.length > 0 ? 'Requires Rescheduling' : 'Balanced'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('teams')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                title="Jump to Teams Page"
              >
                <span>Teams Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateToConflictResolution('team')}
              disabled={teamConflicts.length === 0}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                teamConflicts.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-400 cursor-default'
              }`}
            >
              <span>{teamConflicts.length > 0 ? 'Resolve Teams' : 'No Team Conflicts'}</span>
              {teamConflicts.length > 0 && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 3. Referee Conflicts Card */}
        <div
          className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
            refereeConflicts.length > 0
              ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
              : 'bg-slate-50/60 border-slate-200 opacity-80'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    refereeConflicts.length > 0
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Referee Conflicts
                  </h4>
                  <span className="text-[11px] text-slate-500">Match Officials</span>
                </div>
              </div>

              <span
                className={`text-base font-extrabold ${
                  refereeConflicts.length > 0 ? 'text-purple-800' : 'text-emerald-600'
                }`}
              >
                {refereeConflicts.length}
              </span>
            </div>

            {/* Breakdown Details */}
            <div className="space-y-1 my-3 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-100">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Official Double-Bookings:</span>
                <strong className={refereeBreakdown.doubleBooked > 0 ? 'text-purple-800' : 'text-slate-700'}>
                  {refereeBreakdown.doubleBooked}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Unavailable / Blackouts:</span>
                <strong className={refereeBreakdown.blackout > 0 ? 'text-purple-800' : 'text-slate-700'}>
                  {refereeBreakdown.blackout}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[11px] opacity-75">
                <span className="text-slate-500">Status:</span>
                <span>{refereeConflicts.length > 0 ? 'Reassign Officials' : 'All Clear'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('referees')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                title="Jump to Referees Page"
              >
                <span>Referees Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateToConflictResolution('referee')}
              disabled={refereeConflicts.length === 0}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                refereeConflicts.length > 0
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-400 cursor-default'
              }`}
            >
              <span>{refereeConflicts.length > 0 ? 'Resolve Referees' : 'No Ref Conflicts'}</span>
              {refereeConflicts.length > 0 && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Cross-Division Breakdown Strip */}
      <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Division Breakdown:</span>
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            {appData.divisions.map((div) => {
              const dCount = divisionConflictCounts[div.id]?.total || 0;
              const hasConflicts = dCount > 0;

              return (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => onNavigateToConflictResolution(undefined, div.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer border ${
                    hasConflicts
                      ? 'bg-white border-rose-200 text-rose-800 hover:bg-rose-50 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                  }`}
                  title={`${div.name}: ${dCount} conflict${dCount === 1 ? '' : 's'}. Click to inspect & resolve.`}
                >
                  <span>{div.name}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      hasConflicts ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {dCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToConflictResolution()}
          className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span>Open Full Resolution Engine</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
