import React, { useState } from 'react';
import { AppData } from '../types';
import {
  Users,
  Shield,
  Calendar,
  MapPin,
  Trophy,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Sliders,
  Scale,
  Copy,
  Check,
  Sparkles,
  FileText,
  Layers,
  Mail,
  Printer,
  CalendarPlus,
  Database,
  Lock,
} from 'lucide-react';

interface LandingPageProps {
  appData: AppData;
  onSelectAdmin: () => void;
  onSelectPortal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  appData,
  onSelectAdmin,
  onSelectPortal,
}) => {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const nonByeTeams = appData.teams.filter((t) => !t.isBye);
  const totalGames = appData.games.length;
  const totalDivisions = appData.divisions.length;
  const totalFields = appData.fields.length;
  const seasonName = appData.seasonConfig?.seasonName || 'Youth Soccer League Championship';

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

            <button
              onClick={onSelectAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors font-medium"
            >
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col justify-center space-y-12">
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
            Select your destination portal below. Parents and coaches can view real-time schedules, pitch directions, and calendar exports. League administrators can manage divisions, pitches, and schedule generation.
          </p>

          {/* Active Season Information Banner */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 sm:p-5 text-left max-w-2xl mx-auto shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-3 mb-3 text-xs">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Current Active Season
              </span>
              {appData.seasonConfig?.startDate && (
                <span className="font-mono text-slate-400 text-[11px]">
                  {appData.seasonConfig.startDate} — {appData.seasonConfig.endDate}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {seasonName}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Powered by server file sync (<code className="font-mono text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">league_schedule.json</code>)
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3 shrink-0 text-slate-300 font-mono text-xs">
                <div className="text-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                  <span className="block font-bold text-white text-sm">{totalGames}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans">Games</span>
                </div>
                <div className="text-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                  <span className="block font-bold text-white text-sm">{nonByeTeams.length}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans">Teams</span>
                </div>
                <div className="text-center bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                  <span className="block font-bold text-white text-sm">{totalFields}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-sans">Pitches</span>
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
                  Full administrative workspace for league coordinators, schedulers, and club directors. Configure season blackout dates, auto-generate conflict-free schedules, manage pitches and blackout dates, balance home/away games, and email coaches.
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
                    <span>Field blackout calendar grid</span>
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
                    <span>Publish to server file</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <button
                onClick={onSelectAdmin}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors shadow-lg"
              >
                <span>Enter League Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>

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
            <button
              onClick={onSelectAdmin}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Admin Console (/admin)
            </button>
          </div>
        </div>
      </main>

      {/* Subtle Copyright Bar */}
      <footer className="border-t border-slate-800/50 py-4 bg-slate-950/80 text-center text-[11px] text-slate-500">
        PitchMaster Soccer Scheduler & Public Portal · Local Server Sync Enabled
      </footer>
    </div>
  );
};
