import React, { useState, useMemo } from 'react';
import { AppData, Conflict, Division, Field, Game, Team } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  Plus,
  ArrowRightLeft,
  Edit,
  Trash2,
  Printer,
  Download,
  AlertTriangle,
  Info,
  Phone,
  Mail,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  CalendarPlus,
  ChevronDown,
  Users,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { ExportCalendarModal } from './modals/ExportCalendarModal';
import { PrintScheduleView } from './PrintScheduleView';
import { publishScheduleToServer, downloadLeagueScheduleJson } from '../utils/serverSync';
import {
  buildEventPayload,
  createGoogleCalendarUrl,
  createOutlookCalendarUrl,
  downloadIcsFile,
  generateIcsContent,
} from '../utils/calendarExport';

interface SchedulePageProps {
  appData: AppData;
  conflicts: Conflict[];
  onUpdateGame: (updatedGame: Game) => void;
  onDeleteGame: (gameId: string) => void;
  onAddGame: (newGame: Game) => void;
  onSelectTeamContact: (team: Team, divisionName?: string) => void;
  onSelectFieldMap: (field: Field) => void;
  onEditGame: (game: Game) => void;
  onRegenerateSchedule: () => void;
  onSwitchToPublicPortal?: () => void;
}

export const SchedulePage: React.FC<SchedulePageProps> = ({
  appData,
  conflicts,
  onUpdateGame,
  onDeleteGame,
  onAddGame,
  onSelectTeamContact,
  onSelectFieldMap,
  onEditGame,
  onRegenerateSchedule,
  onSwitchToPublicPortal,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedField, setSelectedField] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gameTypeFilter, setGameTypeFilter] = useState<'all' | 'regular' | 'practice'>('all');
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState<boolean>(false);
  const [activeCalDropdownGameId, setActiveCalDropdownGameId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Maps for rapid lookup
  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);
  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);

  // Extract all unique dates from games in ascending order
  const allGameDates = useMemo(() => {
    return Array.from(new Set(appData.games.map((g) => g.date)))
      .filter(Boolean)
      .sort();
  }, [appData.games]);

  const minGameDate = allGameDates[0] || appData.seasonConfig.startDate || '';
  const maxGameDate = allGameDates[allGameDates.length - 1] || appData.seasonConfig.endDate || '';

  // Set of game IDs that have conflicts
  const conflictedGameIdMap = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const gId of c.gameIds) {
        if (!map.has(gId)) map.set(gId, []);
        map.get(gId)!.push(c);
      }
    }
    return map;
  }, [conflicts]);

  // Filtered games
  const filteredGames = useMemo(() => {
    return appData.games.filter((g) => {
      if (selectedDivision !== 'all' && g.divisionId !== selectedDivision) return false;
      if (selectedTeam !== 'all' && g.homeTeamId !== selectedTeam && g.awayTeamId !== selectedTeam) {
        return false;
      }
      if (selectedField !== 'all' && g.fieldId !== selectedField) return false;
      if (gameTypeFilter === 'practice' && !g.isByePractice) return false;
      if (gameTypeFilter === 'regular' && g.isByePractice) return false;
      if (showConflictsOnly && !conflictedGameIdMap.has(g.id)) return false;

      // Date range filtering
      if (startDateFilter && g.date < startDateFilter) return false;
      if (endDateFilter && g.date > endDateFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const homeName = teamMap.get(g.homeTeamId)?.name.toLowerCase() || '';
        const awayName = teamMap.get(g.awayTeamId)?.name.toLowerCase() || '';
        const fieldName = fieldMap.get(g.fieldId)?.name.toLowerCase() || '';
        const divName = divisionMap.get(g.divisionId)?.name.toLowerCase() || '';
        const dateStr = g.date.toLowerCase();

        return (
          homeName.includes(query) ||
          awayName.includes(query) ||
          fieldName.includes(query) ||
          divName.includes(query) ||
          dateStr.includes(query)
        );
      }
      return true;
    });
  }, [
    appData.games,
    selectedDivision,
    selectedTeam,
    selectedField,
    gameTypeFilter,
    showConflictsOnly,
    startDateFilter,
    endDateFilter,
    searchQuery,
    teamMap,
    fieldMap,
    divisionMap,
    conflictedGameIdMap,
  ]);

  // Group games by date
  const groupedByDate = useMemo(() => {
    const groups: { [date: string]: Game[] } = {};
    for (const game of filteredGames) {
      if (!groups[game.date]) groups[game.date] = [];
      groups[game.date].push(game);
    }
    return groups;
  }, [filteredGames]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedByDate).sort();
  }, [groupedByDate]);

  // Quick swap home/away
  const handleSwapHomeAway = (game: Game) => {
    onUpdateGame({
      ...game,
      homeTeamId: game.awayTeamId,
      awayTeamId: game.homeTeamId,
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Division',
      'Home Team',
      'Away Team',
      'Match Type',
      'Field Name',
      'Field Address',
      'Status',
      'Round',
    ];

    const rows = filteredGames.map((g) => {
      const home = teamMap.get(g.homeTeamId)?.name || 'TBD';
      const away = teamMap.get(g.awayTeamId)?.name || 'TBD';
      const div = divisionMap.get(g.divisionId)?.name || '';
      const field = fieldMap.get(g.fieldId);
      const matchType = g.isByePractice ? 'Bye Practice Game' : 'Regular League Match';

      return [
        `"${g.date}"`,
        `"${g.time}"`,
        `"${div}"`,
        `"${home}"`,
        `"${away}"`,
        `"${matchType}"`,
        `"${field?.name || ''}"`,
        `"${field?.address || ''}"`,
        `"${g.status}"`,
        `"${g.roundNumber}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `soccer_schedule_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Print schedule
  const handlePrint = () => {
    window.print();
  };

  // Format date helper: "Sat, Mar 28, 2026"
  const formatDateFriendly = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePublishToServer = async () => {
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const res = await publishScheduleToServer(appData);
      setPublishResult({
        type: 'success',
        message:
          res.message ||
          'Successfully published schedule to server file league_schedule.json! Coaches and parents now see this updated schedule.',
      });
      setTimeout(() => setPublishResult(null), 6000);
    } catch (err: any) {
      setPublishResult({
        type: 'error',
        message: err.message || 'Failed to publish to server file league_schedule.json.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 no-print">
        {/* Publish Banner Notification */}
        {publishResult && (
          <div
            className={`p-3 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in ${
              publishResult.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              {publishResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{publishResult.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {publishResult.type === 'error' && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await downloadLeagueScheduleJson(appData, 'league_schedule.json', true);
                    if (res.success) {
                      setPublishResult({ type: 'success', message: res.message });
                    } else if (res.method !== 'cancelled') {
                      setPublishResult({ type: 'error', message: res.message });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-900 bg-white border border-rose-300 rounded shadow-2xs hover:bg-rose-50 transition-colors"
                >
                  <Download className="w-3 h-3 text-rose-700" />
                  <span>Save / Download league_schedule.json</span>
                </button>
              )}
              <button
                onClick={() => setPublishResult(null)}
                className="text-xs opacity-60 hover:opacity-100 p-1"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">League Schedule</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Round-robin games, pitch assignments, team contact links, and conflict resolution
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePublishToServer}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shadow-2xs disabled:opacity-50"
              title="Publish active schedule directly to server file league_schedule.json for the public portal"
            >
              <Globe className={`w-3.5 h-3.5 text-purple-600 ${isPublishing ? 'animate-spin' : ''}`} />
              <span>{isPublishing ? 'Publishing...' : 'Publish to Server'}</span>
            </button>
            <button
              onClick={() => setIsCalendarModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
              title="Export schedule to Google Calendar, Outlook, or iCal (.ics)"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Schedule to Calendar</span>
            </button>

            {onSwitchToPublicPortal && (
              <button
                onClick={onSwitchToPublicPortal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                title="Launch standalone read-only portal for coaches, players, and parents"
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Coach & Parent Portal</span>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </button>
            )}

            <button
              onClick={() => setIsPrintViewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              title="Open print-ready PDF layout with headers and team contact directory"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print View (PDF)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onRegenerateSchedule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              title="Re-run round-robin generator with alternating home/away and conflict handling"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Re-run Scheduler</span>
            </button>

            <button
              onClick={() => {
                const sampleDiv = appData.divisions[0]?.id || '';
                const sampleTeams = appData.teams.filter((t) => t.divisionId === sampleDiv);
                onAddGame({
                  id: `g-custom-${Date.now()}`,
                  divisionId: sampleDiv,
                  date: appData.seasonConfig.startDate,
                  time: '10:00',
                  fieldId: appData.fields[0]?.id || 'f1',
                  homeTeamId: sampleTeams[0]?.id || '',
                  awayTeamId: sampleTeams[1]?.id || '',
                  isByePractice: false,
                  roundNumber: 1,
                  status: 'scheduled',
                });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Match</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search team, pitch, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Division Filter */}
          <div>
            <select
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value);
                setSelectedTeam('all');
              }}
              className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Divisions ({appData.divisions.length})</option>
              {appData.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Teams ({appData.teams.filter((t) => !t.isBye).length})</option>
              {appData.teams
                .filter((t) => !t.isBye && (selectedDivision === 'all' || t.divisionId === selectedDivision))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Field Filter */}
          <div>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Pitches ({appData.fields.length})</option>
              {appData.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Match Type */}
          <div>
            <select
              value={gameTypeFilter}
              onChange={(e) => setGameTypeFilter(e.target.value as any)}
              className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Game Types</option>
              <option value="regular">Regular League Matches</option>
              <option value="practice">Bye Practice Sessions</option>
            </select>
          </div>
        </div>

        {/* Date Range Filter Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/70">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Date Range:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-start-date" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  From
                </label>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDateFilter}
                  min={minGameDate}
                  max={endDateFilter || maxGameDate}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="py-1 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 shadow-2xs font-mono"
                  title="Filter games on or after this start date"
                />
              </div>

              <span className="text-xs text-slate-400 font-medium">to</span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="filter-end-date" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  To
                </label>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDateFilter}
                  min={startDateFilter || minGameDate}
                  max={maxGameDate}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="py-1 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 shadow-2xs font-mono"
                  title="Filter games on or before this end date"
                />
              </div>

              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="inline-flex items-center gap-1 py-1 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
                  title="Clear date range filters"
                >
                  <X className="w-3 h-3 text-slate-400" />
                  <span>Reset Dates</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Date Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                !startDateFilter && !endDateFilter
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-2xs'
              }`}
            >
              Full Season
            </button>

            {allGameDates.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const midIndex = Math.floor(allGameDates.length / 2);
                    setStartDateFilter(allGameDates[0]);
                    setEndDateFilter(allGameDates[midIndex]);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                  title="View the first half of scheduled game dates"
                >
                  First Half
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const midIndex = Math.floor(allGameDates.length / 2);
                    setStartDateFilter(allGameDates[midIndex]);
                    setEndDateFilter(allGameDates[allGameDates.length - 1]);
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                  title="View the second half of scheduled game dates"
                >
                  Second Half
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const upcomingDates = allGameDates.filter((d) => d >= todayStr);
                    if (upcomingDates.length > 0) {
                      setStartDateFilter(upcomingDates[0]);
                      const targetEnd = upcomingDates[Math.min(upcomingDates.length - 1, 3)] || upcomingDates[upcomingDates.length - 1];
                      setEndDateFilter(targetEnd);
                    } else {
                      // If season dates are in future or past, take first 4 dates
                      setStartDateFilter(allGameDates[0]);
                      setEndDateFilter(allGameDates[Math.min(allGameDates.length - 1, 3)]);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                  title="Filter to the next 4 match weekends"
                >
                  Next 4 Weeks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Date Filter Validation Message */}
        {startDateFilter && endDateFilter && startDateFilter > endDateFilter && (
          <div className="p-2.5 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">
              Start Date ({startDateFilter}) is after End Date ({endDateFilter}). Please adjust your date range to view scheduled games.
            </span>
          </div>
        )}

        {/* Conflicts Toggle & Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Showing <strong className="font-mono text-slate-900">{filteredGames.length}</strong> of{' '}
              <strong className="font-mono text-slate-900">{appData.games.length}</strong> total games
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Dates: <span className="font-mono">{sortedDates.length}</span> game days
            </span>

            {(startDateFilter || endDateFilter) && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Calendar className="w-3 h-3 text-emerald-600" />
                  <span>
                    Range: {startDateFilter ? formatDateFriendly(startDateFilter) : 'Start'} –{' '}
                    {endDateFilter ? formatDateFriendly(endDateFilter) : 'End'}
                  </span>
                  <button
                    onClick={() => {
                      setStartDateFilter('');
                      setEndDateFilter('');
                    }}
                    className="text-emerald-700 hover:text-emerald-950 ml-0.5 font-bold"
                    title="Remove date filter"
                  >
                    ×
                  </button>
                </span>
              </>
            )}

            {(selectedDivision !== 'all' ||
              selectedTeam !== 'all' ||
              selectedField !== 'all' ||
              gameTypeFilter !== 'all' ||
              showConflictsOnly ||
              searchQuery.trim() ||
              startDateFilter ||
              endDateFilter) && (
              <button
                onClick={() => {
                  setSelectedDivision('all');
                  setSelectedTeam('all');
                  setSelectedField('all');
                  setSearchQuery('');
                  setGameTypeFilter('all');
                  setShowConflictsOnly(false);
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="text-slate-500 hover:text-slate-900 underline ml-1 cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          {conflicts.length > 0 && (
            <button
              onClick={() => setShowConflictsOnly(!showConflictsOnly)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors font-medium ${
                showConflictsOnly
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {showConflictsOnly ? 'Show All Games' : `Filter Only Conflicted Games (${conflicts.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print-only mb-6">
        <h1 className="text-2xl font-bold">{appData.seasonConfig.seasonName}</h1>
        <p className="text-sm text-gray-600">
          Season: {appData.seasonConfig.startDate} to {appData.seasonConfig.endDate} · Generated by PitchMaster
        </p>
        {(startDateFilter || endDateFilter) && (
          <p className="text-xs text-gray-500 mt-1">
            Filtered Date Range: {startDateFilter || appData.seasonConfig.startDate} to {endDateFilter || appData.seasonConfig.endDate}
          </p>
        )}
      </div>

      {/* Games list grouped by date */}
      {sortedDates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No games found for current filter</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {startDateFilter || endDateFilter
              ? `There are no scheduled games within the selected date range (${startDateFilter || 'Season Start'} to ${endDateFilter || 'Season End'}). Try adjusting the dates or clearing filters.`
              : 'Try adjusting your search criteria or division filter. You can also re-run the round-robin scheduler to generate games across the season dates.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSelectedDivision('all');
                setSelectedTeam('all');
                setSelectedField('all');
                setSearchQuery('');
                setGameTypeFilter('all');
                setShowConflictsOnly(false);
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const gamesOnDate = groupedByDate[dateStr];

            return (
              <div key={dateStr} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      {formatDateFriendly(dateStr)}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">({dateStr})</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {gamesOnDate.length} {gamesOnDate.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>

                {/* Match Cards Container */}
                <div className="grid grid-cols-1 gap-2.5">
                  {gamesOnDate.map((game) => {
                    const homeTeam = teamMap.get(game.homeTeamId);
                    const awayTeam = teamMap.get(game.awayTeamId);
                    const division = divisionMap.get(game.divisionId);
                    const field = fieldMap.get(game.fieldId);
                    const gameConflicts = conflictedGameIdMap.get(game.id) || [];
                    const hasConflict = gameConflicts.length > 0;

                    return (
                      <div
                        key={game.id}
                        className={`bg-white rounded-xl border transition-shadow p-3.5 sm:p-4 ${
                          hasConflict
                            ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                          {/* Match Info & Teams */}
                          <div className="space-y-2 flex-1">
                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-slate-800">
                                {division?.name || 'Division'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-mono font-medium text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {game.time}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Round {game.roundNumber}</span>

                              {game.isByePractice && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                                    Bye Practice Game
                                  </span>
                                </>
                              )}

                              {hasConflict && (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-medium text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>{gameConflicts[0]?.title}</span>
                                </span>
                              )}
                            </div>

                            {/* Teams Row (Clickable to view contact info) */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Home Team */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => homeTeam && onSelectTeamContact(homeTeam, division?.name)}
                                  className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline flex items-center gap-1.5 text-left"
                                  title="Click to view coach contact info & team notes"
                                >
                                  <span>{homeTeam?.name || 'TBD'}</span>
                                  <span className="text-[10px] font-normal text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    HOME
                                  </span>
                                </button>
                              </div>

                              <span className="text-xs font-semibold text-slate-400">vs</span>

                              {/* Away Team */}
                              <div className="flex items-center gap-1.5">
                                {game.isByePractice ? (
                                  <span className="text-sm font-medium text-slate-400 italic">
                                    Bye (Dedicated Practice Session)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => awayTeam && onSelectTeamContact(awayTeam, division?.name)}
                                    className="text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline flex items-center gap-1.5 text-left"
                                    title="Click to view coach contact info & team notes"
                                  >
                                    <span>{awayTeam?.name || 'TBD'}</span>
                                    <span className="text-[10px] font-normal text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                      AWAY
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Pitch & Static Address / Google Maps link */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <button
                                type="button"
                                onClick={() => field && onSelectFieldMap(field)}
                                className="font-medium text-slate-800 hover:text-blue-700 hover:underline text-left"
                                title="Click to view static address & map directions"
                              >
                                {field?.name || 'Unassigned Pitch'}
                              </button>

                              {field?.size && (
                                <span className="text-slate-400">({field.size})</span>
                              )}

                              {field?.address && (
                                <>
                                  <span aria-hidden="true" className="text-slate-300">·</span>
                                  <span className="text-slate-500 truncate max-w-xs">{field.address}</span>
                                </>
                              )}

                              {/* External Google Maps shortcut */}
                              {field && (
                                <a
                                  href={
                                    field.googleMapsUrl ||
                                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      field.address || field.name
                                    )}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 font-medium ml-1"
                                  title="Open in Google Maps"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="text-[11px]">Map</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Quick Interactive Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 no-print">
                            {/* Swap Home/Away button */}
                            {!game.isByePractice && (
                              <button
                                type="button"
                                onClick={() => handleSwapHomeAway(game)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Swap Home and Away teams"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            )}

                            {/* Add to Calendar button & dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveCalDropdownGameId(
                                    activeCalDropdownGameId === game.id ? null : game.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Add this match to Google Calendar, Outlook, or iCal"
                              >
                                <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Calendar</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>

                              {activeCalDropdownGameId === game.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  <a
                                    href={createGoogleCalendarUrl(
                                      buildEventPayload(game, appData.teams, appData.divisions, appData.fields)
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setActiveCalDropdownGameId(null)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                  >
                                    <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-[10px]">
                                      G
                                    </span>
                                    <span>Google Calendar</span>
                                  </a>

                                  <a
                                    href={createOutlookCalendarUrl(
                                      buildEventPayload(game, appData.teams, appData.divisions, appData.fields)
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setActiveCalDropdownGameId(null)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                  >
                                    <span className="w-4 h-4 rounded bg-blue-50 text-sky-600 font-bold flex items-center justify-center text-[10px]">
                                      O
                                    </span>
                                    <span>Outlook Calendar</span>
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const payload = buildEventPayload(game, appData.teams, appData.divisions, appData.fields);
                                      const ics = generateIcsContent([game], appData.teams, appData.divisions, appData.fields, payload.title);
                                      downloadIcsFile(ics, `match_${game.date}_${game.id}.ics`);
                                      setActiveCalDropdownGameId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Download .ics Event</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Edit Game button */}
                            <button
                              type="button"
                              onClick={() => onEditGame(game)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Manually adjust pitch, date, time or teams"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit Match</span>
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this scheduled match?')) {
                                  onDeleteGame(game.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete match"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Conflict Explanation Bar if applicable */}
                        {hasConflict && (
                          <div className="mt-3 pt-2.5 border-t border-rose-200/80 text-xs text-rose-800 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">{gameConflicts[0].description}</p>
                              {gameConflicts[0].suggestedResolution && (
                                <p className="text-slate-600 mt-0.5">
                                  <strong>Resolution hint:</strong> {gameConflicts[0].suggestedResolution}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onEditGame(game)}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-800 bg-rose-100 rounded hover:bg-rose-200 whitespace-nowrap"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Export Schedule to Calendar Modal */}
      {isCalendarModalOpen && (
        <ExportCalendarModal
          appData={appData}
          filteredGames={filteredGames}
          onClose={() => setIsCalendarModalOpen(false)}
        />
      )}

      {/* Print View Component (Clean PDF layout with headers and team contacts) */}
      {isPrintViewOpen && (
        <PrintScheduleView
          appData={appData}
          initialDivisionId={selectedDivision}
          initialTeamId={selectedTeam}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}
    </div>
  );
};
