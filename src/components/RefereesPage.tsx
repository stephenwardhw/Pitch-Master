import React, { useState, useMemo } from 'react';
import { AppData, Game, Referee, RefereeCertification, RefereeCertificationOption } from '../types';
import { DEFAULT_REFEREE_CERTIFICATIONS } from '../utils/cookieStorage';
import { ManageCertificationsModal } from './modals/ManageCertificationsModal';
import {
  UserCheck,
  Shield,
  Phone,
  Mail,
  Calendar,
  CalendarX,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Download,
  Printer,
  CheckCircle2,
  X,
  ChevronDown,
  Sparkles,
  Check,
  Users,
  Award,
  IdCard,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react';
import { downloadCsv, escapeCsvCell, exportRefereesToCsv } from '../utils/csvImporter';

interface RefereesPageProps {
  appData: AppData;
  onSaveReferee: (referee: Referee) => void;
  onDeleteReferee: (refereeId: string) => void;
  onUpdateGame: (game: Game) => void;
  onUpdateBatchGames: (games: Game[]) => void;
  onNavigateToSchedule?: () => void;
  onOpenCsvImport?: () => void;
  onSaveCertifications?: (
    updatedCertifications: RefereeCertificationOption[],
    renamedMap?: Record<string, string>
  ) => void;
  isReadOnly?: boolean;
}

export const RefereesPage: React.FC<RefereesPageProps> = ({
  appData,
  onSaveReferee,
  onDeleteReferee,
  onUpdateGame,
  onUpdateBatchGames,
  onNavigateToSchedule,
  onOpenCsvImport,
  onSaveCertifications,
  isReadOnly = false,
}) => {
  const referees = useMemo(() => appData.referees || [], [appData.referees]);
  const games = appData.games;
  const divisions = appData.divisions;
  const fields = appData.fields;
  const teams = appData.teams;

  // View Mode: 'directory' | 'assignments' | 'workload'
  const [viewMode, setViewMode] = useState<'directory' | 'assignments' | 'workload'>('directory');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [certFilter, setCertFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<string>('');

  // Modals state
  const [editingReferee, setEditingReferee] = useState<Referee | null>(null);
  const [isNewRefereeModalOpen, setIsNewRefereeModalOpen] = useState(false);
  const [isCertificationsModalOpen, setIsCertificationsModalOpen] = useState(false);
  const [refereeToDelete, setRefereeToDelete] = useState<Referee | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Dynamic referee certifications
  const certificationOptions = useMemo<RefereeCertificationOption[]>(() => {
    return appData.refereeCertifications && appData.refereeCertifications.length > 0
      ? appData.refereeCertifications
      : DEFAULT_REFEREE_CERTIFICATIONS;
  }, [appData.refereeCertifications]);

  const certificationLevels = useMemo(() => {
    return certificationOptions.map((c) => c.name);
  }, [certificationOptions]);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Maps for quick lookup
  const divisionMap = useMemo(() => new Map(divisions.map((d) => [d.id, d])), [divisions]);
  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const refereeMap = useMemo(() => new Map(referees.map((r) => [r.id, r])), [referees]);

  // Count games assigned to each referee
  const refereeGameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    referees.forEach((r) => {
      counts[r.id] = 0;
    });
    games.forEach((g) => {
      if (g.status === 'cancelled') return;
      if (g.refereeId) counts[g.refereeId] = (counts[g.refereeId] || 0) + 1;
      if (g.assistantReferee1Id) counts[g.assistantReferee1Id] = (counts[g.assistantReferee1Id] || 0) + 1;
      if (g.assistantReferee2Id) counts[g.assistantReferee2Id] = (counts[g.assistantReferee2Id] || 0) + 1;
    });
    return counts;
  }, [referees, games]);

  // Overall schedule referee metrics
  const totalGamesCount = games.filter((g) => g.status !== 'cancelled').length;
  const assignedGamesCount = games.filter((g) => g.status !== 'cancelled' && g.refereeId).length;
  const unassignedGamesCount = totalGamesCount - assignedGamesCount;
  const coveragePercent = totalGamesCount > 0 ? Math.round((assignedGamesCount / totalGamesCount) * 100) : 0;

  // Filtered referees list
  const filteredReferees = useMemo(() => {
    return referees.filter((ref) => {
      if (statusFilter === 'active' && !ref.isActive) return false;
      if (statusFilter === 'inactive' && ref.isActive) return false;
      if (certFilter !== 'all' && ref.certificationLevel !== certFilter) return false;
      if (
        divisionFilter !== 'all' &&
        ref.preferredDivisionIds.length > 0 &&
        !ref.preferredDivisionIds.includes(divisionFilter)
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = ref.name.toLowerCase().includes(q);
        const matchesEmail = ref.email.toLowerCase().includes(q);
        const matchesPhone = ref.phone.includes(q);
        const matchesBadge = (ref.badgeNumber || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesPhone || matchesBadge;
      }

      return true;
    });
  }, [referees, statusFilter, certFilter, divisionFilter, searchQuery]);

  // Filtered games for assignment view
  const filteredGamesForAssignment = useMemo(() => {
    let result = [...games].filter((g) => g.status !== 'cancelled');

    if (unassignedOnly) {
      result = result.filter((g) => !g.refereeId);
    }

    if (divisionFilter !== 'all') {
      result = result.filter((g) => g.divisionId === divisionFilter);
    }

    if (assignmentDateFilter) {
      result = result.filter((g) => g.date === assignmentDateFilter);
    }

    // Sort by date then time
    result.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.time.localeCompare(b.time);
    });

    return result;
  }, [games, unassignedOnly, divisionFilter, assignmentDateFilter]);

  // Distinct dates in season
  const allGameDates = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.date) set.add(g.date);
    });
    return Array.from(set).sort();
  }, [games]);

  // Smart Auto-Assign Algorithm
  const handleAutoAssignReferees = () => {
    const activeRefList = referees.filter((r) => r.isActive);
    if (activeRefList.length === 0) {
      showNotification('No active referees available. Please activate or add referees first.', 'error');
      return;
    }

    const updatedGames: Game[] = [];
    const dateSlotTracker = new Map<string, Set<string>>(); // `${refId}_${date}_${time}`
    const dailyCountTracker = new Map<string, number>(); // `${refId}_${date}`

    // Populate initial bookings from already assigned games
    games.forEach((g) => {
      if (g.status === 'cancelled') return;
      const assigned = [g.refereeId, g.assistantReferee1Id, g.assistantReferee2Id].filter(Boolean) as string[];
      assigned.forEach((rId) => {
        const slotKey = `${rId}_${g.date}_${g.time}`;
        if (!dateSlotTracker.has(slotKey)) dateSlotTracker.set(slotKey, new Set());
        dateSlotTracker.get(slotKey)!.add(g.id);

        const dayKey = `${rId}_${g.date}`;
        dailyCountTracker.set(dayKey, (dailyCountTracker.get(dayKey) || 0) + 1);
      });
    });

    let assignedCount = 0;

    // Loop through unassigned games
    games.forEach((game) => {
      if (game.status === 'cancelled') return;

      // If already has a center referee, keep it
      if (game.refereeId) {
        return;
      }

      // Filter available candidates
      const candidates = activeRefList.filter((ref) => {
        // Check blackout
        if (ref.blackoutDates && ref.blackoutDates.includes(game.date)) return false;

        // Check if already booked at this exact time slot
        const slotKey = `${ref.id}_${game.date}_${game.time}`;
        if (dateSlotTracker.has(slotKey) && dateSlotTracker.get(slotKey)!.size > 0) return false;

        // Check max games per day limit
        const maxDaily = ref.maxGamesPerDay || 3;
        const currentDaily = dailyCountTracker.get(`${ref.id}_${game.date}`) || 0;
        if (currentDaily >= maxDaily) return false;

        return true;
      });

      if (candidates.length > 0) {
        // Prioritize candidates with preferred division matching
        const preferred = candidates.filter(
          (c) => c.preferredDivisionIds.length === 0 || c.preferredDivisionIds.includes(game.divisionId)
        );
        const pool = preferred.length > 0 ? preferred : candidates;

        // Sort by least games assigned on this day (fair distribution)
        pool.sort((a, b) => {
          const countA = dailyCountTracker.get(`${a.id}_${game.date}`) || 0;
          const countB = dailyCountTracker.get(`${b.id}_${game.date}`) || 0;
          return countA - countB;
        });

        const selectedRef = pool[0];
        const updatedGame: Game = {
          ...game,
          refereeId: selectedRef.id,
        };

        // Record tracking
        const slotKey = `${selectedRef.id}_${game.date}_${game.time}`;
        if (!dateSlotTracker.has(slotKey)) dateSlotTracker.set(slotKey, new Set());
        dateSlotTracker.get(slotKey)!.add(game.id);

        const dayKey = `${selectedRef.id}_${game.date}`;
        dailyCountTracker.set(dayKey, (dailyCountTracker.get(dayKey) || 0) + 1);

        updatedGames.push(updatedGame);
        assignedCount++;
      }
    });

    if (updatedGames.length > 0) {
      onUpdateBatchGames(updatedGames);
      showNotification(`Successfully auto-assigned referees to ${assignedCount} matches!`, 'success');
    } else {
      showNotification('All eligible matches already have referees assigned, or no available officials found for open slots.', 'info');
    }
  };

  // Export Referees CSV
  const handleExportRefereesCsv = () => {
    const csvContent = exportRefereesToCsv(appData, referees);
    downloadCsv(`referees_roster_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  // Form Submission for New or Edited Referee
  const handleSaveRefereeForm = (refereeData: Referee) => {
    onSaveReferee(refereeData);
    setEditingReferee(null);
    setIsNewRefereeModalOpen(false);
    showNotification(`Referee ${refereeData.name} saved successfully.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-sm transition-all animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header & Stats Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Referee Directory & Match Officiating
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Manage certified match officials, maintain contact details and blackout availability, and assign referees to scheduled games.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleAutoAssignReferees}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                title="Automatically assign available officials to unassigned matches"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-Assign Referees</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportRefereesCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
              title="Export referee roster to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            {!isReadOnly && onOpenCsvImport && (
              <button
                type="button"
                onClick={onOpenCsvImport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                title="Import referees and match officials from a CSV file"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import CSV</span>
              </button>
            )}

            {!isReadOnly && onSaveCertifications && (
              <button
                type="button"
                onClick={() => setIsCertificationsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-2xs"
                title="Manage referee certification levels, badge codes, and standards"
              >
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Certifications</span>
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsNewRefereeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Referee</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Registered Referees
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
              {referees.length}
            </div>
            <span className="text-[10px] text-slate-400">
              {referees.filter((r) => r.isActive).length} active officials
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Assigned Matches
            </span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
              {assignedGamesCount}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {coveragePercent}% of total games covered
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Unassigned Matches
            </span>
            <div className={`text-lg font-bold mt-0.5 font-mono ${unassignedGamesCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {unassignedGamesCount}
            </div>
            <span className="text-[10px] text-slate-400">
              {unassignedGamesCount === 0 ? 'Full match coverage' : 'Needs referee assignment'}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Certifications
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
              {new Set(referees.map((r) => r.certificationLevel)).size}
            </div>
            <span className="text-[10px] text-slate-400">
              USSF Grades 6-8 & Grassroots
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filtering Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Segmented View Control */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('directory')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              viewMode === 'directory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Referee Roster ({referees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('assignments')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              viewMode === 'assignments'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Game Assignments ({totalGamesCount})</span>
            {unassignedGamesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-mono text-[10px]">
                {unassignedGamesCount} open
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewMode('workload')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              viewMode === 'workload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Workload & Blackouts</span>
          </button>
        </div>

        {/* Global Search and Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {viewMode === 'directory' && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search referees or badge..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-xs w-48 sm:w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                value={certFilter}
                onChange={(e) => setCertFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">All Certifications</option>
                {certificationLevels.map((cert) => (
                  <option key={cert} value={cert}>
                    {cert}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </>
          )}

          {viewMode === 'assignments' && (
            <>
              <select
                value={assignmentDateFilter}
                onChange={(e) => setAssignmentDateFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="">All Match Dates ({allGameDates.length})</option>
                {allGameDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">All Divisions ({divisions.length})</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 h-3.5 w-3.5"
                />
                <span className="font-medium text-xs">Unassigned Only</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: REFEREE ROSTER DIRECTORY                                          */}
      {/* ========================================================================= */}
      {viewMode === 'directory' && (
        <div className="space-y-4">
          {filteredReferees.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <UserCheck className="w-10 h-10 mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-slate-900">No Referees Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No match officials match your search or filters. You can clear your filters or register a new referee.
              </p>
              <button
                type="button"
                onClick={() => setIsNewRefereeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Referee</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReferees.map((ref) => {
                const assignedCount = refereeGameCounts[ref.id] || 0;
                return (
                  <div
                    key={ref.id}
                    className={`bg-white rounded-xl border p-4.5 shadow-2xs transition-all flex flex-col justify-between space-y-4 ${
                      ref.isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/50 opacity-75'
                    }`}
                  >
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{ref.name}</h3>
                            {!ref.isActive && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-600 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-emerald-700 block mt-0.5">
                            {ref.certificationLevel}
                          </span>
                        </div>

                        {/* Assigned matches badge */}
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-mono font-bold border border-slate-200">
                            {assignedCount} games
                          </span>
                        </div>
                      </div>

                      {/* Badge and experience */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        {ref.badgeNumber && <span>{ref.badgeNumber}</span>}
                        {ref.experienceYears !== undefined && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{ref.experienceYears} yrs exp</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>Max {ref.maxGamesPerDay || 3}/day</span>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1 text-xs border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a href={`mailto:${ref.email}`} className="text-blue-600 hover:underline truncate">
                          {ref.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a href={`tel:${ref.phone}`} className="text-slate-800 hover:underline font-mono">
                          {ref.phone}
                        </a>
                      </div>

                      {/* Public Contact Privacy Badge */}
                      <div className="pt-1.5">
                        {ref.hideContactPublicly ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <EyeOff className="w-3 h-3 text-amber-600" />
                            <span>Public Portal: Name Only (Contact Hidden)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
                            <Eye className="w-3 h-3 text-emerald-600" />
                            <span>Public Portal: Name & Contact Visible</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preferred Divisions & Blackout summary */}
                    <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Preferred Divisions:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ref.preferredDivisionIds.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic">All Divisions eligible</span>
                          ) : (
                            ref.preferredDivisionIds.map((divId) => (
                              <span
                                key={divId}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                              >
                                {divisionMap.get(divId)?.name || divId}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {ref.blackoutDates && ref.blackoutDates.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mt-1.5">
                            Unavailable Dates ({ref.blackoutDates.length}):
                          </span>
                          <span className="text-[11px] text-rose-700 font-mono">
                            {ref.blackoutDates.join(', ')}
                          </span>
                        </div>
                      )}

                      {ref.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-2">
                          "{ref.notes}"
                        </p>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('assignments');
                          setDivisionFilter('all');
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-medium"
                      >
                        Assign Games →
                      </button>

                      {!isReadOnly && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingReferee(ref)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit referee profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefereeToDelete(ref)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete referee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: GAME ASSIGNMENTS MATRIX                                           */}
      {/* ========================================================================= */}
      {viewMode === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Scheduled Match Officiating Assignments
                </h3>
                <p className="text-xs text-slate-500">
                  Assign center referees and assistant referees. Referees with blackout dates or existing bookings on that date/time are marked clearly.
                </p>
              </div>

              <div className="text-xs font-mono text-slate-600">
                Showing {filteredGamesForAssignment.length} matches
              </div>
            </div>

            {filteredGamesForAssignment.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic text-sm">
                No scheduled matches match current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">Matchup</th>
                      <th className="py-2.5 px-3">Field / Pitch</th>
                      <th className="py-2.5 px-3 w-56">Center Referee</th>
                      <th className="py-2.5 px-3 w-48">Assistant Ref 1</th>
                      <th className="py-2.5 px-3 w-48">Assistant Ref 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredGamesForAssignment.map((game) => {
                      const div = divisionMap.get(game.divisionId);
                      const home = teamMap.get(game.homeTeamId);
                      const away = teamMap.get(game.awayTeamId);
                      const field = fieldMap.get(game.fieldId);
                      const assignedRef = game.refereeId ? refereeMap.get(game.refereeId) : null;

                      // Check if assigned referee has conflict
                      const isRefDoubleBooked =
                        game.refereeId &&
                        games.some(
                          (other) =>
                            other.id !== game.id &&
                            other.status !== 'cancelled' &&
                            other.date === game.date &&
                            other.time === game.time &&
                            (other.refereeId === game.refereeId ||
                              other.assistantReferee1Id === game.refereeId ||
                              other.assistantReferee2Id === game.refereeId)
                        );

                      const isRefBlackout =
                        assignedRef?.blackoutDates && assignedRef.blackoutDates.includes(game.date);

                      return (
                        <tr
                          key={game.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            !game.refereeId ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Date & Time */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900">{game.date}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{game.time}</div>
                          </td>

                          {/* Division */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-700">{div?.name || 'Division'}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">Round {game.roundNumber}</span>
                          </td>

                          {/* Matchup */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                              {home?.name || 'Home'} <span className="font-normal text-slate-400">vs</span> {away?.name || 'Away'}
                            </div>
                            {game.isByePractice && (
                              <span className="text-[10px] text-purple-700 italic">Practice session</span>
                            )}
                          </td>

                          {/* Field */}
                          <td className="py-2.5 px-3 truncate max-w-[160px]">
                            <span className="text-slate-800">{field?.name || 'Field unassigned'}</span>
                          </td>

                          {/* Center Referee Dropdown */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <select
                                value={game.refereeId || ''}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  onUpdateGame({
                                    ...game,
                                    refereeId: e.target.value || undefined,
                                  });
                                }}
                                className={`w-full text-xs rounded border px-2 py-1.5 focus:outline-hidden focus:ring-1 ${
                                  isReadOnly
                                    ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                                    : !game.refereeId
                                    ? 'border-amber-300 bg-amber-50 text-amber-900 font-medium'
                                    : isRefDoubleBooked || isRefBlackout
                                    ? 'border-rose-400 bg-rose-50 text-rose-900 font-medium'
                                    : 'border-slate-300 bg-white text-slate-900'
                                }`}
                              >
                                <option value="">-- Unassigned --</option>
                                {referees
                                  .filter((r) => r.isActive)
                                  .map((r) => {
                                    const hasBlackout = r.blackoutDates && r.blackoutDates.includes(game.date);
                                    return (
                                      <option key={r.id} value={r.id}>
                                        {r.name} ({r.certificationLevel.split('/')[0].trim()})
                                        {hasBlackout ? ' [Blackout]' : ''}
                                      </option>
                                    );
                                  })}
                              </select>

                              {/* Warning badges */}
                              {isRefDoubleBooked && (
                                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Double-booked at {game.time}
                                </span>
                              )}
                              {isRefBlackout && (
                                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                                  <CalendarX className="w-3 h-3" /> On Blackout Calendar
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Assistant Referee 1 */}
                          <td className="py-2.5 px-3">
                            <select
                              value={game.assistantReferee1Id || ''}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                onUpdateGame({
                                  ...game,
                                  assistantReferee1Id: e.target.value || undefined,
                                });
                              }}
                              className={`w-full text-xs rounded border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-hidden ${
                                isReadOnly ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'
                              }`}
                            >
                              <option value="">-- None / AR1 --</option>
                              {referees
                                .filter((r) => r.isActive && r.id !== game.refereeId)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          </td>

                          {/* Assistant Referee 2 */}
                          <td className="py-2.5 px-3">
                            <select
                              value={game.assistantReferee2Id || ''}
                              disabled={isReadOnly}
                              onChange={(e) => {
                                onUpdateGame({
                                  ...game,
                                  assistantReferee2Id: e.target.value || undefined,
                                });
                              }}
                              className={`w-full text-xs rounded border border-slate-300 px-2 py-1.5 text-slate-800 focus:outline-hidden ${
                                isReadOnly ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'
                              }`}
                            >
                              <option value="">-- None / AR2 --</option>
                              {referees
                                .filter(
                                  (r) =>
                                    r.isActive &&
                                    r.id !== game.refereeId &&
                                    r.id !== game.assistantReferee1Id
                                )
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: WORKLOAD & BLACKOUT CALENDAR                                      */}
      {/* ========================================================================= */}
      {viewMode === 'workload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workload Balancer Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Season Workload Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Monitors total matches officiated per referee across the season to ensure equitable game assignments.
                </p>
              </div>

              <div className="space-y-3">
                {referees.map((ref) => {
                  const count = refereeGameCounts[ref.id] || 0;
                  const maxDaily = ref.maxGamesPerDay || 3;
                  const percentOfTotal = totalGamesCount > 0 ? Math.round((count / totalGamesCount) * 100) : 0;

                  return (
                    <div key={ref.id} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{ref.name}</span>
                        <span className="font-mono font-bold text-slate-700">
                          {count} matches ({percentOfTotal}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (count / (totalGamesCount / referees.length || 1)) * 50)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{ref.certificationLevel}</span>
                        <span>Max {maxDaily} games/day</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blackout Dates Roster */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Unavailable / Blackout Dates Calendar
                </h3>
                <p className="text-xs text-slate-500">
                  Dates when individual officials cannot referee due to personal, travel, or work conflicts.
                </p>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {referees.map((ref) => {
                  const hasBlackouts = ref.blackoutDates && ref.blackoutDates.length > 0;
                  return (
                    <div
                      key={ref.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-900 block">{ref.name}</span>
                        {hasBlackouts ? (
                          <div className="flex flex-wrap gap-1">
                            {ref.blackoutDates.map((date) => (
                              <span
                                key={date}
                                className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[11px]"
                              >
                                {date}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No blackout dates recorded (Fully available)</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingReferee(ref)}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 shrink-0"
                      >
                        Edit Dates
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT REFEREE                                                 */}
      {/* ========================================================================= */}
      {(isNewRefereeModalOpen || editingReferee) && (
        <RefereeFormModal
          referee={editingReferee}
          divisions={divisions}
          certificationLevels={certificationLevels}
          onSave={handleSaveRefereeForm}
          onClose={() => {
            setIsNewRefereeModalOpen(false);
            setEditingReferee(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANAGE REFEREE CERTIFICATIONS                                      */}
      {/* ========================================================================= */}
      {isCertificationsModalOpen && onSaveCertifications && (
        <ManageCertificationsModal
          certifications={certificationOptions}
          referees={referees}
          onSaveCertifications={(updatedCerts, renamedMap) => {
            onSaveCertifications(updatedCerts, renamedMap);
            showNotification('Referee certification levels updated successfully.');
          }}
          onClose={() => setIsCertificationsModalOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE REFEREE CONFIRMATION                                        */}
      {/* ========================================================================= */}
      {refereeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Referee</h3>
                <p className="text-xs text-slate-500">Remove {refereeToDelete.name} from the directory?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove this referee from the league directory. Existing assigned matches will become unassigned.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefereeToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReferee(refereeToDelete.id);
                  setRefereeToDelete(null);
                  showNotification(`Referee deleted successfully.`);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                Delete Referee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// SUB-COMPONENT: REFEREE FORM MODAL (ADD / EDIT)
// -------------------------------------------------------------
interface RefereeFormModalProps {
  referee: Referee | null;
  divisions: AppData['divisions'];
  certificationLevels: string[];
  onSave: (referee: Referee) => void;
  onClose: () => void;
}

const RefereeFormModal: React.FC<RefereeFormModalProps> = ({
  referee,
  divisions,
  certificationLevels,
  onSave,
  onClose,
}) => {
  const isEditing = !!referee;

  const [name, setName] = useState(referee?.name || '');
  const [email, setEmail] = useState(referee?.email || '');
  const [phone, setPhone] = useState(referee?.phone || '');
  const [certificationLevel, setCertificationLevel] = useState<RefereeCertification>(
    referee?.certificationLevel || certificationLevels[0] || 'Grassroots / Grade 8'
  );
  const [badgeNumber, setBadgeNumber] = useState(referee?.badgeNumber || '');
  const [experienceYears, setExperienceYears] = useState<number>(referee?.experienceYears || 2);
  const [maxGamesPerDay, setMaxGamesPerDay] = useState<number>(referee?.maxGamesPerDay || 3);
  const [preferredDivisionIds, setPreferredDivisionIds] = useState<string[]>(
    referee?.preferredDivisionIds || []
  );
  const [blackoutDatesInput, setBlackoutDatesInput] = useState<string>(
    (referee?.blackoutDates || []).join(', ')
  );
  const [isActive, setIsActive] = useState<boolean>(referee ? referee.isActive : true);
  const [hideContactPublicly, setHideContactPublicly] = useState<boolean>(
    referee ? Boolean(referee.hideContactPublicly) : false
  );
  const [notes, setNotes] = useState(referee?.notes || '');

  const handleToggleDivision = (divId: string) => {
    setPreferredDivisionIds((prev) =>
      prev.includes(divId) ? prev.filter((id) => id !== divId) : [...prev, divId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse blackout dates
    const parsedBlackouts = blackoutDatesInput
      .split(/[,;\n]/)
      .map((d) => d.trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

    const finalReferee: Referee = {
      id: referee?.id || `ref-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      certificationLevel,
      badgeNumber: badgeNumber.trim() || undefined,
      experienceYears: Math.max(0, experienceYears),
      maxGamesPerDay: Math.max(1, maxGamesPerDay),
      preferredDivisionIds,
      blackoutDates: parsedBlackouts,
      isActive,
      hideContactPublicly,
      notes: notes.trim() || undefined,
    };

    onSave(finalReferee);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {isEditing ? `Edit Referee: ${referee.name}` : 'Register New Match Official'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Name & Certification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Marcus Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                USSF / Official Certification Level
              </label>
              <select
                value={certificationLevel}
                onChange={(e) => setCertificationLevel(e.target.value as RefereeCertification)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                {certificationLevels.map((cert) => (
                  <option key={cert} value={cert}>
                    {cert}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. ref@socalrefs.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Cell Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. (310) 555-0144"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Badge Number & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                USSF Badge / License #
              </label>
              <input
                type="text"
                placeholder="e.g. USSF-884210"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Years Experience
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Max Matches / Day
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxGamesPerDay}
                onChange={(e) => setMaxGamesPerDay(parseInt(e.target.value, 10) || 3)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Preferred Divisions */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <label className="block font-medium text-slate-700">
              Preferred / Certified Divisions
            </label>
            <p className="text-[11px] text-slate-500">
              Select which divisions this official is certified or prefers to officiate. Leave all unchecked for general eligibility across all divisions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {divisions.map((div) => {
                const checked = preferredDivisionIds.includes(div.id);
                return (
                  <label
                    key={div.id}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer select-none transition-colors ${
                      checked
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleDivision(div.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{div.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Blackout Dates */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Blackout Dates (Unavailable)
            </label>
            <input
              type="text"
              placeholder="e.g. 2026-04-12, 2026-05-02 (YYYY-MM-DD comma separated)"
              value={blackoutDatesInput}
              onChange={(e) => setBlackoutDatesInput(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Dates the referee is unavailable. Schedulers will receive an alert if assigned on these dates.
            </span>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveRef"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 h-4 w-4"
            />
            <label htmlFor="isActiveRef" className="font-medium text-slate-700 cursor-pointer">
              Active Official (Available for game assignments)
            </label>
          </div>

          {/* Public Portal Contact Privacy Flag */}
          <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-1.5">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="hideContactPubliclyRef"
                checked={hideContactPublicly}
                onChange={(e) => setHideContactPublicly(e.target.checked)}
                className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <label htmlFor="hideContactPubliclyRef" className="font-bold text-slate-900 cursor-pointer text-xs">
                  Hide Contact Details on Public Portal (Show Name Only)
                </label>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  When checked, only this official&apos;s name and badge/certification will appear in the public match coordination popup. Phone number and email address will remain hidden from coaches and parents.
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Administrative Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Morning availability preference, bilingual, tournament evaluator"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              {isEditing ? 'Save Referee Changes' : 'Register Referee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
