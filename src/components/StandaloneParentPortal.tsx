import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AppData, Bulletin, Division, Field, Game, Team } from '../types';
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
  Share2,
  ChevronDown,
  Download,
  CheckCircle2,
  Sparkles,
  Info,
  RefreshCw,
  AlertCircle,
  Database,
  Lock,
  ArrowRight,
  Home,
  Shield,
  Github,
  Megaphone,
  Pin,
  X,
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
import { PrintBulletinsModal } from './modals/PrintBulletinsModal';
import { BulletinContent, stripHtmlTags } from './BulletinContent';
import { ErrorBoundary } from './ErrorBoundary';
import { TeamContactModal } from './modals/TeamContactModal';
import { MatchContactModal } from './modals/MatchContactModal';
import { FieldMapModal } from './modals/FieldMapModal';

interface StandaloneParentPortalProps {
  appData?: AppData;
  onSwitchToAdmin?: () => void;
  onGoToHome?: () => void;
}

export const StandaloneParentPortal: React.FC<StandaloneParentPortalProps> = ({
  appData,
  onSwitchToAdmin,
  onGoToHome,
}) => {
  // State for server-hosted league_schedule.json
  const [serverData, setServerData] = useState<AppData | null>(null);
  const [isLoadingServerData, setIsLoadingServerData] = useState<boolean>(true);
  const [serverDataError, setServerDataError] = useState<string | null>(null);
  const [serverFileLoadedAt, setServerFileLoadedAt] = useState<string | null>(null);

  // Modals & Popups
  const [isExportCalendarModalOpen, setIsExportCalendarModalOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [activeContactTeam, setActiveContactTeam] = useState<{ team: Team; divisionName?: string } | null>(null);
  const [activeMatchContacts, setActiveMatchContacts] = useState<{
    game: Game;
    homeTeam?: Team;
    awayTeam?: Team;
    divisionName?: string;
    field?: Field;
  } | null>(null);
  const [activeMapField, setActiveMapField] = useState<Field | null>(null);
  const [activeCalDropdownGameId, setActiveCalDropdownGameId] = useState<string | null>(null);
  const [copyLinkNotice, setCopyLinkNotice] = useState(false);

  // Bulletins state
  const [isPrintBulletinsModalOpen, setIsPrintBulletinsModalOpen] = useState(false);
  const [selectedBulletinDetail, setSelectedBulletinDetail] = useState<Bulletin | null>(null);
  const [bulletinAudienceFilter, setBulletinAudienceFilter] = useState<string>('all');

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
    const groups: { [date: string]: Game[] } = {};
    for (const game of filteredGames) {
      if (!groups[game.date]) {
        groups[game.date] = [];
      }
      groups[game.date].push(game);
    }
    return groups;
  }, [filteredGames]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedByDate).sort();
  }, [groupedByDate]);

  // Bulletins data for portal sidebar
  const activeBulletins = useMemo(() => {
    const list = activeData.bulletins || [];
    return list
      .filter((b) => b.isActive)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const pOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
        const aOrder = pOrder[a.priority] ?? 2;
        const bOrder = pOrder[b.priority] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [activeData.bulletins]);

  const displayedBulletins = useMemo(() => {
    if (bulletinAudienceFilter === 'all') return activeBulletins;
    return activeBulletins.filter(
      (b) => !b.targetAudience || b.targetAudience === 'All' || b.targetAudience === bulletinAudienceFilter
    );
  }, [activeBulletins, bulletinAudienceFilter]);

  const pinnedBulletins = useMemo(() => {
    return activeBulletins.filter((b) => b.isPinned);
  }, [activeBulletins]);

  const scrollToBulletins = () => {
    const el = document.getElementById('bulletins-sidebar');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Copy shareable link
  const handleCopyShareLink = () => {
    try {
      const portalUrl = `${window.location.origin}/portal`;
      navigator.clipboard.writeText(portalUrl);
      setCopyLinkNotice(true);
      setTimeout(() => setCopyLinkNotice(false), 3000);
    } catch {
      setCopyLinkNotice(true);
      setTimeout(() => setCopyLinkNotice(false), 3000);
    }
  };

  // Download team iCal
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
    <div className={`min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans ${isPrintViewOpen ? 'print:p-0 print:m-0 print:bg-white print:block' : ''}`}>
      {/* ================= STANDALONE PORTAL TOP HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16">
            {/* Wordmark & Portal Branding */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <svg
                  className="w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="12 6 15.5 8.5 14 13 10 13 8.5 8.5 12 6" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="21.5" y1="9" x2="18" y2="10" />
                  <line x1="18" y1="19" x2="15" y2="16" />
                  <line x1="6" y1="19" x2="9" y2="16" />
                  <line x1="2.5" y1="9" x2="6" y2="10" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
                    PitchMaster Soccer
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Coach & Parent Portal
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {activeData.seasonConfig.seasonName || 'Official League Schedule'}
                </span>
              </div>
            </div>

            {/* Server Connection Pill & Live Sync Status */}
            <div className="hidden md:flex items-center gap-2">
              {isLoadingServerData ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                  <span>Loading schedule...</span>
                </span>
              ) : serverData ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live: <code className="font-mono text-emerald-950 font-semibold">league_schedule.json</code></span>
                  {serverFileLoadedAt && (
                    <span className="text-emerald-700 font-mono text-[11px]">({serverFileLoadedAt})</span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>Offline cache</span>
                </span>
              )}

              <button
                onClick={loadServerSchedule}
                disabled={isLoadingServerData}
                title="Refresh schedule from league_schedule.json"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerData ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Action Buttons: Home, Print, Calendar, Share */}
            <div className="flex items-center gap-2 shrink-0">
              {onGoToHome && (
                <button
                  onClick={onGoToHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Return to Main Landing Page (/)"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              )}

              <button
                type="button"
                onClick={scrollToBulletins}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                title="Jump to full league bulletins & notices"
              >
                <Megaphone className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Bulletins</span>
                {pinnedBulletins.length > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                    {pinnedBulletins.length} Pinned
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsPrintViewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                title="Print friendly PDF schedule with headers and team directory"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Print (PDF)</span>
              </button>

              <button
                onClick={() => setIsExportCalendarModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                title="Add games to Google Calendar, Outlook, or Apple Calendar"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Add to Calendar</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Copy direct standalone link to share with parents"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{copyLinkNotice ? 'Copied!' : 'Share'}</span>
              </button>

              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                title="League Administrator Login (/admin)"
              >
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Admin Login</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ================= STANDALONE PORTAL MAIN CONTENT ================= */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${isPrintViewOpen ? 'no-print' : ''}`}>
        {/* Printable Portal Header (Displayed only when printing /portal directly) */}
        <div className="hidden print-only mb-6 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900">PitchMaster Soccer</span>
                <span className="text-xs uppercase font-semibold text-slate-500">Coach & Parent Portal</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 mt-1">
                {activeData.seasonConfig.seasonName || 'Official League Schedule'}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedTeamId !== 'all' ? `Filtered by Team: ${teamMap.get(selectedTeamId)?.name}` : 'Full Season League Schedule'}
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate-500">
              <div>Printed: {new Date().toLocaleDateString()}</div>
              <div>{filteredGames.length} Scheduled Games</div>
            </div>
          </div>
        </div>

        {/* Hero Welcome Banner */}
        <div className="bg-emerald-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden no-print">
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
                Official round-robin games, kickoff times, field GPS driving directions, and one-click calendar exports for teams and families.
              </p>
            </div>

            {/* Server file data source indicator */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {isLoadingServerData ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800/90 text-emerald-200 border border-emerald-700">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading schedule from server file (<strong className="font-mono text-white">league_schedule.json</strong>)...</span>
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
                  <span>Server file status: {serverDataError}. Displaying cached dataset.</span>
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

              <button
                type="button"
                onClick={scrollToBulletins}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:text-white bg-emerald-800/70 hover:bg-emerald-700 border border-emerald-600/70 rounded-lg transition-colors cursor-pointer"
                title="Jump down to the full bulletins and announcements section"
              >
                <Megaphone className="w-3.5 h-3.5 text-emerald-300" />
                <span>Full Bulletins Board ({activeBulletins.length}) ↓</span>
              </button>
            </div>
          </div>

          {/* Decorative background watermark */}
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 text-white pointer-events-none select-none text-[180px] font-bold leading-none">
            ⚽
          </div>
        </div>

        {/* Pinned Bulletins at Top of Page */}
        {pinnedBulletins.length > 0 && (
          <section className="bg-gradient-to-r from-amber-50/80 via-emerald-50/40 to-indigo-50/80 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <Pin className="w-3.5 h-3.5 fill-white" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Pinned League Announcements</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {pinnedBulletins.length} Pinned
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={scrollToBulletins}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <span>View Full Bulletins Board & Archive ↓</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pinnedBulletins.map((bulletin) => {
                const isUrgent = bulletin.priority === 'urgent';
                return (
                  <div
                    key={bulletin.id}
                    className={`p-3.5 rounded-xl border bg-white shadow-2xs flex flex-col justify-between space-y-2.5 transition-all hover:shadow-xs ${
                      isUrgent ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                            Pinned Notice
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              bulletin.category === 'Field Closure'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : bulletin.category === 'Weather'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : bulletin.category === 'Schedule Update'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {bulletin.category}
                          </span>
                          {isUrgent && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                              Urgent Alert
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{bulletin.createdAt}</span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 leading-snug">
                        {bulletin.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                        {stripHtmlTags(bulletin.content)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>By {bulletin.author || 'League Admin'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBulletinDetail(bulletin)}
                        className="font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        Read Full Notice →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Grid: Schedule Section (3 cols on lg) + Bulletins Sidebar (1 col on lg) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Main Schedule Column (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quick Team & Division Selector Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 no-print">
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
                  <div key={dateStr} className="space-y-3 print-day-block day-group">
                    {/* Date Heading */}
                    <div className="flex items-center justify-between px-1 print-date-header">
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
                            className={`bg-white rounded-xl border p-4 sm:p-5 transition-shadow shadow-xs hover:border-slate-300 print-match-card break-inside-avoid ${
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
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-base font-bold text-slate-900">
                                  {/* Home Team */}
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded font-medium ${
                                        isSelectedTeamHome
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      HOME
                                    </span>
                                    <span className={isSelectedTeamHome ? 'text-emerald-700 font-extrabold' : ''}>
                                      {homeTeam?.name || 'Home Team'}
                                    </span>
                                    {homeTeam?.jerseyColor && (
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        ({homeTeam.jerseyColor})
                                      </span>
                                    )}
                                  </div>

                                  <span className="text-xs text-slate-400 font-semibold px-1">VS</span>

                                  {/* Away Team */}
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded font-medium ${
                                        isSelectedTeamAway
                                          ? 'bg-emerald-600 text-white font-bold'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      AWAY
                                    </span>
                                    <span className={isSelectedTeamAway ? 'text-emerald-700 font-extrabold' : ''}>
                                      {awayTeam?.name || 'Away Team'}
                                    </span>
                                    {awayTeam?.jerseyColor && (
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        ({awayTeam.jerseyColor})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Field & Address */}
                                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>{field?.name || 'Assigned Pitch'}</span>
                                  </div>

                                  {field?.address && (
                                    <>
                                      <span>·</span>
                                      <span className="text-slate-500">{field.address}</span>
                                    </>
                                  )}

                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium text-[11px] ml-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Directions (GPS)</span>
                                  </a>
                                </div>
                              </div>

                              {/* Right: Quick actions for this game */}
                              <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                {/* Coach Contact Info for Both Teams */}
                                <button
                                  onClick={() => {
                                    setActiveMatchContacts({
                                      game,
                                      homeTeam,
                                      awayTeam,
                                      divisionName: division?.name,
                                      field,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                                  title="View coach contact details for both teams"
                                >
                                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Coach Contacts</span>
                                </button>

                                {/* Field Map */}
                                {field && (
                                  <button
                                    onClick={() => setActiveMapField(field)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                                    title="View pitch location details"
                                  >
                                    Pitch Info
                                  </button>
                                )}

                                {/* Add Single Game to Calendar */}
                                <div className="relative">
                                  <button
                                    onClick={() =>
                                      setActiveCalDropdownGameId(
                                        activeCalDropdownGameId === game.id ? null : game.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                                    title="Add this game to your personal calendar"
                                  >
                                    <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Add to Cal</span>
                                    <ChevronDown className="w-3 h-3 text-emerald-600" />
                                  </button>

                                  {activeCalDropdownGameId === game.id && (
                                    <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in space-y-0.5 text-xs">
                                      <a
                                        href={createGoogleCalendarUrl(
                                          buildEventPayload(
                                            game,
                                            activeData.teams,
                                            activeData.divisions,
                                            activeData.fields
                                          )
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setActiveCalDropdownGameId(null)}
                                        className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Google Calendar</span>
                                      </a>

                                      <a
                                        href={createOutlookCalendarUrl(
                                          buildEventPayload(
                                            game,
                                            activeData.teams,
                                            activeData.divisions,
                                            activeData.fields
                                          )
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setActiveCalDropdownGameId(null)}
                                        className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                        <span>Outlook Web</span>
                                      </a>

                                      <button
                                        onClick={() => {
                                          setActiveCalDropdownGameId(null);
                                          const icsContent = generateIcsContent(
                                            [game],
                                            activeData.teams,
                                            activeData.divisions,
                                            activeData.fields,
                                            `${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`
                                          );
                                          downloadIcsFile(
                                            icsContent,
                                            `game_${game.date}_${homeTeam?.name || 'Home'}.ics`
                                          );
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
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
      </div>

      {/* Dedicated Bulletins Sidebar (1 col on lg) - Marked no-print so schedule printing strictly excludes it */}
      <aside id="bulletins-sidebar" className="lg:col-span-1 space-y-4 no-print w-full scroll-mt-20">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white leading-tight">
                  League Bulletins
                </h3>
                <span className="text-[10px] text-emerald-300 font-medium">
                  Official Notices ({activeBulletins.length})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPrintBulletinsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-700/80 hover:bg-emerald-600 rounded-md transition-colors cursor-pointer shadow-xs"
              title="Print bulletins separately without match schedule"
            >
              <Printer className="w-3 h-3" />
              <span>Print</span>
            </button>
          </div>

          {/* Target Audience Filter Chips */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-1 text-[11px]">
            {['all', 'Parents', 'Coaches', 'Referees'].map((aud) => (
              <button
                key={aud}
                type="button"
                onClick={() => setBulletinAudienceFilter(aud)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  bulletinAudienceFilter === aud
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {aud === 'all' ? 'All' : aud}
              </button>
            ))}
          </div>

          {/* Bulletins List in Sidebar */}
          <div className="p-3 space-y-3 max-h-[640px] overflow-y-auto">
            {displayedBulletins.length === 0 ? (
              <div className="text-center py-6 px-2 text-slate-400 text-xs">
                No announcements posted for this audience filter.
              </div>
            ) : (
              displayedBulletins.map((b) => {
                const isUrgent = b.priority === 'urgent';
                const isImportant = b.priority === 'important';

                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isUrgent
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950 shadow-2xs'
                        : isImportant
                        ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {b.isPinned && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                            <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                            Pinned
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            b.category === 'Field Closure'
                              ? 'bg-rose-100 text-rose-800'
                              : b.category === 'Weather'
                              ? 'bg-amber-100 text-amber-800'
                              : b.category === 'Schedule Update'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.category}
                        </span>
                        {isUrgent && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-600 text-white animate-pulse">
                            Urgent
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{b.createdAt}</span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                      {b.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                      {stripHtmlTags(b.content)}
                    </p>

                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">By {b.author || 'League Admin'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBulletinDetail(b)}
                        className="font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                      >
                        Read More →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer Link */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setIsPrintBulletinsModalOpen(true)}
              className="w-full py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Print All Bulletins (PDF)</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </main>

      {/* ================= STANDALONE PORTAL FOOTER ================= */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-xs text-slate-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">PitchMaster Soccer</span>
            <span aria-hidden="true">·</span>
            <span>Official Coach, Player & Family Portal</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-600">league_schedule.json</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={handleCopyShareLink}
              className="text-emerald-700 hover:underline font-medium"
            >
              Share Portal Link
            </button>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="https://github.com/stephenwardhw/Pitch-Master"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:underline font-medium"
              title="PitchMaster on GitHub"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="/admin"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:underline font-medium"
              title="League Administrator Login (Protected)"
            >
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>League Admin</span>
            </a>
          </div>
        </div>
      </footer>

      {/* ================= MODALS ================= */}
      {/* 1. Export Calendar Modal */}
      {isExportCalendarModalOpen && (
        <ExportCalendarModal
          appData={activeData}
          filteredGames={filteredGames}
          onClose={() => setIsExportCalendarModalOpen(false)}
        />
      )}

      {/* 3. Print View Modal (PDF) */}
      {isPrintViewOpen && (
        <ErrorBoundary fallbackTitle="Print Preview Error" onReset={() => setIsPrintViewOpen(false)}>
          <PrintScheduleView
            appData={activeData}
            initialDivisionId={selectedDivisionId}
            initialTeamId={selectedTeamId}
            onClose={() => setIsPrintViewOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* 4. Match Coach Contacts Modal (Both Teams) */}
      {activeMatchContacts && (
        <MatchContactModal
          game={activeMatchContacts.game}
          homeTeam={activeMatchContacts.homeTeam}
          awayTeam={activeMatchContacts.awayTeam}
          divisionName={activeMatchContacts.divisionName}
          field={activeMatchContacts.field}
          fields={activeData.fields}
          onClose={() => setActiveMatchContacts(null)}
        />
      )}

      {/* 5. Single Team Contact Modal (Spotlight Profile) */}
      {activeContactTeam && (
        <TeamContactModal
          team={activeContactTeam.team}
          divisionName={activeContactTeam.divisionName}
          fields={activeData.fields}
          onClose={() => setActiveContactTeam(null)}
        />
      )}

      {/* 5. Field Map Modal */}
      {activeMapField && (
        <FieldMapModal
          field={activeMapField}
          divisions={activeData.divisions}
          onClose={() => setActiveMapField(null)}
        />
      )}

      {/* 6. Bulletin Detail Reading Modal */}
      {selectedBulletinDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto animate-in fade-in no-print">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedBulletinDetail.isPinned && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    <Pin className="w-3 h-3 fill-indigo-600" />
                    Pinned
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                  {selectedBulletinDetail.category}
                </span>
                {selectedBulletinDetail.priority === 'urgent' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white uppercase">
                    Urgent
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedBulletinDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {selectedBulletinDetail.title}
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-xs sm:text-sm leading-relaxed max-h-80 overflow-y-auto">
              <BulletinContent content={selectedBulletinDetail.content} theme="light" />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="space-y-0.5">
                <div>Posted by <strong className="text-slate-700">{selectedBulletinDetail.author || 'League Admin'}</strong></div>
                <div className="font-mono text-[11px] text-slate-400">Date: {selectedBulletinDetail.createdAt}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBulletinDetail(null);
                    setIsPrintBulletinsModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBulletinDetail(null)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Print Bulletins Modal */}
      {isPrintBulletinsModalOpen && (
        <PrintBulletinsModal
          bulletins={activeBulletins}
          seasonName={activeData.seasonConfig?.seasonName}
          onClose={() => setIsPrintBulletinsModalOpen(false)}
        />
      )}
    </div>
  );
};
