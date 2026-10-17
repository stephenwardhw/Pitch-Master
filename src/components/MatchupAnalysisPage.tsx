import React, { useState, useMemo } from 'react';
import { AppData, Division, Field, Game, Team } from '../types';
import {
  Grid,
  Users,
  Trophy,
  Scale,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  Edit2,
  Sparkles,
  Phone,
  Mail,
  Shield,
  Layers,
  ArrowUpDown,
  Check,
} from 'lucide-react';

interface MatchupAnalysisPageProps {
  appData: AppData;
  onUpdateGame?: (updatedGame: Game) => void;
  onSelectTeamContact?: (team: Team, divisionName?: string) => void;
  onSelectFieldMap?: (field: Field) => void;
  onEditGame?: (game: Game) => void;
  onNavigateToSchedule?: () => void;
}

interface MatchupPair {
  teamA: Team;
  teamB: Team;
  totalGames: number;
  teamAHomeGames: number; // Games where Team A was home
  teamBHomeGames: number; // Games where Team B was home (Team A away)
  games: Game[];
}

export const MatchupAnalysisPage: React.FC<MatchupAnalysisPageProps> = ({
  appData,
  onUpdateGame,
  onSelectTeamContact,
  onSelectFieldMap,
  onEditGame,
  onNavigateToSchedule,
}) => {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(() => {
    return appData.divisions.length > 0 ? appData.divisions[0].id : 'all';
  });
  const [activeCellPair, setActiveCellPair] = useState<{ teamA: Team; teamB: Team } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ rowTeamId: string; colTeamId: string } | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | '0' | '1' | '2' | '3+'>('all');

  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);

  // Real teams (excluding Bye)
  const realTeams = useMemo(() => {
    return appData.teams.filter((t) => !t.isBye && t.name.toLowerCase() !== 'bye');
  }, [appData.teams]);

  // Teams in scope based on division filter
  const scopedTeams = useMemo(() => {
    let teams = realTeams;
    if (selectedDivisionId !== 'all') {
      teams = teams.filter((t) => t.divisionId === selectedDivisionId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      teams = teams.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.contactName?.toLowerCase().includes(q)
      );
    }
    return teams.sort((a, b) => {
      // Sort by division first if "all", then name
      if (selectedDivisionId === 'all' && a.divisionId !== b.divisionId) {
        const divA = divisionMap.get(a.divisionId)?.name || '';
        const divB = divisionMap.get(b.divisionId)?.name || '';
        return divA.localeCompare(divB);
      }
      return a.name.localeCompare(b.name);
    });
  }, [realTeams, selectedDivisionId, searchQuery, divisionMap]);

  // Active games (ignore cancelled)
  const activeGames = useMemo(() => {
    return appData.games.filter((g) => g.status !== 'cancelled' && !g.isByePractice);
  }, [appData.games]);

  // Map of `${teamA.id}_${teamB.id}` to MatchupPair
  const matchupMap = useMemo(() => {
    const map = new Map<string, MatchupPair>();

    // Helper to get consistent pair key (order-independent)
    const getPairKey = (id1: string, id2: string) => {
      return id1 < id2 ? `${id1}__${id2}` : `${id2}__${id1}`;
    };

    // Populate all pairs for real teams
    for (let i = 0; i < realTeams.length; i++) {
      for (let j = i + 1; j < realTeams.length; j++) {
        const t1 = realTeams[i];
        const t2 = realTeams[j];
        const key = getPairKey(t1.id, t2.id);
        map.set(key, {
          teamA: t1,
          teamB: t2,
          totalGames: 0,
          teamAHomeGames: 0,
          teamBHomeGames: 0,
          games: [],
        });
      }
    }

    // Accumulate games
    for (const game of activeGames) {
      if (!game.homeTeamId || !game.awayTeamId) continue;
      const key = getPairKey(game.homeTeamId, game.awayTeamId);
      const pair = map.get(key);
      if (pair) {
        pair.totalGames++;
        pair.games.push(game);
        if (game.homeTeamId === pair.teamA.id) {
          pair.teamAHomeGames++;
        } else {
          pair.teamBHomeGames++;
        }
      }
    }

    return map;
  }, [realTeams, activeGames]);

  // Helper to query matchup between any two teams
  const getMatchup = (team1Id: string, team2Id: string): MatchupPair | undefined => {
    const key = team1Id < team2Id ? `${team1Id}__${team2Id}` : `${team2Id}__${team1Id}`;
    return matchupMap.get(key);
  };

  // Division summary statistics
  const divisionStats = useMemo(() => {
    const teamsInDiv = selectedDivisionId === 'all'
      ? realTeams
      : realTeams.filter((t) => t.divisionId === selectedDivisionId);

    const n = teamsInDiv.length;
    const totalPossiblePairs = (n * (n - 1)) / 2;

    let playedPairsCount = 0;
    let unplayedPairsCount = 0;
    let singleGamePairsCount = 0;
    let doubleGamePairsCount = 0;
    let multiGamePairsCount = 0; // 3+
    let totalScheduledMatchups = 0;

    const unplayedPairsList: { teamA: Team; teamB: Team }[] = [];
    const overplayedPairsList: { teamA: Team; teamB: Team; count: number }[] = [];
    const imbalancedVenuePairsList: { teamA: Team; teamB: Team; homeA: number; homeB: number }[] = [];

    for (let i = 0; i < teamsInDiv.length; i++) {
      for (let j = i + 1; j < teamsInDiv.length; j++) {
        const t1 = teamsInDiv[i];
        const t2 = teamsInDiv[j];
        const matchup = getMatchup(t1.id, t2.id);
        const count = matchup ? matchup.totalGames : 0;

        totalScheduledMatchups += count;

        if (count === 0) {
          unplayedPairsCount++;
          unplayedPairsList.push({ teamA: t1, teamB: t2 });
        } else {
          playedPairsCount++;
          if (count === 1) singleGamePairsCount++;
          else if (count === 2) {
            doubleGamePairsCount++;
            // Check venue balance for 2-game series
            if (matchup && (matchup.teamAHomeGames === 2 || matchup.teamBHomeGames === 2)) {
              imbalancedVenuePairsList.push({
                teamA: t1,
                teamB: t2,
                homeA: matchup.teamAHomeGames,
                homeB: matchup.teamBHomeGames,
              });
            }
          } else if (count >= 3) {
            multiGamePairsCount++;
            overplayedPairsList.push({ teamA: t1, teamB: t2, count });
          }
        }
      }
    }

    const coveragePercentage = totalPossiblePairs > 0
      ? Math.round((playedPairsCount / totalPossiblePairs) * 100)
      : 100;

    // Detect format type
    let roundRobinType: 'Perfect Single Round-Robin' | 'Perfect Double Round-Robin' | 'Balanced Mixed' | 'Uneven Schedule' = 'Uneven Schedule';
    if (totalPossiblePairs > 0) {
      if (singleGamePairsCount === totalPossiblePairs) {
        roundRobinType = 'Perfect Single Round-Robin';
      } else if (doubleGamePairsCount === totalPossiblePairs) {
        roundRobinType = 'Perfect Double Round-Robin';
      } else if (unplayedPairsCount === 0 && multiGamePairsCount === 0) {
        roundRobinType = 'Balanced Mixed';
      }
    }

    return {
      teamCount: n,
      totalPossiblePairs,
      playedPairsCount,
      unplayedPairsCount,
      singleGamePairsCount,
      doubleGamePairsCount,
      multiGamePairsCount,
      totalScheduledMatchups,
      coveragePercentage,
      roundRobinType,
      unplayedPairsList,
      overplayedPairsList,
      imbalancedVenuePairsList,
    };
  }, [selectedDivisionId, realTeams, matchupMap]);

  // Active selected pair games for modal
  const activePairDetails = useMemo(() => {
    if (!activeCellPair) return null;
    const matchup = getMatchup(activeCellPair.teamA.id, activeCellPair.teamB.id);
    return {
      pair: activeCellPair,
      matchup: matchup || {
        teamA: activeCellPair.teamA,
        teamB: activeCellPair.teamB,
        totalGames: 0,
        teamAHomeGames: 0,
        teamBHomeGames: 0,
        games: [],
      },
    };
  }, [activeCellPair, matchupMap]);

  // CSV Export for Matrix
  const handleExportMatrixCsv = () => {
    try {
      const teams = scopedTeams;
      if (teams.length === 0) return;

      const header = ['Team', 'Division', ...teams.map((t) => t.name), 'Total Games Played'];
      const rows = teams.map((rowTeam) => {
        let totalGamesForRow = 0;
        const cols = teams.map((colTeam) => {
          if (rowTeam.id === colTeam.id) return '-';
          const matchup = getMatchup(rowTeam.id, colTeam.id);
          const count = matchup ? matchup.totalGames : 0;
          totalGamesForRow += count;
          return count.toString();
        });
        const divName = divisionMap.get(rowTeam.divisionId)?.name || '';
        return [rowTeam.name, divName, ...cols, totalGamesForRow.toString()];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [header.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const divLabel = selectedDivisionId === 'all' ? 'All_Divisions' : (divisionMap.get(selectedDivisionId)?.name.replace(/\s+/g, '_') || 'Division');
      link.setAttribute('download', `pitchmaster_matchup_matrix_${divLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export matrix CSV:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. PAGE HEADER ================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Grid className="w-4 h-4 text-emerald-600" />
              <span>Head-to-Head Opponent Frequency Matrix</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Matchup Analysis & Round-Robin Balance
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Verify how many times each team plays each other across the season. Monitor round-robin distribution, detect unplayed opponents, and audit home/away host venue balance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportMatrixCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Export complete matchup matrix table to CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              title="Print formatted matchup matrix"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print View</span>
            </button>
          </div>
        </div>

        {/* Division Selector Pills / Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
              Division:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDivisionId('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                selectedDivisionId === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Divisions ({realTeams.length} Teams)
            </button>
            {appData.divisions.map((div) => {
              const teamCount = realTeams.filter((t) => t.divisionId === div.id).length;
              const isSelected = selectedDivisionId === div.id;
              return (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setSelectedDivisionId(div.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{div.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {teamCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle (Matrix vs Detailed Cards) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grid Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Breakdown</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= 2. DIAGNOSTIC HEALTH OVERVIEW CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unique Pairing Coverage */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Opponent Coverage</span>
            <Trophy className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {divisionStats.coveragePercentage}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span className="font-bold text-slate-800">{divisionStats.playedPairsCount}</span> of{' '}
              <span className="font-semibold">{divisionStats.totalPossiblePairs}</span> possible matchups scheduled
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                divisionStats.coveragePercentage === 100
                  ? 'bg-emerald-600'
                  : divisionStats.coveragePercentage > 75
                  ? 'bg-blue-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${divisionStats.coveragePercentage}%` }}
            />
          </div>
        </div>

        {/* Card 2: Round-Robin Schedule Type */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Format Balance</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-slate-900 line-clamp-1">
              {divisionStats.roundRobinType}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {divisionStats.singleGamePairsCount} single · {divisionStats.doubleGamePairsCount} double series
            </div>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-600 flex items-center gap-1">
            {divisionStats.unplayedPairsCount === 0 ? (
              <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All opponents scheduled
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> {divisionStats.unplayedPairsCount} unplayed pair(s)
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Unplayed Pairs Alert */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Unplayed Pairs</span>
            <AlertCircle
              className={`w-4 h-4 ${divisionStats.unplayedPairsCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-black ${
                divisionStats.unplayedPairsCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {divisionStats.unplayedPairsCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Pairs with 0 head-to-head matches
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            {divisionStats.unplayedPairsCount === 0 ? (
              <span className="text-emerald-700 font-semibold">Complete opponent rotation</span>
            ) : (
              <span className="text-amber-800">
                Teams never play in current calendar
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Repeat / High-Frequency Matchups */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Repeat Series (3+)</span>
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {divisionStats.multiGamePairsCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Pairs meeting 3 or more times
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            {divisionStats.imbalancedVenuePairsList.length > 0 ? (
              <span className="text-amber-800 font-medium">
                {divisionStats.imbalancedVenuePairsList.length} 2-game series with venue clash
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">Balanced home/away series</span>
            )}
          </div>
        </div>
      </div>

      {/* ================= 3. QUICK UNPLAYED OPPONENTS NOTICE (If Any) ================= */}
      {divisionStats.unplayedPairsList.length > 0 && selectedDivisionId !== 'all' && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <span className="font-bold text-amber-950 block">
                Attention: {divisionStats.unplayedPairsList.length} Unscheduled Opponent Pairing(s) in this Division
              </span>
              <p className="text-amber-800 leading-relaxed">
                The following teams in this division do not currently have any scheduled matches against each other:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {divisionStats.unplayedPairsList.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveCellPair({ teamA: p.teamA, teamB: p.teamB })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 font-medium hover:bg-amber-100 hover:border-amber-400 transition-colors shadow-2xs text-[11px]"
                  >
                    <span className="font-semibold">{p.teamA.name}</span>
                    <span className="text-amber-500">vs</span>
                    <span className="font-semibold">{p.teamB.name}</span>
                    <span className="text-amber-600 text-[10px] ml-1">(0 games)</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. MAIN CONTENT: GRID MATRIX VIEW ================= */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Matrix Controls & Legend */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Matrix Legend:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 text-slate-400 font-mono text-[11px] font-bold border border-slate-200">
                  0
                </span>
                <span className="text-slate-600">Unplayed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold border border-emerald-300">
                  1
                </span>
                <span className="text-slate-600">1 Match</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-100 text-blue-800 font-mono text-[11px] font-bold border border-blue-300">
                  2
                </span>
                <span className="text-slate-600">2 Matches (Home & Away)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded flex items-center justify-center bg-indigo-100 text-indigo-900 font-mono text-[11px] font-bold border border-indigo-300">
                  3+
                </span>
                <span className="text-slate-600">3+ Matches</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic">
              * Click any count cell to inspect match dates, kickoffs, and venues
            </div>
          </div>

          {/* Responsive Scrollable 2D Table */}
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 sticky top-0 z-20 shadow-2xs">
                  {/* Top-Left Corner Header */}
                  <th className="p-3 font-bold text-slate-700 bg-slate-200 border-r border-slate-300 sticky left-0 z-30 min-w-[180px] max-w-[220px]">
                    <div className="flex items-center justify-between">
                      <span>Team \ Opponent</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({scopedTeams.length})
                      </span>
                    </div>
                  </th>

                  {/* Column Headers (Opponents) */}
                  {scopedTeams.map((colTeam) => (
                    <th
                      key={colTeam.id}
                      className={`p-2.5 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[70px] max-w-[90px] whitespace-nowrap transition-colors ${
                        hoveredCell?.colTeamId === colTeam.id ? 'bg-emerald-100 text-emerald-950' : ''
                      }`}
                      title={`${colTeam.name} (${divisionMap.get(colTeam.divisionId)?.name || ''})`}
                    >
                      <div className="truncate text-xs font-semibold">{colTeam.name}</div>
                      {colTeam.jerseyColor && (
                        <div className="text-[10px] font-normal text-slate-400 truncate">
                          {colTeam.jerseyColor}
                        </div>
                      )}
                    </th>
                  ))}

                  {/* Total Games Column */}
                  <th className="p-3 text-center font-bold text-slate-800 bg-slate-200/90 border-l-2 border-slate-300 min-w-[80px]">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {scopedTeams.map((rowTeam, rowIdx) => {
                  let rowTotalGames = 0;
                  const isRowHovered = hoveredCell?.rowTeamId === rowTeam.id;

                  return (
                    <tr
                      key={rowTeam.id}
                      className={`border-b border-slate-200 transition-colors ${
                        rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } ${isRowHovered ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                    >
                      {/* Row Header (Team Name sticky on left) */}
                      <th
                        className={`p-3 font-semibold text-slate-900 border-r border-slate-300 sticky left-0 z-10 transition-colors truncate min-w-[180px] max-w-[220px] ${
                          isRowHovered ? 'bg-emerald-100/90 text-emerald-950' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-100/80'
                        }`}
                        title={rowTeam.name}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate">{rowTeam.name}</span>
                          {rowTeam.contactName && onSelectTeamContact && (
                            <button
                              type="button"
                              onClick={() => onSelectTeamContact(rowTeam, divisionMap.get(rowTeam.divisionId)?.name)}
                              className="text-slate-400 hover:text-emerald-700 transition-colors shrink-0 p-0.5"
                              title={`View contact info for ${rowTeam.name}`}
                            >
                              <Phone className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {selectedDivisionId === 'all' && (
                          <div className="text-[10px] font-normal text-slate-500 truncate">
                            {divisionMap.get(rowTeam.divisionId)?.name}
                          </div>
                        )}
                      </th>

                      {/* Cells */}
                      {scopedTeams.map((colTeam) => {
                        const isSelf = rowTeam.id === colTeam.id;
                        const isCellHovered =
                          hoveredCell?.rowTeamId === rowTeam.id && hoveredCell?.colTeamId === colTeam.id;

                        if (isSelf) {
                          return (
                            <td
                              key={colTeam.id}
                              className="p-2 text-center text-slate-300 bg-slate-100/80 font-mono text-xs select-none border-r border-slate-200 cursor-not-allowed"
                              title="Team cannot play itself"
                            >
                              —
                            </td>
                          );
                        }

                        const matchup = getMatchup(rowTeam.id, colTeam.id);
                        const count = matchup ? matchup.totalGames : 0;
                        rowTotalGames += count;

                        // Visual styling based on count
                        let cellBg = 'bg-white text-slate-400 hover:bg-amber-50';
                        let badgeBg = 'bg-slate-100 text-slate-500';

                        if (count === 1) {
                          cellBg = 'bg-emerald-50/70 text-emerald-900 font-semibold hover:bg-emerald-100';
                          badgeBg = 'bg-emerald-100 text-emerald-800';
                        } else if (count === 2) {
                          cellBg = 'bg-blue-50/80 text-blue-900 font-bold hover:bg-blue-100';
                          badgeBg = 'bg-blue-100 text-blue-800';
                        } else if (count >= 3) {
                          cellBg = 'bg-indigo-100/90 text-indigo-950 font-black hover:bg-indigo-200';
                          badgeBg = 'bg-indigo-200 text-indigo-950';
                        }

                        if (isCellHovered) {
                          cellBg += ' ring-2 ring-emerald-500 ring-inset';
                        }

                        return (
                          <td
                            key={colTeam.id}
                            onMouseEnter={() => setHoveredCell({ rowTeamId: rowTeam.id, colTeamId: colTeam.id })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setActiveCellPair({ teamA: rowTeam, teamB: colTeam })}
                            className={`p-2 text-center border-r border-slate-200 cursor-pointer transition-all ${cellBg}`}
                            title={`Click to view ${count} match(es) between ${rowTeam.name} and ${colTeam.name}`}
                          >
                            <div className="flex flex-col items-center justify-center">
                              <span
                                className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs ${badgeBg}`}
                              >
                                {count}
                              </span>
                              {matchup && count > 0 && (
                                <span className="text-[9px] font-mono text-slate-500 mt-0.5 whitespace-nowrap">
                                  {rowTeam.id === matchup.teamA.id
                                    ? `${matchup.teamAHomeGames}H/${matchup.teamBHomeGames}A`
                                    : `${matchup.teamBHomeGames}H/${matchup.teamAHomeGames}A`}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Row Total Games Column */}
                      <td className="p-3 text-center font-mono font-bold text-slate-900 bg-slate-100/60 border-l-2 border-slate-300">
                        {rowTotalGames}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 5. TEAM BREAKDOWN VIEW (Cards View) ================= */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Filter by Frequency:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFrequencyFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    frequencyFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  All Opponents
                </button>
                <button
                  type="button"
                  onClick={() => setFrequencyFilter('0')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    frequencyFilter === '0' ? 'bg-white text-amber-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  0 Games (Unplayed)
                </button>
                <button
                  type="button"
                  onClick={() => setFrequencyFilter('1')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    frequencyFilter === '1' ? 'bg-white text-emerald-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  1 Game
                </button>
                <button
                  type="button"
                  onClick={() => setFrequencyFilter('2')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    frequencyFilter === '2' ? 'bg-white text-blue-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  2 Games
                </button>
                <button
                  type="button"
                  onClick={() => setFrequencyFilter('3+')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    frequencyFilter === '3+' ? 'bg-white text-indigo-900 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  3+ Games
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 w-48"
              />
            </div>
          </div>

          {/* List of Team Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopedTeams.map((team) => {
              // Get opponents in the same division
              const divisionTeams = realTeams.filter(
                (t) => t.divisionId === team.divisionId && t.id !== team.id
              );

              // Calculate matchups for each opponent
              const opponentList = divisionTeams
                .map((opp) => {
                  const matchup = getMatchup(team.id, opp.id);
                  const count = matchup ? matchup.totalGames : 0;
                  const homeGames = matchup
                    ? team.id === matchup.teamA.id
                      ? matchup.teamAHomeGames
                      : matchup.teamBHomeGames
                    : 0;
                  const awayGames = matchup
                    ? team.id === matchup.teamA.id
                      ? matchup.teamBHomeGames
                      : matchup.teamAHomeGames
                    : 0;
                  return {
                    opponent: opp,
                    count,
                    homeGames,
                    awayGames,
                    games: matchup ? matchup.games : [],
                  };
                })
                .filter((item) => {
                  if (frequencyFilter === 'all') return true;
                  if (frequencyFilter === '0') return item.count === 0;
                  if (frequencyFilter === '1') return item.count === 1;
                  if (frequencyFilter === '2') return item.count === 2;
                  if (frequencyFilter === '3+') return item.count >= 3;
                  return true;
                })
                .sort((a, b) => {
                  if (a.count !== b.count) return a.count - b.count;
                  return a.opponent.name.localeCompare(b.opponent.name);
                });

              const totalMeetings = opponentList.reduce((acc, curr) => acc + curr.count, 0);

              return (
                <div
                  key={team.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{team.name}</h3>
                        {team.jerseyColor && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({team.jerseyColor})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {divisionMap.get(team.divisionId)?.name || 'Division'}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-black text-slate-900">
                        {totalMeetings}
                      </span>
                      <span className="text-[11px] text-slate-500 block uppercase font-medium">
                        Matches
                      </span>
                    </div>
                  </div>

                  {/* Opponent Rows */}
                  <div className="p-3 divide-y divide-slate-100 flex-1">
                    {opponentList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        No opponents match the current filter criteria.
                      </div>
                    ) : (
                      opponentList.map((oppItem) => {
                        let countBadge = 'bg-slate-100 text-slate-500';
                        if (oppItem.count === 1) countBadge = 'bg-emerald-100 text-emerald-800';
                        else if (oppItem.count === 2) countBadge = 'bg-blue-100 text-blue-800 font-bold';
                        else if (oppItem.count >= 3) countBadge = 'bg-indigo-100 text-indigo-900 font-black';

                        return (
                          <div
                            key={oppItem.opponent.id}
                            onClick={() => setActiveCellPair({ teamA: team, teamB: oppItem.opponent })}
                            className="py-2 px-1.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] font-semibold ${countBadge}`}
                              >
                                {oppItem.count}
                              </span>
                              <span className="font-medium text-slate-800">
                                {oppItem.opponent.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {oppItem.count > 0 ? (
                                <span className="font-mono text-[11px] text-slate-500">
                                  {oppItem.homeGames}H · {oppItem.awayGames}A
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-semibold">
                                  Unplayed
                                </span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 -rotate-90" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 6. MATCHUP DRILLDOWN MODAL ================= */}
      {activePairDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Head-to-Head Series Breakdown</span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{activePairDetails.pair.teamA.name}</span>
                  <span className="text-slate-400 text-sm font-normal">vs</span>
                  <span>{activePairDetails.pair.teamB.name}</span>
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  {divisionMap.get(activePairDetails.pair.teamA.divisionId)?.name || 'Division'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCellPair(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Metric Summary Box */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-xl font-black text-slate-900 block font-mono">
                    {activePairDetails.matchup.totalGames}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Total Meetings
                  </span>
                </div>
                <div>
                  <span className="text-xl font-black text-emerald-700 block font-mono">
                    {activePairDetails.matchup.teamAHomeGames}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {activePairDetails.pair.teamA.name} Home
                  </span>
                </div>
                <div>
                  <span className="text-xl font-black text-blue-700 block font-mono">
                    {activePairDetails.matchup.teamBHomeGames}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {activePairDetails.pair.teamB.name} Home
                  </span>
                </div>
              </div>

              {/* Games List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Scheduled Games ({activePairDetails.matchup.games.length}):
                </span>

                {activePairDetails.matchup.games.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-xs text-amber-800 space-y-2">
                    <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                    <p className="font-semibold text-amber-950">
                      No matches are currently scheduled between these two teams.
                    </p>
                    <p className="text-amber-700">
                      If your league uses a round-robin schedule, navigate to the Schedule page to generate or add a match.
                    </p>
                    {onNavigateToSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCellPair(null);
                          onNavigateToSchedule();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Go to Schedule Page</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activePairDetails.matchup.games.map((game, gIdx) => {
                      const field = fieldMap.get(game.fieldId);
                      const isTeamAHome = game.homeTeamId === activePairDetails.pair.teamA.id;
                      const homeTeam = isTeamAHome ? activePairDetails.pair.teamA : activePairDetails.pair.teamB;
                      const awayTeam = isTeamAHome ? activePairDetails.pair.teamB : activePairDetails.pair.teamA;

                      return (
                        <div
                          key={game.id}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-500 font-mono text-[11px]">
                                Match #{gIdx + 1}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-semibold text-slate-800">
                                {game.date} at {game.time}
                              </span>
                              {game.roundNumber && (
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                                  Round {game.roundNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 font-medium">
                              <span className="font-bold text-slate-900">{homeTeam.name}</span>
                              <span className="text-slate-400 text-[10px] uppercase font-bold">(Home)</span>
                              <span className="text-slate-400">vs</span>
                              <span className="font-bold text-slate-900">{awayTeam.name}</span>
                              <span className="text-slate-400 text-[10px] uppercase font-bold">(Away)</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{field?.name || 'Assigned Pitch'}</span>
                              {field?.address && (
                                <span className="text-slate-400">({field.address})</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {onEditGame && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCellPair(null);
                                  onEditGame(game);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500" />
                                <span>Edit Game</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Pair: {activePairDetails.pair.teamA.name} & {activePairDetails.pair.teamB.name}
              </span>
              <button
                type="button"
                onClick={() => setActiveCellPair(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
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
