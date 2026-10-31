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
  ChevronUp,
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
  Filter,
  Menu,
  ChevronRight,
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
  const [serverFileCreatedAt, setServerFileCreatedAt] = useState<string | null>(null);
  const [serverFileModifiedAt, setServerFileModifiedAt] = useState<string | null>(null);

  // Helper to format ISO dates to a clean human-readable format with date and time
  const formatDateTimeFriendly = useCallback((isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const dt = new Date(isoStr);
      if (isNaN(dt.getTime())) return isoStr;
      return dt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr || '';
    }
  }, []);

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

  // Collapsible mobile sections state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState(true);
  const [isBulletinsSectionOpen, setIsBulletinsSectionOpen] = useState(false);
  const [isFieldsSectionOpen, setIsFieldsSectionOpen] = useState(false);
  const [isSeasonDetailsOpen, setIsSeasonDetailsOpen] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

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
      setServerFileCreatedAt(data.fileCreatedAt || null);
      setServerFileModifiedAt(data.fileModifiedAt || data.lastModified || null);
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

  // Live clock to keep countdown dynamically updated
  const [currentClock, setCurrentClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClock(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Format 24h HH:MM to 12h readable time (e.g. "09:00" -> "9:00 AM")
  const formatTimeFriendly = useCallback((timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      const [hStr, mStr] = timeStr.split(':');
      let h = parseInt(hStr, 10);
      const m = mStr ? mStr.padStart(2, '0') : '00';
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    } catch {
      return timeStr || '';
    }
  }, []);

  // Derive authoritative season timing: start date/time and end date/time
  const seasonTiming = useMemo(() => {
    const cfg = activeData.seasonConfig;
    const games = (activeData.games || []).filter((g) => g.status !== 'cancelled');

    let startTime = cfg?.startTime;
    let endTime = cfg?.endTime;

    if (!startTime) {
      if (games.length > 0) {
        const sortedByTime = [...games].sort((a, b) => a.time.localeCompare(b.time));
        startTime = sortedByTime[0]?.time;
      }
      if (!startTime && activeData.divisions?.length > 0) {
        const allSlots = activeData.divisions.flatMap((d) => d.playTimeSlots || []);
        if (allSlots.length > 0) {
          allSlots.sort();
          startTime = allSlots[0];
        }
      }
      if (!startTime) startTime = '09:00';
    }

    if (!endTime) {
      if (games.length > 0) {
        const sortedByTime = [...games].sort((a, b) => b.time.localeCompare(a.time));
        const latestGame = sortedByTime[0];
        if (latestGame) {
          const div = activeData.divisions.find((d) => d.id === latestGame.divisionId);
          const duration = div?.matchDurationMinutes || 60;
          const [h, m] = latestGame.time.split(':').map(Number);
          const endTotalMin = (h || 0) * 60 + (m || 0) + duration;
          const endH = Math.floor(endTotalMin / 60) % 24;
          const endM = endTotalMin % 60;
          endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        }
      }
      if (!endTime && activeData.divisions?.length > 0) {
        const allSlots = activeData.divisions.flatMap((d) => d.playTimeSlots || []);
        if (allSlots.length > 0) {
          allSlots.sort();
          const lastSlot = allSlots[allSlots.length - 1];
          const [h, m] = lastSlot.split(':').map(Number);
          const endH = Math.min(23, (h || 16) + 1);
          endTime = `${endH.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
        }
      }
      if (!endTime) endTime = '17:00';
    }

    return {
      startDate: cfg?.startDate || '',
      endDate: cfg?.endDate || '',
      startTime,
      endTime,
    };
  }, [activeData.seasonConfig, activeData.games, activeData.divisions]);

  // Calculate live countdown timer in months and days until season start (changes to "Season Underway" once started)
  const seasonCountdown = useMemo(() => {
    if (!seasonTiming.startDate) {
      return {
        isUnderway: false,
        months: 0,
        days: 0,
        hours: 0,
        text: 'Dates TBA',
        shortText: 'Dates TBA',
      };
    }

    const [y, m, d] = seasonTiming.startDate.split('-').map(Number);
    const [hour, min] = (seasonTiming.startTime || '09:00').split(':').map(Number);
    const startDateTime = new Date(y, m - 1, d, hour || 0, min || 0, 0);

    // If current time is on or after the season start, status changes to "Season Underway"
    if (currentClock >= startDateTime) {
      return {
        isUnderway: true,
        months: 0,
        days: 0,
        hours: 0,
        text: 'Season Underway',
        shortText: 'Season Underway',
      };
    }

    // Calculate calendar months and remaining days until start
    let months =
      (startDateTime.getFullYear() - currentClock.getFullYear()) * 12 +
      (startDateTime.getMonth() - currentClock.getMonth());
    let anchor = new Date(
      currentClock.getFullYear(),
      currentClock.getMonth() + months,
      currentClock.getDate(),
      currentClock.getHours(),
      currentClock.getMinutes()
    );

    if (anchor > startDateTime) {
      months--;
      anchor = new Date(
        currentClock.getFullYear(),
        currentClock.getMonth() + months,
        currentClock.getDate(),
        currentClock.getHours(),
        currentClock.getMinutes()
      );
    }

    const diffMs = startDateTime.getTime() - anchor.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let text = '';
    let shortText = '';
    if (months > 0 && days > 0) {
      text = `${months} ${months === 1 ? 'Month' : 'Months'}, ${days} ${days === 1 ? 'Day' : 'Days'}`;
      shortText = `${months}m, ${days}d`;
    } else if (months > 0) {
      text = `${months} ${months === 1 ? 'Month' : 'Months'}`;
      shortText = `${months}m`;
    } else if (days > 0) {
      text = `${days} ${days === 1 ? 'Day' : 'Days'}`;
      shortText = `${days}d`;
    } else {
      text = hours > 0 ? `${hours} ${hours === 1 ? 'Hour' : 'Hours'}` : 'Starting Today';
      shortText = hours > 0 ? `${hours}h` : 'Today';
    }

    return {
      isUnderway: false,
      months: Math.max(0, months),
      days: Math.max(0, days),
      hours: Math.max(0, hours),
      text,
      shortText,
    };
  }, [seasonTiming, currentClock]);

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
          const q = searchQuery.toLowerCase().trim();
          const homeTeam = teamMap.get(g.homeTeamId);
          const awayTeam = teamMap.get(g.awayTeamId);
          const home = homeTeam?.name.toLowerCase() || '';
          const away = awayTeam?.name.toLowerCase() || '';
          const homeCoach = homeTeam?.contactName?.toLowerCase() || '';
          const awayCoach = awayTeam?.contactName?.toLowerCase() || '';
          const homePhone = homeTeam?.contactPhone?.toLowerCase() || '';
          const awayPhone = awayTeam?.contactPhone?.toLowerCase() || '';
          const field = fieldMap.get(g.fieldId)?.name.toLowerCase() || '';
          const div = divisionMap.get(g.divisionId)?.name.toLowerCase() || '';
          const date = g.date.toLowerCase();
          const round = `round ${g.roundNumber}`.toLowerCase();

          return (
            home.includes(q) ||
            away.includes(q) ||
            homeCoach.includes(q) ||
            awayCoach.includes(q) ||
            homePhone.includes(q) ||
            awayPhone.includes(q) ||
            field.includes(q) ||
            div.includes(q) ||
            date.includes(q) ||
            round.includes(q)
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

  const hasUrgentBulletin = useMemo(() => {
    return activeBulletins.some((b) => b.priority === 'urgent');
  }, [activeBulletins]);

  // If there are urgent announcements, auto-expand the bulletins section
  useEffect(() => {
    if (hasUrgentBulletin) {
      setIsBulletinsSectionOpen(true);
    }
  }, [hasUrgentBulletin]);

  // When a specific team is selected or user searches, expand all dates so matching games are immediately visible
  useEffect(() => {
    if (selectedTeamId !== 'all' || searchQuery.trim() !== '') {
      setCollapsedDates({});
    }
  }, [selectedTeamId, searchQuery]);

  const toggleDateCollapsed = (dateStr: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const collapseAllDates = () => {
    const next: Record<string, boolean> = {};
    for (const d of sortedDates) {
      next[d] = true;
    }
    setCollapsedDates(next);
  };

  const expandAllDates = () => {
    setCollapsedDates({});
  };

  const scrollToBulletins = () => {
    setIsBulletinsSectionOpen(true);
    const el = document.getElementById('bulletins-section') || document.getElementById('bulletins-sidebar');
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-14 sm:h-16">
            {/* Wordmark & Portal Branding */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white"
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 leading-none shrink-0">
                    PitchMaster
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    Portal
                  </span>
                  {seasonCountdown.isUnderway ? (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Season Underway
                    </span>
                  ) : (
                    <span
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                      title={`Season starts: ${formatDateFriendly(seasonTiming.startDate)} at ${formatTimeFriendly(seasonTiming.startTime)}`}
                    >
                      <Clock className="w-3 h-3 text-amber-600" />
                      Starts in {seasonCountdown.shortText}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate block max-w-[180px] sm:max-w-xs md:max-w-sm lg:max-w-md mt-0.5"
                  title={activeData.seasonConfig.seasonName || 'Official Schedule'}
                >
                  {activeData.seasonConfig.seasonName || 'Official Schedule'}
                </span>
              </div>
            </div>

            {/* Desktop Server Connection Pill & Live Sync Status (Clean & Compact) */}
            <div className="hidden xl:flex items-center gap-2 shrink-0">
              {isLoadingServerData ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                  <span>Syncing...</span>
                </span>
              ) : serverData ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs font-medium cursor-default"
                  title={`Server schedule: league_schedule.json\nFile Updated: ${formatDateTimeFriendly(serverFileModifiedAt)}\nFile Created: ${formatDateTimeFriendly(serverFileCreatedAt)}\nBrowser Synced: ${serverFileLoadedAt}`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-emerald-950">Live Sync</span>
                  {serverFileModifiedAt && (
                    <span className="text-emerald-700 font-mono text-[10px] hidden 2xl:inline border-l border-emerald-200 pl-1.5">
                      Updated: {formatDateTimeFriendly(serverFileModifiedAt)}
                    </span>
                  )}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                  title="Running on local cached schedule"
                >
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>Offline cache</span>
                </span>
              )}

              <button
                onClick={loadServerSchedule}
                disabled={isLoadingServerData}
                title="Refresh schedule from league_schedule.json"
                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerData ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={scrollToBulletins}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                title="Jump to full league bulletins & notices"
              >
                <Megaphone className="w-3.5 h-3.5 text-emerald-700" />
                <span>Bulletins</span>
                {pinnedBulletins.length > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                    {pinnedBulletins.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsPrintViewOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                title="Print friendly PDF schedule"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print</span>
              </button>

              <button
                onClick={() => setIsExportCalendarModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                title="Add games to Google Calendar, Outlook, or Apple Calendar"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Calendar</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="Copy direct standalone link to share with parents"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{copyLinkNotice ? 'Copied!' : 'Share'}</span>
              </button>

              {/* Visual Divider between tools and admin/home */}
              <div className="h-5 w-px bg-slate-200 mx-1" />

              {onGoToHome && (
                <button
                  onClick={onGoToHome}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Return to Main Landing Page (/)"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">Home</span>
                </button>
              )}

              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                title="League Administrator Login (/admin)"
              >
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>Admin Login</span>
              </a>
            </div>

            {/* Mobile Action Controls: Bulletins Icon + Calendar Icon + Hamburger Toggle */}
            <div className="flex md:hidden items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsBulletinsSectionOpen((prev) => !prev);
                  if (!isBulletinsSectionOpen) {
                    const el = document.getElementById('bulletins-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors relative ${
                  isBulletinsSectionOpen || activeBulletins.length > 0
                    ? 'text-emerald-900 bg-emerald-50 border border-emerald-200'
                    : 'text-slate-600 bg-slate-100'
                }`}
                title="Toggle Bulletins"
                aria-label="Toggle Bulletins"
              >
                <Megaphone className="w-4 h-4 text-emerald-700" />
                {pinnedBulletins.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 ring-1 ring-white"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsExportCalendarModalOpen(true)}
                className="p-2 rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="Export Calendar"
                aria-label="Export Calendar"
              >
                <CalendarPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors ml-0.5"
                aria-label="Toggle mobile portal navigation menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Action Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
            {/* Season Timing & Countdown on Mobile Drawer */}
            <div className="p-3 rounded-xl bg-emerald-950 text-white border border-emerald-800 space-y-2 text-xs shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Season Schedule & Countdown
                </span>
                {seasonCountdown.isUnderway ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Season Underway
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/80">
                    <Clock className="w-2.5 h-2.5 text-amber-300" />
                    Starts in {seasonCountdown.text}
                  </span>
                )}
              </div>
              <div className="text-[11px] space-y-1 text-emerald-100 bg-emerald-900/40 p-2 rounded-lg border border-emerald-800/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300">Opening Kickoff:</span>
                  <span className="font-semibold text-white">
                    {seasonTiming.startDate ? formatDateFriendly(seasonTiming.startDate) : 'TBA'}
                    {seasonTiming.startTime ? ` · ${formatTimeFriendly(seasonTiming.startTime)}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300">Final Whistle:</span>
                  <span className="font-semibold text-white">
                    {seasonTiming.endDate ? formatDateFriendly(seasonTiming.endDate) : 'TBA'}
                    {seasonTiming.endTime ? ` · ${formatTimeFriendly(seasonTiming.endTime)}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Server Sync Status on Mobile */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${serverData ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">
                    {serverData ? 'Live Schedule' : 'Cached Schedule'}
                  </span>
                  {serverFileModifiedAt && (
                    <span className="font-medium text-[11px] text-emerald-800">
                      File Updated: <strong className="font-mono">{formatDateTimeFriendly(serverFileModifiedAt)}</strong>
                    </span>
                  )}
                  {serverFileCreatedAt && (
                    <span className="font-normal text-[10px] text-slate-600">
                      File Created: <strong className="font-mono">{formatDateTimeFriendly(serverFileCreatedAt)}</strong>
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-slate-500">
                    {serverFileLoadedAt ? `Browser sync: ${serverFileLoadedAt}` : 'league_schedule.json'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  loadServerSchedule();
                }}
                disabled={isLoadingServerData}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100 rounded-md hover:bg-emerald-200 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingServerData ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>
            </div>

            {/* Menu Links */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => {
                  setIsPrintViewOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left min-h-[44px]"
              >
                <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Print Schedule</span>
              </button>

              <button
                onClick={() => {
                  setIsExportCalendarModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-semibold text-left min-h-[44px]"
              >
                <CalendarPlus className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Add to Calendar</span>
              </button>

              <button
                onClick={() => {
                  handleCopyShareLink();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left min-h-[44px]"
              >
                <Share2 className="w-4 h-4 text-slate-600 shrink-0" />
                <span>{copyLinkNotice ? 'Copied Link!' : 'Share Portal'}</span>
              </button>

              <button
                onClick={() => {
                  setIsFieldsSectionOpen(true);
                  setIsMobileMenuOpen(false);
                  const el = document.getElementById('fields-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left min-h-[44px]"
              >
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Pitch Locations</span>
              </button>

              {onGoToHome && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onGoToHome();
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left min-h-[44px]"
                >
                  <Home className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Home Page</span>
                </button>
              )}

              <a
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left min-h-[44px]"
              >
                <Shield className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Admin Login</span>
              </a>
            </div>
          </div>
        )}
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

        {/* Hero Welcome Banner (Desktop Optimized & Collapsible Server Details) */}
        <div className="bg-emerald-900 text-white rounded-2xl p-4 sm:p-6 shadow-md relative overflow-hidden no-print">
          <div className="relative z-10 space-y-4 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-800/80 border border-emerald-700/60 text-emerald-200 text-xs font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>Coach, Player & Parent Schedule Portal</span>
              </div>

              {/* Server live indicator pill */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800">
                <span className={`w-2 h-2 rounded-full ${serverData ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="font-mono text-[10px]">
                  {serverData ? 'league_schedule.json' : 'Cached Data'}
                </span>
                {serverFileModifiedAt && (
                  <span className="text-emerald-300 font-sans text-[10px] border-l border-emerald-700 pl-1.5">
                    File Updated: <strong className="font-mono text-white">{formatDateTimeFriendly(serverFileModifiedAt)}</strong>
                  </span>
                )}
                {serverFileCreatedAt && (
                  <span className="text-emerald-400 font-sans text-[10px] border-l border-emerald-700 pl-1.5 hidden sm:inline">
                    Created: <span className="font-mono text-emerald-200">{formatDateTimeFriendly(serverFileCreatedAt)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight">
                {activeData.seasonConfig.seasonName || 'Official League Season'}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 leading-relaxed">
                Official round-robin games, kickoff times, field GPS driving directions, and one-click calendar exports.
              </p>
            </div>

            {/* Dedicated Season Start & End Times + Countdown Timer Card */}
            <div className="p-4 sm:p-5 rounded-xl bg-emerald-950/70 border border-emerald-700/80 backdrop-blur-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-white shadow-inner">
              {/* Season Start & End Details */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                {/* Season Start with Opening Kickoff */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-600/60 flex items-center justify-center shrink-0 text-emerald-300">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">
                      Season Start & Kickoff
                    </span>
                    <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                      <span>{seasonTiming.startDate ? formatDateFriendly(seasonTiming.startDate) : 'Dates TBA'}</span>
                      {seasonTiming.startTime && (
                        <span className="text-emerald-200 font-mono text-[11px] bg-emerald-900/90 px-1.5 py-0.5 rounded border border-emerald-700">
                          {formatTimeFriendly(seasonTiming.startTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden sm:block h-8 w-px bg-emerald-700/60" />

                {/* Season End & Final Match */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-600/60 flex items-center justify-center shrink-0 text-emerald-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">
                      Season Concludes
                    </span>
                    <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                      <span>{seasonTiming.endDate ? formatDateFriendly(seasonTiming.endDate) : 'Dates TBA'}</span>
                      {seasonTiming.endTime && (
                        <span className="text-emerald-200 font-mono text-[11px] bg-emerald-900/90 px-1.5 py-0.5 rounded border border-emerald-700">
                          {formatTimeFriendly(seasonTiming.endTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Countdown Timer Badge */}
              <div className="shrink-0 flex items-center">
                {seasonCountdown.isUnderway ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-200 shadow-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold">
                        Current Status
                      </span>
                      <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-100">
                        Season Underway
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-amber-500/20 border border-amber-400/80 text-amber-200 shadow-xs">
                    <Clock className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-amber-300 font-bold">
                        Season Countdown
                      </span>
                      <span className="font-extrabold text-xs text-white">
                        Starts in {seasonCountdown.text}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Chips on Hero */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setIsExportCalendarModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700/90 hover:bg-emerald-700 border border-emerald-600 rounded-lg transition-colors shadow-2xs"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-emerald-300" />
                <span>Add Season to Calendar</span>
              </button>

              <button
                onClick={() => setIsPrintViewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Print Schedule (PDF)</span>
              </button>

              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:text-white bg-emerald-800/70 hover:bg-emerald-800 border border-emerald-700 rounded-lg transition-colors"
                title="Copy read-only direct link for parents"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copyLinkNotice ? 'Copied Link!' : 'Share Portal'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSeasonDetailsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-white font-medium py-1 px-2 rounded hover:bg-emerald-800/40 transition-colors"
              >
                <span>Season Details & Server Sync</span>
                {isSeasonDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Season Details & Sync Box */}
            {isSeasonDetailsOpen && (
              <div className="pt-3 border-t border-emerald-800/80 text-xs space-y-2 text-emerald-100 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800">
                  <div className="space-y-1">
                    <span className="text-emerald-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Season Schedule & Timing
                    </span>
                    <span className="font-medium text-white block">
                      {activeData.games.length} total matches across {activeData.teams.filter((t) => !t.isBye).length} teams and {activeData.divisions.length} divisions
                    </span>
                    <div className="text-[11px] text-emerald-200/90 pt-1 space-y-0.5">
                      <div>
                        Opening Kickoff:{' '}
                        <strong className="text-white">
                          {seasonTiming.startDate ? formatDateFriendly(seasonTiming.startDate) : 'TBA'}
                          {seasonTiming.startTime ? ` at ${formatTimeFriendly(seasonTiming.startTime)}` : ''}
                        </strong>
                      </div>
                      <div>
                        Final Match Whistle:{' '}
                        <strong className="text-white">
                          {seasonTiming.endDate ? formatDateFriendly(seasonTiming.endDate) : 'TBA'}
                          {seasonTiming.endTime ? ` at ${formatTimeFriendly(seasonTiming.endTime)}` : ''}
                        </strong>
                      </div>
                      <div className="pt-0.5 font-semibold text-emerald-300">
                        Status:{' '}
                        {seasonCountdown.isUnderway ? (
                          <span className="text-emerald-200">Season Underway</span>
                        ) : (
                          <span className="text-amber-200">Starts in {seasonCountdown.text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-emerald-400 font-semibold block text-[11px] uppercase tracking-wider">
                      Data Connection & File Timestamp
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex flex-col text-[11px] leading-relaxed">
                        <span className="font-medium text-white">
                          {serverData ? (
                            <>
                              Loaded: <code className="font-mono text-emerald-200">league_schedule.json</code>
                              {serverFileModifiedAt && (
                                <span className="ml-1 text-emerald-300">
                                  · File Updated: <strong className="font-mono text-white">{formatDateTimeFriendly(serverFileModifiedAt)}</strong>
                                </span>
                              )}
                              {serverFileCreatedAt && (
                                <span className="ml-1 text-emerald-400">
                                  (Created: <span className="font-mono text-emerald-200">{formatDateTimeFriendly(serverFileCreatedAt)}</span>)
                                </span>
                              )}
                            </>
                          ) : (
                            `Offline fallback (${serverDataError || 'Server not reachable'})`
                          )}
                        </span>
                        {serverFileLoadedAt && (
                          <span className="text-[10px] text-emerald-300/80 font-mono">
                            Browser fetch completed at {serverFileLoadedAt}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={loadServerSchedule}
                        disabled={isLoadingServerData}
                        className="px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-semibold shrink-0 transition-colors shadow-2xs"
                      >
                        {isLoadingServerData ? 'Syncing...' : 'Reload'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Decorative background watermark */}
          <div className="absolute right-[-15px] bottom-[-25px] opacity-10 text-white pointer-events-none select-none text-[140px] sm:text-[180px] font-bold leading-none">
            ⚽
          </div>
        </div>

        {/* ================= PROMINENT QUICK SCHEDULE SEARCH BAR FOR COACHES & PARENTS ================= */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/30 shadow-md p-4 sm:p-5 space-y-3.5 no-print transition-all hover:border-emerald-500/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Quick Schedule Search</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Coaches & Parents
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Quickly locate your team schedule, division games, coach contact, or field pitch
                </p>
              </div>
            </div>

            {/* Quick stats / count & Reset button */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                {filteredGames.length} of {activeData.games.length} Matches
              </span>
              {(searchQuery.trim() !== '' || selectedTeamId !== 'all' || selectedDivisionId !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTeamId('all');
                    setSelectedDivisionId('all');
                    setViewFilter('all');
                  }}
                  className="px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-800 font-semibold text-xs hover:bg-rose-50 transition-colors flex items-center gap-1 border border-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Search & Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Search Input Box with Search Icon and Clear button */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team name, division (e.g. U10, U12), coach name, or pitch..."
              className="block w-full pl-11 pr-24 py-3 text-sm sm:text-base bg-slate-50 hover:bg-white focus:bg-white text-slate-900 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 font-medium shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2 flex items-center px-2.5 text-xs text-slate-500 hover:text-slate-900 font-semibold"
                title="Clear search"
              >
                <X className="w-4 h-4 mr-1 text-slate-400" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>

          {/* Quick Division Filter Buttons */}
          <div className="pt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-600" />
              <span>Quick Divisions:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedDivisionId('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedDivisionId === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Divisions ({activeData.divisions.length})
            </button>

            {activeData.divisions.map((d) => {
              const isSelected = selectedDivisionId === d.id;
              const divGamesCount = activeData.games.filter((g) => g.divisionId === d.id && g.status !== 'cancelled').length;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDivisionId('all');
                    } else {
                      setSelectedDivisionId(d.id);
                      if (selectedTeam && selectedTeam.divisionId !== d.id) {
                        setSelectedTeamId('all');
                      }
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                  }`}
                >
                  <span>{d.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {divGamesCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Search & Filter Feedback Banner */}
          {searchQuery.trim() !== '' && (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-950">
                  Showing {filteredGames.length} {filteredGames.length === 1 ? 'match' : 'matches'} for "{searchQuery}"
                </span>
                {filteredGames.length === 0 && (
                  <span className="text-slate-600 ml-1">
                    — No games matched. Try searching by team name, division, or coach name.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>

        {/* ================= COLLAPSIBLE SECTION 1: LEAGUE ANNOUNCEMENTS & BULLETINS ================= */}
        {activeBulletins.length > 0 && (
          <section
            id="bulletins-section"
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print scroll-mt-20"
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => setIsBulletinsSectionOpen((prev) => !prev)}
              className="w-full p-3.5 sm:p-4 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/40 hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      League Announcements & Bulletins
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {activeBulletins.length} {activeBulletins.length === 1 ? 'Notice' : 'Notices'}
                    </span>
                    {pinnedBulletins.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                        <span>{pinnedBulletins.length} Pinned</span>
                      </span>
                    )}
                    {hasUrgentBulletin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white animate-pulse">
                        Urgent Alert
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Field closures, weather alerts, and official notices for players and families
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-emerald-700 hidden sm:inline">
                  {isBulletinsSectionOpen ? 'Collapse' : 'Expand'}
                </span>
                <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                  {isBulletinsSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            {/* Accordion Body */}
            {isBulletinsSectionOpen && (
              <div className="p-3.5 sm:p-5 border-t border-slate-200 space-y-4 animate-in fade-in">
                {/* Target Audience Filter Chips */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-500 font-medium mr-1 text-[11px]">Filter by:</span>
                    {['all', 'Parents', 'Coaches', 'Referees'].map((aud) => (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => setBulletinAudienceFilter(aud)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          bulletinAudienceFilter === aud
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {aud === 'all' ? 'All Audiences' : aud}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPrintBulletinsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Bulletins (PDF)</span>
                  </button>
                </div>

                {/* Bulletins Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedBulletins.length === 0 ? (
                    <div className="col-span-full text-center py-6 text-slate-400 text-xs">
                      No notices found matching the selected audience.
                    </div>
                  ) : (
                    displayedBulletins.map((bulletin) => {
                      const isUrgent = bulletin.priority === 'urgent';
                      const isImportant = bulletin.priority === 'important';

                      return (
                        <div
                          key={bulletin.id}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all bg-white hover:shadow-xs ${
                            isUrgent
                              ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20'
                              : isImportant
                              ? 'border-amber-200 bg-amber-50/20'
                              : 'border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <div className="flex flex-wrap items-center gap-1">
                                {bulletin.isPinned && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                    <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                                    Pinned
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    bulletin.category === 'Field Closure'
                                      ? 'bg-rose-100 text-rose-800'
                                      : bulletin.category === 'Weather'
                                      ? 'bg-amber-100 text-amber-800'
                                      : bulletin.category === 'Schedule Update'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {bulletin.category}
                                </span>
                                {isUrgent && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                                    Urgent
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">{bulletin.createdAt}</span>
                            </div>

                            <h3 className="font-bold text-sm text-slate-900 leading-snug">
                              {bulletin.title}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-3">
                              {stripHtmlTags(bulletin.content)}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span>By {bulletin.author || 'League Admin'}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedBulletinDetail(bulletin)}
                              className="font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer min-h-[36px] flex items-center"
                            >
                              Read Full Notice →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================= COLLAPSIBLE SECTION 2: SEARCH & FILTER GAMES ================= */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
          {/* Accordion Header */}
          <button
            type="button"
            onClick={() => setIsFilterSectionOpen((prev) => !prev)}
            className="w-full p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Find Your Team's Games
                  </h2>
                  {selectedTeam ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 truncate max-w-[200px]">
                      {selectedTeam.name}
                    </span>
                  ) : selectedDivision ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                      {selectedDivision.name}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                      All Teams
                    </span>
                  )}
                  {viewFilter === 'upcoming' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                      Upcoming Only
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Filter by team, division, or opponent to customize your view
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                {isFilterSectionOpen ? 'Collapse Filters' : 'Change Filters'}
              </span>
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-2xs">
                {isFilterSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </button>

          {/* Accordion Body */}
          {isFilterSectionOpen && (
            <div className="p-3.5 sm:p-5 border-t border-slate-200 space-y-4 animate-in fade-in">
              {/* Season vs Upcoming Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-semibold text-slate-700">Display Matches:</span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setViewFilter('all')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer min-h-[38px] ${
                      viewFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Season Games
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('upcoming')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors text-center cursor-pointer min-h-[38px] ${
                      viewFilter === 'upcoming'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Upcoming Only
                  </button>
                </div>
              </div>

              {/* Selectors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
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
                    className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden min-h-[44px]"
                  >
                    <option value="all">All Teams ({activeData.teams.filter((t) => !t.isBye).length})</option>
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
                    className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden min-h-[44px]"
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
                    Search Opponent or Pitch:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Red Bulls, Pitch 2..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              {/* Reset button if any filter active */}
              {(selectedTeamId !== 'all' || selectedDivisionId !== 'all' || searchQuery.trim() !== '' || viewFilter !== 'all') && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Filtered view active</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamId('all');
                      setSelectedDivisionId('all');
                      setSearchQuery('');
                      setViewFilter('all');
                    }}
                    className="font-semibold text-rose-600 hover:text-rose-800 p-1"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Selected Team Profile Spotlight Banner (When user picks a team) */}
        {selectedTeam && (
          <div className="bg-white rounded-2xl border border-emerald-300 p-4 sm:p-5 shadow-xs bg-gradient-to-r from-emerald-50/70 via-white to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                  {selectedTeam.name}
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {divisionMap.get(selectedTeam.divisionId)?.name || 'League'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600">
                {selectedTeam.contactName && (
                  <span>Coach: <strong>{selectedTeam.contactName}</strong></span>
                )}
                {selectedTeam.contactPhone && (
                  <>
                    <span>·</span>
                    <a
                      href={`tel:${selectedTeam.contactPhone}`}
                      className="text-emerald-700 hover:underline font-mono font-medium"
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

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
              <button
                onClick={handleExportSelectedTeamCalendar}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-2xs min-h-[44px]"
                title="Download entire season calendar for this team into Apple Calendar, Google, or Outlook"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="truncate">Download iCal</span>
              </button>

              <button
                onClick={() =>
                  setActiveContactTeam({
                    team: selectedTeam,
                    divisionName: divisionMap.get(selectedTeam.divisionId)?.name,
                  })
                }
                className="flex items-center justify-center px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Coach Details
              </button>
            </div>
          </div>
        )}

        {/* ================= MAIN CONTENT LAYOUT (SCHEDULE + DESKTOP SIDEBAR) ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Main Schedule Column (3 cols on lg, full width on mobile) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Schedule Section Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs">
              <div className="text-slate-600 font-medium">
                Showing <strong className="font-mono text-slate-900 font-bold">{filteredGames.length}</strong> matches across <span className="font-mono text-slate-900 font-bold">{sortedDates.length}</span> match days
              </div>

              {sortedDates.length > 0 && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={expandAllDates}
                    className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                  >
                    Expand All Dates
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={collapseAllDates}
                    className="text-slate-600 hover:text-slate-900 font-semibold text-xs px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

            {/* Empty State or Loading */}
            {isLoadingServerData && !serverData ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <h3 className="text-base font-semibold text-slate-800">
                  Loading League Schedule...
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Fetching <code className="font-mono text-slate-700">league_schedule.json</code> from the server.
                </p>
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
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
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 min-h-[44px]"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              /* Collapsible Date Groups */
              <div className="space-y-4">
                {sortedDates.map((dateStr) => {
                  const gamesOnDate = groupedByDate[dateStr];
                  const isDateCollapsed = Boolean(collapsedDates[dateStr]);

                  return (
                    <div
                      key={dateStr}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden print-day-block day-group"
                    >
                      {/* Collapsible Date Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleDateCollapsed(dateStr)}
                        className="w-full px-4 py-3 sm:py-3.5 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer print-date-header"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {formatDateFriendly(dateStr)}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                            ({dateStr})
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                            {gamesOnDate.length} {gamesOnDate.length === 1 ? 'game' : 'games'}
                          </span>
                          <div className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-500 flex items-center justify-center no-print">
                            {isDateCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </button>

                      {/* Games List on Date */}
                      {!isDateCollapsed && (
                        <div className="p-3 sm:p-4 space-y-3 bg-slate-50/40">
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
                                className={`bg-white rounded-xl border p-3.5 sm:p-4 transition-all shadow-2xs hover:shadow-xs print-match-card break-inside-avoid ${
                                  isSelectedTeamHome || isSelectedTeamAway
                                    ? 'border-emerald-300 ring-1 ring-emerald-200'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="space-y-3">
                                  {/* Top line: Division, Kickoff Time, Round */}
                                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-bold text-slate-800 truncate">
                                        {division?.name || 'League Match'}
                                      </span>
                                      <span>·</span>
                                      <span>Round {game.roundNumber}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {game.time}
                                      </span>
                                      {game.isByePractice && (
                                        <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                                          Practice
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Teams Matchup Box (High contrast & clean mobile stacking) */}
                                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                                    {/* Home Team */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wide shrink-0 ${
                                            isSelectedTeamHome
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          HOME
                                        </span>
                                        <span
                                          className={`text-xs sm:text-sm font-bold truncate ${
                                            isSelectedTeamHome ? 'text-emerald-700 font-extrabold' : 'text-slate-900'
                                          }`}
                                        >
                                          {homeTeam?.name || 'Home Team'}
                                        </span>
                                      </div>
                                      {homeTeam?.jerseyColor && (
                                        <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200">
                                          {homeTeam.jerseyColor}
                                        </span>
                                      )}
                                    </div>

                                    {/* VS Divider */}
                                    <div className="relative flex items-center justify-center">
                                      <div className="border-t border-slate-200 w-full absolute"></div>
                                      <span className="bg-slate-100 text-slate-400 font-bold text-[9px] px-2 py-0.2 rounded relative z-10 uppercase tracking-widest">
                                        vs
                                      </span>
                                    </div>

                                    {/* Away Team */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wide shrink-0 ${
                                            isSelectedTeamAway
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          AWAY
                                        </span>
                                        <span
                                          className={`text-xs sm:text-sm font-bold truncate ${
                                            isSelectedTeamAway ? 'text-emerald-700 font-extrabold' : 'text-slate-900'
                                          }`}
                                        >
                                          {awayTeam?.name || 'Away Team'}
                                        </span>
                                      </div>
                                      {awayTeam?.jerseyColor && (
                                        <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200">
                                          {awayTeam.jerseyColor}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Field & Driving Directions Row */}
                                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      <span className="font-semibold text-slate-800 truncate">
                                        {field?.name || 'Assigned Pitch'}
                                      </span>
                                      {field?.size && (
                                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                          ({field.size})
                                        </span>
                                      )}
                                    </div>

                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs shrink-0 py-0.5"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>GPS Directions</span>
                                    </a>
                                  </div>

                                  {/* Mobile-Friendly Action Buttons Row (3 Columns) */}
                                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                                    {/* Match Contacts */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMatchContacts({
                                          game,
                                          homeTeam,
                                          awayTeam,
                                          divisionName: division?.name,
                                          field,
                                        });
                                      }}
                                      className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors min-h-[40px] text-center"
                                      title="View coach and referee contact details"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">Contacts</span>
                                    </button>

                                    {/* Pitch Info */}
                                    <button
                                      type="button"
                                      onClick={() => field && setActiveMapField(field)}
                                      className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors min-h-[40px] text-center"
                                      title="View field details and layout"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span className="truncate">Pitch Info</span>
                                    </button>

                                    {/* Add to Calendar with safe dropdown positioning */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveCalDropdownGameId(
                                            activeCalDropdownGameId === game.id ? null : game.id
                                          )
                                        }
                                        className="w-full flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors min-h-[40px] text-center"
                                        title="Add this match to your phone calendar"
                                      >
                                        <CalendarPlus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">+ Cal</span>
                                        <ChevronDown className="w-3 h-3 text-emerald-600 shrink-0" />
                                      </button>

                                      {activeCalDropdownGameId === game.id && (
                                        <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-52 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in space-y-0.5 text-xs">
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
                                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
                                          >
                                            <Download className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Download .ics File</span>
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= COLLAPSIBLE SECTION 4: FIELD LOCATIONS & GPS NAVIGATION ================= */}
            <section
              id="fields-section"
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print scroll-mt-20 mt-6"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setIsFieldsSectionOpen((prev) => !prev)}
                className="w-full p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold shadow-xs shrink-0">
                    <MapPin className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Pitch Locations & GPS Directions
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        {activeData.fields.length} {activeData.fields.length === 1 ? 'Pitch' : 'Pitches'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Click any venue to launch turn-by-turn driving directions in Google Maps
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                    {isFieldsSectionOpen ? 'Collapse Pitches' : 'View Pitches'}
                  </span>
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-2xs">
                    {isFieldsSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Accordion Body */}
              {isFieldsSectionOpen && (
                <div className="p-3.5 sm:p-5 border-t border-slate-200 space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeData.fields.map((field) => {
                      const mapsUrl =
                        field.googleMapsUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          field.address || field.name
                        )}`;

                      return (
                        <div
                          key={field.id}
                          className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2 text-xs hover:border-slate-300 transition-colors"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-900">{field.name}</span>
                              {field.size && (
                                <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {field.size}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 text-[11px] mt-1 leading-snug">
                              {field.address || 'Standard League Soccer Complex'}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveMapField(field)}
                              className="text-slate-700 hover:text-slate-900 font-semibold text-[11px]"
                            >
                              Pitch Layout →
                            </button>
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-[11px] bg-white px-2 py-1 rounded border border-blue-200 shadow-2xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Google Maps GPS</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Dedicated Bulletins Sidebar (1 col on lg, hidden on mobile since mobile uses top collapsible section) */}
          <aside id="bulletins-sidebar" className="hidden lg:block lg:col-span-1 space-y-4 no-print w-full scroll-mt-20">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
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
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                                Pinned
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
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
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
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
          referees={activeData.referees || []}
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
