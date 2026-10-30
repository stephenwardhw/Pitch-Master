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
  UserCheck,
  Database,
  LogOut,
  Save,
  Check,
  RefreshCw,
  History,
  Megaphone,
  UploadCloud,
  Eye,
  Lock,
  Download,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { AdminUser, canPublishSchedule, isViewerRole } from '../utils/authClient';

export type NavTab =
  | 'schedule'
  | 'stats'
  | 'matchups'
  | 'conflicts'
  | 'balance'
  | 'divisions'
  | 'teams'
  | 'fields'
  | 'referees'
  | 'bulletins'
  | 'season';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  appData: AppData;
  conflicts: Conflict[];
  onOpenDatasetModal: () => void;
  onOpenMySqlBackupModal?: () => void;
  onOpenActivityLogModal?: () => void;
  onOpenPortal: (openInNewTab?: boolean) => void;
  onGoToHome?: () => void;
  adminUser?: AdminUser | null;
  onOpenAdminUsersModal?: () => void;
  onLogoutAdmin?: () => void;
  onUnifiedSave?: () => Promise<{ success: boolean; message: string }>;
  onPublishServer?: () => Promise<{ success: boolean; message: string }>;
  onFetchLatestMySql?: () => Promise<void>;
  onCreateLocalBackupJson?: () => Promise<void>;
  onLoadLocalBackupJson?: () => void;
  isLoadingMySql?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  appData,
  conflicts,
  onOpenDatasetModal,
  onOpenMySqlBackupModal,
  onOpenActivityLogModal,
  onOpenPortal,
  onGoToHome,
  adminUser,
  onOpenAdminUsersModal,
  onLogoutAdmin,
  onUnifiedSave,
  onPublishServer,
  onFetchLatestMySql,
  onCreateLocalBackupJson,
  onLoadLocalBackupJson,
  isLoadingMySql = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [isSavingUnified, setIsSavingUnified] = useState(false);
  const [saveSuccessState, setSaveSuccessState] = useState(false);
  const [isPublishingServer, setIsPublishingServer] = useState(false);
  const [publishSuccessState, setPublishSuccessState] = useState(false);

  const canPublish = canPublishSchedule(adminUser);
  const isViewer = isViewerRole(adminUser);

  const handleQuickSave = async () => {
    if (!onUnifiedSave || isSavingUnified || isViewer) return;
    setIsSavingUnified(true);
    try {
      const res = await onUnifiedSave();
      if (res.success) {
        setSaveSuccessState(true);
        setTimeout(() => setSaveSuccessState(false), 2500);
      }
    } finally {
      setIsSavingUnified(false);
    }
  };

  const handleQuickPublish = async () => {
    if (!onPublishServer || isPublishingServer || !canPublish) return;
    setIsPublishingServer(true);
    try {
      const res = await onPublishServer();
      if (res?.success) {
        setPublishSuccessState(true);
        setTimeout(() => setPublishSuccessState(false), 2500);
      }
    } finally {
      setIsPublishingServer(false);
    }
  };

  const activeFileName = appData.fileName || getCookie(COOKIE_NAME) || 'soccer_schedule.json';
  const conflictCount = conflicts.length;
  const urgentBulletinsCount = (appData.bulletins || []).filter(
    (b) => b.isActive && b.priority === 'urgent'
  ).length;

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'schedule',
      label: 'Schedule',
      icon: <Calendar className="w-3.5 h-3.5" />,
      badge: conflictCount > 0 ? conflictCount : undefined,
    },
    { id: 'stats', label: 'Stats', icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'divisions', label: 'Divisions', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'teams', label: 'Teams', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'fields', label: 'Fields', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'referees', label: 'Referees', icon: <UserCheck className="w-3.5 h-3.5" /> },
    {
      id: 'bulletins',
      label: 'Bulletins',
      icon: <Megaphone className="w-3.5 h-3.5" />,
      badge: urgentBulletinsCount > 0 ? urgentBulletinsCount : undefined,
    },
    { id: 'season', label: 'Season', icon: <Settings className="w-3.5 h-3.5" /> },
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-2 h-14 sm:h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSelectTab('schedule')}
              className="flex items-center gap-2 text-left focus:outline-hidden cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <svg
                  className="w-4 h-4 text-white"
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
              <div className="hidden sm:block">
                <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-none">
                  PitchMaster
                </span>
                <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase">
                  Admin
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation links (desktop) */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive =
                currentTab === item.id ||
                (item.id === 'schedule' &&
                  ['schedule', 'matchups', 'conflicts', 'balance'].includes(currentTab));
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

          {/* Zone 3: Actions, Portal, Save, Sync Dropdown, Profile (fits in single line) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Return to Landing Page Button */}
            {onGoToHome && (
              <button
                onClick={onGoToHome}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-2xs cursor-pointer"
                title="Return to Landing Page (/)"
              >
                <Home className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xl:inline">Home</span>
              </button>
            )}

            {/* Standalone Coach & Parent Portal Launcher */}
            <div className="relative">
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => onOpenPortal(false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-l-lg bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer"
                  title="Open Standalone Coach & Parent Portal"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Portal</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </button>
                <button
                  onClick={() => {
                    setPortalMenuOpen(!portalMenuOpen);
                    setSyncMenuOpen(false);
                    setUserMenuOpen(false);
                  }}
                  className="px-1 py-1.5 rounded-r-lg bg-emerald-50 text-emerald-900 border-y border-r border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Portal options"
                >
                  <ChevronDown className="w-3 h-3 text-emerald-700" />
                </button>
              </div>

              {portalMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in space-y-1 text-xs">
                  <div className="px-2.5 py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                      Public Portal Links
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Share with coaches and parents
                    </span>
                  </div>

                  {onGoToHome && (
                    <button
                      onClick={() => {
                        setPortalMenuOpen(false);
                        onGoToHome();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors font-medium cursor-pointer"
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
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg text-left transition-colors font-medium cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Standalone Portal</span>
                  </button>

                  <button
                    onClick={() => {
                      setPortalMenuOpen(false);
                      onOpenPortal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open in New Window (/portal)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleCopyPortalLink();
                      setPortalMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
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

            {/* Read-Only Viewer Badge */}
            {isViewer && (
              <div
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold shadow-2xs select-none"
                title="Signed in as Viewer. You have read-only access to the admin area."
              >
                <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Read-Only Viewer</span>
              </div>
            )}

            {/* Unified Save Button (MySQL Database) */}
            {!isViewer && onUnifiedSave && (
              <button
                type="button"
                onClick={handleQuickSave}
                disabled={isSavingUnified}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 ${
                  saveSuccessState
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                }`}
                title="Save to MySQL: Persists current schedule directly to MySQL NoSQL database"
              >
                {isSavingUnified ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : saveSuccessState ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSavingUnified
                    ? 'Saving...'
                    : saveSuccessState
                    ? 'Saved to MySQL!'
                    : 'Save to MySQL'}
                </span>
              </button>
            )}

            {/* Server Publish Button (uploads public league_schedule.json to server) - Restricted to Scheduler and above */}
            {canPublish && onPublishServer && (
              <button
                type="button"
                onClick={handleQuickPublish}
                disabled={isPublishingServer}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 ${
                  publishSuccessState
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                }`}
                title="Publish: Uploads and deploys public league_schedule.json to the server for portal & landing page viewers (Scheduler and above)"
              >
                {isPublishingServer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : publishSuccessState ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPublishingServer
                    ? 'Publishing...'
                    : publishSuccessState
                    ? 'Published!'
                    : 'Publish'}
                </span>
              </button>
            )}

            {/* Consolidated Sync & Data Dropdown (Eliminates horizontal header clutter) */}
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setSyncMenuOpen(!syncMenuOpen);
                  setPortalMenuOpen(false);
                  setUserMenuOpen(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
                  appData.mysqlBackupSync
                    ? 'border-indigo-300 bg-indigo-50/90 text-indigo-900 hover:bg-indigo-100'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="Storage, MySQL backups, activity log, and local file datasets"
              >
                <div className="relative">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  {appData.mysqlBackupSync && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  )}
                </div>
                <span className="hidden xl:inline">
                  {appData.mysqlBackupSync ? 'MySQL Synced' : 'Sync & Storage'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {syncMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in space-y-1 text-xs">
                  <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                      Storage & Backups
                    </span>
                    {appData.mysqlBackupSync && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        MySQL Synced
                      </span>
                    )}
                  </div>

                  {/* 1. Fetch Latest from MySQL (Authoritative) */}
                  {onFetchLatestMySql && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onFetchLatestMySql();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 text-left transition-colors cursor-pointer"
                      title="Fetch and load the most recent copy of the data from the MySQL server"
                    >
                      <div className="flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 text-indigo-600 shrink-0 ${isLoadingMySql ? 'animate-spin' : ''}`} />
                        <div>
                          <span className="font-semibold block leading-tight">Fetch Latest MySQL Data</span>
                          <span className="text-[10px] text-slate-500 block">
                            Prioritize latest server document
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        Server #1
                      </span>
                    </button>
                  )}

                  {/* 2. MySQL NoSQL Backups Modal */}
                  {onOpenMySqlBackupModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onOpenMySqlBackupModal();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-semibold block leading-tight">MySQL NoSQL Backups</span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[190px]">
                            {appData.mysqlBackupSync
                              ? `Sync: ${appData.mysqlBackupSync.backupName}`
                              : 'Multi-user database backups'}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-3 h-3 -rotate-90 text-slate-400" />
                    </button>
                  )}

                  {/* 3. Create Local Backup JSON (Manual Option) */}
                  {!isViewer && onCreateLocalBackupJson && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onCreateLocalBackupJson();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 text-left transition-colors cursor-pointer"
                      title="Create a local JSON backup manually (saved in browser local storage & downloaded)"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-semibold block leading-tight">Create Local Backup JSON</span>
                          <span className="text-[10px] text-slate-500 block">
                            Manual snapshot to browser & file
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Manual
                      </span>
                    </button>
                  )}

                  {/* 4. Load Local JSON Backup (Manual Option) */}
                  {!isViewer && onLoadLocalBackupJson && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onLoadLocalBackupJson();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-amber-50 text-slate-700 hover:text-amber-900 text-left transition-colors cursor-pointer"
                      title="Load a saved local JSON backup from browser local storage"
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-semibold block leading-tight">Load Local JSON Backup</span>
                          <span className="text-[10px] text-slate-500 block">
                            Restore manual local snapshot
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Manual
                      </span>
                    </button>
                  )}

                  {/* 5. Schedule Activity Log */}
                  {onOpenActivityLogModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onOpenActivityLogModal();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-semibold block leading-tight">Schedule Activity Log</span>
                          <span className="text-[10px] text-slate-500 block">
                            Last 10 schedule changes
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-3 h-3 -rotate-90 text-slate-400" />
                    </button>
                  )}

                  {/* 6. Local File Datasets */}
                  <button
                    type="button"
                    onClick={() => {
                      setSyncMenuOpen(false);
                      onOpenDatasetModal();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold block leading-tight">Local File Datasets</span>
                        <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[190px]">
                          {activeFileName}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="w-3 h-3 -rotate-90 text-slate-400" />
                  </button>

                  {adminUser && adminUser.role === 'superadmin' && onOpenAdminUsersModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setSyncMenuOpen(false);
                        onOpenAdminUsersModal();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-semibold block leading-tight">Manage Admin Users</span>
                          <span className="text-[10px] text-slate-500 block">
                            Superadmin permissions & logins
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-3 h-3 -rotate-90 text-slate-400" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Logged In Admin Profile Dropdown */}
            {adminUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setSyncMenuOpen(false);
                    setPortalMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs transition-colors shadow-2xs cursor-pointer"
                  title={`Logged in as ${adminUser.displayName} (@${adminUser.username})`}
                >
                  <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {adminUser.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline font-semibold text-xs text-slate-800 max-w-[70px] xl:max-w-[100px] truncate">
                    {adminUser.displayName}
                  </span>
                  <span className="hidden 2xl:inline text-[9px] font-mono uppercase bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                    {adminUser.role}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in space-y-1 text-xs">
                    <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-lg">
                      <span className="font-bold text-slate-900 block truncate">{adminUser.displayName}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        @{adminUser.username} · {adminUser.role}
                      </span>
                    </div>

                    {adminUser.role === 'superadmin' && onOpenAdminUsersModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenAdminUsersModal();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 rounded-lg text-left transition-colors font-medium cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Manage Admin Users</span>
                      </button>
                    )}

                    {onOpenActivityLogModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenActivityLogModal();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Schedule Activity Log</span>
                      </button>
                    )}

                    {onOpenMySqlBackupModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenMySqlBackupModal();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        <span>MySQL Backups & Sync</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenDatasetModal();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left transition-colors cursor-pointer"
                    >
                      <FileJson className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Local Datasets ({activeFileName})</span>
                    </button>

                    {onLogoutAdmin && (
                      <div className="pt-1 border-t border-slate-100 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onLogoutAdmin();
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-left transition-colors font-medium cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200 space-y-1.5 animate-in slide-in-from-top-2 text-xs">
            {onGoToHome && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onGoToHome();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 text-left font-medium"
              >
                <Home className="w-4 h-4 text-slate-500" />
                <span>Return to Landing Page (/)</span>
              </button>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Coach & Parent Portal</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </button>

            {/* Mobile Read-Only Viewer notice */}
            {isViewer && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Viewer Account · Read-Only Mode</span>
              </div>
            )}

            {!isViewer && onUnifiedSave && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleQuickSave();
                }}
                disabled={isSavingUnified}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  <span>Save to MySQL</span>
                </div>
                {isSavingUnified && <RefreshCw className="w-4 h-4 animate-spin" />}
              </button>
            )}

            {canPublish && onPublishServer && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleQuickPublish();
                }}
                disabled={isPublishingServer}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish (Upload league_schedule.json)</span>
                </div>
                {isPublishingServer && <RefreshCw className="w-4 h-4 animate-spin" />}
              </button>
            )}

            {/* Mobile Fetch Latest MySQL Action */}
            {onFetchLatestMySql && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onFetchLatestMySql();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-indigo-600 ${isLoadingMySql ? 'animate-spin' : ''}`} />
                  <span>Fetch Latest from MySQL</span>
                </div>
                <span className="text-[10px] font-bold bg-indigo-200/70 text-indigo-900 px-1.5 py-0.5 rounded">#1 Server</span>
              </button>
            )}

            {/* Mobile Manual Create Local Backup */}
            {!isViewer && onCreateLocalBackupJson && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onCreateLocalBackupJson();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Create Local Backup JSON</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">Manual</span>
              </button>
            )}

            {/* Mobile Manual Load Local Backup */}
            {!isViewer && onLoadLocalBackupJson && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLoadLocalBackupJson();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-amber-800 bg-amber-50 hover:bg-amber-100"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  <span>Load Local JSON Backup</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded">Manual</span>
              </button>
            )}

            <div className="pt-1 border-t border-slate-100">
              {navItems.map((item) => {
                const isActive =
                  currentTab === item.id ||
                  (item.id === 'schedule' &&
                    ['schedule', 'matchups', 'conflicts', 'balance'].includes(currentTab));
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {onOpenMySqlBackupModal && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenMySqlBackupModal();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-indigo-700 hover:bg-indigo-50 rounded-lg text-left font-medium"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>MySQL NoSQL Backups</span>
                </div>
                {appData.mysqlBackupSync && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                    Synced
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDatasetModal();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-left"
            >
              <FileJson className="w-4 h-4 text-emerald-600" />
              <span>Dataset & File Manager ({activeFileName})</span>
            </button>

            {adminUser && (
              <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                <div className="px-3 py-1 text-xs text-slate-500 flex items-center justify-between">
                  <span>Signed in as <strong className="text-slate-800">{adminUser.displayName}</strong></span>
                  <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">{adminUser.role}</span>
                </div>

                {adminUser.role === 'superadmin' && onOpenAdminUsersModal && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAdminUsersModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-indigo-700 hover:bg-indigo-50 rounded-lg text-left font-medium"
                  >
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Manage Admin Users</span>
                  </button>
                )}

                {onOpenActivityLogModal && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenActivityLogModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left font-medium"
                  >
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>Schedule Activity Log</span>
                  </button>
                )}

                {onLogoutAdmin && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogoutAdmin();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-lg text-left font-medium"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
