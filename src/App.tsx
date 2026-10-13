import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppData, Conflict, Division, Field, Game, SeasonConfig, Team, TeamSizeOption } from './types';
import { loadAppData, saveAppData, COOKIE_NAME, getCookie, setCookie } from './utils/cookieStorage';
import { generateLeagueSchedule } from './utils/scheduler';
import { detectConflicts } from './utils/conflictDetector';

import { Navbar, NavTab } from './components/Navbar';
import { SchedulePage } from './components/SchedulePage';
import { HomeAwayBalancePage } from './components/HomeAwayBalancePage';
import { ConflictsPage } from './components/ConflictsPage';
import { DivisionsPage } from './components/DivisionsPage';
import { TeamsPage } from './components/TeamsPage';
import { FieldsPage } from './components/FieldsPage';
import { SeasonConfigPage } from './components/SeasonConfigPage';
import { StandaloneParentPortal } from './components/StandaloneParentPortal';
import { TeamStatisticsPage } from './components/TeamStatisticsPage';

import { TeamContactModal } from './components/modals/TeamContactModal';
import { FieldMapModal } from './components/modals/FieldMapModal';
import { EditGameModal } from './components/modals/EditGameModal';
import { DatasetModal } from './components/modals/DatasetModal';
import { ManageTeamSizesModal } from './components/modals/ManageTeamSizesModal';

function checkIsPortalRoute(): boolean {
  try {
    const pathname = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (
      pathname.includes('/portal') ||
      pathname.includes('/parents') ||
      pathname.includes('/public') ||
      pathname.includes('/coach') ||
      search.includes('portal') ||
      search.includes('view=public') ||
      search.includes('view=portal') ||
      hash.includes('portal') ||
      hash.includes('public')
    );
  } catch {
    return false;
  }
}

export default function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [currentTab, setCurrentTab] = useState<NavTab>('schedule');
  const [appMode, setAppMode] = useState<'admin' | 'portal'>(() =>
    checkIsPortalRoute() ? 'portal' : 'admin'
  );

  // Sync mode with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setAppMode(checkIsPortalRoute() ? 'portal' : 'admin');
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
      window.history.pushState(null, '', '/');
    } catch {}
  }, []);

  // Modals state (Admin workspace)
  const [activeContactTeam, setActiveContactTeam] = useState<{ team: Team; divisionName?: string } | null>(null);
  const [activeMapField, setActiveMapField] = useState<Field | null>(null);
  const [activeEditingGame, setActiveEditingGame] = useState<Game | null>(null);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [isTeamSizesModalOpen, setIsTeamSizesModalOpen] = useState(false);

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

  // Re-generate schedule
  const handleRegenerateSchedule = useCallback(() => {
    if (
      window.confirm(
        'Generate new season schedule? This will recompute round-robin rotations, apply home pitch preferences and alternate conflict pitches, and create practice games for bye divisions.'
      )
    ) {
      const result = generateLeagueSchedule(appData);
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
      setCurrentTab('schedule');
    }
  }, [appData, updateAndSaveAppData]);

  // ================= STANDALONE PORTAL MODE =================
  // If in portal mode, render exclusively the Standalone Parent & Coach Portal
  if (appMode === 'portal') {
    return (
      <StandaloneParentPortal
        appData={appData}
        onSwitchToAdmin={handleSwitchToAdmin}
      />
    );
  }

  // ================= LEAGUE ADMIN MODE =================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navigation Bar with Cookie Tracked File Indicator & Portal Launcher */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        appData={appData}
        conflicts={conflicts}
        onOpenDatasetModal={() => setIsDatasetModalOpen(true)}
        onOpenPortal={handleOpenPortal}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'schedule' && (
          <SchedulePage
            appData={appData}
            conflicts={conflicts}
            onUpdateGame={handleUpdateGame}
            onDeleteGame={handleDeleteGame}
            onAddGame={handleAddGame}
            onSelectTeamContact={(team, divisionName) => setActiveContactTeam({ team, divisionName })}
            onSelectFieldMap={(field) => setActiveMapField(field)}
            onEditGame={(game) => setActiveEditingGame(game)}
            onRegenerateSchedule={handleRegenerateSchedule}
            onSwitchToPublicPortal={() => handleOpenPortal(false)}
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
          />
        )}

        {currentTab === 'conflicts' && (
          <ConflictsPage
            appData={appData}
            conflicts={conflicts}
            onUpdateGame={handleUpdateGame}
            onEditGame={(game) => setActiveEditingGame(game)}
            onRecheckConflicts={() => {
              // Trigger state refresh
              setAppData((prev) => ({ ...prev }));
            }}
          />
        )}

        {currentTab === 'balance' && (
          <HomeAwayBalancePage
            appData={appData}
            onUpdateGame={handleUpdateGame}
            onUpdateBatchGames={handleUpdateBatchGames}
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
              onClick={() => handleOpenPortal(false)}
              className="text-emerald-700 hover:underline font-medium"
            >
              Coach & Parent Portal ↗
            </button>
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
    </div>
  );
}
