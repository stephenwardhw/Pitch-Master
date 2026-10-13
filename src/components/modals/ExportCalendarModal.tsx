import React, { useState, useMemo } from 'react';
import { AppData, Game, Team } from '../../types';
import {
  downloadIcsFile,
  generateIcsContent,
  buildEventPayload,
  createGoogleCalendarUrl,
  createOutlookCalendarUrl,
} from '../../utils/calendarExport';
import {
  X,
  Calendar,
  Download,
  ExternalLink,
  CheckCircle2,
  Filter,
  Layers,
  Users,
  Copy,
  Info,
} from 'lucide-react';

interface ExportCalendarModalProps {
  appData: AppData;
  filteredGames: Game[];
  onClose: () => void;
}

export const ExportCalendarModal: React.FC<ExportCalendarModalProps> = ({
  appData,
  filteredGames,
  onClose,
}) => {
  const [scope, setScope] = useState<'filtered' | 'all' | 'team' | 'division'>('filtered');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(appData.teams[0]?.id || '');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(appData.divisions[0]?.id || '');
  const [customFilename, setCustomFilename] = useState('soccer_league_schedule');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedIcs, setCopiedIcs] = useState(false);

  // Compute selected games based on scope
  const targetGames = useMemo(() => {
    if (scope === 'filtered') {
      return filteredGames;
    }
    if (scope === 'all') {
      return appData.games;
    }
    if (scope === 'team') {
      return appData.games.filter(
        (g) => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId
      );
    }
    if (scope === 'division') {
      return appData.games.filter((g) => g.divisionId === selectedDivisionId);
    }
    return filteredGames;
  }, [scope, filteredGames, appData.games, selectedTeamId, selectedDivisionId]);

  // Selected team object
  const selectedTeam = appData.teams.find((t) => t.id === selectedTeamId);
  const selectedDivision = appData.divisions.find((d) => d.id === selectedDivisionId);

  // Calendar title
  const calTitle = useMemo(() => {
    if (scope === 'team' && selectedTeam) {
      return `${selectedTeam.name} - Match Schedule`;
    }
    if (scope === 'division' && selectedDivision) {
      return `${selectedDivision.name} - Game Calendar`;
    }
    return appData.seasonConfig?.seasonName || 'PitchMaster Soccer Schedule';
  }, [scope, selectedTeam, selectedDivision, appData.seasonConfig]);

  // Handle iCal Download
  const handleDownloadIcs = () => {
    const icsContent = generateIcsContent(
      targetGames,
      appData.teams,
      appData.divisions,
      appData.fields,
      calTitle
    );

    let filename = customFilename.trim();
    if (scope === 'team' && selectedTeam) {
      filename = `${selectedTeam.name.toLowerCase().replace(/\s+/g, '_')}_schedule`;
    } else if (scope === 'division' && selectedDivision) {
      filename = `${selectedDivision.name.toLowerCase().replace(/\s+/g, '_')}_schedule`;
    }

    downloadIcsFile(icsContent, `${filename}.ics`);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  // Copy .ics content to clipboard
  const handleCopyIcs = () => {
    const icsContent = generateIcsContent(
      targetGames,
      appData.teams,
      appData.divisions,
      appData.fields,
      calTitle
    );
    navigator.clipboard.writeText(icsContent);
    setCopiedIcs(true);
    setTimeout(() => setCopiedIcs(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                Export Schedule to Calendar
              </h3>
              <p className="text-xs text-slate-500">
                Sync games with Google Calendar, Microsoft Outlook, or iCal (.ics)
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
          {/* Notification */}
          {downloadSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                iCal file downloaded successfully ({targetGames.length} matches included). Open the file to import directly into Apple Calendar, Outlook, or Google Calendar.
              </span>
            </div>
          )}

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Matches to Include
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-2 text-xs rounded-lg border text-left transition-colors ${
                  scope === 'filtered'
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">Current Filters</span>
                <span className="text-[11px] opacity-75 font-mono">{filteredGames.length} games</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-2 text-xs rounded-lg border text-left transition-colors ${
                  scope === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">All Matches</span>
                <span className="text-[11px] opacity-75 font-mono">{appData.games.length} games</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('team')}
                className={`p-2 text-xs rounded-lg border text-left transition-colors ${
                  scope === 'team'
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">Specific Team</span>
                <span className="text-[11px] opacity-75">Team schedule</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('division')}
                className={`p-2 text-xs rounded-lg border text-left transition-colors ${
                  scope === 'division'
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">By Division</span>
                <span className="text-[11px] opacity-75">League division</span>
              </button>
            </div>
          </div>

          {/* Contextual dropdowns if specific team or division */}
          {scope === 'team' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Select Team:</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-900"
              >
                {appData.teams
                  .filter((t) => !t.isBye)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {scope === 'division' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <label className="text-xs font-medium text-slate-700 block">Select Division:</label>
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-900"
              >
                {appData.divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Calendar Service Options Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Export Destination & Format
            </h4>

            {/* 1. Universal iCal (.ics) Download */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-shadow space-y-3 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      Standard iCalendar (.ics) File
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Universal calendar file supported natively by <strong>Apple Calendar</strong> (iOS & macOS), <strong>Google Calendar</strong>, and <strong>Microsoft Outlook</strong>. Includes match kickoff, pitch GPS address, opponent, and coach contacts.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ics File ({targetGames.length} Games)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyIcs}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedIcs ? 'Copied iCal Text!' : 'Copy iCal Text'}</span>
                </button>
              </div>
            </div>

            {/* 2. Google Calendar Integration */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <h5 className="text-sm font-semibold text-slate-900">Google Calendar</h5>
                </div>
                <a
                  href="https://calendar.google.com/calendar/u/0/r/settings/export"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <span>Open Google Import Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                To import the full schedule into Google Calendar, download the <code>.ics</code> file above, then click the link to visit Google Calendar Settings &gt; Import & Export &gt; Select file from your computer. Individual matches can also be added directly with one click from any match card.
              </p>
            </div>

            {/* 3. Microsoft Outlook Calendar */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                    O
                  </div>
                  <h5 className="text-sm font-semibold text-slate-900">Microsoft Outlook Calendar</h5>
                </div>
                <a
                  href="https://outlook.live.com/calendar/0/view/month"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <span>Open Outlook Web</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                In Outlook (Desktop or Web), open the downloaded <code>.ics</code> file to add it as a new calendar, or drag and drop it directly onto Outlook.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {targetGames.length} {targetGames.length === 1 ? 'match' : 'matches'} ready for export
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
