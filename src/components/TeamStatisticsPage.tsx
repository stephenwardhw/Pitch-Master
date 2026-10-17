import React, { useState, useMemo } from 'react';
import { AppData, Division, Field, Game, Team, TeamRecordStats } from '../types';
import {
  Trophy,
  BarChart3,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Users,
  Award,
  TrendingUp,
  ArrowUpDown,
  Plus,
  Edit2,
  X,
  Phone,
  Mail,
  Activity,
  Zap,
  Grid,
} from 'lucide-react';

interface TeamStatisticsPageProps {
  appData: AppData;
  onUpdateGame: (updatedGame: Game) => void;
  onUpdateBatchGames: (updatedGames: Game[]) => void;
  onSelectTeamContact?: (team: Team, divisionName?: string) => void;
  onSelectFieldMap?: (field: Field) => void;
  onEditGame?: (game: Game) => void;
  onNavigateToMatchups?: () => void;
}

type SortField =
  | 'rank'
  | 'name'
  | 'division'
  | 'totalGames'
  | 'gamesPlayed'
  | 'wins'
  | 'losses'
  | 'ties'
  | 'points'
  | 'winPercentage'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'goalDifferential';

export const TeamStatisticsPage: React.FC<TeamStatisticsPageProps> = ({
  appData,
  onUpdateGame,
  onUpdateBatchGames,
  onSelectTeamContact,
  onSelectFieldMap,
  onEditGame,
  onNavigateToMatchups,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Quick Score Modal/Dialog state
  const [activeScoreGame, setActiveScoreGame] = useState<Game | null>(null);
  const [modalHomeScore, setModalHomeScore] = useState<string>('0');
  const [modalAwayScore, setModalAwayScore] = useState<string>('0');

  // Lookups
  const divisionMap = useMemo(
    () => new Map(appData.divisions.map((d) => [d.id, d])),
    [appData.divisions]
  );
  const fieldMap = useMemo(
    () => new Map(appData.fields.map((f) => [f.id, f])),
    [appData.fields]
  );
  const teamMap = useMemo(
    () => new Map(appData.teams.map((t) => [t.id, t])),
    [appData.teams]
  );

  // Calculate full team records and standings based on games
  const allTeamStats: TeamRecordStats[] = useMemo(() => {
    // Only real teams (exclude "Bye")
    const realTeams = appData.teams.filter((t) => !t.isBye && t.name !== 'Bye');

    return realTeams.map((team) => {
      let totalGames = 0;
      let gamesPlayed = 0;
      let wins = 0;
      let losses = 0;
      let ties = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;
      let homeWins = 0;
      let homeLosses = 0;
      let homeTies = 0;
      let awayWins = 0;
      let awayLosses = 0;
      let awayTies = 0;

      // Collect team games sorted chronologically for recent form
      const teamGames = appData.games
        .filter(
          (g) =>
            g.status !== 'cancelled' &&
            (g.homeTeamId === team.id || g.awayTeamId === team.id)
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      const formList: ('W' | 'L' | 'D')[] = [];

      for (const game of teamGames) {
        totalGames++;

        const isCompleted = game.status === 'completed' || game.score !== undefined;
        if (!isCompleted) continue;

        gamesPlayed++;
        const isHome = game.homeTeamId === team.id;
        const myScore = isHome ? (game.score?.home ?? 0) : (game.score?.away ?? 0);
        const oppScore = isHome ? (game.score?.away ?? 0) : (game.score?.home ?? 0);

        goalsFor += myScore;
        goalsAgainst += oppScore;

        if (myScore > oppScore) {
          wins++;
          if (isHome) homeWins++;
          else awayWins++;
          formList.push('W');
        } else if (myScore < oppScore) {
          losses++;
          if (isHome) homeLosses++;
          else awayLosses++;
          formList.push('L');
        } else {
          ties++;
          if (isHome) homeTies++;
          else awayTies++;
          formList.push('D');
        }
      }

      const points = wins * 3 + ties * 1;
      const goalDifferential = goalsFor - goalsAgainst;
      const winPercentage = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
      const divisionName = divisionMap.get(team.divisionId)?.name || 'Division';

      // Keep last 5 for form
      const recentForm = formList.slice(-5);

      return {
        team,
        divisionName,
        totalGames,
        gamesPlayed,
        wins,
        losses,
        ties,
        points,
        winPercentage,
        goalsFor,
        goalsAgainst,
        goalDifferential,
        homeWins,
        homeLosses,
        homeTies,
        awayWins,
        awayLosses,
        awayTies,
        recentForm,
      };
    });
  }, [appData.teams, appData.games, divisionMap]);

  // Overall Standings Ranking (points desc, goal diff desc, goals for desc, wins desc)
  const rankedStats = useMemo(() => {
    // Group by division or rank globally
    const sorted = [...allTeamStats].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifferential !== a.goalDifferential) return b.goalDifferential - a.goalDifferential;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.team.name.localeCompare(b.team.name);
    });

    return sorted;
  }, [allTeamStats]);

  // Filtered & Sorted Display List
  const displayedStats = useMemo(() => {
    let list = rankedStats;

    if (selectedDivision !== 'all') {
      list = list.filter((s) => s.team.divisionId === selectedDivision);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.team.name.toLowerCase().includes(q) ||
          s.divisionName.toLowerCase().includes(q) ||
          (s.team.contactName && s.team.contactName.toLowerCase().includes(q))
      );
    }

    // Sort by active sortField
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.team.name.localeCompare(b.team.name);
          break;
        case 'division':
          comparison = a.divisionName.localeCompare(b.divisionName);
          break;
        case 'totalGames':
          comparison = a.totalGames - b.totalGames;
          break;
        case 'gamesPlayed':
          comparison = a.gamesPlayed - b.gamesPlayed;
          break;
        case 'wins':
          comparison = a.wins - b.wins;
          break;
        case 'losses':
          comparison = a.losses - b.losses;
          break;
        case 'ties':
          comparison = a.ties - b.ties;
          break;
        case 'points':
          comparison = a.points - b.points;
          break;
        case 'winPercentage':
          comparison = a.winPercentage - b.winPercentage;
          break;
        case 'goalsFor':
          comparison = a.goalsFor - b.goalsFor;
          break;
        case 'goalsAgainst':
          comparison = a.goalsAgainst - b.goalsAgainst;
          break;
        case 'goalDifferential':
          comparison = a.goalDifferential - b.goalDifferential;
          break;
        case 'rank':
        default:
          comparison = 0;
          break;
      }

      if (comparison === 0) {
        // Fallback secondary sort: points desc then goal diff desc
        comparison = b.points - a.points || b.goalDifferential - a.goalDifferential;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rankedStats, selectedDivision, searchQuery, sortField, sortDirection]);

  // Summary Overview Totals
  const summaryTotals = useMemo(() => {
    const totalTeams = allTeamStats.length;
    const totalScheduledGames = appData.games.filter((g) => g.status !== 'cancelled').length;
    const completedGames = appData.games.filter(
      (g) => g.status === 'completed' || g.score !== undefined
    ).length;
    const totalGoals = allTeamStats.reduce((sum, t) => sum + t.goalsFor, 0) / 2; // Each goal counted twice across home/away
    const topTeam = rankedStats[0];

    return {
      totalTeams,
      totalScheduledGames,
      completedGames,
      totalGoals: Math.round(totalGoals),
      topTeam,
    };
  }, [allTeamStats, appData.games, rankedStats]);

  // Handle Table Header Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default directions
      if (field === 'name' || field === 'division') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  // Quick Score Entry Open
  const handleOpenScoreModal = (game: Game) => {
    setActiveScoreGame(game);
    setModalHomeScore(game.score?.home !== undefined ? String(game.score.home) : '0');
    setModalAwayScore(game.score?.away !== undefined ? String(game.score.away) : '0');
  };

  // Save Quick Score
  const handleSaveModalScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScoreGame) return;

    const homeNum = Math.max(0, parseInt(modalHomeScore, 10) || 0);
    const awayNum = Math.max(0, parseInt(modalAwayScore, 10) || 0);

    const updated: Game = {
      ...activeScoreGame,
      status: 'completed',
      score: {
        home: homeNum,
        away: awayNum,
      },
    };

    onUpdateGame(updated);
    setActiveScoreGame(null);
  };

  // Simulate Sample Scores for Testing Standings
  const handleSimulateSampleScores = () => {
    if (
      !window.confirm(
        'Simulate sample game scores for Round 1 and Round 2? This will populate realistic scores and update all team wins, losses, goals, and standings.'
      )
    ) {
      return;
    }

    // Sample realistic soccer scorelines
    const scorelines = [
      [2, 1],
      [1, 0],
      [3, 2],
      [0, 0],
      [2, 2],
      [3, 1],
      [1, 2],
      [4, 1],
      [0, 1],
      [2, 0],
      [1, 3],
      [3, 0],
    ];

    let scoreIndex = 0;
    const updatedGames = appData.games.map((g) => {
      // Simulate for Round 1 and 2 non-bye games
      if (g.roundNumber <= 2 && !g.isByePractice && g.status !== 'cancelled') {
        const [homeG, awayG] = scorelines[scoreIndex % scorelines.length];
        scoreIndex++;
        return {
          ...g,
          status: 'completed' as const,
          score: { home: homeG, away: awayG },
        };
      }
      return g;
    });

    onUpdateBatchGames(updatedGames);
  };

  // Clear/Reset all game scores back to scheduled
  const handleResetScores = () => {
    if (
      !window.confirm(
        'Reset all recorded scores? All matches will revert to "scheduled" and standings will reset to 0 games played.'
      )
    ) {
      return;
    }

    const resetGames = appData.games.map((g) => ({
      ...g,
      status: 'scheduled' as const,
      score: undefined,
    }));

    onUpdateBatchGames(resetGames);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Team Name',
      'Division',
      'Games Scheduled',
      'Games Played',
      'Wins (W)',
      'Losses (L)',
      'Draws (D)',
      'Points (Pts)',
      'Win %',
      'Goals For (GF)',
      'Goals Against (GA)',
      'Goal Diff (GD)',
      'Home Record',
      'Away Record',
    ];

    const rows = displayedStats.map((s, idx) => [
      idx + 1,
      `"${s.team.name}"`,
      `"${s.divisionName}"`,
      s.totalGames,
      s.gamesPlayed,
      s.wins,
      s.losses,
      s.ties,
      s.points,
      `${s.winPercentage}%`,
      s.goalsFor,
      s.goalsAgainst,
      s.goalDifferential,
      `"${s.homeWins}-${s.homeLosses}-${s.homeTies}"`,
      `"${s.awayWins}-${s.awayLosses}-${s.awayTies}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `team_statistics_standings_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Print View
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Action Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Team Statistics & League Standings</span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Computed
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculates total games scheduled, games played, wins, losses, ties, points, and goal differentials across all divisions.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSimulateSampleScores}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shadow-2xs"
              title="Populate realistic sample match scores for Round 1 & 2 to test and preview league standings"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Simulate Sample Scores</span>
            </button>

            {summaryTotals.completedGames > 0 && (
              <button
                onClick={handleResetScores}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-2xs"
                title="Reset all match scores and restore schedule to 0 games played"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Scores</span>
              </button>
            )}

            {onNavigateToMatchups && (
              <button
                type="button"
                onClick={onNavigateToMatchups}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                title="View Head-to-Head Opponent Frequency Matrix"
              >
                <Grid className="w-3.5 h-3.5 text-slate-500" />
                <span>Matchup Matrix</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Export complete standings table to CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Print formatted league table"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Table</span>
            </button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Active Teams
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
              {summaryTotals.totalTeams}
            </div>
            <span className="text-[10px] text-slate-400">Excluding Bye</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Scheduled Games
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
              {summaryTotals.totalScheduledGames}
            </div>
            <span className="text-[10px] text-slate-400">Total match fixtures</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Games Played
            </span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
              {summaryTotals.completedGames}{' '}
              <span className="text-xs font-normal text-slate-500">
                ({summaryTotals.totalScheduledGames > 0
                  ? Math.round(
                      (summaryTotals.completedGames / summaryTotals.totalScheduledGames) * 100
                    )
                  : 0}
                %)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">With scores recorded</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Goals
            </span>
            <div className="text-lg font-bold text-blue-700 mt-0.5 font-mono">
              {summaryTotals.totalGoals}
            </div>
            <span className="text-[10px] text-slate-400">
              {summaryTotals.completedGames > 0
                ? `${(summaryTotals.totalGoals / summaryTotals.completedGames).toFixed(1)} goals/game`
                : 'No games yet'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-amber-50/70 p-3 rounded-lg border border-amber-200/80">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>League Leader</span>
            </span>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
              {summaryTotals.topTeam ? summaryTotals.topTeam.team.name : 'TBD'}
            </div>
            <span className="text-[10px] text-amber-700 font-mono">
              {summaryTotals.topTeam
                ? `${summaryTotals.topTeam.points} Pts (${summaryTotals.topTeam.wins}W - ${summaryTotals.topTeam.losses}L - ${summaryTotals.topTeam.ties}D)`
                : 'Awaiting match results'}
            </span>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search team or division..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Division Filter */}
          <div>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Divisions ({appData.divisions.length})</option>
              {appData.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Info & Count */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="font-mono text-slate-900">{displayedStats.length}</strong> of{' '}
              <strong className="font-mono text-slate-900">{allTeamStats.length}</strong> teams
            </span>
            {(selectedDivision !== 'all' || searchQuery.trim()) && (
              <button
                onClick={() => {
                  setSelectedDivision('all');
                  setSearchQuery('');
                }}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Printable Header */}
      <div className="hidden print-only mb-6">
        <h1 className="text-2xl font-bold">{appData.seasonConfig.seasonName} - Team Standings</h1>
        <p className="text-sm text-gray-600">
          Generated on {new Date().toLocaleDateString()} · Season: {appData.seasonConfig.startDate} to{' '}
          {appData.seasonConfig.endDate}
        </p>
      </div>

      {/* Standings Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                <th
                  onClick={() => handleSort('rank')}
                  className="py-3 px-3 w-14 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Rank in standings"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>#</span>
                    {sortField === 'rank' && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Team</span>
                    {sortField === 'name' && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('division')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors hidden sm:table-cell"
                >
                  <div className="flex items-center gap-1">
                    <span>Division</span>
                    {sortField === 'division' && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('totalGames')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  title="Total games on schedule"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Sched</span>
                    {sortField === 'totalGames' && (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('gamesPlayed')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors font-bold text-slate-900"
                  title="Games Played (with recorded score)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>GP</span>
                    {sortField === 'gamesPlayed' && (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('wins')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors text-emerald-700 font-bold"
                  title="Total Wins"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>W</span>
                    {sortField === 'wins' && <ArrowUpDown className="w-3 h-3 text-emerald-600" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('losses')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors text-rose-700 font-bold"
                  title="Total Losses"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>L</span>
                    {sortField === 'losses' && <ArrowUpDown className="w-3 h-3 text-rose-600" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('ties')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors text-amber-700 font-bold"
                  title="Total Ties / Draws"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>D</span>
                    {sortField === 'ties' && <ArrowUpDown className="w-3 h-3 text-amber-600" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('points')}
                  className="py-3 px-3 text-center cursor-pointer bg-slate-100/80 hover:bg-slate-200/80 transition-colors text-slate-900 font-extrabold"
                  title="Points (3 pts per win, 1 pt per tie)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>PTS</span>
                    {sortField === 'points' && <ArrowUpDown className="w-3 h-3 text-slate-600" />}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('winPercentage')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors hidden md:table-cell"
                  title="Win Percentage"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Win %</span>
                    {sortField === 'winPercentage' && (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('goalsFor')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors hidden lg:table-cell"
                  title="Goals For (scored)"
                >
                  <span>GF</span>
                </th>

                <th
                  onClick={() => handleSort('goalsAgainst')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 transition-colors hidden lg:table-cell"
                  title="Goals Against (conceded)"
                >
                  <span>GA</span>
                </th>

                <th
                  onClick={() => handleSort('goalDifferential')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 transition-colors hidden sm:table-cell"
                  title="Goal Differential (GF - GA)"
                >
                  <span>GD</span>
                </th>

                <th className="py-3 px-3 text-center hidden xl:table-cell" title="Home Record (W-L-D)">
                  <span>Home</span>
                </th>

                <th className="py-3 px-3 text-center hidden xl:table-cell" title="Away Record (W-L-D)">
                  <span>Away</span>
                </th>

                <th className="py-3 px-3 text-center hidden md:table-cell" title="Recent Form (last 5 games)">
                  <span>Form</span>
                </th>

                <th className="py-3 px-3 text-right no-print">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {displayedStats.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-400 space-y-2">
                    <Trophy className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-sm font-medium text-slate-700">No teams found</p>
                    <p className="text-xs text-slate-400">
                      Try clearing your search query or division filter.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedStats.map((stat, index) => {
                  const isExpanded = expandedTeamId === stat.team.id;
                  const isLeader = index === 0 && selectedDivision !== 'all';
                  const isGlobalLeader = index === 0 && selectedDivision === 'all';

                  // All games for this team
                  const teamGames = appData.games
                    .filter(
                      (g) =>
                        g.status !== 'cancelled' &&
                        (g.homeTeamId === stat.team.id || g.awayTeamId === stat.team.id)
                    )
                    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

                  return (
                    <React.Fragment key={stat.team.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isExpanded ? 'bg-slate-50/60' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                          {isGlobalLeader || isLeader ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs shadow-2xs">
                              1
                            </span>
                          ) : (
                            <span className="text-slate-500">{index + 1}</span>
                          )}
                        </td>

                        {/* Team Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {stat.team.jerseyColor && (
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300 shadow-2xs"
                                style={{ backgroundColor: stat.team.jerseyColor }}
                                title={`Jersey: ${stat.team.jerseyColor}`}
                              />
                            )}
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectTeamContact &&
                                  onSelectTeamContact(stat.team, stat.divisionName)
                                }
                                className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                                title="Click to view team contact information"
                              >
                                {stat.team.name}
                              </button>
                              <div className="text-[10px] text-slate-400 sm:hidden">
                                {stat.divisionName}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Division */}
                        <td className="py-3 px-3 hidden sm:table-cell text-slate-600 text-xs">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                            {stat.divisionName}
                          </span>
                        </td>

                        {/* Scheduled */}
                        <td className="py-3 px-2.5 text-center font-mono text-slate-500">
                          {stat.totalGames}
                        </td>

                        {/* Games Played */}
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900 bg-slate-50/40">
                          {stat.gamesPlayed}
                        </td>

                        {/* Wins */}
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-emerald-700">
                          {stat.wins}
                        </td>

                        {/* Losses */}
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-rose-700">
                          {stat.losses}
                        </td>

                        {/* Ties / Draws */}
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-amber-700">
                          {stat.ties}
                        </td>

                        {/* Points */}
                        <td className="py-3 px-3 text-center font-mono font-extrabold text-sm text-slate-900 bg-slate-100/70">
                          {stat.points}
                        </td>

                        {/* Win % */}
                        <td className="py-3 px-2.5 text-center font-mono text-slate-600 hidden md:table-cell">
                          {stat.gamesPlayed > 0 ? `${stat.winPercentage}%` : '—'}
                        </td>

                        {/* Goals For */}
                        <td className="py-3 px-2 text-center font-mono text-slate-600 hidden lg:table-cell">
                          {stat.goalsFor}
                        </td>

                        {/* Goals Against */}
                        <td className="py-3 px-2 text-center font-mono text-slate-600 hidden lg:table-cell">
                          {stat.goalsAgainst}
                        </td>

                        {/* Goal Differential */}
                        <td className="py-3 px-2.5 text-center font-mono font-semibold hidden sm:table-cell">
                          <span
                            className={
                              stat.goalDifferential > 0
                                ? 'text-emerald-700'
                                : stat.goalDifferential < 0
                                ? 'text-rose-700'
                                : 'text-slate-500'
                            }
                          >
                            {stat.goalDifferential > 0
                              ? `+${stat.goalDifferential}`
                              : stat.goalDifferential}
                          </span>
                        </td>

                        {/* Home Record */}
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500 hidden xl:table-cell">
                          {stat.homeWins}-{stat.homeLosses}-{stat.homeTies}
                        </td>

                        {/* Away Record */}
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500 hidden xl:table-cell">
                          {stat.awayWins}-{stat.awayLosses}-{stat.awayTies}
                        </td>

                        {/* Recent Form */}
                        <td className="py-3 px-3 text-center hidden md:table-cell">
                          {stat.recentForm.length === 0 ? (
                            <span className="text-slate-300 text-xs">—</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {stat.recentForm.map((result, rIdx) => (
                                <span
                                  key={rIdx}
                                  className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow-2xs ${
                                    result === 'W'
                                      ? 'bg-emerald-600'
                                      : result === 'L'
                                      ? 'bg-rose-600'
                                      : 'bg-amber-500'
                                  }`}
                                  title={
                                    result === 'W'
                                      ? 'Win'
                                      : result === 'L'
                                      ? 'Loss'
                                      : 'Draw / Tie'
                                  }
                                >
                                  {result}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right no-print">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTeamId((prev) => (prev === stat.team.id ? null : stat.team.id))
                            }
                            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors shadow-2xs"
                          >
                            <span>Games ({teamGames.length})</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Team Game Log Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200 no-print">
                          <td colSpan={17} className="p-4 sm:p-5">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <span>Match Results & Schedule Log:</span>
                                    <span className="text-emerald-700 normal-case font-semibold">
                                      {stat.team.name}
                                    </span>
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    Click "Record Score" or "Edit" on any game to update scorelines and immediately recalculate wins and losses.
                                  </p>
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  Record: <strong className="text-emerald-700">{stat.wins}W</strong> -{' '}
                                  <strong className="text-rose-700">{stat.losses}L</strong> -{' '}
                                  <strong className="text-amber-700">{stat.ties}D</strong> ({stat.points} Pts)
                                </div>
                              </div>

                              {teamGames.length === 0 ? (
                                <p className="text-xs text-slate-400 py-3 text-center">
                                  No scheduled games found for this team.
                                </p>
                              ) : (
                                <div className="divide-y divide-slate-100">
                                  {teamGames.map((game) => {
                                    const isHome = game.homeTeamId === stat.team.id;
                                    const oppId = isHome ? game.awayTeamId : game.homeTeamId;
                                    const oppTeam = teamMap.get(oppId);
                                    const field = fieldMap.get(game.fieldId);
                                    const hasScore =
                                      game.status === 'completed' || game.score !== undefined;

                                    let outcomeLabel = 'Upcoming';
                                    let outcomeClass = 'bg-slate-100 text-slate-700';

                                    if (hasScore) {
                                      const myG = isHome ? (game.score?.home ?? 0) : (game.score?.away ?? 0);
                                      const oppG = isHome ? (game.score?.away ?? 0) : (game.score?.home ?? 0);
                                      if (myG > oppG) {
                                        outcomeLabel = `WIN (${myG}-${oppG})`;
                                        outcomeClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
                                      } else if (myG < oppG) {
                                        outcomeLabel = `LOSS (${myG}-${oppG})`;
                                        outcomeClass = 'bg-rose-50 text-rose-800 border border-rose-200';
                                      } else {
                                        outcomeLabel = `DRAW (${myG}-${oppG})`;
                                        outcomeClass = 'bg-amber-50 text-amber-800 border border-amber-200';
                                      }
                                    }

                                    return (
                                      <div
                                        key={game.id}
                                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                                            Round {game.roundNumber}
                                          </span>
                                          <span className="font-medium text-slate-900">
                                            {game.date} @ {game.time}
                                          </span>
                                          <span className="text-slate-300">·</span>
                                          <span className="text-slate-600 font-medium">
                                            {isHome ? 'vs (Home)' : '@ (Away)'}{' '}
                                            <strong className="text-slate-900">
                                              {oppTeam?.name || 'Opponent'}
                                            </strong>
                                          </span>
                                          {field && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <span className="text-slate-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-slate-400" />
                                                {field.name}
                                              </span>
                                            </>
                                          )}
                                          {game.isByePractice && (
                                            <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                              Bye Practice
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${outcomeClass}`}
                                          >
                                            {outcomeLabel}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() => handleOpenScoreModal(game)}
                                            className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                                          >
                                            {hasScore ? 'Edit Score' : 'Record Score'}
                                          </button>

                                          {onEditGame && (
                                            <button
                                              type="button"
                                              onClick={() => onEditGame(game)}
                                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                              title="Edit full match details"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Score Modal */}
      {activeScoreGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Match Score</h3>
                <p className="text-xs text-slate-500">
                  {divisionMap.get(activeScoreGame.divisionId)?.name || 'Division'} · Round{' '}
                  {activeScoreGame.roundNumber} ({activeScoreGame.date})
                </p>
              </div>
              <button
                onClick={() => setActiveScoreGame(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalScore} className="p-5 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="text-center space-y-1.5">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider block">
                      HOME
                    </span>
                    <label className="block text-xs font-bold text-slate-900 truncate" title={teamMap.get(activeScoreGame.homeTeamId)?.name}>
                      {teamMap.get(activeScoreGame.homeTeamId)?.name || 'Home Team'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={modalHomeScore}
                      onChange={(e) => setModalHomeScore(e.target.value)}
                      className="w-20 mx-auto text-xl font-bold font-mono text-center rounded-lg border border-slate-300 bg-white py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>

                  <div className="text-center space-y-1.5">
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase tracking-wider block">
                      AWAY
                    </span>
                    <label className="block text-xs font-bold text-slate-900 truncate" title={teamMap.get(activeScoreGame.awayTeamId)?.name}>
                      {teamMap.get(activeScoreGame.awayTeamId)?.name || 'Away Team'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={modalAwayScore}
                      onChange={(e) => setModalAwayScore(e.target.value)}
                      className="w-20 mx-auto text-xl font-bold font-mono text-center rounded-lg border border-slate-300 bg-white py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>Kickoff: {activeScoreGame.time}</span>
                <span>Pitch: {fieldMap.get(activeScoreGame.fieldId)?.name || 'Field'}</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveScoreGame(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs"
                >
                  Save Score & Update Standings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
