import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AppData, Division, Field, Game, Team } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Users,
  Printer,
  CalendarPlus,
  ExternalLink,
  Phone,
  Mail,
  Shield,
  Share2,
  ChevronDown,
  Download,
  CheckCircle2,
  Sparkles,
  Info,
  RefreshCw,
  AlertCircle,
  Database,
  ArrowRight,
} from 'lucide-react';
import {
  buildEventPayload,
  createGoogleCalendarUrl,
  createOutlookCalendarUrl,
  downloadIcsFile,
  generateIcsContent,
} from '../utils/calendarExport';
import { fetchServerLeagueSchedule } from '../utils/serverSync';
import { ExportCalendarModal } from './modals/ExportCalendarModal';
import { PrintScheduleView } from './PrintScheduleView';
import { TeamContactModal } from './modals/TeamContactModal';
import { FieldMapModal } from './modals/FieldMapModal';

interface PublicSchedulePageProps {
  appData?: AppData;
  onSwitchToAdmin?: () => void;
}

export const PublicSchedulePage: React.FC<PublicSchedulePageProps> = ({
  appData,
  onSwitchToAdmin,
}) => {
  // State for server-hosted league_schedule.json
  const [serverData, setServerData] = useState<AppData | null>(null);
  const [isLoadingServerData, setIsLoadingServerData] = useState<boolean>(true);
  const [serverDataError, setServerDataError] = useState<string | null>(null);
  const [serverFileLoadedAt, setServerFileLoadedAt] = useState<string | null>(null);

  // Fetch the server-hosted league_schedule.json file
  const loadServerSchedule = useCallback(async () => {
    setIsLoadingServerData(true);
    setServerDataError(null);
    try {
      const data = await fetchServerLeagueSchedule();
      setServerData(data);
      setServerFileLoadedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      console.warn('Could not fetch server league_schedule.json:', err);
      setServerDataError(err.message || 'Unable to connect to server league_schedule.json');
    } finally {
      setIsLoadingServerData(false);
    }
  }, []);

  useEffect(() => {
    loadServerSchedule();
  }, [loadServerSchedule]);

  // Effective data source: Server file is primary. Fallback to appData only if server fetch encounters an issue.
  const activeData: AppData = serverData || appData || {
    version: '1.0.0',
    fileName: 'league_schedule.json',
    seasonConfig: {
      seasonName: 'Soccer League Season',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      blackoutDates: [],
    },
    teamSizes: [],
    fields: [],
    divisions: [],
    teams: [],
    games: [],
    lastModified: new Date().toISOString(),
  };

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewFilter, setViewFilter] = useState<'upcoming' | 'all'>('all');

  // Modals & Popups
  const [isExportCalendarModalOpen, setIsExportCalendarModalOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [activeContactTeam, setActiveContactTeam] = useState<{ team: Team; divisionName?: string } | null>(null);
  const [activeMapField, setActiveMapField] = useState<Field | null>(null);
  const [activeCalDropdownGameId, setActiveCalDropdownGameId] = useState<string | null>(null);
  const [copyLinkNotice, setCopyLinkNotice] = useState(false);

  const teamMap = useMemo(() => new Map(activeData.teams.map((t) => [t.id, t])), [activeData.teams]);
  const fieldMap = useMemo(() => new Map(activeData.fields.map((f) => [f.id, f])), [activeData.fields]);
  const divisionMap = useMemo(() => new Map(activeData.divisions.map((d) => [d.id, d])), [activeData.divisions]);

  // Selected Team Object
  const selectedTeam = selectedTeamId !== 'all' ? teamMap.get(selectedTeamId) : null;
  const selectedDivision = selectedDivisionId !== 'all' ? divisionMap.get(selectedDivisionId) : null;

  // Filtered games
  const filteredGames = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return activeData.games
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

        // Upcoming filter (games on or after today)
        if (viewFilter === 'upcoming' && g.date < todayStr) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const home = teamMap.get(g.homeTeamId)?.name.toLowerCase() || '';
          const away = teamMap.get(g.awayTeamId)?.name.toLowerCase() || '';
          const field = fieldMap.get(g.fieldId)?.name.toLowerCase() || '';
          const div = divisionMap.get(g.divisionId)?.name.toLowerCase() || '';
          const date = g.date.toLowerCase();

          return (
            home.includes(q) ||
            away.includes(q) ||
            field.includes(q) ||
            div.includes(q) ||
            date.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [
    activeData.games,
    selectedDivisionId,
    selectedTeamId,
    viewFilter,
    searchQuery,
    teamMap,
    fieldMap,
    divisionMap,
  ]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map: { [date: string]: Game[] } = {};
    for (const game of filteredGames) {
      if (!map[game.date]) map[game.date] = [];
      map[game.date].push(game);
    }
    return map;
  }, [filteredGames]);

  const sortedDates = useMemo(() => Object.keys(groupedByDate).sort(), [groupedByDate]);

  // Handle Share link copy
  const handleCopyShareLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('portal', 'public');
      if (selectedTeamId !== 'all') url.searchParams.set('team', selectedTeamId);
      if (selectedDivisionId !== 'all') url.searchParams.set('division', selectedDivisionId);

      navigator.clipboard.writeText(url.toString());
      setCopyLinkNotice(true);
      setTimeout(() => setCopyLinkNotice(false), 3000);
    } catch {
      // Fallback
    }
  };

  // Export full selected team schedule to iCal
  const handleExportSelectedTeamCalendar = () => {
    if (!selectedTeam) return;
    const teamGames = activeData.games.filter(
      (g) => g.homeTeamId === selectedTeam.id || g.awayTeamId === selectedTeam.id
    );
    const icsContent = generateIcsContent(
      teamGames,
      activeData.teams,
      activeData.divisions,
      activeData.fields,
      `${selectedTeam.name} - Game Schedule`
    );
    downloadIcsFile(icsContent, `${selectedTeam.name.toLowerCase().replace(/\s+/g, '_')}_schedule.ics`);
  };

  const formatDateFriendly = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
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
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome / Notice Banner for Coaches & Parents */}
      <div className="bg-emerald-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-700/60 text-emerald-200 text-xs font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>Coach, Player & Parent Schedule Portal</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {activeData.seasonConfig.seasonName}
            </h1>
            <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed">
              Official schedule games, kickoff times, field GPS driving directions, and instant calendar export.
            </p>
          </div>

          {/* Server file data source indicator (league_schedule.json) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {isLoadingServerData ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800/90 text-emerald-200 border border-emerald-700">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reading schedule from server file (<strong className="font-mono text-white">league_schedule.json</strong>)...</span>
              </span>
            ) : serverData ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-800/90 border border-emerald-600/70 text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Source: Server file <strong className="font-mono text-white bg-emerald-950/60 px-1.5 py-0.5 rounded">league_schedule.json</strong> ·{' '}
                  <span className="text-emerald-100">{activeData.games.length} games</span>, {activeData.teams.filter((t) => !t.isBye).length} teams · Synced at {serverFileLoadedAt}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/70 border border-amber-700/60 text-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Server file error ({serverDataError}). Displaying local cached dataset.</span>
              </span>
            )}

            <button
              onClick={loadServerSchedule}
              disabled={isLoadingServerData}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 hover:text-white transition-colors border border-emerald-600/60 font-medium disabled:opacity-50"
              title="Reload latest schedule from server file league_schedule.json"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerData ? 'animate-spin' : ''}`} />
              <span>Reload Server File</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={() => setIsPrintViewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Print Schedule (PDF)</span>
            </button>

            <button
              onClick={() => setIsExportCalendarModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700/90 hover:bg-emerald-700 border border-emerald-600 rounded-lg transition-colors shadow-xs"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-emerald-300" />
              <span>Add Season to Calendar</span>
            </button>

            <button
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-100 hover:text-white bg-emerald-800/60 hover:bg-emerald-800 border border-emerald-700 rounded-lg transition-colors"
              title="Copy read-only direct link for parents"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copyLinkNotice ? 'Link Copied!' : 'Share Portal Link'}</span>
            </button>

            {onSwitchToAdmin && (
              <button
                onClick={onSwitchToAdmin}
                className="text-xs text-emerald-200 hover:text-white underline ml-2"
              >
                Switch to League Admin Console
              </button>
            )}
          </div>
        </div>

        {/* Decorative background watermark */}
        <div className="absolute right-[-20px] bottom-[-20px] opacity-10 text-white pointer-events-none select-none text-[180px] font-bold leading-none">
          ⚽
        </div>
      </div>

      {/* Quick Team & Division Selector Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Find Your Team's Games
            </h2>
            <p className="text-xs text-slate-500">
              Select your team or division below to immediately filter games.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewFilter === 'all'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Season Games
            </button>
            <button
              onClick={() => setViewFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewFilter === 'upcoming'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Upcoming Only
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Select My Team */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select My Team:
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                // Auto sync division if a team is picked
                if (e.target.value !== 'all') {
                  const t = teamMap.get(e.target.value);
                  if (t) setSelectedDivisionId(t.divisionId);
                }
              }}
              className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
            >
              <option value="all">All Teams</option>
              {activeData.teams
                .filter((t) => !t.isBye)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({divisionMap.get(t.divisionId)?.name || 'League'})
                  </option>
                ))}
            </select>
          </div>

          {/* Select Division */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Filter Division:
            </label>
            <select
              value={selectedDivisionId}
              onChange={(e) => {
                setSelectedDivisionId(e.target.value);
                if (e.target.value !== 'all' && selectedTeam && selectedTeam.divisionId !== e.target.value) {
                  setSelectedTeamId('all');
                }
              }}
              className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
            >
              <option value="all">All Divisions ({activeData.divisions.length})</option>
              {activeData.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Search by Opponent / Pitch:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Memorial Park, Strikers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Team Profile Spotlight Banner (When user picks a team) */}
      {selectedTeam && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-xs bg-gradient-to-r from-emerald-50/50 via-white to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900">{selectedTeam.name}</span>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                {divisionMap.get(selectedTeam.divisionId)?.name}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              {selectedTeam.contactName && (
                <span>Coach: <strong>{selectedTeam.contactName}</strong></span>
              )}
              {selectedTeam.contactPhone && (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${selectedTeam.contactPhone}`}
                    className="text-emerald-700 hover:underline font-mono"
                  >
                    {selectedTeam.contactPhone}
                  </a>
                </>
              )}
              {selectedTeam.jerseyColor && (
                <>
                  <span>·</span>
                  <span>Jersey: <strong>{selectedTeam.jerseyColor}</strong></span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportSelectedTeamCalendar}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
              title="Download entire season calendar for this team into Apple Calendar, Google, or Outlook"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {selectedTeam.name} iCal</span>
            </button>

            <button
              onClick={() =>
                setActiveContactTeam({
                  team: selectedTeam,
                  divisionName: divisionMap.get(selectedTeam.divisionId)?.name,
                })
              }
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Coach Details
            </button>
          </div>
        </div>
      )}

      {/* Match Games List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1 text-xs text-slate-500">
          <span>
            Showing <strong className="font-mono text-slate-900">{filteredGames.length}</strong> scheduled games
          </span>
          <span className="font-mono">{sortedDates.length} game dates</span>
        </div>

        {isLoadingServerData && !serverData ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">
              Loading League Schedule...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Fetching <code className="font-mono text-slate-700">league_schedule.json</code> from the server.
            </p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No scheduled games found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no games matching your selected team or filters. Try resetting the filters or switching to "All Season Games".
            </p>
            <button
              onClick={() => {
                setSelectedTeamId('all');
                setSelectedDivisionId('all');
                setSearchQuery('');
                setViewFilter('all');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateStr) => {
              const gamesOnDate = groupedByDate[dateStr];

              return (
                <div key={dateStr} className="space-y-3">
                  {/* Date Heading */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        {formatDateFriendly(dateStr)}
                      </h3>
                      <span className="text-xs font-mono text-slate-400">({dateStr})</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {gamesOnDate.length} {gamesOnDate.length === 1 ? 'game' : 'games'}
                    </span>
                  </div>

                  {/* Match Cards */}
                  <div className="grid grid-cols-1 gap-3">
                    {gamesOnDate.map((game) => {
                      const homeTeam = teamMap.get(game.homeTeamId);
                      const awayTeam = teamMap.get(game.awayTeamId);
                      const division = divisionMap.get(game.divisionId);
                      const field = fieldMap.get(game.fieldId);

                      const isSelectedTeamHome = selectedTeamId !== 'all' && game.homeTeamId === selectedTeamId;
                      const isSelectedTeamAway = selectedTeamId !== 'all' && game.awayTeamId === selectedTeamId;

                      const mapsUrl =
                        field?.googleMapsUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          field?.address || field?.name || ''
                        )}`;

                      return (
                        <div
                          key={game.id}
                          className={`bg-white rounded-xl border p-4 sm:p-5 transition-shadow shadow-xs hover:border-slate-300 ${
                            isSelectedTeamHome || isSelectedTeamAway
                              ? 'border-emerald-300 ring-1 ring-emerald-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: Teams & Game info */}
                            <div className="space-y-2 flex-1">
                              {/* Metadata */}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-800">
                                  {division?.name || 'League'}
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-900">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {game.time}
                                </span>
                                <span>·</span>
                                <span>Round {game.roundNumber}</span>

                                {game.isByePractice && (
                                  <>
                                    <span>·</span>
                                    <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                                      Dedicated Practice Session
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Teams Matchup */}
                              <div className="flex flex-wrap items-center gap-3">
                                {/* Home Team */}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => homeTeam && setActiveContactTeam({ team: homeTeam, divisionName: division?.name })}
                                    className={`text-base font-bold text-left hover:underline ${
                                      isSelectedTeamHome ? 'text-emerald-700' : 'text-slate-900'
                                    }`}
                                    title="Click to view coach contact notes"
                                  >
                                    {homeTeam?.name || 'TBD'}
                                  </button>
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    HOME
                                  </span>
                                  {homeTeam?.jerseyColor && (
                                    <span className="text-[11px] text-slate-400">
                                      ({homeTeam.jerseyColor})
                                    </span>
                                  )}
                                </div>

                                <span className="text-xs font-bold text-slate-400">vs</span>

                                {/* Away Team */}
                                <div className="flex items-center gap-2">
                                  {game.isByePractice ? (
                                    <span className="text-sm font-medium text-slate-400 italic">
                                      Bye Round Practice
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => awayTeam && setActiveContactTeam({ team: awayTeam, divisionName: division?.name })}
                                        className={`text-base font-bold text-left hover:underline ${
                                          isSelectedTeamAway ? 'text-emerald-700' : 'text-slate-900'
                                        }`}
                                        title="Click to view coach contact notes"
                                      >
                                        {awayTeam?.name || 'TBD'}
                                      </button>
                                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                        AWAY
                                      </span>
                                      {awayTeam?.jerseyColor && (
                                        <span className="text-[11px] text-slate-400">
                                          ({awayTeam.jerseyColor})
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Pitch Location & Static Street Address */}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <button
                                  onClick={() => field && setActiveMapField(field)}
                                  className="font-semibold text-slate-800 hover:text-blue-700 hover:underline"
                                  title="View pitch facility & directions"
                                >
                                  {field?.name || 'Pitch'}
                                </button>
                                {field?.size && <span className="text-slate-400">({field.size})</span>}

                                {field?.address && (
                                  <>
                                    <span>·</span>
                                    <span className="text-slate-600">{field.address}</span>
                                  </>
                                )}

                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium ml-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Google Maps</span>
                                </a>
                              </div>
                            </div>

                            {/* Right: Add to Calendar Actions */}
                            <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                              {/* 1-Click Calendar Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveCalDropdownGameId(
                                      activeCalDropdownGameId === game.id ? null : game.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                                  title="Add to Google Calendar, Outlook, or Apple Calendar"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Add to Calendar</span>
                                  <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>

                                {activeCalDropdownGameId === game.id && (
                                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                    <a
                                      href={createGoogleCalendarUrl(
                                        buildEventPayload(game, activeData.teams, activeData.divisions, activeData.fields)
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setActiveCalDropdownGameId(null)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                    >
                                      <span className="w-4 h-4 rounded bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-[10px]">
                                        G
                                      </span>
                                      <span>Google Calendar</span>
                                    </a>

                                    <a
                                      href={createOutlookCalendarUrl(
                                        buildEventPayload(game, activeData.teams, activeData.divisions, activeData.fields)
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setActiveCalDropdownGameId(null)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                    >
                                      <span className="w-4 h-4 rounded bg-blue-50 text-sky-600 font-bold flex items-center justify-center text-[10px]">
                                        O
                                      </span>
                                      <span>Outlook Calendar</span>
                                    </a>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const payload = buildEventPayload(game, activeData.teams, activeData.divisions, activeData.fields);
                                        const ics = generateIcsContent([game], activeData.teams, activeData.divisions, activeData.fields, payload.title);
                                        downloadIcsFile(ics, `game_${game.date}_${game.id}.ics`);
                                        setActiveCalDropdownGameId(null);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-left"
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Download .ics File (Apple / All)</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fields & Venues Quick Reference Directory */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">
            Field Locations & GPS Navigation Reference
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Click any field name or address below to open driving directions in Google Maps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {activeData.fields.map((field) => {
            const mapsUrl =
              field.googleMapsUrl ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                field.address || field.name
              )}`;

            return (
              <div
                key={field.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900">{field.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{field.size}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-snug">{field.address}</p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-[11px] pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Directions</span>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {/* 1. Export Calendar Modal */}
      {isExportCalendarModalOpen && (
        <ExportCalendarModal
          appData={activeData}
          filteredGames={filteredGames}
          onClose={() => setIsExportCalendarModalOpen(false)}
        />
      )}

      {/* 2. Print View Modal (PDF) */}
      {isPrintViewOpen && (
        <PrintScheduleView
          appData={activeData}
          initialDivisionId={selectedDivisionId}
          initialTeamId={selectedTeamId}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}

      {/* 3. Team Contact Modal */}
      {activeContactTeam && (
        <TeamContactModal
          team={activeContactTeam.team}
          divisionName={activeContactTeam.divisionName}
          fields={activeData.fields}
          onClose={() => setActiveContactTeam(null)}
        />
      )}

      {/* 4. Field Map Modal */}
      {activeMapField && (
        <FieldMapModal
          field={activeMapField}
          divisions={activeData.divisions}
          onClose={() => setActiveMapField(null)}
        />
      )}
    </div>
  );
};
