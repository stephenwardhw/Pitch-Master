import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppData, Conflict, Division, Field, Game, SeasonConfig, Team, TeamSizeOption } from './types';
import { loadAppData, saveAppData, COOKIE_NAME, getCookie, setCookie } from './utils/cookieStorage';
import { generateLeagueSchedule } from './utils/scheduler';
import { detectConflicts } from './utils/conflictDetector';

import { Navbar, NavTab } from './components/Navbar';
import { SchedulePage } from './components/SchedulePage';
import { DivisionsPage } from './components/DivisionsPage';
import { TeamsPage } from './components/TeamsPage';
import { FieldsPage } from './components/FieldsPage';
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
import { Github } from 'lucide-react';

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
    // Perform a true browser navigation to /admin so the web server (Apache)
    // intercepts the HTTP request and enforces Basic Authentication / security rules.
    // Client-side pushState or React state switching bypasses web server HTTP authentication.
    window.location.assign('/admin');
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
  const [isTeamSizesModalOpen, setIsTeamSizesModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvImportInitialType, setCsvImportInitialType] = useState<CsvImportType>('teams');
  const [scheduleNotice, setScheduleNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleOpenCsvImport = useCallback((type: CsvImportType = 'teams') => {
    setCsvImportInitialType(type);
    setIsCsvImportOpen(true);
  }, []);

  // Conflicts scanning
  const conflicts = useMemo(() => {
    return detectConflicts(appData);
  }, [appData]);

  // Persist appData whenever it changes
  const updateAndSaveAppData = useCallback((updater: (prev: AppData) => AppData) => {
    setAppData((prev) => {
      const next = updater(prev);
      next.lastModified = new Date().toISOString();
      saveAppData(next);
      return next;
    });
  }, []);

  // Update whole dataset (e.g. from import or reset)
  const handleUpdateFullData = useCallback((newData: AppData) => {
    setAppData(newData);
    saveAppData(newData);
  }, []);

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

  // Season config save
  const handleSaveSeasonConfig = useCallback((config: SeasonConfig) => {
    updateAndSaveAppData((prev) => ({
      ...prev,
      seasonConfig: config,
    }));
  }, [updateAndSaveAppData]);

  // Re-generate schedule - opens modern in-app modal (no browser popup blockers)
  const handleRegenerateSchedule = useCallback(() => {
    setIsRegenerateModalOpen(true);
  }, []);

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
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navigation Bar with Cookie Tracked File Indicator, Home button & Portal Launcher */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        appData={appData}
        conflicts={conflicts}
        onOpenDatasetModal={() => setIsDatasetModalOpen(true)}
        onOpenPortal={handleOpenPortal}
        onGoToHome={handleGoToLanding}
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
            onSaveField={handleSaveField}
            onDeleteField={handleDeleteField}
            onSelectFieldMap={(field) => setActiveMapField(field)}
            onOpenCsvImport={() => handleOpenCsvImport('fields')}
          />
        )}

        {currentTab === 'season' && (
          <SeasonConfigPage
            appData={appData}
            onSaveSeasonConfig={handleSaveSeasonConfig}
            onRegenerateSchedule={handleRegenerateSchedule}
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
          </div>
        </div>
      </footer>

      {/* Modals */}
      {/* 1. Team Contact Modal */}
      <TeamContactModal
        team={activeContactTeam?.team || null}
        divisionName={activeContactTeam?.divisionName}
        fields={appData.fields}
        onClose={() => setActiveContactTeam(null)}
        onEditTeam={(team) => {
          setCurrentTab('teams');
        }}
      />

      {/* 2. Field Map Modal */}
      <FieldMapModal
        field={activeMapField}
        divisions={appData.divisions}
        onClose={() => setActiveMapField(null)}
        onEditField={(field) => {
          setCurrentTab('fields');
        }}
      />

      {/* 3. Edit Game Modal */}
      <EditGameModal
        game={activeEditingGame}
        divisions={appData.divisions}
        teams={appData.teams}
        fields={appData.fields}
        onSave={handleUpdateGame}
        onClose={() => setActiveEditingGame(null)}
      />

      {/* 4. Dataset Manager Modal */}
      {isDatasetModalOpen && (
        <DatasetModal
          appData={appData}
          onUpdateData={handleUpdateFullData}
          onClose={() => setIsDatasetModalOpen(false)}
          onOpenCsvImport={handleOpenCsvImport}
        />
      )}

      {/* 5. Manage Team Sizes Modal */}
      {isTeamSizesModalOpen && (
        <ManageTeamSizesModal
          teamSizes={appData.teamSizes}
          onSaveTeamSizes={handleSaveTeamSizes}
          onClose={() => setIsTeamSizesModalOpen(false)}
        />
      )}

      {/* 6. Re-run Automated Scheduler Modal */}
      {isRegenerateModalOpen && (
        <RegenerateScheduleModal
          appData={appData}
          onConfirmRegenerate={handleConfirmRegenerate}
          onClose={() => setIsRegenerateModalOpen(false)}
        />
      )}

      {/* 7. CSV Importer Modal */}
      {isCsvImportOpen && (
        <CsvImportModal
          appData={appData}
          initialType={csvImportInitialType}
          onUpdateAppData={handleUpdateFullData}
          onClose={() => setIsCsvImportOpen(false)}
        />
      )}
    </div>
  );
}
