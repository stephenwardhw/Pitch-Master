import React, { useState, useEffect } from 'react';
import { Field, Game, Referee, Team } from '../../types';
import {
  X,
  Phone,
  Mail,
  User,
  Shield,
  MapPin,
  FileText,
  Copy,
  Check,
  Send,
  Calendar,
  Clock,
  Shirt,
  AlertCircle,
  Users,
  UserCheck,
  EyeOff,
  Eye,
  Award,
} from 'lucide-react';

interface MatchContactModalProps {
  game: Game;
  homeTeam?: Team;
  awayTeam?: Team;
  divisionName?: string;
  field?: Field;
  fields: Field[];
  referees?: Referee[];
  onClose: () => void;
}

export const MatchContactModal: React.FC<MatchContactModalProps> = ({
  game,
  homeTeam,
  awayTeam,
  divisionName,
  field,
  fields,
  referees = [],
  onClose,
}) => {
  const [copiedState, setCopiedState] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  const formatFriendlyDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedState(label);
      setTimeout(() => setCopiedState(null), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedState(label);
      setTimeout(() => setCopiedState(null), 2500);
    }
  };

  // Referee lookups
  const refMap = new Map((referees || []).map((r) => [r.id, r]));
  const centerRef = game.refereeId ? refMap.get(game.refereeId) : null;
  const ar1 = game.assistantReferee1Id ? refMap.get(game.assistantReferee1Id) : null;
  const ar2 = game.assistantReferee2Id ? refMap.get(game.assistantReferee2Id) : null;

  const assignedOfficials = [
    { role: 'Center Referee', officialRole: 'Lead Match Official', ref: centerRef, isLead: true },
    { role: 'Assistant Referee 1', officialRole: 'AR1 Linesperson', ref: ar1, isLead: false },
    { role: 'Assistant Referee 2', officialRole: 'AR2 Linesperson', ref: ar2, isLead: false },
  ].filter(
    (item): item is { role: string; officialRole: string; ref: Referee; isLead: boolean } =>
      item.ref !== null && item.ref !== undefined
  );

  // Collect emails
  const homeEmail = homeTeam?.contactEmail?.trim() || '';
  const awayEmail = awayTeam?.contactEmail?.trim() || '';
  const bothEmails = [homeEmail, awayEmail].filter(Boolean);
  const bothEmailsString = bothEmails.join(', ');

  // Compose coordination mailto link
  const emailSubject = encodeURIComponent(
    `[${divisionName || 'League'}] Match Coordination: ${homeTeam?.name || 'Home'} vs ${
      awayTeam?.name || 'Away'
    } (${game.date} @ ${game.time})`
  );

  const emailBody = encodeURIComponent(
    `Hello Coaches & Match Officials,\n\nReaching out regarding our upcoming match:\n\n• Division: ${
      divisionName || 'Youth Soccer League'
    }\n• Matchup: ${homeTeam?.name || 'Home Team'} (HOME) vs ${
      awayTeam?.name || 'Away Team'
    } (AWAY)\n• Date & Time: ${formatFriendlyDate(game.date)} at ${game.time}\n• Pitch: ${
      field?.name || 'Assigned Pitch'
    }${field?.address ? ` (${field.address})` : ''}\n• Round: Round ${
      game.roundNumber
    }\n\nHome Jersey Color: ${homeTeam?.jerseyColor || 'Not specified'}\nAway Jersey Color: ${
      awayTeam?.jerseyColor || 'Not specified'
    }\n\nPlease confirm warm-up arrival times and jersey colors to avoid kit clash.\n\nBest regards,\n`
  );

  const mailtoBothUrl = `mailto:${bothEmails.join(',')}?subject=${emailSubject}&body=${emailBody}`;

  // Jersey clash detector
  const isJerseyColorClash =
    homeTeam?.jerseyColor &&
    awayTeam?.jerseyColor &&
    !game.isByePractice &&
    homeTeam.jerseyColor.trim().toLowerCase() === awayTeam.jerseyColor.trim().toLowerCase();

  const isByePractice = game.isByePractice || awayTeam?.isBye || !awayTeam;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                <span>Match Contacts: Coaches & Referees</span>
              </span>
              {divisionName && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                  {divisionName}
                </span>
              )}
              <span className="text-xs text-slate-400">· Round {game.roundNumber}</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {homeTeam?.name || 'Home Team'}{' '}
              <span className="text-slate-400 font-medium text-sm px-1">vs</span>{' '}
              {isByePractice ? 'Practice Session (Bye)' : awayTeam?.name || 'Away Team'}
            </h3>

            {/* Game Context Info */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 pt-0.5">
              <div className="flex items-center gap-1 text-slate-700 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{formatFriendlyDate(game.date)}</span>
              </div>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1 text-slate-700 font-mono font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{game.time}</span>
              </div>
              <span className="text-slate-300">·</span>
              <div className="flex items-center gap-1 text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{field?.name || 'Assigned Pitch'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Banner: Email Both Coaches */}
        {!isByePractice && (
          <div className="px-5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Coordinate with coaches of <strong>both teams</strong> before match day:
              </span>
            </div>

            <div className="flex items-center gap-2">
              {bothEmails.length > 0 && (
                <>
                  <a
                    href={mailtoBothUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Email Both Coaches</span>
                  </a>

                  <button
                    onClick={() => copyToClipboard(bothEmailsString, 'both-emails')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium transition-colors"
                    title="Copy both coach email addresses comma-separated"
                  >
                    {copiedState === 'both-emails' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied 2 Emails!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Both Emails</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Jersey Conflict Notice */}
        {isJerseyColorClash && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Jersey Color Match Alert</p>
              <p className="mt-0.5 text-amber-800">
                Both teams have designated <strong>{homeTeam?.jerseyColor}</strong> jerseys. Standard
                league regulations state the Home team wears primary jerseys and the Away team wears
                alternate jerseys or pennies. Contact the opposing coach to coordinate.
              </p>
            </div>
          </div>
        )}

        {/* Body: Two Team Cards */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Home Team Card */}
            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                {/* Team Badge & Name */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white tracking-wide">
                      HOME
                    </span>
                    <h4 className="font-bold text-slate-900 text-base leading-tight">
                      {homeTeam?.name || 'Home Team'}
                    </h4>
                  </div>
                  {homeTeam?.jerseyColor && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <Shirt className="w-3 h-3 text-slate-500" />
                      <span>{homeTeam.jerseyColor}</span>
                    </span>
                  )}
                </div>

                {/* Coach Contact Details */}
                <div className="mt-3 space-y-2.5 text-xs">
                  {/* Coach Name */}
                  <div className="flex items-start gap-2 text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <User className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {homeTeam?.contactName || 'No coach name specified'}
                      </div>
                      <div className="text-[11px] text-slate-500">Head Coach / Team Manager</div>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      {homeTeam?.contactPhone ? (
                        <a
                          href={`tel:${homeTeam.contactPhone}`}
                          className="font-mono font-medium text-emerald-700 hover:underline hover:text-emerald-800 truncate"
                        >
                          {homeTeam.contactPhone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No phone provided</span>
                      )}
                    </div>
                    {homeTeam?.contactPhone && (
                      <button
                        onClick={() =>
                          copyToClipboard(homeTeam.contactPhone || '', 'home-phone')
                        }
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shrink-0"
                        title="Copy phone number"
                      >
                        {copiedState === 'home-phone' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                      {homeTeam?.contactEmail ? (
                        <a
                          href={`mailto:${homeTeam.contactEmail}`}
                          className="font-medium text-blue-600 hover:underline hover:text-blue-800 truncate"
                          title={homeTeam.contactEmail}
                        >
                          {homeTeam.contactEmail}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No email provided</span>
                      )}
                    </div>
                    {homeTeam?.contactEmail && (
                      <button
                        onClick={() =>
                          copyToClipboard(homeTeam.contactEmail || '', 'home-email')
                        }
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shrink-0"
                        title="Copy email address"
                      >
                        {copiedState === 'home-email' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Team Notes & Instructions */}
                {homeTeam?.notes && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                      <FileText className="w-3.5 h-3.5 text-amber-700" />
                      <span>Team Notes</span>
                    </div>
                    <p className="text-amber-950/80 leading-relaxed whitespace-pre-wrap">
                      {homeTeam.notes}
                    </p>
                  </div>
                )}

                {/* Home Pitch Info */}
                {homeTeam?.primaryHomeFieldId && (
                  <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Primary Home Pitch:{' '}
                      <strong className="text-slate-700">
                        {fieldMap.get(homeTeam.primaryHomeFieldId)?.name || 'Assigned'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Away Team Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                {/* Team Badge & Name */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-white tracking-wide">
                      AWAY
                    </span>
                    <h4 className="font-bold text-slate-900 text-base leading-tight">
                      {isByePractice ? 'Bye / Practice Session' : awayTeam?.name || 'Away Team'}
                    </h4>
                  </div>
                  {!isByePractice && awayTeam?.jerseyColor && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <Shirt className="w-3 h-3 text-slate-500" />
                      <span>{awayTeam.jerseyColor}</span>
                    </span>
                  )}
                </div>

                {isByePractice ? (
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2 text-center">
                    <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-800">Dedicated Practice Game</p>
                    <p className="text-slate-500">
                      There is no opposing team for this match slot. This time is reserved for{' '}
                      <strong>{homeTeam?.name}</strong> training and scrimmage.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Coach Contact Details */}
                    <div className="mt-3 space-y-2.5 text-xs">
                      {/* Coach Name */}
                      <div className="flex items-start gap-2 text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <User className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {awayTeam?.contactName || 'No coach name specified'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Head Coach / Team Manager
                          </div>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                          {awayTeam?.contactPhone ? (
                            <a
                              href={`tel:${awayTeam.contactPhone}`}
                              className="font-mono font-medium text-emerald-700 hover:underline hover:text-emerald-800 truncate"
                            >
                              {awayTeam.contactPhone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No phone provided</span>
                          )}
                        </div>
                        {awayTeam?.contactPhone && (
                          <button
                            onClick={() =>
                              copyToClipboard(awayTeam.contactPhone || '', 'away-phone')
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shrink-0"
                            title="Copy phone number"
                          >
                            {copiedState === 'away-phone' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>

                      {/* Email */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                          {awayTeam?.contactEmail ? (
                            <a
                              href={`mailto:${awayTeam.contactEmail}`}
                              className="font-medium text-blue-600 hover:underline hover:text-blue-800 truncate"
                              title={awayTeam.contactEmail}
                            >
                              {awayTeam.contactEmail}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No email provided</span>
                          )}
                        </div>
                        {awayTeam?.contactEmail && (
                          <button
                            onClick={() =>
                              copyToClipboard(awayTeam.contactEmail || '', 'away-email')
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shrink-0"
                            title="Copy email address"
                          >
                            {copiedState === 'away-email' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Team Notes & Instructions */}
                    {awayTeam?.notes && (
                      <div className="mt-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                          <FileText className="w-3.5 h-3.5 text-amber-700" />
                          <span>Team Notes</span>
                        </div>
                        <p className="text-amber-950/80 leading-relaxed whitespace-pre-wrap">
                          {awayTeam.notes}
                        </p>
                      </div>
                    )}

                    {/* Away Home Pitch Info */}
                    {awayTeam?.primaryHomeFieldId && (
                      <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          Primary Home Pitch:{' '}
                          <strong className="text-slate-700">
                            {fieldMap.get(awayTeam.primaryHomeFieldId)?.name || 'Assigned'}
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. Match Officials & Referee Contacts */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm tracking-tight">
                  Assigned Match Officials & Referee Contacts
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Official officiating crew assigned to this match fixture
              </span>
            </div>

            {assignedOfficials.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-600 text-xs flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0 text-slate-500">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-slate-800 block">No Match Officials Assigned Yet</span>
                  <span className="text-[11px] text-slate-500">
                    Center referees and assistant referees will appear here once appointed by the league scheduler.
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {assignedOfficials.map(({ role, ref, isLead }) => {
                  const isContactHidden = Boolean(ref.hideContactPublicly) || (!ref.email && !ref.phone);

                  return (
                    <div
                      key={ref.id + role}
                      className={`p-3.5 rounded-xl border bg-white shadow-2xs flex flex-col justify-between space-y-3 transition-all ${
                        isLead ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Header: Role & Privacy Pill */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isLead
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {role}
                            </span>
                            <h5 className="font-bold text-slate-900 text-sm mt-1">{ref.name}</h5>
                          </div>

                          {/* Privacy Indicator Badge */}
                          {isContactHidden ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0"
                              title="Referee contact info is set to private (Name only shown)"
                            >
                              <EyeOff className="w-3 h-3 text-amber-600" />
                              <span>Name Only</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0"
                              title="Referee contact info is visible"
                            >
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Contact Visible</span>
                            </span>
                          )}
                        </div>

                        {/* Certification & License */}
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800">{ref.certificationLevel}</span>
                          {ref.badgeNumber && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-slate-500">{ref.badgeNumber}</span>
                            </>
                          )}
                        </div>

                        {/* Contact Details vs Private Flag Mode */}
                        {isContactHidden ? (
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                            <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="leading-snug">
                              Official contact details (phone & email) are kept private per this referee&apos;s privacy preference.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs pt-1">
                            {/* Phone */}
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                {ref.phone ? (
                                  <a
                                    href={`tel:${ref.phone}`}
                                    className="font-mono font-medium text-emerald-700 hover:underline truncate"
                                  >
                                    {ref.phone}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">No phone listed</span>
                                )}
                              </div>
                              {ref.phone && (
                                <button
                                  onClick={() => copyToClipboard(ref.phone, `ref-phone-${ref.id}`)}
                                  className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors shrink-0"
                                  title="Copy phone number"
                                >
                                  {copiedState === `ref-phone-${ref.id}` ? 'Copied' : 'Copy'}
                                </button>
                              )}
                            </div>

                            {/* Email */}
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                {ref.email ? (
                                  <a
                                    href={`mailto:${ref.email}`}
                                    className="font-medium text-blue-600 hover:underline truncate"
                                    title={ref.email}
                                  >
                                    {ref.email}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">No email listed</span>
                                )}
                              </div>
                              {ref.email && (
                                <button
                                  onClick={() => copyToClipboard(ref.email, `ref-email-${ref.id}`)}
                                  className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors shrink-0"
                                  title="Copy email address"
                                >
                                  {copiedState === `ref-email-${ref.id}` ? 'Copied' : 'Copy'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 hidden sm:block">
            Need changes to team records? Contact your league administrator.
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {bothEmails.length > 0 && !isByePractice && (
              <a
                href={mailtoBothUrl}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-2xs inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Email Coaches</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
