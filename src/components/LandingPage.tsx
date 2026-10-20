import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppData, Game } from '../types';
import { fetchServerLeagueSchedule, downloadLeagueScheduleJson } from '../utils/serverSync';
import {
  Users,
  Shield,
  Calendar,
  MapPin,
  Trophy,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Lock,
  Github,
  RefreshCw,
  FileCode,
  Download,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Clock,
  Shirt,
  X,
} from 'lucide-react';

interface LandingPageProps {
  appData?: AppData;
  fallbackAppData?: AppData;
  onSelectAdmin: () => void;
  onSelectPortal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  appData,
  fallbackAppData,
  onSelectAdmin,
  onSelectPortal,
}) => {
  const fallback = fallbackAppData || appData;

  // State for reading directly from the local league_schedule.json file
  const [fileData, setFileData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  // UI state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isRawJsonModalOpen, setIsRawJsonModalOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeTab, setActiveTab] = useState<'fixtures' | 'divisions' | 'fields'>('fixtures');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch the local league_schedule.json file
  const loadLocalFileSchedule = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchServerLeagueSchedule();
      setFileData(data);
      setLoadedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      console.warn('Could not load local league_schedule.json on landing page:', err);
      setLoadError(err.message || 'Unable to load local league_schedule.json');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocalFileSchedule();
  }, [loadLocalFileSchedule]);

  // Primary data source: The local file league_schedule.json is authoritative for landing visitors
  const activeData: AppData = fileData || fallback || {
    version: '1.0.0',
    fileName: 'league_schedule.json',
    seasonConfig: {
      seasonName: 'Soccer League Championship',
      startDate: '',
      endDate: '',
      blackoutDates: [],
    },
    teamSizes: [],
    fields: [],
    divisions: [],
    teams: [],
    games: [],
    lastModified: '',
  };

  const nonByeTeams = useMemo(() => activeData.teams.filter((t) => !t.isBye), [activeData.teams]);
  const totalGames = activeData.games.length;
  const totalDivisions = activeData.divisions.length;
  const totalFields = activeData.fields.length;
  const seasonName = activeData.seasonConfig?.seasonName || 'Soccer League Championship';

  const divisionMap = useMemo(() => new Map(activeData.divisions.map((d) => [d.id, d])), [activeData.divisions]);
  const teamMap = useMemo(() => new Map(activeData.teams.map((t) => [t.id, t])), [activeData.teams]);
  const fieldMap = useMemo(() => new Map(activeData.fields.map((f) => [f.id, f])), [activeData.fields]);

  // Filter games for schedule preview
  const filteredGames = useMemo(() => {
    let result = [...activeData.games];

    if (selectedDivisionId !== 'all') {
      result = result.filter((g) => g.divisionId === selectedDivisionId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((g) => {
        const homeName = teamMap.get(g.homeTeamId)?.name.toLowerCase() || '';
        const awayName = teamMap.get(g.awayTeamId)?.name.toLowerCase() || '';
        const fieldName = fieldMap.get(g.fieldId)?.name.toLowerCase() || '';
        const divName = divisionMap.get(g.divisionId)?.name.toLowerCase() || '';
        const date = g.date.toLowerCase();
        return (
          homeName.includes(q) ||
          awayName.includes(q) ||
          fieldName.includes(q) ||
          divName.includes(q) ||
          date.includes(q)
        );
      });
    }

    // Sort by date then time
    result.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    return result;
  }, [activeData.games, selectedDivisionId, searchQuery, teamMap, fieldMap, divisionMap]);

  const handleCopyLink = (path: string, label: string) => {
    try {
      const fullUrl = `${window.location.origin}${path}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2500);
    } catch {
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(activeData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-950/40">
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
              <span className="text-lg font-black tracking-tight text-white leading-none block">
                PitchMaster
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Soccer League Scheduling Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={onSelectPortal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 transition-colors font-medium"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Coach & Parent Portal</span>
            </button>

            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors font-medium"
            >
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Admin Login</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Welcome to PitchMaster Official League Portal</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Soccer League Scheduling & Match Hub
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Viewing official league data directly from the local <code className="font-mono text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">league_schedule.json</code> file. Parents and coaches can view real-time fixtures, pitch directions, and calendar exports.
          </p>

          {/* Active Season Information Banner with Local File Sync Status */}
          <div className="bg-slate-800/80 border border-slate-700/90 rounded-2xl p-4 sm:p-5 text-left max-w-3xl mx-auto shadow-xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3 mb-3 text-xs">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Current Active Season
              </span>

              {/* Local File Status Pill */}
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-700/60 text-blue-300 text-[11px] font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Loading local league_schedule.json...</span>
                  </span>
                ) : fileData ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 text-[11px] font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Source: Local <code className="font-mono text-emerald-200">league_schedule.json</code></span>
                    {loadedAt && <span className="text-slate-400 font-mono">({loadedAt})</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[11px] font-medium">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>Local file unavailable ({loadError || 'Using fallback'})</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={loadLocalFileSchedule}
                  disabled={isLoading}
                  title="Reload schedule data from local league_schedule.json"
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {seasonName}
                </h2>
                {activeData.seasonConfig?.startDate && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeData.seasonConfig.startDate} — {activeData.seasonConfig.endDate}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Data loaded directly from local file (<code className="font-mono text-emerald-300">league_schedule.json</code>), independent of admin workspace edits.
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2.5 shrink-0 text-slate-300 font-mono text-xs">
                <div className="text-center bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="block font-black text-emerald-400 text-base">{totalGames}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans tracking-wider">Games</span>
                </div>
                <div className="text-center bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="block font-black text-white text-base">{nonByeTeams.length}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans tracking-wider">Teams</span>
                </div>
                <div className="text-center bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="block font-black text-white text-base">{totalFields}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans tracking-wider">Pitches</span>
                </div>
                <div className="text-center bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700/80 shadow-inner">
                  <span className="block font-black text-white text-base">{totalDivisions}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans tracking-wider">Divs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Portal Gateway Options Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto w-full">
          {/* Card 1: Coach, Player & Parent Portal */}
          <div className="group bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-600/50 hover:border-emerald-500 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl hover:shadow-emerald-950/40 transition-all duration-200">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50 group-hover:scale-105 transition-transform">
                  <Users className="w-7 h-7" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Public · No Login Required
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Coach, Player & Parent Portal
                </h3>
                <p className="text-sm text-emerald-200/80 mt-1 font-medium">
                  Official Game Schedules, Pitch Locations & Match Days
                </p>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Fast, clean read-only portal for team families, players, and coaching staff. Filter games by your specific division or team, get GPS pitch navigation directions, and sync match dates straight to your phone.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Included Portal Features:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-time kickoff schedules</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Google Maps driving directions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>1-Click Google / iCal export</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Printable PDF schedule sheets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Coach contact details & jerseys</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Division standings & records</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <button
                onClick={onSelectPortal}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-950/60"
              >
                <span>Enter Coach & Parent Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-mono text-[11px] text-slate-500">
                  Direct URL: <span className="text-emerald-300">/portal</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink('/portal', 'portal')}
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {copiedLink === 'portal' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Portal Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: League Administrator Portal */}
          <div className="group bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-slate-700 hover:border-slate-500 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl hover:shadow-slate-900/60 transition-all duration-200">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <Shield className="w-7 h-7 text-emerald-400" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Admin Console · Full Access
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  League Administrator Portal
                </h3>
                <p className="text-sm text-slate-300 mt-1 font-medium">
                  Round-Robin Generator, Conflicts & Facility Controls
                </p>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Full administrative workspace for league coordinators, schedulers, and club directors. Configure season blackout dates, auto-generate conflict-free schedules, manage pitches and blackout dates, balance home/away games, and publish updates.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Included Administrator Tools:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Round-robin schedule generator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pitch double-booking conflict scan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CSV Import & Export (Teams/Schedule/Fields)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Home vs Away balance balancer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Mass coach email mailto tool</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Publish directly to league_schedule.json</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <a
                href="/admin"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors shadow-lg"
              >
                <span>Enter League Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-mono text-[11px] text-slate-500">
                  Direct URL: <span className="text-slate-300">/admin</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink('/admin', 'admin')}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white font-medium"
                >
                  {copiedLink === 'admin' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Admin Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LIVE SCHEDULE VIEWER: DIRECTLY FROM LOCAL league_schedule.json FILE       */}
        {/* ========================================================================= */}
        <div className="max-w-5xl mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Current Data from <code className="font-mono text-emerald-400">league_schedule.json</code>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Browse matches, divisions, and pitches read in real-time from the local server schedule file.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsRawJsonModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors font-medium"
                title="View formatted JSON content of league_schedule.json"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span>View Raw JSON</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await downloadLeagueScheduleJson(activeData, 'league_schedule.json', false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors font-medium"
                title="Download a copy of the current league_schedule.json"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download .json</span>
              </button>

              <button
                type="button"
                onClick={onSelectPortal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-sm"
              >
                <span>Open Full Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Fixtures vs Divisions vs Pitches */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('fixtures')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'fixtures'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fixtures & Matches ({filteredGames.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('divisions')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'divisions'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Divisions & Teams ({activeData.divisions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fields')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'fields'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pitches & Locations ({activeData.fields.length})
              </button>
            </div>

            {/* Quick search and filter */}
            {activeTab === 'fixtures' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search teams, pitch, date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 text-xs w-48 sm:w-56"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedDivisionId}
                  onChange={(e) => setSelectedDivisionId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="all">All Divisions ({activeData.divisions.length})</option>
                  {activeData.divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: FIXTURES LIST */}
          {activeTab === 'fixtures' && (
            <div className="space-y-3">
              {filteredGames.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 text-slate-400 space-y-2">
                  <Calendar className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">No matches found matching criteria in league_schedule.json</p>
                  <p className="text-xs text-slate-500">Try clearing your filters or select "All Divisions".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredGames.slice(0, 8).map((game) => {
                    const homeTeam = teamMap.get(game.homeTeamId);
                    const awayTeam = teamMap.get(game.awayTeamId);
                    const field = fieldMap.get(game.fieldId);
                    const division = divisionMap.get(game.divisionId);

                    return (
                      <div
                        key={game.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                          <span className="font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                            {division?.name || 'Division'}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {game.date} · {game.time}
                          </span>
                        </div>

                        {/* Teams line */}
                        <div className="space-y-1 py-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-sm font-bold text-white truncate max-w-[200px]">
                                {homeTeam?.name || (game.isByePractice ? 'Practice / Bye' : 'TBD')}
                              </span>
                              {homeTeam?.jerseyColor && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                                  <Shirt className="w-2.5 h-2.5" />
                                  {homeTeam.jerseyColor}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 uppercase">Home</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                              <span className="text-sm font-bold text-slate-200 truncate max-w-[200px]">
                                {awayTeam?.name || (game.isByePractice ? 'Practice Session' : 'TBD')}
                              </span>
                              {awayTeam?.jerseyColor && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                                  <Shirt className="w-2.5 h-2.5" />
                                  {awayTeam.jerseyColor}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 uppercase">Away</span>
                          </div>
                        </div>

                        {/* Pitch & Map link */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                          <span className="truncate flex items-center gap-1 max-w-[220px]" title={field?.name}>
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{field?.name || 'Field unassigned'}</span>
                          </span>

                          {field?.googleMapsUrl ? (
                            <a
                              href={field.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 shrink-0"
                            >
                              <span>Directions</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-500">Round {game.roundNumber || 1}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredGames.length > 8 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={onSelectPortal}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>View all {filteredGames.length} fixtures in the Coach & Parent Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIVISIONS LIST */}
          {activeTab === 'divisions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeData.divisions.map((division) => {
                const divTeams = activeData.teams.filter((t) => t.divisionId === division.id && !t.isBye);
                const divGames = activeData.games.filter((g) => g.divisionId === division.id);

                return (
                  <div
                    key={division.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{division.name}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {divTeams.length} Teams · {divGames.length} Matches
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
                        Active
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Enrolled Teams:
                      </span>
                      <ul className="text-xs text-slate-300 space-y-0.5 max-h-32 overflow-y-auto pr-1">
                        {divTeams.map((team) => (
                          <li key={team.id} className="flex items-center justify-between text-[11px]">
                            <span className="truncate">{team.name}</span>
                            {team.contactName && (
                              <span className="text-slate-500 text-[10px] truncate max-w-[100px]">
                                Coach {team.contactName.split(' ')[0]}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: FIELDS / PITCHES LIST */}
          {activeTab === 'fields' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeData.fields.map((field) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        {field.name}
                      </h4>
                      {field.address && (
                        <p className="text-xs text-slate-400 mt-0.5">{field.address}</p>
                      )}
                    </div>
                    {field.surfaceType && (
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                        {field.surfaceType}
                      </span>
                    )}
                  </div>

                  {field.googleMapsUrl && (
                    <a
                      href={field.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline pt-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informative Footer & Quick Navigation Bar */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              PitchMaster Soccer League Suite · Built for youth soccer clubs, tournament directors & families
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onSelectPortal}
              className="text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Public Schedule (/portal)
            </button>
            <span className="text-slate-700">·</span>
            <a
              href="/admin"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Admin Console (/admin)
            </a>
          </div>
        </div>
      </main>

      {/* Subtle Copyright Bar */}
      <footer className="border-t border-slate-800/50 py-4 bg-slate-950/80 text-center text-[11px] text-slate-500 flex flex-wrap items-center justify-center gap-2">
        <span>PitchMaster Soccer Scheduler & Public Portal · Local Server File: <code className="font-mono text-slate-400">league_schedule.json</code></span>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/stephenwardhw/Pitch-Master"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          title="PitchMaster on GitHub"
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </a>
      </footer>

      {/* RAW JSON VIEWER MODAL */}
      {isRawJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Local <code className="font-mono text-emerald-400">league_schedule.json</code> Inspector
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRawJsonModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-auto font-mono text-xs bg-slate-950/80">
              <pre className="text-emerald-400 leading-relaxed whitespace-pre">
                {JSON.stringify(activeData, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 text-xs text-slate-400">
              <span>Size: ~{Math.round(JSON.stringify(activeData).length / 1024)} KB · {activeData.games.length} games</span>
              <button
                type="button"
                onClick={() => setIsRawJsonModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
