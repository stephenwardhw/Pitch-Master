import React, { useState } from 'react';
import { AppData, Field } from '../types';
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
} from 'lucide-react';

interface FieldsPageProps {
  appData: AppData;
  onSaveField: (field: Field) => void;
  onDeleteField: (fieldId: string) => void;
  onSelectFieldMap: (field: Field) => void;
}

export const FieldsPage: React.FC<FieldsPageProps> = ({
  appData,
  onSaveField,
  onDeleteField,
  onSelectFieldMap,
}) => {
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapsUrl, setFormMapsUrl] = useState('');
  const [formSize, setFormSize] = useState('11v11 Full');
  const [formSurface, setFormSurface] = useState<Field['surfaceType']>('Natural Grass');
  const [formDivisionIds, setFormDivisionIds] = useState<string[]>([]);
  const [formBlackoutDates, setFormBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d]));

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
    setFormDivisionIds(appData.divisions.map((d) => d.id)); // assign to all by default
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pitches & Facilities</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specify sizes, street addresses, Google Maps references, multiple division assignments, and blackout dates.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Pitch</span>
        </button>
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appData.fields.map((field) => {
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
                {field.blackoutDates && field.blackoutDates.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Blackout Dates ({field.blackoutDates.length})</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {field.blackoutDates.map((date) => (
                        <span
                          key={date}
                          className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-amber-800 bg-amber-50 rounded border border-amber-200"
                        >
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {field.notes && (
                  <p className="text-[11px] text-slate-500 italic line-clamp-2">
                    "{field.notes}"
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(field)}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  Edit Pitch & Blackouts
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Field Modal */}
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
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono tabular-nums text-amber-800 bg-amber-50 rounded border border-amber-200"
                    >
                      <Calendar className="w-3 h-3 text-amber-600" />
                      <span>{date}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlackoutDate(date)}
                        className="text-amber-500 hover:text-rose-600"
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
