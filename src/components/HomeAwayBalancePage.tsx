import React, { useState, useMemo } from 'react';
import { AppData, Division, Game, Team, TeamBalanceStats } from '../types';
import {
  Scale,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';

interface HomeAwayBalancePageProps {
  appData: AppData;
  onUpdateGame: (updatedGame: Game) => void;
  onUpdateBatchGames: (updatedGames: Game[]) => void;
}

export const HomeAwayBalancePage: React.FC<HomeAwayBalancePageProps> = ({
  appData,
  onUpdateGame,
  onUpdateBatchGames,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);

  // Calculate balance statistics for each team
  const balanceStats: TeamBalanceStats[] = useMemo(() => {
    // Only real teams (exclude "Bye")
    const realTeams = appData.teams.filter((t) => !t.isBye && t.name !== 'Bye');

    return realTeams.map((team) => {
      let homeGames = 0;
      let awayGames = 0;
      let practiceGames = 0;
      let totalGames = 0;

      for (const game of appData.games) {
        if (game.status === 'cancelled') continue;

        if (game.homeTeamId === team.id) {
          totalGames++;
          if (game.isByePractice) {
            practiceGames++;
          } else {
            homeGames++;
          }
        } else if (game.awayTeamId === team.id) {
          totalGames++;
          awayGames++;
        }
      }

      const differential = homeGames - awayGames;
      const divisionName = divisionMap.get(team.divisionId)?.name || 'Unknown Division';

      return {
        team,
        divisionName,
        totalGames,
        homeGames,
        awayGames,
        practiceGames,
        differential,
      };
    });
  }, [appData.teams, appData.games, divisionMap]);

  // Filter stats
  const filteredStats = useMemo(() => {
    if (selectedDivision === 'all') return balanceStats;
    return balanceStats.filter((s) => s.team.divisionId === selectedDivision);
  }, [balanceStats, selectedDivision]);

  // Summary counts
  const totalTeams = filteredStats.length;
  const evenCount = filteredStats.filter((s) => s.differential === 0).length;
  const closeCount = filteredStats.filter((s) => Math.abs(s.differential) === 1).length;
  const unbalancedCount = filteredStats.filter((s) => Math.abs(s.differential) >= 2).length;

  // Games for currently expanded team
  const expandedTeamGames = useMemo(() => {
    if (!expandedTeamId) return [];
    return appData.games.filter(
      (g) =>
        g.status !== 'cancelled' &&
        (g.homeTeamId === expandedTeamId || g.awayTeamId === expandedTeamId)
    );
  }, [appData.games, expandedTeamId]);

  // 1-Click Swap Home / Away for a specific game
  const handleSwapHomeAway = (game: Game) => {
    onUpdateGame({
      ...game,
      homeTeamId: game.awayTeamId,
      awayTeamId: game.homeTeamId,
    });
  };

  // Automated home/away re-balancing optimizer
  const handleAutoRebalance = () => {
    // Greedy heuristic to invert games where home differential is positive for home team and negative for away team
    const updatedGames = [...appData.games];
    let swapsMade = 0;

    // Build current differentials
    const diffs = new Map<string, number>();
    for (const stat of balanceStats) {
      diffs.set(stat.team.id, stat.differential);
    }

    for (let i = 0; i < updatedGames.length; i++) {
      const g = updatedGames[i];
      if (g.isByePractice || g.status === 'cancelled') continue;

      const homeDiff = diffs.get(g.homeTeamId) || 0;
      const awayDiff = diffs.get(g.awayTeamId) || 0;

      // If home team has excess home games (diff > 0) and away team has deficit (away > home, diff < 0),
      // swapping reduces the delta for both!
      if (homeDiff > 0 && awayDiff < 0) {
        updatedGames[i] = {
          ...g,
          homeTeamId: g.awayTeamId,
          awayTeamId: g.homeTeamId,
        };
        diffs.set(g.homeTeamId, homeDiff - 2);
        diffs.set(g.awayTeamId, awayDiff + 2);
        swapsMade++;
      }
    }

    if (swapsMade > 0) {
      onUpdateBatchGames(updatedGames);
      alert(`Auto-Balance Optimizer completed: Swapped Home/Away designations on ${swapsMade} matches.`);
    } else {
      alert('The current schedule is already optimized for maximum home/away balance.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Home / Away Balance Analysis
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verify fair distribution of home field advantage and away travel across all teams in the league.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoRebalance}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-Balance Assistant</span>
            </button>
          </div>
        </div>

        {/* Division Selector & KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-semibold block">Total Teams</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">{totalTeams}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-emerald-700 uppercase font-semibold block">Perfect Balance (0)</span>
            <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">{evenCount}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-blue-700 uppercase font-semibold block">Optimal (±1 diff)</span>
            <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">{closeCount}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-amber-700 uppercase font-semibold block">Imbalanced (±2 or more)</span>
            <span className="text-xl font-bold font-mono text-amber-700 tabular-nums">{unbalancedCount}</span>
          </div>
        </div>

        {/* Filter Division */}
        <div className="flex items-center gap-3 pt-1">
          <label className="text-xs font-medium text-slate-600">Filter Division:</label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Divisions ({appData.divisions.length})</option>
            {appData.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Balance Statistics Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Division</th>
                <th className="py-3 px-4 text-center">Total Games</th>
                <th className="py-3 px-4 text-center">Home</th>
                <th className="py-3 px-4 text-center">Away</th>
                <th className="py-3 px-4 text-center">Practice (Bye)</th>
                <th className="py-3 px-4 text-center">Differential (H - A)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStats.map((stat) => {
                const diff = stat.differential;
                const isExpanded = expandedTeamId === stat.team.id;

                let diffBadgeColor = 'text-slate-600 bg-slate-100 border-slate-200';
                if (diff === 0) diffBadgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 font-bold';
                else if (Math.abs(diff) === 1) diffBadgeColor = 'text-blue-700 bg-blue-50 border-blue-200';
                else diffBadgeColor = 'text-amber-800 bg-amber-50 border-amber-200 font-bold';

                return (
                  <React.Fragment key={stat.team.id}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors ${
                        isExpanded ? 'bg-slate-50/80 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{stat.team.name}</div>
                        {stat.team.contactName && (
                          <div className="text-[11px] text-slate-400">Coach: {stat.team.contactName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{stat.divisionName}</td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold text-slate-900">
                        {stat.totalGames}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-emerald-700 font-medium">
                        {stat.homeGames}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-blue-700 font-medium">
                        {stat.awayGames}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                        {stat.practiceGames}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono tabular-nums text-xs border ${diffBadgeColor}`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedTeamId(isExpanded ? null : stat.team.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Matches' : 'View & Balance'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Matches Drawer for 1-Click Balancing */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="p-4 border-t border-b border-slate-200">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                Scheduled Matches for {stat.team.name} ({expandedTeamGames.length})
                              </h4>
                              <span className="text-xs text-slate-500">
                                Click "Swap Home / Away" on any game below to re-balance
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {expandedTeamGames.map((game) => {
                                const isHome = game.homeTeamId === stat.team.id;
                                const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
                                const opponent = teamMap.get(opponentId);
                                const field = fieldMap.get(game.fieldId);

                                return (
                                  <div
                                    key={game.id}
                                    className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                                            isHome
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}
                                        >
                                          {isHome ? 'HOME' : 'AWAY'}
                                        </span>
                                        <span className="font-semibold text-slate-900">
                                          {isHome ? 'vs ' : '@ '}
                                          {game.isByePractice ? 'Bye (Practice)' : opponent?.name || 'Opponent'}
                                        </span>
                                      </div>
                                      <div className="text-slate-500 flex items-center gap-2 text-[11px]">
                                        <span className="font-mono tabular-nums">{game.date} · {game.time}</span>
                                        <span>·</span>
                                        <span className="truncate max-w-[140px]">{field?.name || 'Pitch'}</span>
                                      </div>
                                    </div>

                                    {!game.isByePractice && (
                                      <button
                                        type="button"
                                        onClick={() => handleSwapHomeAway(game)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
                                        title="Flip home/away designation for this match"
                                      >
                                        <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Swap</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
