import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppData, Bulletin, Conflict, Division, Field, Game, Referee, RefereeCertificationOption, SeasonConfig, Team, TeamSizeOption } from './types';
import { loadAppData, saveAppData, COOKIE_NAME, getCookie, setCookie } from './utils/cookieStorage';
import { generateLeagueSchedule } from './utils/scheduler';
import { detectConflicts } from './utils/conflictDetector';

import { Navbar, NavTab } from './components/Navbar';
import { SchedulePage } from './components/SchedulePage';
import { DivisionsPage } from './components/DivisionsPage';
import { TeamsPage } from './components/TeamsPage';
import { FieldsPage } from './components/FieldsPage';
import { RefereesPage } from './components/RefereesPage';
import { BulletinsPage } from './components/BulletinsPage';
import { SeasonConfigPage } from './components/SeasonConfigPage';
import { StandaloneParentPortal } from './components/StandaloneParentPortal';
import { TeamStatisticsPage } from './components/TeamStatisticsPage';
import { LandingPage } from './components/LandingPage';

import { TeamContactModal } from './components/modals/TeamContactModal';
import { FieldMapModal } from './components/modals/FieldMapModal';
import { EditGameModal } from './components/modals/EditGameModal';
import { DatasetModal } from './components/modals/DatasetModal';
import { ManageTeamSizesModal } from './components/modals/ManageTeamSizesModal';
import { RegenerateScheduleModal } from './components/modals/RegenerateScheduleModal';
import { CsvImportModal, CsvImportType } from './components/modals/CsvImportModal';
import { MySqlBackupModal } from './components/modals/MySqlBackupModal';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminUsersModal } from './components/modals/AdminUsersModal';
import { ActivityLogModal } from './components/modals/ActivityLogModal';
import {
  AdminUser,
  checkAdminSession,
  getStoredUser,
  logoutAdmin,
  canPublishSchedule,
  isViewerRole,
} from './utils/authClient';
import { saveOrExportJson } from './utils/fileExport';
import { saveMySqlBackup, getMySqlBackup } from './utils/mysqlBackupClient';
import { publishScheduleToServer } from './utils/serverSync';
import { Github, Database } from 'lucide-react';

export type AppMode = 'landing' | 'admin' | 'portal';

function checkRouteMode(): AppMode {
  try {
    const pathname = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    // 1. Coach & Parent Portal routes
    if (
      pathname.startsWith('/portal') ||
      pathname.startsWith('/parents') ||
      pathname.startsWith('/public') ||
      pathname.startsWith('/coach') ||
      search.includes('view=portal') ||
      search.includes('view=public') ||
      hash.includes('portal') ||
      hash.includes('public')
    ) {
      return 'portal';
    }

    // 2. League Admin route
    if (
      pathname.startsWith('/admin') ||
      search.includes('view=admin') ||
      hash.includes('admin')
    ) {
      return 'admin';
    }

    // 3. Root and default is the Landing Page
    return 'landing';
  } catch {
    return 'landing';
  }
}

export default function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [currentTab, setCurrentTab] = useState<NavTab>('schedule');
  const [appMode, setAppMode] = useState<AppMode>(() => checkRouteMode());

  // MySQL Admin Authentication State
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => getStoredUser());
  const [isAdminUsersModalOpen, setIsAdminUsersModalOpen] = useState(false);

  // Verify stored session on mount
  useEffect(() => {
    checkAdminSession().then((user) => {
      setAdminUser(user);
    });
  }, []);

  // Sync mode with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setAppMode(checkRouteMode());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenPortal = useCallback((openInNewTab = false) => {
    if (openInNewTab) {
      window.open('/portal', '_blank');
      return;
    }
    setAppMode('portal');
    try {
      window.history.pushState(null, '', '/portal');
    } catch {}
  }, []);

  const handleSwitchToAdmin = useCallback(() => {
    setAppMode('admin');
    try {
      window.history.pushState(null, '', '/admin');
    } catch {}
  }, []);

  const handleLogoutAdmin = useCallback(async () => {
    await logoutAdmin();
    setAdminUser(null);
  }, []);

  const handleGoToLanding = useCallback(() => {
    setAppMode('landing');
    try {
      window.history.pushState(null, '', '/');
    } catch {}
  }, []);

  // Modals state (Admin workspace)
  const [activeContactTeam, setActiveContactTeam] = useState<{ team: Team; divisionName?: string } | null>(null);
  const [activeMapField, setActiveMapField] = useState<Field | null>(null);
  const [activeEditingGame, setActiveEditingGame] = useState<Game | null>(null);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [isMySqlBackupModalOpen, setIsMySqlBackupModalOpen] = useState(false);
  const [isActivityLogModalOpen, setIsActivityLogModalOpen] = useState(false);
  const [isTeamSizesModalOpen, setIsTeamSizesModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvImportInitialType, setCsvImportInitialType] = useState<CsvImportType>('teams');
  const [scheduleNotice, setScheduleNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleOpenCsvImport = useCallback((type: CsvImportType = 'teams') => {
    if (isViewerRole(adminUser)) {
      setScheduleNotice({
        message: 'Action not allowed: Viewer accounts have read-only access and cannot import data.',
        type: 'error',
      });
      return;
    }
    setCsvImportInitialType(type);
    setIsCsvImportOpen(true);
  }, [adminUser]);

  // Conflicts scanning
  const conflicts = useMemo(() => {
    return detectConflicts(appData);
  }, [appData]);

  // Persist appData whenever it changes
  const updateAndSaveAppData = useCallback((updater: (prev: AppData) => AppData) => {
    if (isViewerRole(adminUser)) {
      setScheduleNotice({
        message: 'Action not allowed: Viewer accounts have read-only access.',
        type: 'error',
      });
      return;
    }
    setAppData((prev) => {
      const next = updater(prev);
      next.lastModified = new Date().toISOString();
      saveAppData(next);
      return next;
    });
  }, [adminUser]);

  // Update whole dataset (e.g. from import or reset)
  const handleUpdateFullData = useCallback((newData: AppData) => {
    if (isViewerRole(adminUser)) {
      setScheduleNotice({
        message: 'Action not allowed: Viewer accounts have read-only access.',
        type: 'error',
      });
      return;
    }
    setAppData(newData);
    saveAppData(newData);
  }, [adminUser]);

  // Unified Save: Persists current schedule to MySQL NoSQL document and saves to local JSON file
  const handleUnifiedSave = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (isViewerRole(adminUser)) {
      setScheduleNotice({
        message: 'Action not allowed: Viewer accounts have read-only access and cannot save or overwrite data.',
        type: 'error',
      });
      return { success: false, message: 'Forbidden: Read-only viewer' };
    }
    try {
      const activeName = appData.fileName || getCookie(COOKIE_NAME) || 'soccer_schedule.json';
      const cleanJsonName = activeName.endsWith('.json') ? activeName : `${activeName}.json`;

      // 1. Save to MySQL Database
      const backupId = appData.mysqlBackupSync
        ? appData.mysqlBackupSync.backupId
        : cleanJsonName.replace(/\.json$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const backupTitle = appData.mysqlBackupSync
        ? appData.mysqlBackupSync.backupName
        : cleanJsonName.replace(/\.json$/i, '');

      const mysqlRes = await saveMySqlBackup({
        id: backupId,
        name: backupTitle,
        appData,
        checkSyncToken: appData.mysqlBackupSync?.syncToken,
        modifiedBy: adminUser?.displayName || 'League Admin',
        forceOverwrite: false,
      });

      if (mysqlRes.conflict && mysqlRes.remoteData) {
        setIsMySqlBackupModalOpen(true);
        setScheduleNotice({
          message: 'Concurrent update conflict detected in MySQL database. Please review differences in the backup dialog.',
          type: 'error',
        });
        return { success: false, message: 'MySQL Concurrency Conflict Detected' };
      }

      let dataToExport = appData;
      if (mysqlRes.success && mysqlRes.updatedAppData) {
        dataToExport = mysqlRes.updatedAppData;
        handleUpdateFullData(dataToExport);
      }

      // 2. Save / Export to local JSON file
      const exportRes = await saveOrExportJson(dataToExport, cleanJsonName, {
        preferOverwrite: true,
        reuseHandle: true,
      });

      if (exportRes.success) {
        setCookie(COOKIE_NAME, exportRes.fileName);
        setScheduleNotice({
          message: `Saved successfully! Schedule updated in MySQL (${mysqlRes.isLiveMySql ? 'Live Database' : 'NoSQL Fallback'}) and saved local file "${exportRes.fileName}".`,
          type: 'success',
        });
        return { success: true, message: `Saved to MySQL & ${exportRes.fileName}` };
      } else if (exportRes.method === 'cancelled') {
        setScheduleNotice({
          message: `Schedule saved to MySQL database (local file save dialog was cancelled).`,
          type: 'success',
        });
        return { success: true, message: 'Saved to MySQL' };
      } else {
        setScheduleNotice({
          message: `Saved to MySQL database. Note on local file: ${exportRes.message}`,
          type: 'success',
        });
        return { success: true, message: 'Saved to MySQL' };
      }
    } catch (err: any) {
      setScheduleNotice({
        message: `Save error: ${err.message || 'Failed to complete save operation'}`,
        type: 'error',
      });
      return { success: false, message: err.message };
    }
  }, [appData, adminUser, handleUpdateFullData]);

  // Publish Schedule directly to server file league_schedule.json for public coach/parent access
  const handlePublishToServer = useCallback(async () => {
    if (!canPublishSchedule(adminUser)) {
      const errorMsg = 'Action not allowed: Publishing the schedule requires Scheduler role or above.';
      setScheduleNotice({
        message: errorMsg,
        type: 'error',
      });
      return { success: false, message: errorMsg };
    }
    try {
      const res = await publishScheduleToServer(appData);
      const successMsg =
        res.message ||
        'Successfully published schedule to server file "league_schedule.json"! Public portal is updated with referee contacts kept private.';
      setScheduleNotice({
        message: successMsg,
        type: 'success',
      });
      return { success: true, message: successMsg };
    } catch (err: any) {
      const errorMsg = `Publish error: ${err.message || 'Failed to upload league_schedule.json to server.'}`;
      setScheduleNotice({
        message: errorMsg,
        type: 'error',
      });
      return { success: false, message: errorMsg };
    }
  }, [appData, adminUser]);

  // Game update
  const handleUpdateGame = useCallback((updatedGame: Game) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.id === updatedGame.id ? updatedGame : g)),
    }));
  }, [updateAndSaveAppData]);

  // Batch game updates (e.g. from Auto-Balance)
  const handleUpdateBatchGames = useCallback((updatedGames: Game[]) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      games: updatedGames,
    }));
  }, [updateAndSaveAppData]);

  // Add custom game
  const handleAddGame = useCallback((newGame: Game) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      games: [newGame, ...prev.games],
    }));
    setActiveEditingGame(newGame);
  }, [updateAndSaveAppData]);

  // Delete game
  const handleDeleteGame = useCallback((gameId: string) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g.id !== gameId),
    }));
  }, [updateAndSaveAppData]);

  // Division save
  const handleSaveDivision = useCallback((division: Division) => {
    updateAndSaveAppData((prev) => {
      const exists = prev.divisions.some((d) => d.id === division.id);
      return {
        ...prev,
        divisions: exists
          ? prev.divisions.map((d) => (d.id === division.id ? division : d))
          : [...prev.divisions, division],
      };
    });
  }, [updateAndSaveAppData]);

  // Division delete
  const handleDeleteDivision = useCallback((divisionId: string) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      divisions: prev.divisions.filter((d) => d.id !== divisionId),
    }));
  }, [updateAndSaveAppData]);

  // Team save
  const handleSaveTeam = useCallback((team: Team) => {
    updateAndSaveAppData((prev) => {
      const exists = prev.teams.some((t) => t.id === team.id);
      return {
        ...prev,
        teams: exists
          ? prev.teams.map((t) => (t.id === team.id ? team : t))
          : [...prev.teams, team],
      };
    });
  }, [updateAndSaveAppData]);

  // Team delete
  const handleDeleteTeam = useCallback((teamId: string) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== teamId),
      games: prev.games.filter((g) => g.homeTeamId !== teamId && g.awayTeamId !== teamId),
    }));
  }, [updateAndSaveAppData]);

  // Team sizes save
  const handleSaveTeamSizes = useCallback((updatedSizes: TeamSizeOption[]) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      teamSizes: updatedSizes,
    }));
  }, [updateAndSaveAppData]);

  // Field save
  const handleSaveField = useCallback((field: Field) => {
    updateAndSaveAppData((prev) => {
      const exists = prev.fields.some((f) => f.id === field.id);
      return {
        ...prev,
        fields: exists
          ? prev.fields.map((f) => (f.id === field.id ? field : f))
          : [...prev.fields, field],
      };
    });
  }, [updateAndSaveAppData]);

  // Field delete
  const handleDeleteField = useCallback((fieldId: string) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== fieldId),
    }));
  }, [updateAndSaveAppData]);

  // Referee save
  const handleSaveReferee = useCallback((referee: Referee) => {
    updateAndSaveAppData((prev) => {
      const currentReferees = prev.referees || [];
      const exists = currentReferees.some((r) => r.id === referee.id);
      return {
        ...prev,
        referees: exists
          ? currentReferees.map((r) => (r.id === referee.id ? referee : r))
          : [...currentReferees, referee],
      };
    });
  }, [updateAndSaveAppData]);

  // Referee delete
  const handleDeleteReferee = useCallback((refereeId: string) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      referees: (prev.referees || []).filter((r) => r.id !== refereeId),
      games: prev.games.map((g) => ({
        ...g,
        refereeId: g.refereeId === refereeId ? undefined : g.refereeId,
        assistantReferee1Id: g.assistantReferee1Id === refereeId ? undefined : g.assistantReferee1Id,
        assistantReferee2Id: g.assistantReferee2Id === refereeId ? undefined : g.assistantReferee2Id,
      })),
    }));
  }, [updateAndSaveAppData]);

  // Referee certification levels save & remapping
  const handleSaveRefereeCertifications = useCallback(
    (updatedCertifications: RefereeCertificationOption[], renamedMap?: Record<string, string>) => {
      updateAndSaveAppData((prev) => {
        let updatedReferees = prev.referees || [];
        if (renamedMap && Object.keys(renamedMap).length > 0) {
          updatedReferees = updatedReferees.map((r) => {
            if (renamedMap[r.certificationLevel]) {
              return { ...r, certificationLevel: renamedMap[r.certificationLevel] };
            }
            return r;
          });
        }
        return {
          ...prev,
          refereeCertifications: updatedCertifications,
          referees: updatedReferees,
        };
      });
    },
    [updateAndSaveAppData]
  );

  // Bulletin management handlers
  const handleSaveBulletin = useCallback(
    (bulletin: Bulletin) => {
      updateAndSaveAppData((prev) => {
        const existing = prev.bulletins || [];
        const index = existing.findIndex((b) => b.id === bulletin.id);
        let updated: Bulletin[];
        if (index >= 0) {
          updated = [...existing];
          updated[index] = bulletin;
        } else {
          updated = [bulletin, ...existing];
        }
        return {
          ...prev,
          bulletins: updated,
        };
      });
      setScheduleNotice({
        message: `Bulletin "${bulletin.title}" saved successfully.`,
        type: 'success',
      });
    },
    [updateAndSaveAppData]
  );

  const handleDeleteBulletin = useCallback(
    (bulletinId: string) => {
      updateAndSaveAppData((prev) => ({
        ...prev,
        bulletins: (prev.bulletins || []).filter((b) => b.id !== bulletinId),
      }));
      setScheduleNotice({
        message: 'Bulletin deleted.',
        type: 'success',
      });
    },
    [updateAndSaveAppData]
  );

  const handleTogglePinBulletin = useCallback(
    (bulletinId: string) => {
      updateAndSaveAppData((prev) => ({
        ...prev,
        bulletins: (prev.bulletins || []).map((b) =>
          b.id === bulletinId ? { ...b, isPinned: !b.isPinned } : b
        ),
      }));
    },
    [updateAndSaveAppData]
  );

  const handleToggleActiveBulletin = useCallback(
    (bulletinId: string) => {
      updateAndSaveAppData((prev) => ({
        ...prev,
        bulletins: (prev.bulletins || []).map((b) =>
          b.id === bulletinId ? { ...b, isActive: !b.isActive } : b
        ),
      }));
    },
    [updateAndSaveAppData]
  );

  // Season config save - Restricted to admin and superadmin
  const handleSaveSeasonConfig = useCallback((config: SeasonConfig) => {
    if (adminUser?.role !== 'admin' && adminUser?.role !== 'superadmin') {
      setScheduleNotice({
        message: 'Permission denied: Season configuration can only be modified by Admins or Superadmins.',
        type: 'error',
      });
      return;
    }
    updateAndSaveAppData((prev) => ({
      ...prev,
      seasonConfig: config,
    }));
  }, [adminUser, updateAndSaveAppData]);

  // Re-generate schedule - opens modern in-app modal (Restricted to admin and superadmin)
  const handleRegenerateSchedule = useCallback(() => {
    if (adminUser?.role !== 'admin' && adminUser?.role !== 'superadmin') {
      setScheduleNotice({
        message: 'Permission denied: Schedule generation requires Admin or Superadmin permissions.',
        type: 'error',
      });
      return;
    }
    setIsRegenerateModalOpen(true);
  }, [adminUser]);

  // Executes schedule generation from modal confirmation
  const handleConfirmRegenerate = useCallback((targetDivisionId?: string) => {
    try {
      const result = generateLeagueSchedule(appData, targetDivisionId);
      updateAndSaveAppData((prev) => {
        // Merge synthetic teams (like "Bye") if needed
        const existingTeamIds = new Set(prev.teams.map((t) => t.id));
        const combinedTeams = [...prev.teams];
        if (result.syntheticTeams) {
          for (const syn of result.syntheticTeams) {
            if (!existingTeamIds.has(syn.id)) {
              combinedTeams.push(syn);
            }
          }
        }
        return {
          ...prev,
          teams: combinedTeams,
          games: result.games,
        };
      });

      const targetLabel =
        targetDivisionId && targetDivisionId !== 'all'
          ? appData.divisions.find((d) => d.id === targetDivisionId)?.name || 'Division'
          : 'All Divisions';

      setScheduleNotice({
        message: `Schedule successfully generated for ${targetLabel}! Total of ${result.games.length} matches created with 0 conflicts.`,
        type: 'success',
      });

      setTimeout(() => {
        setScheduleNotice(null);
      }, 6000);

      setCurrentTab('schedule');
    } catch (err: any) {
      console.error('Schedule regeneration error:', err);
      setScheduleNotice({
        message: `Failed to regenerate schedule: ${err?.message || 'Unknown error'}`,
        type: 'error',
      });
    }
  }, [appData, updateAndSaveAppData]);

  // ================= 1. ROOT LANDING PAGE (/) =================
  if (appMode === 'landing') {
    return (
      <LandingPage
        fallbackAppData={appData}
        onSelectAdmin={handleSwitchToAdmin}
        onSelectPortal={() => handleOpenPortal(false)}
      />
    );
  }

  // ================= 2. STANDALONE PORTAL MODE (/portal) =================
  // If in portal mode, render exclusively the Standalone Parent & Coach Portal
  if (appMode === 'portal') {
    return (
      <StandaloneParentPortal
        appData={appData}
        onSwitchToAdmin={handleSwitchToAdmin}
        onGoToHome={handleGoToLanding}
      />
    );
  }

  // ================= 3. LEAGUE ADMIN MODE (/admin) =================
  // If not authenticated, prompt for MySQL admin login
  if (!adminUser) {
    return (
      <AdminLoginScreen
        onLoginSuccess={(user) => {
          setAdminUser(user);
          updateAndSaveAppData((prev) => ({
            ...prev,
            lastModifiedBy: user.displayName || user.username,
          }));
        }}
        onGoToHome={handleGoToLanding}
        onGoToPortal={() => handleOpenPortal(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navigation Bar with Cookie Tracked File Indicator, Home button & Portal Launcher */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        appData={appData}
        conflicts={conflicts}
        onOpenDatasetModal={() => setIsDatasetModalOpen(true)}
        onOpenMySqlBackupModal={() => setIsMySqlBackupModalOpen(true)}
        onOpenActivityLogModal={() => setIsActivityLogModalOpen(true)}
        onOpenPortal={handleOpenPortal}
        onGoToHome={handleGoToLanding}
        adminUser={adminUser}
        onOpenAdminUsersModal={() => setIsAdminUsersModalOpen(true)}
        onLogoutAdmin={handleLogoutAdmin}
        onUnifiedSave={handleUnifiedSave}
        onPublishServer={handlePublishToServer}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Schedule Generation Notice Banner */}
        {scheduleNotice && (
          <div
            className={`mb-5 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-2xs transition-all animate-in fade-in ${
              scheduleNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{scheduleNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setScheduleNotice(null)}
              className="text-slate-400 hover:text-slate-700 p-1 font-bold text-sm leading-none"
            >
              ✕
            </button>
          </div>
        )}

        {(currentTab === 'schedule' ||
          currentTab === 'matchups' ||
          currentTab === 'conflicts' ||
          currentTab === 'balance') && (
          <SchedulePage
            appData={appData}
            conflicts={conflicts}
            canPublish={canPublishSchedule(adminUser)}
            isReadOnly={isViewerRole(adminUser)}
            activeRefinementTab={
              currentTab === 'matchups' || currentTab === 'conflicts' || currentTab === 'balance'
                ? currentTab
                : undefined
            }
            onSelectRefinementTab={(subTab) => {
              if (subTab === 'schedule') {
                setCurrentTab('schedule');
              } else {
                setCurrentTab(subTab as NavTab);
              }
            }}
            onNavigateToTab={(tab) => setCurrentTab(tab as NavTab)}
            onUpdateGame={handleUpdateGame}
            onUpdateBatchGames={handleUpdateBatchGames}
            onDeleteGame={handleDeleteGame}
            onAddGame={handleAddGame}
            onSelectTeamContact={(team, divisionName) => setActiveContactTeam({ team, divisionName })}
            onSelectFieldMap={(field) => setActiveMapField(field)}
            onEditGame={(game) => setActiveEditingGame(game)}
            onRegenerateSchedule={handleRegenerateSchedule}
            onRecheckConflicts={() => setAppData((prev) => ({ ...prev }))}
            onSwitchToPublicPortal={() => handleOpenPortal(false)}
            onOpenCsvImport={() => handleOpenCsvImport('schedule')}
          />
        )}

        {currentTab === 'stats' && (
          <TeamStatisticsPage
            appData={appData}
            isReadOnly={isViewerRole(adminUser)}
            onUpdateGame={handleUpdateGame}
            onUpdateBatchGames={handleUpdateBatchGames}
            onSelectTeamContact={(team, divisionName) => setActiveContactTeam({ team, divisionName })}
            onSelectFieldMap={(field) => setActiveMapField(field)}
            onEditGame={(game) => setActiveEditingGame(game)}
            onNavigateToMatchups={() => setCurrentTab('matchups')}
          />
        )}

        {currentTab === 'divisions' && (
          <DivisionsPage
            appData={appData}
            isReadOnly={isViewerRole(adminUser)}
            onSaveDivision={handleSaveDivision}
            onDeleteDivision={handleDeleteDivision}
            onSelectTeam={(team) => {
              const div = appData.divisions.find((d) => d.id === team.divisionId);
              setActiveContactTeam({ team, divisionName: div?.name });
            }}
            onSelectField={(field) => setActiveMapField(field)}
          />
        )}

        {currentTab === 'teams' && (
          <TeamsPage
            appData={appData}
            isReadOnly={isViewerRole(adminUser)}
            onSaveTeam={handleSaveTeam}
            onDeleteTeam={handleDeleteTeam}
            onOpenManageTeamSizes={() => setIsTeamSizesModalOpen(true)}
            onOpenCsvImport={() => handleOpenCsvImport('teams')}
            onSelectTeamContact={(team, divisionName) => setActiveContactTeam({ team, divisionName })}
            onSelectField={(field) => setActiveMapField(field)}
          />
        )}

        {currentTab === 'fields' && (
          <FieldsPage
            appData={appData}
            isReadOnly={isViewerRole(adminUser)}
            onSaveField={handleSaveField}
            onDeleteField={handleDeleteField}
            onSelectFieldMap={(field) => setActiveMapField(field)}
            onOpenCsvImport={() => handleOpenCsvImport('fields')}
          />
        )}

        {currentTab === 'referees' && (
          <RefereesPage
            appData={appData}
            isReadOnly={isViewerRole(adminUser)}
            onSaveReferee={handleSaveReferee}
            onDeleteReferee={handleDeleteReferee}
            onUpdateGame={handleUpdateGame}
            onUpdateBatchGames={handleUpdateBatchGames}
            onNavigateToSchedule={() => setCurrentTab('schedule')}
            onOpenCsvImport={() => handleOpenCsvImport('referees')}
            onSaveCertifications={handleSaveRefereeCertifications}
          />
        )}

        {currentTab === 'bulletins' && (
          <BulletinsPage
            appData={appData}
            adminUser={adminUser}
            isReadOnly={isViewerRole(adminUser)}
            onSaveBulletin={handleSaveBulletin}
            onDeleteBulletin={handleDeleteBulletin}
            onTogglePinBulletin={handleTogglePinBulletin}
            onToggleActiveBulletin={handleToggleActiveBulletin}
          />
        )}

        {currentTab === 'season' && (
          <SeasonConfigPage
            appData={appData}
            onSaveSeasonConfig={handleSaveSeasonConfig}
            onRegenerateSchedule={handleRegenerateSchedule}
            canEdit={adminUser?.role === 'admin' || adminUser?.role === 'superadmin'}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">PitchMaster Soccer Scheduler</span>
            <span aria-hidden="true">·</span>
            <span>Round-Robin & Pitch Conflict Management</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Active Data File: <code className="font-mono text-slate-700">{appData.fileName}</code>
            </span>
            <button
              onClick={() => setIsDatasetModalOpen(true)}
              className="text-blue-600 hover:underline"
            >
              Export / Import
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setIsMySqlBackupModalOpen(true)}
              className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <Database className="w-3 h-3 text-indigo-600" />
              <span>MySQL Backup</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenCsvImport('teams')}
              className="text-emerald-700 hover:underline font-medium"
            >
              CSV Migration
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenPortal(false)}
              className="text-emerald-700 hover:underline font-medium"
            >
              Coach & Parent Portal ↗
            </button>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/stephenwardhw/Pitch-Master"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:underline"
              title="PitchMaster on GitHub"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500 font-mono text-[11px]">MIT License</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {/* 1. Team Contact Modal */}
      {activeContactTeam && (
        <TeamContactModal
          team={activeContactTeam.team || null}
          divisionName={activeContactTeam.divisionName}
          fields={appData.fields}
          onClose={() => setActiveContactTeam(null)}
          onEditTeam={(team) => {
            setCurrentTab('teams');
          }}
        />
      )}

      {/* 2. Field Map Modal */}
      {activeMapField && (
        <FieldMapModal
          field={activeMapField}
          divisions={appData.divisions}
          onClose={() => setActiveMapField(null)}
          onEditField={(field) => {
            setCurrentTab('fields');
          }}
        />
      )}

      {/* 3. Edit Game Modal */}
      {activeEditingGame && (
        <EditGameModal
          game={activeEditingGame}
          divisions={appData.divisions}
          teams={appData.teams}
          fields={appData.fields}
          referees={appData.referees}
          isReadOnly={isViewerRole(adminUser)}
          onSave={handleUpdateGame}
          onClose={() => setActiveEditingGame(null)}
        />
      )}

      {/* 4. Dataset Manager Modal */}
      {isDatasetModalOpen && (
        <DatasetModal
          appData={appData}
          adminUser={adminUser}
          onUpdateData={handleUpdateFullData}
          onClose={() => setIsDatasetModalOpen(false)}
          onOpenCsvImport={handleOpenCsvImport}
          onOpenMySqlBackupModal={() => setIsMySqlBackupModalOpen(true)}
        />
      )}

      {/* 5. MySQL NoSQL Document Backup Modal */}
      {isMySqlBackupModalOpen && (
        <MySqlBackupModal
          appData={appData}
          adminUser={adminUser}
          isReadOnly={isViewerRole(adminUser)}
          onUpdateAppData={(updatedData) => {
            handleUpdateFullData(updatedData);
          }}
          onClose={() => setIsMySqlBackupModalOpen(false)}
          onOpenActivityLog={() => {
            setIsMySqlBackupModalOpen(false);
            setIsActivityLogModalOpen(true);
          }}
        />
      )}

      {/* 6. Manage Team Sizes Modal */}
      {isTeamSizesModalOpen && (
        <ManageTeamSizesModal
          teamSizes={appData.teamSizes}
          onSaveTeamSizes={handleSaveTeamSizes}
          onClose={() => setIsTeamSizesModalOpen(false)}
        />
      )}

      {/* 7. Re-run Automated Scheduler Modal */}
      {isRegenerateModalOpen && (
        <RegenerateScheduleModal
          appData={appData}
          onConfirmRegenerate={handleConfirmRegenerate}
          onClose={() => setIsRegenerateModalOpen(false)}
        />
      )}

      {/* 8. CSV Importer Modal */}
      {isCsvImportOpen && (
        <CsvImportModal
          appData={appData}
          initialType={csvImportInitialType}
          onUpdateAppData={handleUpdateFullData}
          onClose={() => setIsCsvImportOpen(false)}
        />
      )}

      {/* 9. MySQL Admin Users Management Modal */}
      {isAdminUsersModalOpen && adminUser && (
        <AdminUsersModal
          currentUser={adminUser}
          onClose={() => setIsAdminUsersModalOpen(false)}
        />
      )}

      {/* 10. Schedule Activity Log Modal */}
      {isActivityLogModalOpen && (
        <ActivityLogModal
          onClose={() => setIsActivityLogModalOpen(false)}
          onOpenMySqlBackupModal={() => {
            setIsActivityLogModalOpen(false);
            setIsMySqlBackupModalOpen(true);
          }}
          onLoadBackup={async (backupId) => {
            try {
              const res = await getMySqlBackup(backupId);
              if (res && res.appData) {
                handleUpdateFullData(res.appData);
                setScheduleNotice({
                  message: `Successfully restored and loaded snapshot "${res.metadata.name}" (version v${res.metadata.versionNumber}) from MySQL database.`,
                  type: 'success',
                });
              }
            } catch (err: any) {
              setScheduleNotice({
                message: `Failed to load backup: ${err.message || 'Unknown error'}`,
                type: 'error',
              });
            }
          }}
        />
      )}
    </div>
  );
}
