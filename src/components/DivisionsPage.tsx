import React, { useState } from 'react';
import { AppData, DayOfWeek, Division, Field, Team } from '../types';
import {
  Layers,
  Plus,
  Clock,
  Calendar,
  MapPin,
  Users,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronRight,
} from 'lucide-react';

interface DivisionsPageProps {
  appData: AppData;
  onSaveDivision: (division: Division) => void;
  onDeleteDivision: (divisionId: string) => void;
  onSelectTeam: (team: Team) => void;
  onSelectField: (field: Field) => void;
  isReadOnly?: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DivisionsPage: React.FC<DivisionsPageProps> = ({
  appData,
  onSaveDivision,
  onDeleteDivision,
  onSelectTeam,
  onSelectField,
  isReadOnly = false,
}) => {
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDays, setFormDays] = useState<DayOfWeek[]>([6]);
  const [formSlots, setFormSlots] = useState<string[]>(['09:00', '10:30', '12:00']);
  const [formNewSlot, setFormNewSlot] = useState('13:30');
  const [formFieldIds, setFormFieldIds] = useState<string[]>([]);
  const [formDuration, setFormDuration] = useState('60');

  const teamMap = new Map(appData.teams.map((t) => [t.id, t]));
  const fieldMap = new Map(appData.fields.map((f) => [f.id, f]));

  const handleOpenEdit = (div: Division) => {
    if (isReadOnly) return;
    setEditingDivision(div);
    setIsCreatingNew(false);
    setFormName(div.name);
    setFormDays([...div.playDays]);
    setFormSlots([...div.playTimeSlots]);
    setFormFieldIds([...div.fieldIds]);
    setFormDuration(String(div.matchDurationMinutes || 60));
  };

  const handleOpenCreate = () => {
    if (isReadOnly) return;
    setIsCreatingNew(true);
    setEditingDivision(null);
    setFormName('');
    setFormDays([6]);
    setFormSlots(['09:00', '10:30', '12:00']);
    setFormFieldIds(appData.fields.map((f) => f.id));
    setFormDuration('60');
  };

  const handleToggleDay = (day: DayOfWeek) => {
    if (formDays.includes(day)) {
      if (formDays.length === 1) return; // Must have at least 1 day
      setFormDays(formDays.filter((d) => d !== day));
    } else {
      setFormDays([...formDays, day].sort());
    }
  };

  const handleToggleField = (fieldId: string) => {
    if (formFieldIds.includes(fieldId)) {
      setFormFieldIds(formFieldIds.filter((id) => id !== fieldId));
    } else {
      setFormFieldIds([...formFieldIds, fieldId]);
    }
  };

  const handleAddSlot = () => {
    if (!formNewSlot || formSlots.includes(formNewSlot)) return;
    setFormSlots([...formSlots, formNewSlot].sort());
  };

  const handleRemoveSlot = (slot: string) => {
    if (formSlots.length === 1) return; // Keep at least one
    setFormSlots(formSlots.filter((s) => s !== slot));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const divToSave: Division = {
      id: editingDivision ? editingDivision.id : `div-${Date.now()}`,
      name: formName.trim(),
      playDays: formDays,
      playTimeSlots: formSlots,
      fieldIds: formFieldIds,
      matchDurationMinutes: Number(formDuration) || 60,
    };

    onSaveDivision(divToSave);
    setEditingDivision(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Divisions & Leagues</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure play days of week, kickoff time slots, assigned pitches, and registered teams.
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Division</span>
          </button>
        )}
      </div>

      {/* Divisions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appData.divisions.map((division) => {
          const registeredTeams = appData.teams.filter(
            (t) => t.divisionId === division.id && !t.isBye
          );
          const usedFields = division.fieldIds.map((fId) => fieldMap.get(fId)).filter(Boolean) as Field[];

          return (
            <div
              key={division.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-shadow"
            >
              {/* Division Title & Controls */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {division.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      {division.matchDurationMinutes} min matches · {registeredTeams.length} Teams
                    </p>
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(division)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        title="Edit division"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete division "${division.name}"? This will not delete teams, but they will become unassigned.`
                            )
                          ) {
                            onDeleteDivision(division.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete division"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Play Days */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Play Days
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {SHORT_DAY_NAMES.map((dayName, idx) => {
                      const isPlayDay = division.playDays.includes(idx as DayOfWeek);
                      return (
                        <span
                          key={dayName}
                          className={`px-2 py-0.5 text-[11px] rounded font-medium ${
                            isPlayDay
                              ? 'bg-emerald-100 text-emerald-800 font-semibold'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {dayName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Kickoff Times */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Kickoff Time Slots
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {division.playTimeSlots.map((time) => (
                      <span
                        key={time}
                        className="px-2 py-0.5 text-xs font-mono tabular-nums text-slate-700 bg-slate-100 rounded border border-slate-200"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Registered Teams (Clickable to view/edit) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Registered Teams ({registeredTeams.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 lowercase font-normal">click to view</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => onSelectTeam(team)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-slate-100 hover:text-emerald-700 rounded-md border border-slate-200 transition-colors text-left"
                        title="Click to view/edit team details"
                      >
                        {team.name}
                      </button>
                    ))}
                    {registeredTeams.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No teams registered</span>
                    )}
                  </div>
                </div>

                {/* Used Fields (Clickable to view/edit) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Approved Pitches ({usedFields.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 lowercase font-normal">click to view</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {usedFields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => onSelectField(field)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition-colors text-left"
                        title="Click to view/edit pitch and location"
                      >
                        {field.name}
                      </button>
                    ))}
                    {usedFields.length === 0 && (
                      <span className="text-xs text-slate-400 italic">No pitches assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(division)}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <span>Edit Schedule Rules</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Division Modal */}
      {(editingDivision || isCreatingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">
                {isCreatingNew ? 'Create New Division' : `Edit Division: ${editingDivision?.name}`}
              </h3>
              <button
                onClick={() => {
                  setEditingDivision(null);
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
                  Division Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. U12 Boys Premier"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              {/* Match duration */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Match Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 font-mono tabular-nums"
                  required
                />
              </div>

              {/* Play Days */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Days Played On (Select all that apply)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {DAY_NAMES.map((name, idx) => {
                    const isSelected = formDays.includes(idx as DayOfWeek);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleToggleDay(idx as DayOfWeek)}
                        className={`p-2 text-xs rounded-lg font-medium border text-center transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {SHORT_DAY_NAMES[idx]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kickoff Time Slots
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formSlots.map((slot) => (
                    <span
                      key={slot}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium text-slate-800 bg-slate-100 rounded border border-slate-200"
                    >
                      <span>{slot}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={formNewSlot}
                    onChange={(e) => setFormNewSlot(e.target.value)}
                    className="text-xs rounded-lg border border-slate-300 p-1.5 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                  >
                    Add Time Slot
                  </button>
                </div>
              </div>

              {/* Available Fields */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fields Usable by this Division
                </label>
                <div className="space-y-1.5 border border-slate-200 rounded-lg p-2.5 max-h-40 overflow-y-auto">
                  {appData.fields.map((f) => {
                    const isChecked = formFieldIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 p-1 text-xs text-slate-800 hover:bg-slate-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleField(f.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="font-medium">{f.name}</span>
                        <span className="text-slate-400">· {f.size}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDivision(null);
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
                  Save Division
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
