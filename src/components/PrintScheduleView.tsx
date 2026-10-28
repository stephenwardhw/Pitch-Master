import React, { useState, useMemo } from 'react';
import { AppData, Division, Field, Game, Team } from '../types';
import {
  Printer,
  X,
  Calendar,
  Users,
  MapPin,
  Check,
  FileText,
  Phone,
  Mail,
  Filter,
  Download,
  UserCheck,
} from 'lucide-react';

interface PrintScheduleViewProps {
  appData: AppData;
  initialDivisionId?: string;
  initialTeamId?: string;
  onClose: () => void;
}

// Pure helper to format ISO date string (YYYY-MM-DD) into readable format
function formatDateFriendly(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Pure helper to determine the Monday of the calendar week for any given date string
function getMondayOfDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(y, m - 1, d - diffToMonday);
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const date = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  } catch {
    return dateStr;
  }
}

export const PrintScheduleView: React.FC<PrintScheduleViewProps> = ({
  appData,
  initialDivisionId = 'all',
  initialTeamId = 'all',
  onClose,
}) => {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(initialDivisionId);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId);
  const [includeTeamContacts, setIncludeTeamContacts] = useState<boolean>(true);
  const [includePitchDirectory, setIncludePitchDirectory] = useState<boolean>(true);
  const [includeRefereeDirectory, setIncludeRefereeDirectory] = useState<boolean>(false);
  const [includePracticeSessions, setIncludePracticeSessions] = useState<boolean>(true);
  const [forceWeekPageBreaks, setForceWeekPageBreaks] = useState<boolean>(true);
  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable'>('compact');

  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);
  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const refereeMap = useMemo(() => new Map((appData.referees || []).map((r) => [r.id, r])), [appData.referees]);
  const printableReferees = useMemo(() => (appData.referees || []).filter((r) => r.isActive), [appData.referees]);

  // Filtered games
  const printableGames = useMemo(() => {
    return appData.games
      .filter((g) => {
        if (g.status === 'cancelled') return false;
        if (selectedDivisionId !== 'all' && g.divisionId !== selectedDivisionId) return false;
        if (
          selectedTeamId !== 'all' &&
          g.homeTeamId !== selectedTeamId &&
          g.awayTeamId !== selectedTeamId
        ) {
          return false;
        }
        if (!includePracticeSessions && g.isByePractice) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [appData.games, selectedDivisionId, selectedTeamId, includePracticeSessions]);

  // Group games into distinct Game Weeks (Monday to Sunday cycle)
  const groupedWeeks = useMemo(() => {
    const weekMap = new Map<string, { daysMap: Map<string, Game[]>; totalGames: number }>();

    for (const game of printableGames) {
      const monday = getMondayOfDate(game.date);
      if (!weekMap.has(monday)) {
        weekMap.set(monday, { daysMap: new Map(), totalGames: 0 });
      }
      const weekEntry = weekMap.get(monday)!;
      weekEntry.totalGames++;
      if (!weekEntry.daysMap.has(game.date)) {
        weekEntry.daysMap.set(game.date, []);
      }
      weekEntry.daysMap.get(game.date)!.push(game);
    }

    const sortedMondays = Array.from(weekMap.keys()).sort();

    return sortedMondays.map((monday, index) => {
      const weekEntry = weekMap.get(monday)!;
      const sortedDatesInWeek = Array.from(weekEntry.daysMap.keys()).sort();
      const days = sortedDatesInWeek.map((dateStr) => ({
        dateStr,
        formattedDate: formatDateFriendly(dateStr),
        games: weekEntry.daysMap.get(dateStr)!,
      }));

      const firstDateFriendly = formatDateFriendly(sortedDatesInWeek[0]);
      const lastDateFriendly = formatDateFriendly(sortedDatesInWeek[sortedDatesInWeek.length - 1]);
      const dateRangeFormatted =
        sortedDatesInWeek.length === 1
          ? firstDateFriendly
          : `${firstDateFriendly} – ${lastDateFriendly}`;

      return {
        weekKey: monday,
        weekNumber: index + 1,
        label: `Game Week ${index + 1}`,
        dateRangeFormatted,
        days,
        totalGames: weekEntry.totalGames,
      };
    });
  }, [printableGames]);

  // Retain day grouping for backwards compatibility
  const groupedByDate = useMemo(() => {
    const map: { [date: string]: Game[] } = {};
    for (const game of printableGames) {
      if (!map[game.date]) map[game.date] = [];
      map[game.date].push(game);
    }
    return map;
  }, [printableGames]);

  const sortedDates = useMemo(() => Object.keys(groupedByDate).sort(), [groupedByDate]);

  // Filtered teams for contact directory
  const printableTeams = useMemo(() => {
    return appData.teams
      .filter((t) => {
        if (t.isBye) return false;
        if (selectedDivisionId !== 'all' && t.divisionId !== selectedDivisionId) return false;
        if (selectedTeamId !== 'all' && t.id !== selectedTeamId) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [appData.teams, selectedDivisionId, selectedTeamId]);

  // Filtered pitches
  const printableFields = useMemo(() => {
    if (selectedDivisionId === 'all') return appData.fields;
    return appData.fields.filter(
      (f) => !f.assignedDivisionIds || f.assignedDivisionIds.includes(selectedDivisionId)
    );
  }, [appData.fields, selectedDivisionId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-start overflow-y-auto print:static print:inset-auto print:z-auto print:bg-white print:overflow-visible print:h-auto print:min-h-0 print:block print-modal-container print-modal-overlay">
      {/* Interactive Toolbar (Hidden during print) */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-md no-print">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Print & PDF Layout Preview
              </h2>
              <p className="text-[11px] text-slate-500">
                Formatted for standard 8.5x11 / A4 paper with page headers and team contact directory
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Division Filter */}
            <select
              value={selectedDivisionId}
              onChange={(e) => {
                setSelectedDivisionId(e.target.value);
                setSelectedTeamId('all');
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-hidden"
            >
              <option value="all">All Divisions ({appData.divisions.length})</option>
              {appData.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Team Filter */}
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-hidden"
            >
              <option value="all">All Teams</option>
              {appData.teams
                .filter(
                  (t) =>
                    !t.isBye &&
                    (selectedDivisionId === 'all' || t.divisionId === selectedDivisionId)
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>

            {/* Checkbox Options */}
            <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTeamContacts}
                onChange={(e) => setIncludeTeamContacts(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Team Contacts</span>
            </label>

            <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includePitchDirectory}
                onChange={(e) => setIncludePitchDirectory(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Pitch Directory</span>
            </label>

            {printableReferees.length > 0 && (
              <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer" title="Include referee directory appendix in printout">
                <input
                  type="checkbox"
                  checked={includeRefereeDirectory}
                  onChange={(e) => setIncludeRefereeDirectory(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900"
                />
                <span>Referee Directory</span>
              </label>
            )}

            <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer" title="Enforce page breaks between game weeks or specific match groups">
              <input
                type="checkbox"
                checked={forceWeekPageBreaks}
                onChange={(e) => setForceWeekPageBreaks(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Page Break Per Week</span>
            </label>

            {/* Print Primary Action */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close Print View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Printable Sheet Viewport */}
      <div className={`flex-1 py-8 px-4 sm:px-6 print:p-0 print:m-0 print:overflow-visible print:block ${!forceWeekPageBreaks ? 'no-force-week-breaks' : ''}`}>
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl p-8 sm:p-12 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:block print:overflow-visible text-slate-900 font-sans print-root">
          {/* Document Header */}
          <div className="border-b-2 border-slate-300 print:border-slate-400 pb-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm print:border print:border-slate-400">
                    ⚽
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {appData.seasonConfig.seasonName}
                  </h1>
                </div>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  Official Match Schedule & Team Directory
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2 font-mono">
                  <span>
                    Season Span: <strong>{appData.seasonConfig.startDate}</strong> to{' '}
                    <strong>{appData.seasonConfig.endDate}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Generated: <strong>{new Date().toLocaleDateString()}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    File: <strong>{appData.fileName}</strong>
                  </span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-4 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 print:bg-white print:border-slate-400">
                <div className="text-center px-2">
                  <span className="block text-slate-400 uppercase font-mono text-[10px]">Matches</span>
                  <span className="font-bold text-base font-mono tabular-nums">{printableGames.length}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-center px-2">
                  <span className="block text-slate-400 uppercase font-mono text-[10px]">Game Weeks</span>
                  <span className="font-bold text-base font-mono tabular-nums">{groupedWeeks.length}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-center px-2">
                  <span className="block text-slate-400 uppercase font-mono text-[10px]">Teams</span>
                  <span className="font-bold text-base font-mono tabular-nums">{printableTeams.length}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-center px-2">
                  <span className="block text-slate-400 uppercase font-mono text-[10px]">Pitches</span>
                  <span className="font-bold text-base font-mono tabular-nums">{printableFields.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Schedule Matches Section */}
          <div className="space-y-6 mb-10">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" />
                <span>Scheduled Games ({printableGames.length} Games across {groupedWeeks.length} Game Weeks)</span>
              </h2>
              {selectedDivisionId !== 'all' && (
                <span className="text-xs font-semibold text-slate-600">
                  Division: {divisionMap.get(selectedDivisionId)?.name}
                </span>
              )}
            </div>

            {groupedWeeks.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 italic">
                No games scheduled matching the current filters.
              </div>
            ) : (
              <div className="space-y-8">
                {groupedWeeks.map((week) => (
                  <div
                    key={week.weekKey}
                    className="print-game-week game-week match-week week-group space-y-4"
                    data-game-week={week.weekKey}
                  >
                    {/* Game Week Header Banner */}
                    <div
                      className="bg-slate-900 text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs print:bg-slate-50 print:text-slate-900 print:border print:border-slate-300 print-avoid-break print-game-week-header"
                      style={{ borderColor: '#cbd5e1' }}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-extrabold text-sm uppercase tracking-wider text-emerald-400 print:text-emerald-800 week-label">
                          {week.label}
                        </span>
                        <span className="text-slate-400 text-xs hidden sm:inline print:text-slate-400">·</span>
                        <span className="text-xs text-slate-200 font-medium print:text-slate-700">
                          {week.dateRangeFormatted}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-emerald-300 font-bold tabular-nums print:text-slate-700">
                        {week.totalGames} {week.totalGames === 1 ? 'match' : 'matches'}
                      </span>
                    </div>

                    {/* Day Tables in this week */}
                    <div className="space-y-4">
                      {week.days.map((day) => (
                        <div
                          key={day.dateStr}
                          className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid print-day-block day-group print:border-slate-400"
                        >
                          {/* Date Header Strip */}
                          <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between print:bg-slate-200">
                            <span className="font-bold text-xs uppercase tracking-wide text-slate-900">
                              {day.formattedDate}
                            </span>
                            <span className="text-xs font-mono text-slate-600 tabular-nums">
                              {day.games.length} {day.games.length === 1 ? 'match' : 'matches'}
                            </span>
                          </div>

                          {/* Games Table for this date */}
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold print:bg-white">
                              <tr>
                                <th className="py-2 px-3 w-20">Time</th>
                                <th className="py-2 px-3 w-32">Division</th>
                                <th className="py-2 px-3">Home Team</th>
                                <th className="py-2 px-3">Away Team</th>
                                <th className="py-2 px-3">Pitch / Facility</th>
                                <th className="py-2 px-3 w-36">Pitch Address</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {day.games.map((g) => {
                                const home = teamMap.get(g.homeTeamId);
                                const away = teamMap.get(g.awayTeamId);
                                const div = divisionMap.get(g.divisionId);
                                const field = fieldMap.get(g.fieldId);

                                return (
                                  <tr key={g.id} className="hover:bg-slate-50 break-inside-avoid">
                                    <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                      {g.time}
                                    </td>
                                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                      {div?.name || 'League'}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-slate-900">
                                      {home?.name || 'TBD'}
                                      {home?.jerseyColor && (
                                        <span className="text-[10px] text-slate-500 font-normal block">
                                          Jersey: {home.jerseyColor}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-slate-900">
                                      {g.isByePractice ? (
                                        <span className="text-amber-800 font-medium italic">
                                          Practice Session (Bye Round)
                                        </span>
                                      ) : (
                                        <>
                                          {away?.name || 'TBD'}
                                          {away?.jerseyColor && (
                                            <span className="text-[10px] text-slate-500 font-normal block">
                                              Jersey: {away.jerseyColor}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-slate-800 font-medium">
                                      {field?.name || 'Unassigned'}
                                      {field?.size && (
                                        <span className="text-[10px] text-slate-500 font-normal block">
                                          Format: {field.size}
                                        </span>
                                      )}
                                      {g.refereeId && refereeMap.has(g.refereeId) && (
                                        <span className="text-[10px] text-emerald-800 font-semibold block print:text-slate-700">
                                          Ref: {refereeMap.get(g.refereeId)?.name}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-[11px] text-slate-600">
                                      {field?.address || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Team Contacts & Notes Directory (Requested in user brief) */}
          {includeTeamContacts && printableTeams.length > 0 && (
            <div className="space-y-4 mb-10 print-section print-directory-section team-contacts-section">
              <div className="border-b border-slate-300 pb-2 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <span>Team Contact & Coach Directory ({printableTeams.length} Teams)</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  Official contacts, emergency info, and pitch assignments
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden print:border-slate-400">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-semibold text-slate-700 print:bg-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Team Name</th>
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">Head Coach / Contact</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Home Pitch</th>
                      <th className="py-2.5 px-3">Notes & Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printableTeams.map((t) => {
                      const div = divisionMap.get(t.divisionId);
                      const primaryField = fieldMap.get(t.primaryHomeFieldId);

                      return (
                        <tr key={t.id} className="hover:bg-slate-50 break-inside-avoid">
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {t.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{div?.name}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {t.contactName || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {t.contactPhone || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 truncate max-w-[150px]">
                            {t.contactEmail || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            {primaryField?.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 leading-snug">
                            {t.notes || (t.jerseyColor ? `Jersey: ${t.jerseyColor}` : '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Pitch & Facilities Directory */}
          {includePitchDirectory && printableFields.length > 0 && (
            <div className="space-y-4 mb-6 print-section print-directory-section pitch-directory-section">
              <div className="border-b border-slate-300 pb-2 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-700" />
                  <span>Pitch Locations & Static Address Directory ({printableFields.length} Pitches)</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  Driving addresses and field format
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden print:border-slate-400">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-semibold text-slate-700 print:bg-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Pitch Name</th>
                      <th className="py-2.5 px-3">Size / Format</th>
                      <th className="py-2.5 px-3">Surface</th>
                      <th className="py-2.5 px-3">Static GPS Street Address</th>
                      <th className="py-2.5 px-3">Facility Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printableFields.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 break-inside-avoid">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {f.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{f.size}</td>
                        <td className="py-2.5 px-3 text-slate-700">{f.surfaceType || 'Pitch'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 leading-snug">
                          {f.address || 'Address not listed'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 leading-snug">
                          {f.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Referee Directory Appendix */}
          {includeRefereeDirectory && printableReferees.length > 0 && (
            <div className="space-y-4 mb-6 print-section print-directory-section referee-directory-section">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-700" />
                  <span>Match Officials & Referee Directory ({printableReferees.length} Registered Officials)</span>
                </h2>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden print:border-slate-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-semibold text-slate-700 print:bg-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Official Name</th>
                      <th className="py-2.5 px-3">Certification Level</th>
                      <th className="py-2.5 px-3">Badge Number</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printableReferees.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 break-inside-avoid">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {r.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{r.certificationLevel}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{r.badgeNumber || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {r.hideContactPublicly ? (
                            <span className="text-slate-400 italic">Name Only (Private)</span>
                          ) : (
                            r.email || '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {r.hideContactPublicly ? (
                            <span className="text-slate-400 italic">Private</span>
                          ) : (
                            r.phone || '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Document Footer */}
          <div className="pt-6 border-t border-slate-300 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Generated by <strong>PitchMaster Soccer Scheduler</strong> · Client Dataset: {appData.fileName}
            </span>
            <span className="font-mono">
              Page 1 of 1 · Print layout formatted for referee, coach, and league distribution
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
