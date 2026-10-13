import React, { useState } from 'react';
import { Division, Field, Game, Team } from '../../types';
import { X, Calendar, Clock, MapPin, ArrowRightLeft } from 'lucide-react';

interface EditGameModalProps {
  game: Game | null;
  divisions: Division[];
  teams: Team[];
  fields: Field[];
  onSave: (updatedGame: Game) => void;
  onClose: () => void;
}

export const EditGameModal: React.FC<EditGameModalProps> = ({
  game,
  divisions,
  teams,
  fields,
  onSave,
  onClose,
}) => {
  if (!game) return null;

  const [date, setDate] = useState(game.date);
  const [time, setTime] = useState(game.time);
  const [fieldId, setFieldId] = useState(game.fieldId);
  const [homeTeamId, setHomeTeamId] = useState(game.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState(game.awayTeamId);
  const [isByePractice, setIsByePractice] = useState(game.isByePractice);
  const [status, setStatus] = useState<Game['status']>(game.status);
  const [notes, setNotes] = useState(game.notes || '');

  // Teams in this division
  const currentDivision = divisions.find((d) => d.id === game.divisionId);
  const availableTeams = teams.filter((t) => t.divisionId === game.divisionId);

  // Home team object to inspect alternate fields
  const selectedHomeTeam = teams.find((t) => t.id === homeTeamId);

  const handleSwapTeams = () => {
    const temp = homeTeamId;
    setHomeTeamId(awayTeamId);
    setAwayTeamId(temp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...game,
      date,
      time,
      fieldId,
      homeTeamId,
      awayTeamId,
      isByePractice,
      status,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900 leading-tight">
              Edit Match Details
            </h3>
            <p className="text-xs text-slate-500">
              {currentDivision?.name || 'League Match'} · Round {game.roundNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Teams Selection */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Teams Playing
              </span>
              <button
                type="button"
                onClick={handleSwapTeams}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                title="Swap Home and Away teams"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Swap Home / Away</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Home Team (Designated Host)
                </label>
                <select
                  value={homeTeamId}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                >
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isBye ? '(Bye)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Away Team (Visiting)
                </label>
                <select
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                >
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isBye ? '(Bye)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isByePractice"
                checked={isByePractice}
                onChange={(e) => setIsByePractice(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
              />
              <label htmlFor="isByePractice" className="text-xs text-slate-600">
                Mark as Practice Session (for bye rounds on home pitch)
              </label>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Match Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kickoff Time Slot
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono tabular-nums"
                  required
                />
              </div>
            </div>
          </div>

          {/* Field Assignment */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                Field / Pitch Assignment
              </label>
              {selectedHomeTeam?.primaryHomeFieldId && (
                <button
                  type="button"
                  onClick={() => setFieldId(selectedHomeTeam.primaryHomeFieldId)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Set to Home Team Primary Pitch
                </button>
              )}
            </div>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              required
            >
              {fields.map((f) => {
                const isPrimary = selectedHomeTeam?.primaryHomeFieldId === f.id;
                const isAlt = selectedHomeTeam?.alternateHomeFieldIds?.includes(f.id);
                return (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.size}) {isPrimary ? '★ Primary Home' : isAlt ? '✦ Alternate Home' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status & Match Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Match Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Game['status'])}
                className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Game Notes / Instructions
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Referee assigned, photo day, equipment notes"
                className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Save Match Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
