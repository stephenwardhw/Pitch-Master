import React, { useState, useMemo } from 'react';
import { AppData, Field, Game, DayOfWeek } from '../types';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Calendar,
  Layers,
  X,
  ShieldAlert,
  Info,
  ChevronLeft,
  ChevronRight,
  Grid,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Clock,
  Users,
  Filter,
  Sparkles,
  Shield,
} from 'lucide-react';

interface FieldsPageProps {
  appData: AppData;
  onSaveField: (field: Field) => void;
  onDeleteField: (fieldId: string) => void;
  onSelectFieldMap: (field: Field) => void;
}

type ViewMode = 'matrix' | 'calendar' | 'cards';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Pure string date helper YYYY-MM-DD
const formatDateKey = (year: number, monthIndex: number, day: number): string => {
  const y = year.toString();
  const m = (monthIndex + 1).toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const FieldsPage: React.FC<FieldsPageProps> = ({
  appData,
  onSaveField,
  onDeleteField,
  onSelectFieldMap,
}) => {
  // Primary View Mode
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  // Month navigation: default to season start month or current month
  const initialYearMonth = useMemo(() => {
    if (appData.seasonConfig?.startDate) {
      const parts = appData.seasonConfig.startDate.split('-');
      if (parts.length === 3) {
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10) - 1,
        };
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [appData.seasonConfig?.startDate]);

  const [currentYear, setCurrentYear] = useState<number>(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialYearMonth.month);

  // Filters
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');
  const [selectedCalendarFieldId, setSelectedCalendarFieldId] = useState<string>('all');

  // Interactive warning modal when blocking a date that has scheduled games
  const [conflictWarning, setConflictWarning] = useState<{
    field: Field;
    date: string;
    games: Game[];
  } | null>(null);

  // Toast / notification feedback
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Field Edit / Create Form states
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapsUrl, setFormMapsUrl] = useState('');
  const [formSize, setFormSize] = useState('11v11 Full');
  const [formSurface, setFormSurface] = useState<Field['surfaceType']>('Natural Grass');
  const [formDivisionIds, setFormDivisionIds] = useState<string[]>([]);
  const [formBlackoutDates, setFormBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Quick lookup maps
  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const teamMap = useMemo(() => new Map(appData.teams.map((t) => [t.id, t])), [appData.teams]);

  // Games indexed by `${fieldId}_${date}`
  const gamesByFieldAndDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    appData.games.forEach((game) => {
      const key = `${game.fieldId}_${game.date}`;
      const list = map.get(key) || [];
      list.push(game);
      map.set(key, list);
    });
    return map;
  }, [appData.games]);

  // Games specifically for the selected division
  const divisionGamesByFieldAndDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    appData.games.forEach((game) => {
      if (game.status === 'cancelled') return;
      if (selectedDivisionFilter !== 'all' && game.divisionId !== selectedDivisionFilter) return;
      const key = `${game.fieldId}_${game.date}`;
      const list = map.get(key) || [];
      list.push(game);
      map.set(key, list);
    });
    return map;
  }, [appData.games, selectedDivisionFilter]);

  // Active division object if filtered
  const activeDivision = useMemo(() => {
    if (selectedDivisionFilter === 'all') return null;
    return appData.divisions.find((d) => d.id === selectedDivisionFilter) || null;
  }, [appData.divisions, selectedDivisionFilter]);

  // Filtered fields based on selected division
  const filteredFields = useMemo(() => {
    if (selectedDivisionFilter === 'all') {
      return appData.fields;
    }

    const targetDivision = appData.divisions.find((d) => d.id === selectedDivisionFilter);
    if (!targetDivision) return appData.fields;

    // If division explicitly specifies permitted fields in Divisions Setup, that is authoritative:
    if (Array.isArray(targetDivision.fieldIds) && targetDivision.fieldIds.length > 0) {
      return appData.fields.filter((field) => targetDivision.fieldIds.includes(field.id));
    }

    // Otherwise, check pitch's assigned divisions:
    if (appData.fields.some((f) => Array.isArray(f.assignedDivisionIds) && f.assignedDivisionIds.length > 0)) {
      const assigned = appData.fields.filter(
        (f) => Array.isArray(f.assignedDivisionIds) && f.assignedDivisionIds.includes(selectedDivisionFilter)
      );
      if (assigned.length > 0) return assigned;
    }

    // Fallback: check teams' home pitches and scheduled games for this division
    const divTeams = appData.teams.filter((t) => t.divisionId === selectedDivisionFilter);
    return appData.fields.filter((field) => {
      if (divTeams.some((t) => t.primaryHomeFieldId === field.id || t.alternateHomeFieldIds?.includes(field.id))) {
        return true;
      }
      return appData.games.some(
        (g) => g.divisionId === selectedDivisionFilter && g.fieldId === field.id && g.status !== 'cancelled'
      );
    });
  }, [appData.fields, appData.divisions, appData.teams, appData.games, selectedDivisionFilter]);

  // Fields to display in the matrix (supports single pitch filter as well)
  const displayMatrixFields = useMemo(() => {
    if (selectedCalendarFieldId === 'all') return filteredFields;
    const match = filteredFields.filter((f) => f.id === selectedCalendarFieldId);
    return match.length > 0 ? match : filteredFields;
  }, [filteredFields, selectedCalendarFieldId]);

  // Calendar dates calculation for current month
  const daysInCurrentMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Month days array
  const monthDays = useMemo(() => {
    const days: { day: number; dateStr: string; dayOfWeek: number }[] = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = formatDateKey(currentYear, currentMonth, d);
      const dayOfWeek = (firstDayOfWeek + d - 1) % 7;
      days.push({ day: d, dateStr, dayOfWeek });
    }
    return days;
  }, [currentYear, currentMonth, daysInCurrentMonth, firstDayOfWeek]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Season quick months
  const seasonMonths = useMemo(() => {
    if (!appData.seasonConfig?.startDate || !appData.seasonConfig?.endDate) return [];
    const [startYear, startMonth] = appData.seasonConfig.startDate.split('-').map(Number);
    const [endYear, endMonth] = appData.seasonConfig.endDate.split('-').map(Number);

    const list: { year: number; month: number; label: string }[] = [];
    let y = startYear;
    let m = startMonth - 1;

    while (y < endYear || (y === endYear && m <= endMonth - 1)) {
      list.push({
        year: y,
        month: m,
        label: `${MONTH_NAMES[m].slice(0, 3)} ${y}`,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return list;
  }, [appData.seasonConfig?.startDate, appData.seasonConfig?.endDate]);

  // Availability metrics for active month
  const metrics = useMemo(() => {
    let totalBlackoutSlots = 0;
    let totalGameSlots = 0;

    filteredFields.forEach((f) => {
      monthDays.forEach(({ dateStr }) => {
        const isFieldBlackout = (f.blackoutDates || []).includes(dateStr);
        const hasGames = selectedDivisionFilter === 'all'
          ? (gamesByFieldAndDate.get(`${f.id}_${dateStr}`) || []).length > 0
          : (divisionGamesByFieldAndDate.get(`${f.id}_${dateStr}`) || []).length > 0;
        if (isFieldBlackout) totalBlackoutSlots++;
        if (hasGames) totalGameSlots++;
      });
    });

    const totalPotentialSlots = filteredFields.length * monthDays.length;
    const availableSlots = Math.max(0, totalPotentialSlots - totalBlackoutSlots);
    const availabilityRate =
      totalPotentialSlots > 0 ? Math.round((availableSlots / totalPotentialSlots) * 100) : 100;

    return {
      totalFields: filteredFields.length,
      totalBlackoutSlots,
      totalGameSlots,
      availabilityRate,
    };
  }, [filteredFields, monthDays, gamesByFieldAndDate, divisionGamesByFieldAndDate, selectedDivisionFilter]);

  // Toggle blackout date for a field
  const handleToggleFieldBlackout = (field: Field, dateStr: string) => {
    const isCurrentlyBlackout = (field.blackoutDates || []).includes(dateStr);

    if (isCurrentlyBlackout) {
      // Remove blackout
      const updatedDates = (field.blackoutDates || []).filter((d) => d !== dateStr);
      onSaveField({
        ...field,
        blackoutDates: updatedDates,
      });
      showFeedback(`Removed blackout date (${dateStr}) for ${field.name}`);
    } else {
      // Check if games are scheduled
      const scheduledGames = gamesByFieldAndDate.get(`${field.id}_${dateStr}`) || [];
      if (scheduledGames.length > 0) {
        setConflictWarning({
          field,
          date: dateStr,
          games: scheduledGames,
        });
      } else {
        // Direct add blackout
        const updatedDates = [...(field.blackoutDates || []), dateStr].sort();
        onSaveField({
          ...field,
          blackoutDates: updatedDates,
        });
        showFeedback(`Blocked ${dateStr} for ${field.name}`);
      }
    }
  };

  const handleConfirmConflictBlackout = () => {
    if (!conflictWarning) return;
    const { field, date } = conflictWarning;
    const updatedDates = [...(field.blackoutDates || []), date].sort();
    onSaveField({
      ...field,
      blackoutDates: updatedDates,
    });
    setConflictWarning(null);
    showFeedback(`Blackout added for ${field.name} on ${date} (Flagged conflicts)`);
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3200);
  };

  // Edit / Form Handlers
  const handleOpenEdit = (field: Field) => {
    setEditingField(field);
    setIsCreatingNew(false);
    setFormName(field.name);
    setFormAddress(field.address);
    setFormMapsUrl(field.googleMapsUrl || '');
    setFormSize(field.size || '11v11 Full');
    setFormSurface(field.surfaceType || 'Natural Grass');
    setFormDivisionIds([...(field.assignedDivisionIds || [])]);
    setFormBlackoutDates([...(field.blackoutDates || [])]);
    setFormNotes(field.notes || '');
  };

  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingField(null);
    setFormName('');
    setFormAddress('');
    setFormMapsUrl('');
    setFormSize('11v11 Full');
    setFormSurface('Natural Grass');
    setFormDivisionIds(appData.divisions.map((d) => d.id));
    setFormBlackoutDates([]);
    setFormNotes('');
  };

  const handleToggleDivision = (divId: string) => {
    if (formDivisionIds.includes(divId)) {
      setFormDivisionIds(formDivisionIds.filter((id) => id !== divId));
    } else {
      setFormDivisionIds([...formDivisionIds, divId]);
    }
  };

  const handleAddBlackoutDate = () => {
    if (!newBlackoutDate || formBlackoutDates.includes(newBlackoutDate)) return;
    setFormBlackoutDates([...formBlackoutDates, newBlackoutDate].sort());
    setNewBlackoutDate('');
  };

  const handleRemoveBlackoutDate = (date: string) => {
    setFormBlackoutDates(formBlackoutDates.filter((d) => d !== date));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const mapsUrl =
      formMapsUrl.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        formAddress.trim() || formName.trim()
      )}`;

    const fieldToSave: Field = {
      id: editingField ? editingField.id : `f-${Date.now()}`,
      name: formName.trim(),
      address: formAddress.trim(),
      googleMapsUrl: mapsUrl,
      size: formSize,
      surfaceType: formSurface,
      assignedDivisionIds: formDivisionIds,
      blackoutDates: formBlackoutDates,
      notes: formNotes.trim(),
    };

    onSaveField(fieldToSave);
    setEditingField(null);
    setIsCreatingNew(false);
    showFeedback(`Saved pitch profile for "${fieldToSave.name}"`);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pitches & Facility Availability</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual calendar grid of field availability, blocked maintenance dates, match bookings, and facility specs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center text-xs">
            <button
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View timeline availability matrix for all pitches"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Availability Grid</span>
            </button>

            <button
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View classic 7-day monthly calendar"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Monthly Calendar</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View facility directory cards"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pitch Directory</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Pitch</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionFeedback && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Calendar Controls & Summary Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-slate-900 text-sm px-2 min-w-[140px] text-center">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick Season Jump Pills */}
            {seasonMonths.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium mr-1">Season:</span>
                {seasonMonths.map((sm) => {
                  const isActive = sm.year === currentYear && sm.month === currentMonth;
                  return (
                    <button
                      key={`${sm.year}-${sm.month}`}
                      onClick={() => handleJumpToMonth(sm.year, sm.month)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sm.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Division Filter & Pitch Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <label className="font-medium text-slate-600">Filter Division:</label>
              <select
                value={selectedDivisionFilter}
                onChange={(e) => {
                  setSelectedDivisionFilter(e.target.value);
                  setSelectedCalendarFieldId('all');
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              >
                <option value="all">All Divisions ({appData.divisions.length})</option>
                {appData.divisions.map((d) => {
                  const pitchCount = Array.isArray(d.fieldIds) && d.fieldIds.length > 0
                    ? d.fieldIds.length
                    : appData.fields.filter((f) => f.assignedDivisionIds?.includes(d.id)).length;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} ({pitchCount} pitch{pitchCount !== 1 ? 'es' : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Single Field Filter (Works in both Matrix and Calendar modes) */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <label className="font-medium text-slate-600">Pitch:</label>
              <select
                value={selectedCalendarFieldId}
                onChange={(e) => setSelectedCalendarFieldId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              >
                <option value="all">
                  {selectedDivisionFilter === 'all'
                    ? `All Pitches (${filteredFields.length})`
                    : `All Permitted Pitches (${filteredFields.length})`}
                </option>
                {filteredFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Legend & Availability Metric Stats Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Legend:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-500 border border-rose-600 inline-block" />
              <span className="font-medium text-rose-900">Pitch Blackout / Blocked</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 border border-amber-500 inline-block" />
              <span className="font-medium text-amber-900">League Holiday Break</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500 border border-blue-600 inline-block" />
              <span className="font-medium text-blue-900">
                {activeDivision ? `${activeDivision.name} Match` : 'Scheduled Game(s)'}
              </span>
            </span>
            {activeDivision && (
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-300 border border-slate-400 inline-block" />
                <span className="font-medium text-slate-700">Pitch Booked (Other Division)</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
              <span className="font-medium text-emerald-800">Available / Open</span>
            </span>
            <span className="text-slate-400 italic">· Click any cell to toggle blackout</span>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-slate-500 font-mono text-xs tabular-nums">
            <span>
              <strong className="text-slate-800 font-sans">{metrics.totalFields}</strong> pitches
              {activeDivision && <span className="text-[10px] text-emerald-700 ml-1 font-sans font-semibold">({activeDivision.name.split(' ')[0]})</span>}
            </span>
            <span>
              <strong className="text-rose-600 font-sans">{metrics.totalBlackoutSlots}</strong> blocked
            </span>
            <span>
              <strong className="text-blue-600 font-sans">{metrics.totalGameSlots}</strong> booked
            </span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-bold">
              {metrics.availabilityRate}% open
            </span>
          </div>
        </div>
      </div>

      {/* ================= VIEW 1: TIMELINE AVAILABILITY MATRIX ================= */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Facility Availability Matrix — {MONTH_NAMES[currentMonth]} {currentYear}
                </h2>
                {activeDivision && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    Division: {activeDivision.name}
                  </span>
                )}
                {selectedCalendarFieldId !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                    Pitch: {appData.fields.find((f) => f.id === selectedCalendarFieldId)?.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeDivision
                  ? `Showing ${displayMatrixFields.length} permitted pitch${displayMatrixFields.length !== 1 ? 'es' : ''} for ${activeDivision.name}. Click any cell to toggle blackout dates.`
                  : 'Click any cell to toggle pitch availability. Schedulers will flag conflicts if games fall on blocked days.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeDivision && (
                <button
                  onClick={() => {
                    setSelectedDivisionFilter('all');
                    setSelectedCalendarFieldId('all');
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                >
                  Clear Division Filter
                </button>
              )}
              <div className="text-xs text-slate-500 hidden md:block">
                Weekend columns highlighted in subtle slate
              </div>
            </div>
          </div>

          {displayMatrixFields.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-700">
                No pitches assigned to {activeDivision?.name || 'this selection'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Configure permitted pitches in Divisions Setup or assign divisions in Pitch Setup.
              </p>
              <button
                onClick={() => {
                  setSelectedDivisionFilter('all');
                  setSelectedCalendarFieldId('all');
                }}
                className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs"
              >
                Show All League Pitches
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600">
                    <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700 border-r border-slate-200 min-w-[190px] shadow-xs">
                      Pitch Facility ({displayMatrixFields.length})
                    </th>
                    {monthDays.map(({ day, dateStr, dayOfWeek }) => {
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isSeasonBlackout = (appData.seasonConfig?.blackoutDates || []).includes(dateStr);
                      const isDivisionPlayDay = activeDivision
                        ? activeDivision.playDays.includes(dayOfWeek as DayOfWeek)
                        : isWeekend;

                      return (
                        <th
                          key={dateStr}
                          className={`px-1.5 py-1.5 text-center font-semibold min-w-[34px] border-r border-slate-200 ${
                            isSeasonBlackout
                              ? 'bg-amber-100 text-amber-900'
                              : isDivisionPlayDay
                              ? 'bg-slate-200/70 text-slate-900 font-bold'
                              : 'bg-slate-50/40 text-slate-400 font-normal'
                          }`}
                          title={`${DAYS_OF_WEEK[dayOfWeek]}, ${MONTH_NAMES[currentMonth]} ${day}${
                            isSeasonBlackout
                              ? ' (League Season Blackout)'
                              : activeDivision && isDivisionPlayDay
                              ? ` (${activeDivision.name} Match Play Day)`
                              : ''
                          }`}
                        >
                          <div
                            className={`text-[10px] uppercase tracking-tighter ${
                              activeDivision && isDivisionPlayDay ? 'text-emerald-700 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {DAYS_OF_WEEK[dayOfWeek].slice(0, 2)}
                          </div>
                          <div className={`text-xs ${activeDivision && isDivisionPlayDay ? 'font-black text-slate-900' : 'font-semibold'}`}>
                            {day}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-center font-bold text-slate-700 min-w-[90px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayMatrixFields.map((field) => {
                    const fieldBlackouts = new Set(field.blackoutDates || []);
                    const totalBlockedInMonth = monthDays.filter(({ dateStr }) =>
                      fieldBlackouts.has(dateStr)
                    ).length;

                    return (
                      <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Fixed Left Header for Pitch Info */}
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate" title={field.name}>
                                {field.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                {field.size} · {field.surfaceType || 'Pitch'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenEdit(field)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="Edit Pitch"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Day Cells */}
                        {monthDays.map(({ day, dateStr, dayOfWeek }) => {
                          const isFieldBlackout = fieldBlackouts.has(dateStr);
                          const isSeasonBlackout = (appData.seasonConfig?.blackoutDates || []).includes(dateStr);
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                          const allGamesOnThisDay = gamesByFieldAndDate.get(`${field.id}_${dateStr}`) || [];
                          const divisionGames = selectedDivisionFilter === 'all'
                            ? allGamesOnThisDay
                            : allGamesOnThisDay.filter((g) => g.divisionId === selectedDivisionFilter);
                          const otherGames = selectedDivisionFilter === 'all'
                            ? []
                            : allGamesOnThisDay.filter((g) => g.divisionId !== selectedDivisionFilter);

                          const hasDivisionGames = divisionGames.length > 0;
                          const hasOtherGamesOnly = !hasDivisionGames && otherGames.length > 0;

                          return (
                            <td
                              key={dateStr}
                              onClick={() => handleToggleFieldBlackout(field, dateStr)}
                              className={`p-1 text-center border-r border-slate-200 cursor-pointer transition-colors relative group ${
                                isFieldBlackout
                                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                                  : isSeasonBlackout
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                  : hasDivisionGames
                                  ? 'bg-blue-100 text-blue-900 hover:bg-blue-200 border-blue-200'
                                  : hasOtherGamesOnly
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : isWeekend
                                  ? 'bg-slate-50 text-slate-700 hover:bg-emerald-50'
                                  : 'hover:bg-emerald-50 text-slate-400'
                              }`}
                              title={`${field.name} on ${DAYS_OF_WEEK[dayOfWeek]}, ${MONTH_NAMES[currentMonth]} ${day}: ${
                                isFieldBlackout
                                  ? 'BLOCKED / Blackout Date (Click to unblock)'
                                  : isSeasonBlackout
                                  ? 'League Holiday Break'
                                  : hasDivisionGames
                                  ? `${divisionGames.length} ${activeDivision ? activeDivision.name : ''} match(es): ${divisionGames
                                      .map((g) => `${g.time} ${teamMap.get(g.homeTeamId)?.name || 'Home'} vs ${teamMap.get(g.awayTeamId)?.name || 'Away'}`)
                                      .join(', ')}${otherGames.length > 0 ? ` (+${otherGames.length} other division match(es) sharing pitch)` : ''}`
                                  : hasOtherGamesOnly
                                  ? `Pitch booked by other division (${otherGames.length} match(es): ${otherGames
                                      .map((g) => `${g.time} ${teamMap.get(g.homeTeamId)?.name || 'Home'} vs ${teamMap.get(g.awayTeamId)?.name || 'Away'}`)
                                      .join(', ')}). No ${activeDivision?.name || 'this division'} matches.`
                                  : 'Available (Click to block)'
                              }`}
                            >
                              <div className="h-7 flex items-center justify-center font-mono text-[11px] font-bold">
                                {isFieldBlackout ? (
                                  <Lock className="w-3.5 h-3.5 text-white" />
                                ) : isSeasonBlackout ? (
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                                ) : hasDivisionGames ? (
                                  <div className="flex items-center gap-0.5">
                                    <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold shadow-2xs">
                                      {divisionGames.length}
                                    </span>
                                    {otherGames.length > 0 && (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"
                                        title={`${otherGames.length} additional match(es) from other divisions`}
                                      />
                                    )}
                                  </div>
                                ) : hasOtherGamesOnly ? (
                                  <span
                                    className="px-1 py-0.5 bg-slate-300 text-slate-700 rounded text-[9px] font-semibold"
                                    title={`${otherGames.length} other division game(s)`}
                                  >
                                    {otherGames.length}•
                                  </span>
                                ) : (
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-600 font-bold">
                                    +
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Right Total Stats */}
                        <td className="px-3 py-2 text-center text-xs font-medium">
                          {totalBlockedInMonth > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              {totalBlockedInMonth} blocked
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">100% open</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW 2: CLASSIC MONTHLY CALENDAR ================= */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Calendar Month View — {MONTH_NAMES[currentMonth]} {currentYear}
              {selectedCalendarFieldId !== 'all' && (
                <span className="ml-2 font-normal text-slate-500">
                  for {appData.fields.find((f) => f.id === selectedCalendarFieldId)?.name}
                </span>
              )}
            </h2>
            <span className="text-xs text-slate-500">
              {selectedCalendarFieldId === 'all'
                ? 'Showing aggregate availability across all pitches'
                : 'Click any day to toggle blackout date for this pitch'}
            </span>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-xs font-bold text-slate-700 text-center">
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-2 border-r border-slate-200 last:border-r-0 ${
                  idx === 0 || idx === 6 ? 'bg-slate-200/50 text-slate-900' : ''
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Month Day Blocks */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 text-xs">
            {/* Blank leading slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[105px] bg-slate-50/50 p-2 text-slate-300" />
            ))}

            {/* Days of current month */}
            {monthDays.map(({ day, dateStr, dayOfWeek }) => {
              const isSeasonBlackout = (appData.seasonConfig?.blackoutDates || []).includes(dateStr);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              // If a specific field is selected
              if (selectedCalendarFieldId !== 'all') {
                const singleField = appData.fields.find((f) => f.id === selectedCalendarFieldId);
                const isFieldBlackout = (singleField?.blackoutDates || []).includes(dateStr);
                const allFieldGames = singleField
                  ? gamesByFieldAndDate.get(`${singleField.id}_${dateStr}`) || []
                  : [];
                const games = selectedDivisionFilter === 'all'
                  ? allFieldGames
                  : allFieldGames.filter((g) => g.divisionId === selectedDivisionFilter);

                return (
                  <div
                    key={dateStr}
                    onClick={() => singleField && handleToggleFieldBlackout(singleField, dateStr)}
                    className={`min-h-[105px] p-2 flex flex-col justify-between transition-colors cursor-pointer group ${
                      isFieldBlackout
                        ? 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200'
                        : isSeasonBlackout
                        ? 'bg-amber-50/70 hover:bg-amber-100/70'
                        : isWeekend
                        ? 'bg-slate-50/40 hover:bg-slate-100/60'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold text-xs ${
                          isFieldBlackout ? 'text-rose-700' : 'text-slate-800'
                        }`}
                      >
                        {day}
                      </span>
                      {isFieldBlackout && (
                        <span className="p-0.5 rounded bg-rose-500 text-white">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1">
                      {isFieldBlackout && (
                        <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span>BLOCKED</span>
                        </div>
                      )}

                      {isSeasonBlackout && (
                        <div className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-900 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>League Break</span>
                        </div>
                      )}

                      {games.map((g) => {
                        const home = teamMap.get(g.homeTeamId);
                        const away = teamMap.get(g.awayTeamId);
                        return (
                          <div
                            key={g.id}
                            className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1 py-0.5 rounded truncate"
                            title={`${g.time} - ${home?.name || 'Home'} vs ${away?.name || 'Away'}`}
                          >
                            <span className="font-mono font-bold mr-1">{g.time}</span>
                            <span>{home?.name || 'Home'} vs {away?.name || 'Away'}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-slate-400 group-hover:text-slate-600 flex justify-end">
                      {isFieldBlackout ? 'Click to unblock' : 'Click to block'}
                    </div>
                  </div>
                );
              }

              // All Pitches combined view
              const blockedFieldsToday = filteredFields.filter((f) =>
                (f.blackoutDates || []).includes(dateStr)
              );
              const gamesToday = appData.games.filter(
                (g) => g.date === dateStr && (selectedDivisionFilter === 'all' || g.divisionId === selectedDivisionFilter)
              );

              return (
                <div
                  key={dateStr}
                  className={`min-h-[105px] p-2 flex flex-col justify-between ${
                    isSeasonBlackout
                      ? 'bg-amber-50/60'
                      : blockedFieldsToday.length > 0
                      ? 'bg-slate-50/90'
                      : isWeekend
                      ? 'bg-slate-50/40'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{day}</span>
                    {blockedFieldsToday.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        {blockedFieldsToday.length} blocked
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 my-1">
                    {isSeasonBlackout && (
                      <div className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-900">
                        League Holiday Break
                      </div>
                    )}

                    {blockedFieldsToday.slice(0, 2).map((bf) => (
                      <div
                        key={bf.id}
                        onClick={() => handleToggleFieldBlackout(bf, dateStr)}
                        className="text-[10px] px-1 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 truncate cursor-pointer hover:bg-rose-100"
                        title={`${bf.name} is blocked. Click to remove blackout.`}
                      >
                        🚫 {bf.name}
                      </div>
                    ))}

                    {blockedFieldsToday.length > 2 && (
                      <span className="text-[10px] text-rose-600 block">
                        +{blockedFieldsToday.length - 2} more blocked
                      </span>
                    )}

                    {gamesToday.length > 0 && (
                      <div className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-200">
                        ⚽ {gamesToday.length} {gamesToday.length === 1 ? 'game' : 'games'} scheduled
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 text-right">
                    {filteredFields.length - blockedFieldsToday.length}/{filteredFields.length} open
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW 3: PITCH DIRECTORY CARDS ================= */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFields.map((field) => {
            const assignedDivs = (field.assignedDivisionIds || [])
              .map((id) => divisionMap.get(id))
              .filter(Boolean);
            const mapsUrl =
              field.googleMapsUrl ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                field.address || field.name
              )}`;

            return (
              <div
                key={field.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-shadow"
              >
                <div className="space-y-3">
                  {/* Field Name & Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {field.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {field.size} · {field.surfaceType || 'Pitch'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(field)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        title="Edit pitch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete pitch "${field.name}"?`)) {
                            onDeleteField(field.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete pitch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Static Address & Google Maps reference */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {field.address || 'Address not registered'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-200">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Google Maps Link</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => onSelectFieldMap(field)}
                        className="text-slate-600 hover:text-slate-900 underline"
                      >
                        View Map Details
                      </button>
                    </div>
                  </div>

                  {/* Which divisions that field is used in */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Used In Divisions ({assignedDivs.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedDivs.map((d: any) => (
                        <span
                          key={d.id}
                          className="px-2 py-0.5 text-xs font-medium text-slate-700 bg-slate-100 rounded border border-slate-200"
                        >
                          {d.name}
                        </span>
                      ))}
                      {assignedDivs.length === 0 && (
                        <span className="text-xs text-slate-400 italic">Open to all divisions</span>
                      )}
                    </div>
                  </div>

                  {/* Unavailable / Blackout Dates */}
                  {field.blackoutDates && field.blackoutDates.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        <span>Blocked Dates ({field.blackoutDates.length})</span>
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {field.blackoutDates.map((date) => (
                          <span
                            key={date}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-rose-800 bg-rose-50 rounded border border-rose-200"
                          >
                            <span>{date}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleFieldBlackout(field, date)}
                              className="text-rose-400 hover:text-rose-700"
                              title="Remove blackout"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50/70 p-2 rounded border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Zero blackout dates · Full season availability</span>
                    </div>
                  )}

                  {/* Notes */}
                  {field.notes && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-2">
                      "{field.notes}"
                    </p>
                  )}
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('matrix');
                    }}
                    className="text-emerald-700 hover:text-emerald-900 font-medium inline-flex items-center gap-1"
                  >
                    <Grid className="w-3 h-3" />
                    <span>View in Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(field)}
                    className="font-medium text-slate-700 hover:text-slate-900"
                  >
                    Edit Specifications
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= WARNING MODAL: BLOCKING DATE WITH SCHEDULED GAMES ================= */}
      {conflictWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-amber-50 flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Games Scheduled on this Date!
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Blocking this pitch will cause schedule conflict flags.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                You are about to add a blackout date on <strong className="text-slate-900">{conflictWarning.date}</strong> for{' '}
                <strong className="text-slate-900">{conflictWarning.field.name}</strong>.
              </p>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Affected Scheduled Matches ({conflictWarning.games.length}):
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                  {conflictWarning.games.map((g) => {
                    const home = teamMap.get(g.homeTeamId);
                    const away = teamMap.get(g.awayTeamId);
                    const div = divisionMap.get(g.divisionId);
                    return (
                      <div
                        key={g.id}
                        className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {home?.name || 'Home'} vs {away?.name || 'Away'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {div?.name || 'Division'} · Kickoff: {g.time}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                          {g.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-slate-500 italic">
                If confirmed, the scheduler conflict detector will mark these games in red on the schedule table so you can reassign them to an alternate pitch.
              </p>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setConflictWarning(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConflictBlackout}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Confirm Blackout Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT / CREATE FIELD MODAL ================= */}
      {(editingField || isCreatingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">
                {isCreatingNew ? 'Register New Pitch' : `Edit Pitch: ${editingField?.name}`}
              </h3>
              <button
                onClick={() => {
                  setEditingField(null);
                  setIsCreatingNew(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Field / Pitch Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Memorial Park - Pitch 1"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Size specification */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Field Size Specification
                  </label>
                  <select
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  >
                    <option value="11v11 Full">11v11 Full Regulation</option>
                    <option value="9v9 Intermediate">9v9 Intermediate</option>
                    <option value="7v7 Small">7v7 Small-sided</option>
                    <option value="5v5 Futsal">5v5 Futsal / Cage</option>
                    <option value="4v4 Micro">4v4 Micro Grassroots</option>
                  </select>
                </div>

                {/* Surface type */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Surface Type
                  </label>
                  <select
                    value={formSurface}
                    onChange={(e) => setFormSurface(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  >
                    <option value="Natural Grass">Natural Grass</option>
                    <option value="Artificial Turf">Artificial Turf</option>
                    <option value="Indoor / Futsal">Indoor / Futsal</option>
                    <option value="Hybrid">Hybrid Pitch</option>
                  </select>
                </div>
              </div>

              {/* Static Address */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Static Street Address
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 1400 Olympic Blvd, Los Angeles, CA 90064"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2"
                  required
                />
              </div>

              {/* Google Maps link / coordinates */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Google Map Reference URL (Optional)
                </label>
                <input
                  type="url"
                  value={formMapsUrl}
                  onChange={(e) => setFormMapsUrl(e.target.value)}
                  placeholder="https://www.google.com/maps/search/?api=1&query=..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2"
                />
              </div>

              {/* Assigned to Multiple Divisions */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assigned Divisions (Available to one or more divisions)
                </label>
                <div className="space-y-1 border border-slate-200 rounded-lg p-2.5 max-h-36 overflow-y-auto">
                  {appData.divisions.map((d) => {
                    const isChecked = formDivisionIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 p-1 text-xs text-slate-800 hover:bg-slate-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDivision(d.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="font-medium">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Blackout Dates Specification */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Dates When Field is Not Available (Blackouts)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formBlackoutDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono tabular-nums text-rose-800 bg-rose-50 rounded border border-rose-200"
                    >
                      <Lock className="w-3 h-3 text-rose-600" />
                      <span>{date}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlackoutDate(date)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {formBlackoutDates.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No blackout dates set</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newBlackoutDate}
                    onChange={(e) => setNewBlackoutDate(e.target.value)}
                    className="text-xs rounded-lg border border-slate-300 p-1.5 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddBlackoutDate}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                  >
                    Add Blackout Date
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Field Notes & Facilities
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Floodlights, spectator bleachers, parking instructions..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2"
                />
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingField(null);
                    setIsCreatingNew(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Save Pitch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
