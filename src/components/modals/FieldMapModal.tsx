import React from 'react';
import { Division, Field } from '../../types';
import { X, MapPin, ExternalLink, Calendar, Layers, ShieldAlert } from 'lucide-react';

interface FieldMapModalProps {
  field: Field | null;
  divisions: Division[];
  onClose: () => void;
  onEditField?: (field: Field) => void;
}

export const FieldMapModal: React.FC<FieldMapModalProps> = ({
  field,
  divisions,
  onClose,
  onEditField,
}) => {
  if (!field) return null;

  const assignedDivisions = divisions.filter((d) => field.assignedDivisionIds?.includes(d.id));
  const mapsUrl =
    field.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.address || field.name)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">{field.name}</h3>
              <p className="text-xs text-slate-500">
                {field.size} · {field.surfaceType || 'Pitch'}
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
          {/* Static Address & Map Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Field Location & Directions
            </h4>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 leading-snug">
                    {field.address || 'Address not registered'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Static street address for coaches, players, and match referees.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Maps</span>
                </a>
                <span className="text-xs text-slate-400">Live GPS navigation & directions</span>
              </div>
            </div>
          </div>

          {/* Assigned Divisions */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Assigned Divisions ({assignedDivisions.length})</span>
            </div>
            {assignedDivisions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {assignedDivisions.map((div) => (
                  <span
                    key={div.id}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md border border-slate-200"
                  >
                    {div.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">This field is not currently restricted to specific divisions.</p>
            )}
          </div>

          {/* Blackout Dates */}
          {field.blackoutDates && field.blackoutDates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Field Unavailable Dates ({field.blackoutDates.length})</span>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1">
                <p className="text-xs text-amber-800">
                  Games will not be scheduled on this pitch on the following blackout dates:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {field.blackoutDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono tabular-nums text-amber-900 bg-amber-100 rounded border border-amber-300"
                    >
                      <Calendar className="w-3 h-3 text-amber-700" />
                      {date}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Field Notes */}
          {field.notes && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Field Facilities & Notes
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                {field.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          {onEditField && (
            <button
              onClick={() => {
                onClose();
                onEditField(field);
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Edit Field Details
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
