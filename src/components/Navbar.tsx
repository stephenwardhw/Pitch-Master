import React, { useState } from 'react';
import { AppData, Conflict } from '../types';
import { COOKIE_NAME, getCookie } from '../utils/cookieStorage';
import {
  Calendar,
  AlertTriangle,
  Scale,
  Layers,
  Users,
  MapPin,
  Settings,
  FileJson,
  Menu,
  X,
  ExternalLink,
  Share2,
  ChevronDown,
  Trophy,
  Home,
  Grid,
} from 'lucide-react';

export type NavTab =
  | 'schedule'
  | 'stats'
  | 'matchups'
  | 'conflicts'
  | 'balance'
  | 'divisions'
  | 'teams'
  | 'fields'
  | 'season';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  appData: AppData;
  conflicts: Conflict[];
  onOpenDatasetModal: () => void;
  onOpenPortal: (openInNewTab?: boolean) => void;
  onGoToHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  appData,
  conflicts,
  onOpenDatasetModal,
  onOpenPortal,
  onGoToHome,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const activeFileName = appData.fileName || getCookie(COOKIE_NAME) || 'soccer_schedule.json';
  const conflictCount = conflicts.length;

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'stats', label: 'Team Statistics', icon: <Trophy className="w-4 h-4" /> },
    { id: 'matchups', label: 'Matchup Matrix', icon: <Grid className="w-4 h-4" /> },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: conflictCount,
    },
    { id: 'balance', label: 'Home/Away Balance', icon: <Scale className="w-4 h-4" /> },
    { id: 'divisions', label: 'Divisions', icon: <Layers className="w-4 h-4" /> },
    { id: 'teams', label: 'Teams', icon: <Users className="w-4 h-4" /> },
    { id: 'fields', label: 'Fields', icon: <MapPin className="w-4 h-4" /> },
    { id: 'season', label: 'Season Setup', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleCopyPortalLink = () => {
    try {
      const portalUrl = `${window.location.origin}/portal`;
      navigator.clipboard.writeText(portalUrl);
      setCopyNotice(true);
      setTimeout(() => setCopyNotice(false), 2500);
    } catch {
      setCopyNotice(true);
      setTimeout(() => setCopyNotice(false), 2500);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectTab('schedule')}
              className="flex items-center gap-2.5 text-left focus:outline-hidden"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
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
                <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-none">
                  PitchMaster
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                  Admin Console
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation links (desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold font-mono text-rose-700 bg-rose-100 rounded-full tabular-nums border border-rose-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Standalone Portal button & Data file indicator */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Return to Landing Page Button */}
            {onGoToHome && (
              <button
                onClick={onGoToHome}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-2xs"
                title="Return to Landing Page (/)"
              >
                <Home className="w-3.5 h-3.5 text-slate-500" />
                <span>Home</span>
              </button>
            )}

            {/* Standalone Coach & Parent Portal Launcher */}
            <div className="relative">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => onOpenPortal(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 font-semibold text-xs transition-colors"
                  title="Open Standalone Coach & Parent Portal"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Parent Portal</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </button>
                <button
                  onClick={() => setPortalMenuOpen(!portalMenuOpen)}
                  className="px-1.5 py-1.5 rounded-r-lg bg-emerald-50 text-emerald-900 border-y border-r border-emerald-300 hover:bg-emerald-100 transition-colors"
                  title="Portal options"
                >
                  <ChevronDown className="w-3 h-3 text-emerald-700" />
                </button>
              </div>

              {portalMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in space-y-1 text-xs">
                  <div className="px-2.5 py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                      Portal & Navigation
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Switch views or share public links
                    </span>
                  </div>

                  {onGoToHome && (
                    <button
                      onClick={() => {
                        setPortalMenuOpen(false);
                        onGoToHome();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors font-medium"
                    >
                      <Home className="w-3.5 h-3.5 text-slate-500" />
                      <span>Main Landing Page (/)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setPortalMenuOpen(false);
                      onOpenPortal(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg text-left transition-colors font-medium"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Standalone Portal</span>
                  </button>

                  <button
                    onClick={() => {
                      setPortalMenuOpen(false);
                      onOpenPortal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open in New Window (/portal)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleCopyPortalLink();
                      setPortalMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Link for Parents</span>
                    </div>
                    {copyNotice && (
                      <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Header Data File Indicator */}
            <button
              onClick={onOpenDatasetModal}
              title="Click to manage file, export or import data (tracked in cookie)"
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors text-xs max-w-[180px] sm:max-w-[220px]"
            >
              <FileJson className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="truncate text-left leading-tight">
                <span className="text-[9px] text-slate-400 block uppercase font-mono">Cookie Tracked File</span>
                <span className="font-mono text-xs font-medium text-slate-800 truncate block">
                  {activeFileName}
                </span>
              </div>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200 space-y-1">
            {/* Return to Home Landing Page */}
            {onGoToHome && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onGoToHome();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg text-left font-medium"
              >
                <Home className="w-4 h-4 text-slate-500" />
                <span>Return to Landing Page (/)</span>
              </button>
            )}

            {/* Standalone portal quick access in mobile menu */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Coach & Parent Portal (Standalone)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </button>

            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDatasetModal();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg text-left"
            >
              <FileJson className="w-4 h-4 text-emerald-600" />
              <span>Dataset & File Manager ({activeFileName})</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
