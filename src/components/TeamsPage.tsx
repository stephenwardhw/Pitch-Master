import React, { useState } from 'react';
import { AppData, Field, Team, TeamSizeOption } from '../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Sliders,
  X,
  Shield,
  Layers,
} from 'lucide-react';

interface TeamsPageProps {
  appData: AppData;
  onSaveTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onOpenManageTeamSizes: () => void;
  onSelectTeamContact: (team: Team, divisionName?: string) => void;
  onSelectField: (field: Field) => void;
}

export const TeamsPage: React.FC<TeamsPageProps> = ({
  appData,
  onSaveTeam,
  onDeleteTeam,
  onOpenManageTeamSizes,
  onSelectTeamContact,
  onSelectField,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDivisionId, setFormDivisionId] = useState('');
  const [formSizeId, setFormSizeId] = useState('');
  const [formPrimaryFieldId, setFormPrimaryFieldId] = useState('');
  const [formAltFieldIds, setFormAltFieldIds] = useState<string[]>([]);
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formJerseyColor, setFormJerseyColor] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d]));
  const fieldMap = new Map(appData.fields.map((f) => [f.id, f]));
  const sizeMap = new Map(appData.teamSizes.map((s) => [s.id, s]));

  const filteredTeams = appData.teams.filter((t) => {
    if (t.isBye) return false;
    if (selectedDivision !== 'all' && t.divisionId !== selectedDivision) return false;
    return true;
  });

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setIsCreatingNew(false);
    setFormName(team.name);
    setFormDivisionId(team.divisionId);
    setFormSizeId(team.sizeId || appData.teamSizes[0]?.id || '');
    setFormPrimaryFieldId(team.primaryHomeFieldId || appData.fields[0]?.id || '');
    setFormAltFieldIds([...team.alternateHomeFieldIds]);
    setFormContactName(team.contactName || '');
    setFormContactPhone(team.contactPhone || '');
    setFormContactEmail(team.contactEmail || '');
    setFormJerseyColor(team.jerseyColor || '');
    setFormNotes(team.notes || '');
  };

  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingTeam(null);
    setFormName('');
    setFormDivisionId(appData.divisions[0]?.id || '');
    setFormSizeId(appData.teamSizes[0]?.id || '');
    setFormPrimaryFieldId(appData.fields[0]?.id || '');
    setFormAltFieldIds([]);
    setFormContactName('');
    setFormContactPhone('');
    setFormContactEmail('');
    setFormJerseyColor('');
    setFormNotes('');
  };

  const handleToggleAltField = (fieldId: string) => {
    if (formAltFieldIds.includes(fieldId)) {
      setFormAltFieldIds(formAltFieldIds.filter((id) => id !== fieldId));
    } else {
      setFormAltFieldIds([...formAltFieldIds, fieldId]);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const teamToSave: Team = {
      id: editingTeam ? editingTeam.id : `t-${Date.now()}`,
      name: formName.trim(),
      divisionId: formDivisionId,
      sizeId: formSizeId,
      primaryHomeFieldId: formPrimaryFieldId,
      alternateHomeFieldIds: formAltFieldIds.filter((id) => id !== formPrimaryFieldId),
      contactName: formContactName.trim(),
      contactPhone: formContactPhone.trim(),
      contactEmail: formContactEmail.trim(),
      jerseyColor: formJerseyColor.trim(),
      notes: formNotes.trim(),
    };

    onSaveTeam(teamToSave);
    setEditingTeam(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Teams & Rosters</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage divisions, primary/alternate home pitches for conflict resolution, and coach contact details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Editable Team Sizes Button */}
          <button
            onClick={onOpenManageTeamSizes}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Team Sizes</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Team</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <label className="font-medium text-slate-600">Filter by Division:</label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Divisions ({appData.divisions.length})</option>
            {appData.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-500 font-mono tabular-nums">
          {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'} registered
        </span>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => {
          const division = divisionMap.get(team.divisionId);
          const size = sizeMap.get(team.sizeId);
          const primaryField = fieldMap.get(team.primaryHomeFieldId);
          const altFields = team.alternateHomeFieldIds.map((id) => fieldMap.get(id)).filter(Boolean) as Field[];

          return (
            <div
              key={team.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-shadow"
            >
              <div className="space-y-3">
                {/* Team Name & Division Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {team.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {division?.name || 'Unassigned Division'} {team.jerseyColor && `· ${team.jerseyColor}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(team)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="Edit team details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete team "${team.name}"?`)) {
                          onDeleteTeam(team.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Delete team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Team Size Specification */}
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">
                    Format:
                  </span>
                  <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {size ? `${size.name} (${size.playersPerSide}v${size.playersPerSide})` : 'Standard'}
                  </span>
                </div>

                {/* Home Pitches */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-700">Primary Home:</span>
                    {primaryField ? (
                      <button
                        type="button"
                        onClick={() => onSelectField(primaryField)}
                        className="text-slate-900 font-medium hover:underline hover:text-blue-700 truncate max-w-[170px]"
                        title="View pitch map"
                      >
                        {primaryField.name}
                      </button>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>

                  {/* Alternate fields */}
                  {altFields.length > 0 && (
                    <div className="pl-5 text-[11px] text-slate-500 space-y-0.5">
                      <span className="font-medium text-slate-600">Alternates for conflicts:</span>
                      <div className="flex flex-wrap gap-1">
                        {altFields.map((af) => (
                          <button
                            key={af.id}
                            type="button"
                            onClick={() => onSelectField(af)}
                            className="bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700"
                          >
                            {af.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coach & Contact Information (Linked on schedule) */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-[11px]">
                      {team.contactName || 'Team Contact'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectTeamContact(team, division?.name)}
                      className="text-[11px] text-emerald-700 hover:underline font-medium"
                    >
                      View Profile
                    </button>
                  </div>

                  {team.contactPhone && (
                    <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{team.contactPhone}</span>
                    </div>
                  )}

                  {team.contactEmail && (
                    <div className="flex items-center gap-1.5 text-slate-600 text-[11px] truncate">
                      <Mail className="w-3 h-3 text-blue-600" />
                      <span className="truncate">{team.contactEmail}</span>
                    </div>
                  )}
                </div>

                {/* Notes preview */}
                {team.notes && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                    "{team.notes}"
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(team)}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  Edit Profile & Pitch Preferences
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Team Modal */}
      {(editingTeam || isCreatingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">
                {isCreatingNew ? 'Register New Team' : `Edit Team: ${editingTeam?.name}`}
              </h3>
              <button
                onClick={() => {
                  setEditingTeam(null);
                  setIsCreatingNew(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Pacific Strikers"
                  className="w-full text-sm rounded-lg border border-slate-300 p-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Division */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assigned Division
                  </label>
                  <select
                    value={formDivisionId}
                    onChange={(e) => setFormDivisionId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                    required
                  >
                    {appData.divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Team Size Specification */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Team Size</label>
                    <button
                      type="button"
                      onClick={onOpenManageTeamSizes}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Edit Sizes
                    </button>
                  </div>
                  <select
                    value={formSizeId}
                    onChange={(e) => setFormSizeId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                    required
                  >
                    {appData.teamSizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.playersPerSide}v{s.playersPerSide})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Primary Home Field */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Home Pitch (for home matches)
                </label>
                <select
                  value={formPrimaryFieldId}
                  onChange={(e) => setFormPrimaryFieldId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  required
                >
                  {appData.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.size})
                    </option>
                  ))}
                </select>
              </div>

              {/* Alternate Home Fields */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alternate Pitches (for scheduler conflict resolution)
                </label>
                <div className="space-y-1 border border-slate-200 rounded-lg p-2.5 max-h-32 overflow-y-auto">
                  {appData.fields
                    .filter((f) => f.id !== formPrimaryFieldId)
                    .map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-2 p-1 text-xs text-slate-800 hover:bg-slate-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formAltFieldIds.includes(f.id)}
                          onChange={() => handleToggleAltField(f.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span>{f.name}</span>
                        <span className="text-slate-400">· {f.size}</span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Contact Information & Notes Section */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Coach & Contact Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Coach Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Marco Rossi"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Jersey Colors</label>
                    <input
                      type="text"
                      placeholder="e.g. Royal Blue / White"
                      value={formJerseyColor}
                      onChange={(e) => setFormJerseyColor(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. (310) 555-0144"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. coach@team.org"
                      value={formContactEmail}
                      onChange={(e) => setFormContactEmail(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">
                    Team Notes (linked on schedule page)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter additional contact details, assistant coach info, or team preferences..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full text-xs rounded border border-slate-300 p-2 bg-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeam(null);
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
                  Save Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
