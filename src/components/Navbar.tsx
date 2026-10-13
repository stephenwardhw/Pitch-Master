import React, { useState } from 'react';
import { AppData, Conflict } from '../types';
import { COOKIE_NAME, getCookie } from '../utils/cookieStorage';
import { Calendar, AlertTriangle, Scale, Layers, Users, MapPin, Settings, FileJson, Menu, X, ShieldAlert } from 'lucide-react';

export type NavTab =
  | 'schedule'
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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  appData,
  conflicts,
  onOpenDatasetModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeFileName = appData.fileName || getCookie(COOKIE_NAME) || 'soccer_schedule.json';
  const conflictCount = conflicts.length;

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
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

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Zone 1: Single text element wordmark */}
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
                  Soccer Scheduler
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Concise navigation links (desktop) */}
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

          {/* Zone 3: 1 primary action & data file indicator (Header specification) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Header Data File Indicator: "The program should use a local cookie to store the export file name and attempt to reload that at page load if possible. It should indicate this file name in the interface header." */}
            <button
              onClick={onOpenDatasetModal}
              title="Click to manage file, export or import data (tracked in cookie)"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors text-xs max-w-[200px] sm:max-w-[260px]"
            >
              <FileJson className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="truncate text-left leading-tight">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Cookie Tracked File</span>
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
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
                      {item.badge} conflict{item.badge > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
