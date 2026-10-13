import React, { useState } from 'react';
import { TeamSizeOption } from '../../types';
import { X, Plus, Trash2, Edit2, Users, Check } from 'lucide-react';

interface ManageTeamSizesModalProps {
  teamSizes: TeamSizeOption[];
  onSaveTeamSizes: (updatedSizes: TeamSizeOption[]) => void;
  onClose: () => void;
}

export const ManageTeamSizesModal: React.FC<ManageTeamSizesModalProps> = ({
  teamSizes,
  onSaveTeamSizes,
  onClose,
}) => {
  const [sizes, setSizes] = useState<TeamSizeOption[]>([...teamSizes]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New size form
  const [newName, setNewName] = useState('');
  const [newPlayers, setNewPlayers] = useState('7');
  const [newRoster, setNewRoster] = useState('12');
  const [newDesc, setNewDesc] = useState('');

  // Editing state
  const [editName, setEditName] = useState('');
  const [editPlayers, setEditPlayers] = useState('');
  const [editRoster, setEditRoster] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleStartEdit = (s: TeamSizeOption) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPlayers(String(s.playersPerSide));
    setEditRoster(String(s.typicalRoster));
    setEditDesc(s.description || '');
  };

  const handleSaveEdit = (id: string) => {
    const updated = sizes.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          name: editName.trim() || s.name,
          playersPerSide: Number(editPlayers) || s.playersPerSide,
          typicalRoster: Number(editRoster) || s.typicalRoster,
          description: editDesc.trim(),
        };
      }
      return s;
    });
    setSizes(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (sizes.length <= 1) {
      alert('You must have at least one team size specification.');
      return;
    }
    setSizes(sizes.filter((s) => s.id !== id));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newOption: TeamSizeOption = {
      id: `size-${Date.now()}`,
      name: newName.trim(),
      playersPerSide: Number(newPlayers) || 11,
      typicalRoster: Number(newRoster) || 16,
      description: newDesc.trim(),
    };

    setSizes([...sizes, newOption]);
    setNewName('');
    setNewPlayers('7');
    setNewRoster('12');
    setNewDesc('');
  };

  const handleFinish = () => {
    onSaveTeamSizes(sizes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                Manage Team Size Specifications
              </h3>
              <p className="text-xs text-slate-500">
                Customizable squad sizes, players per side, and roster limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Current sizes list */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Team Sizes ({sizes.length})
            </h4>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
              {sizes.map((s) => {
                const isEditing = editingId === s.id;

                if (isEditing) {
                  return (
                    <div key={s.id} className="p-3.5 bg-slate-50 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="text-[11px] text-slate-500">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">Players/Side</label>
                          <input
                            type="number"
                            value={editPlayers}
                            onChange={(e) => setEditPlayers(e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">Max Roster</label>
                          <input
                            type="number"
                            value={editRoster}
                            onChange={(e) => setEditRoster(e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-mono tabular-nums"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500">Description</label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(s.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs text-white bg-emerald-600 rounded hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={s.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{s.name}</span>
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
                          {s.playersPerSide}v{s.playersPerSide} · Roster: {s.typicalRoster}
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded"
                        title="Edit size specification"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="Delete size specification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add new size form */}
          <form onSubmit={handleAdd} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Add New Team Size Option</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">Size Name</label>
                <input
                  type="text"
                  placeholder="e.g. 8v8 Middle"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Players/Side</label>
                <input
                  type="number"
                  min="2"
                  max="22"
                  value={newPlayers}
                  onChange={(e) => setNewPlayers(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white font-mono tabular-nums"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Typical Roster</label>
                <input
                  type="number"
                  min="2"
                  max="35"
                  value={newRoster}
                  onChange={(e) => setNewRoster(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Grassroots tournament size"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Specification</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleFinish}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
