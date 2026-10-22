import React, { useState, useMemo } from 'react';
import { Referee, RefereeCertificationOption } from '../../types';
import { DEFAULT_REFEREE_CERTIFICATIONS } from '../../utils/cookieStorage';
import { X, Plus, Trash2, Edit2, Check, Award, AlertTriangle, RotateCcw, ShieldCheck, Info } from 'lucide-react';

interface ManageCertificationsModalProps {
  certifications: RefereeCertificationOption[];
  referees: Referee[];
  onSaveCertifications: (
    updatedCertifications: RefereeCertificationOption[],
    renamedMap?: Record<string, string>
  ) => void;
  onClose: () => void;
}

export const ManageCertificationsModal: React.FC<ManageCertificationsModalProps> = ({
  certifications,
  referees,
  onSaveCertifications,
  onClose,
}) => {
  const [certList, setCertList] = useState<RefereeCertificationOption[]>(() => {
    return certifications && certifications.length > 0 ? certifications : DEFAULT_REFEREE_CERTIFICATIONS;
  });

  // Track renames from originalName -> newName
  const [renames, setRenames] = useState<Record<string, string>>({});

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // New certification form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBadge, setNewBadge] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Deletion reassignment modal/state
  const [deletingCert, setDeletingCert] = useState<RefereeCertificationOption | null>(null);
  const [reassignTargetName, setReassignTargetName] = useState<string>('');

  // Count referees holding each certification
  const certRefereeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    certList.forEach((c) => {
      counts[c.name] = 0;
    });
    referees.forEach((r) => {
      counts[r.certificationLevel] = (counts[r.certificationLevel] || 0) + 1;
    });
    return counts;
  }, [certList, referees]);

  const handleStartEdit = (cert: RefereeCertificationOption) => {
    setEditingId(cert.id);
    setEditName(cert.name);
    setEditBadge(cert.badgeCode || '');
    setEditDesc(cert.description || '');
    setErrorMsg(null);
  };

  const handleSaveEdit = (cert: RefereeCertificationOption) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setErrorMsg('Certification name cannot be empty.');
      return;
    }

    // Check for duplicate name
    if (
      certList.some(
        (c) => c.id !== cert.id && c.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setErrorMsg(`A certification named "${trimmedName}" already exists.`);
      return;
    }

    const oldName = cert.name;
    const isRenamed = oldName !== trimmedName;

    const updated = certList.map((c) => {
      if (c.id === cert.id) {
        return {
          ...c,
          name: trimmedName,
          badgeCode: editBadge.trim() || undefined,
          description: editDesc.trim() || undefined,
        };
      }
      return c;
    });

    if (isRenamed) {
      setRenames((prev) => ({
        ...prev,
        [oldName]: trimmedName,
      }));
    }

    setCertList(updated);
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleAddNewCert = () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a certification name.');
      return;
    }

    if (certList.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorMsg(`Certification "${trimmedName}" already exists.`);
      return;
    }

    const newOption: RefereeCertificationOption = {
      id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      badgeCode: newBadge.trim() || undefined,
      description: newDesc.trim() || undefined,
      isDefault: false,
    };

    setCertList([...certList, newOption]);
    setNewName('');
    setNewBadge('');
    setNewDesc('');
    setIsAddingNew(false);
    setErrorMsg(null);
  };

  const handlePromptDelete = (cert: RefereeCertificationOption) => {
    if (certList.length <= 1) {
      setErrorMsg('You must have at least one certification level in the system.');
      return;
    }

    const assignedCount = certRefereeCounts[cert.name] || 0;
    if (assignedCount > 0) {
      // Find default fallback target
      const otherCerts = certList.filter((c) => c.id !== cert.id);
      setReassignTargetName(otherCerts[0]?.name || '');
      setDeletingCert(cert);
    } else {
      // No assigned referees, delete directly
      setCertList(certList.filter((c) => c.id !== cert.id));
    }
    setErrorMsg(null);
  };

  const handleConfirmReassignedDelete = () => {
    if (!deletingCert || !reassignTargetName) return;

    // Track rename/reassignment from deletingCert.name -> reassignTargetName
    setRenames((prev) => ({
      ...prev,
      [deletingCert.name]: reassignTargetName,
    }));

    setCertList(certList.filter((c) => c.id !== deletingCert.id));
    setDeletingCert(null);
    setReassignTargetName('');
  };

  const handleResetToDefaults = () => {
    if (
      window.confirm(
        'Reset referee certification list to standard USSF & FIFA defaults? Custom certification entries will be replaced.'
      )
    ) {
      setCertList([...DEFAULT_REFEREE_CERTIFICATIONS]);
      setErrorMsg(null);
    }
  };

  const handleSaveAllAndClose = () => {
    onSaveCertifications(certList, renames);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Referee Certification Levels
              </h2>
              <p className="text-xs text-slate-500">
                Configure official grades, license tiers, badge codes, and qualifying descriptions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-500 hover:text-rose-800 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Quick Notice */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Certification tiers are used when registering officials, filtering assignments, and matching referees to division age groups. Renaming an existing certification will automatically update all registered referees currently holding that level.
            </p>
          </div>

          {/* Certifications List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configured Certification Tiers ({certList.length})
              </span>
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline"
                title="Restore default USSF and FIFA certification tiers"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="space-y-2">
              {certList.map((cert) => {
                const isEditing = editingId === cert.id;
                const assignedCount = certRefereeCounts[cert.name] || 0;

                if (isEditing) {
                  return (
                    <div
                      key={cert.id}
                      className="p-3.5 rounded-xl border border-emerald-400 bg-emerald-50/20 shadow-xs space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Certification Name *
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="e.g. Grassroots / Grade 8"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Badge Code (Optional)
                          </label>
                          <input
                            type="text"
                            value={editBadge}
                            onChange={(e) => setEditBadge(e.target.value)}
                            placeholder="e.g. USSF-8"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Description & Qualifications
                        </label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Brief description of matches or age tiers qualified to officiate"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cert)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply Changes</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cert.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {cert.name}
                        </span>

                        {cert.badgeCode && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {cert.badgeCode}
                          </span>
                        )}

                        <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {assignedCount} {assignedCount === 1 ? 'referee' : 'referees'}
                        </span>
                      </div>

                      {cert.description && (
                        <p className="text-[11px] text-slate-500 truncate max-w-lg">
                          {cert.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cert)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit certification tier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePromptDelete(cert)}
                        disabled={certList.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={
                          certList.length <= 1
                            ? 'Cannot delete the only remaining certification tier'
                            : 'Delete certification tier'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Certification Section */}
          {isAddingNew ? (
            <div className="p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Create New Certification Tier</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Certification / Grade Title *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. State Referee / Grade 5, AYSO Advanced"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Badge Code
                  </label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    placeholder="e.g. USSF-5, AYSO-ADV"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Description & Officiating Scope
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Certified for senior competitive matches and state tournaments"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewCert}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Certification</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(true);
                setErrorMsg(null);
              }}
              className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50/50 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Add Custom Certification Level</span>
            </button>
          )}

          {/* Deletion & Reassignment Confirmation Sub-modal */}
          {deletingCert && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-xs text-amber-950 block">
                    Reassign Officials for "{deletingCert.name}"
                  </span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    There are <strong>{certRefereeCounts[deletingCert.name]}</strong> registered official(s) currently assigned to this certification level. Please select which certification to reassign them to before deleting:
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  New Certification Tier for Assigned Officials:
                </label>
                <select
                  value={reassignTargetName}
                  onChange={(e) => setReassignTargetName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                >
                  {certList
                    .filter((c) => c.id !== deletingCert.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setDeletingCert(null)}
                  className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReassignedDelete}
                  className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs"
                >
                  Reassign & Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAllAndClose}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Save Certifications</span>
          </button>
        </div>
      </div>
    </div>
  );
};
