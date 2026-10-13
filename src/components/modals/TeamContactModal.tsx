import React from 'react';
import { Field, Team } from '../../types';
import { X, Phone, Mail, User, Shield, MapPin, FileText } from 'lucide-react';

interface TeamContactModalProps {
  team: Team | null;
  fields: Field[];
  divisionName?: string;
  onClose: () => void;
  onEditTeam?: (team: Team) => void;
}

export const TeamContactModal: React.FC<TeamContactModalProps> = ({
  team,
  fields,
  divisionName,
  onClose,
  onEditTeam,
}) => {
  if (!team) return null;

  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const primaryField = fieldMap.get(team.primaryHomeFieldId);
  const altFields = team.alternateHomeFieldIds.map((id) => fieldMap.get(id)).filter(Boolean) as Field[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">{team.name}</h3>
              <p className="text-xs text-slate-500">
                {divisionName || 'Team Profile'} {team.jerseyColor && `· Jersey: ${team.jerseyColor}`}
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
          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contact Information
            </h4>
            
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2.5">
              {team.contactName ? (
                <div className="flex items-center gap-2 text-sm text-slate-800">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-900">{team.contactName}</span>
                  <span className="text-xs text-slate-500">(Head Coach / Manager)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500 italic">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>No primary contact name specified</span>
                </div>
              )}

              {team.contactPhone ? (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <a
                    href={`tel:${team.contactPhone}`}
                    className="font-mono text-emerald-700 hover:underline hover:text-emerald-800 tabular-nums"
                  >
                    {team.contactPhone}
                  </a>
                </div>
              ) : null}

              {team.contactEmail ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <a
                    href={`mailto:${team.contactEmail}`}
                    className="text-blue-700 hover:underline hover:text-blue-800 break-all"
                  >
                    {team.contactEmail}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Notes Section (linked on schedule) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Team Notes & Coach Details</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {team.notes?.trim() ? team.notes : 'No specific notes recorded for this team.'}
            </div>
          </div>

          {/* Home Pitch & Alternates */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Home Pitches
            </h4>
            <div className="space-y-2 text-sm">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-emerald-700">Primary Home Pitch</div>
                    <div className="font-semibold text-slate-900">
                      {primaryField?.name || 'Unassigned'}
                    </div>
                    {primaryField?.address && (
                      <div className="text-xs text-slate-500 mt-0.5">{primaryField.address}</div>
                    )}
                  </div>
                </div>
              </div>

              {altFields.length > 0 && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs font-medium text-slate-600 mb-1.5">
                    Alternate Pitches for Conflicts ({altFields.length})
                  </div>
                  <div className="space-y-1">
                    {altFields.map((f) => (
                      <div key={f.id} className="text-xs text-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{f.name}</span>
                        <span className="text-slate-400">· {f.size}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          {onEditTeam && !team.isBye && (
            <button
              onClick={() => {
                onClose();
                onEditTeam(team);
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Edit Team Profile
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
