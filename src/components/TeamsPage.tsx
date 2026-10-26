import React, { useState, useMemo } from 'react';
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
  Send,
  Copy,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Info,
  Filter,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Calendar,
} from 'lucide-react';
import { exportTeamsToCsv, downloadCsv } from '../utils/csvImporter';

interface TeamsPageProps {
  appData: AppData;
  onSaveTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onOpenManageTeamSizes: () => void;
  onOpenCsvImport?: () => void;
  onSelectTeamContact: (team: Team, divisionName?: string) => void;
  onSelectField: (field: Field) => void;
}

type EmailScope = 'all' | 'division' | 'team';
type EmailSendMode = 'bcc' | 'to';

export const TeamsPage: React.FC<TeamsPageProps> = ({
  appData,
  onSaveTeam,
  onDeleteTeam,
  onOpenManageTeamSizes,
  onOpenCsvImport,
  onSelectTeamContact,
  onSelectField,
}) => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [blackoutFilter, setBlackoutFilter] = useState<'all' | 'with-blackouts' | 'no-blackouts'>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDivisionId, setFormDivisionId] = useState('');
  const [formSizeId, setFormSizeId] = useState('');
  const [formPrimaryFieldId, setFormPrimaryFieldId] = useState('');
  const [formAltFieldIds, setFormAltFieldIds] = useState<string[]>([]);
  const [formBlackoutDates, setFormBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState<string>('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formJerseyColor, setFormJerseyColor] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Email Mass Communication modal states
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailScope, setEmailScope] = useState<EmailScope>('all');
  const [emailTargetDivisionId, setEmailTargetDivisionId] = useState<string>('');
  const [emailTargetTeamId, setEmailTargetTeamId] = useState<string>('');
  const [emailSendMode, setEmailSendMode] = useState<EmailSendMode>('bcc');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const divisionMap = useMemo(() => new Map(appData.divisions.map((d) => [d.id, d])), [appData.divisions]);
  const fieldMap = useMemo(() => new Map(appData.fields.map((f) => [f.id, f])), [appData.fields]);
  const sizeMap = useMemo(() => new Map(appData.teamSizes.map((s) => [s.id, s])), [appData.teamSizes]);

  const filteredTeams = useMemo(() => {
    return appData.teams.filter((t) => {
      if (t.isBye) return false;
      if (selectedDivision !== 'all' && t.divisionId !== selectedDivision) return false;
      const hasBlackouts = Array.isArray(t.blackoutDates) && t.blackoutDates.length > 0;
      if (blackoutFilter === 'with-blackouts' && !hasBlackouts) return false;
      if (blackoutFilter === 'no-blackouts' && hasBlackouts) return false;
      return true;
    });
  }, [appData.teams, selectedDivision, blackoutFilter]);

  // Total league teams and email availability stats
  const leagueEmailStats = useMemo(() => {
    const validTeams = appData.teams.filter((t) => !t.isBye);
    const withEmail = validTeams.filter((t) => t.contactEmail && t.contactEmail.trim().length > 0);
    return {
      total: validTeams.length,
      withEmail: withEmail.length,
      missingEmail: validTeams.length - withEmail.length,
    };
  }, [appData.teams]);

  // Candidates for the email modal based on active scope
  const targetTeamsForEmail = useMemo(() => {
    const nonBye = appData.teams.filter((t) => !t.isBye);
    if (emailScope === 'all') {
      return nonBye;
    }
    if (emailScope === 'division') {
      const divId = emailTargetDivisionId || appData.divisions[0]?.id;
      return nonBye.filter((t) => t.divisionId === divId);
    }
    if (emailScope === 'team') {
      const teamId = emailTargetTeamId || nonBye[0]?.id;
      return nonBye.filter((t) => t.id === teamId);
    }
    return nonBye;
  }, [appData.teams, appData.divisions, emailScope, emailTargetDivisionId, emailTargetTeamId]);

  // Breakdown of targeted teams
  const targetedWithEmail = useMemo(() => {
    return targetTeamsForEmail.filter((t) => t.contactEmail && t.contactEmail.trim().length > 0);
  }, [targetTeamsForEmail]);

  const targetedMissingEmail = useMemo(() => {
    return targetTeamsForEmail.filter((t) => !t.contactEmail || t.contactEmail.trim().length === 0);
  }, [targetTeamsForEmail]);

  // Active recipient email list (selected by checkbox and possessing valid email)
  const activeRecipientEmails = useMemo(() => {
    const emails: string[] = [];
    const seen = new Set<string>();

    targetedWithEmail.forEach((team) => {
      if (selectedRecipientIds.includes(team.id)) {
        const rawEmail = team.contactEmail?.trim();
        if (rawEmail) {
          // In case a coach email field has comma-separated multiple emails
          const splitEmails = rawEmail.split(/[,;]/).map((e) => e.trim()).filter((e) => e.length > 0);
          splitEmails.forEach((e) => {
            const lower = e.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              emails.push(e);
            }
          });
        }
      }
    });

    return emails;
  }, [targetedWithEmail, selectedRecipientIds]);

  // Pre-configured email templates
  const applyEmailTemplate = (templateKey: 'schedule' | 'weather' | 'rules' | 'general') => {
    const leagueTitle = appData.seasonConfig?.seasonName || 'Youth Soccer League';
    let scopeLabel = 'All Divisions';
    if (emailScope === 'division') {
      const d = divisionMap.get(emailTargetDivisionId || appData.divisions[0]?.id);
      scopeLabel = d ? d.name : 'Division';
    } else if (emailScope === 'team') {
      const t = appData.teams.find((tm) => tm.id === (emailTargetTeamId || appData.teams[0]?.id));
      scopeLabel = t ? t.name : 'Team';
    }

    if (templateKey === 'schedule') {
      setEmailSubject(`[${leagueTitle}] Match Schedule & Kickoff Notice (${scopeLabel})`);
      setEmailBody(
        `Dear Coaches & Team Managers,\n\n` +
        `The official match schedule for ${scopeLabel} has been published and updated in the league portal.\n\n` +
        `Please review your scheduled match dates, kickoff times, and designated pitch locations. Coaches are asked to confirm match times with team families and arrive at least 20 minutes prior to kickoff.\n\n` +
        `If you notice any schedule conflicts or need to coordinate pitch requirements, please notify league administration immediately.\n\n` +
        `Best regards,\n` +
        `League Administration\n` +
        `${leagueTitle}`
      );
    } else if (templateKey === 'weather') {
      setEmailSubject(`[${leagueTitle}] Pitch Conditions & Match Day Weather Advisory`);
      setEmailBody(
        `Attention Coaches & Team Managers,\n\n` +
        `Please take note of the following pitch conditions and weather guidance for upcoming league games.\n\n` +
        `• All games will proceed as scheduled unless field closures are announced via official league notice.\n` +
        `• Please remind parents and players to dress warmly and bring ample hydration.\n` +
        `• In the event of lightning or field unplayability, referee and park official decisions are final.\n\n` +
        `Thank you for keeping player safety our top priority.\n\n` +
        `League Operations`
      );
    } else if (templateKey === 'rules') {
      setEmailSubject(`[${leagueTitle}] Coach Check-in & Match Day Protocol`);
      setEmailBody(
        `Hello Coaches,\n\n` +
        `A quick reminder regarding match day protocols and sportsmanship for ${scopeLabel}:\n\n` +
        `1. Home teams wear primary designated colors. Visiting teams switch if there is a color clash.\n` +
        `2. Team rosters and player credentials should be presented to the match official prior to start.\n` +
        `3. Spectator seating is restricted to designated touchline zones opposite the player benches.\n\n` +
        `Thank you for your leadership and dedication to youth development!\n\n` +
        `League Administration`
      );
    } else {
      setEmailSubject(`[${leagueTitle}] Important Announcement for Coaches (${scopeLabel})`);
      setEmailBody(
        `Dear Coaches & Managers,\n\n` +
        `We are contacting you with an important update regarding the current season for ${scopeLabel}.\n\n` +
        `[Insert your custom announcement details here]\n\n` +
        `Please feel free to reply with any questions or team updates.\n\n` +
        `Best regards,\n` +
        `League Administration`
      );
    }
  };

  // Open the mass email modal configured with an initial scope
  const handleOpenEmailModal = (scope: EmailScope = 'all', targetId?: string) => {
    setEmailScope(scope);

    let defaultDivId = emailTargetDivisionId;
    let defaultTeamId = emailTargetTeamId;

    if (scope === 'division') {
      defaultDivId = targetId || (selectedDivision !== 'all' ? selectedDivision : appData.divisions[0]?.id || '');
      setEmailTargetDivisionId(defaultDivId);
    } else if (scope === 'team') {
      defaultTeamId = targetId || appData.teams.find((t) => !t.isBye)?.id || '';
      setEmailTargetTeamId(defaultTeamId);
    }

    // Determine target teams and initialize selected recipient IDs
    const nonBye = appData.teams.filter((t) => !t.isBye);
    let matchedTeams: Team[] = [];
    if (scope === 'all') {
      matchedTeams = nonBye;
    } else if (scope === 'division') {
      matchedTeams = nonBye.filter((t) => t.divisionId === defaultDivId);
    } else {
      matchedTeams = nonBye.filter((t) => t.id === defaultTeamId);
    }

    const availableIds = matchedTeams
      .filter((t) => t.contactEmail && t.contactEmail.trim().length > 0)
      .map((t) => t.id);
    setSelectedRecipientIds(availableIds);

    // Initial default subject & body if currently blank
    if (!emailSubject) {
      const leagueTitle = appData.seasonConfig?.seasonName || 'Youth Soccer League';
      setEmailSubject(`[${leagueTitle}] Important Update for Coaches`);
      setEmailBody(
        `Dear Coaches,\n\nPlease see the latest league announcements and schedule details in your portal.\n\nBest regards,\nLeague Administration`
      );
    }

    setIsEmailModalOpen(true);
  };

  // Change scope within modal and auto-select all valid recipients in that scope
  const handleSelectScope = (newScope: EmailScope) => {
    setEmailScope(newScope);

    let matched: Team[] = [];
    const nonBye = appData.teams.filter((t) => !t.isBye);

    if (newScope === 'all') {
      matched = nonBye;
    } else if (newScope === 'division') {
      const dId = emailTargetDivisionId || appData.divisions[0]?.id || '';
      setEmailTargetDivisionId(dId);
      matched = nonBye.filter((t) => t.divisionId === dId);
    } else if (newScope === 'team') {
      const tId = emailTargetTeamId || nonBye[0]?.id || '';
      setEmailTargetTeamId(tId);
      matched = nonBye.filter((t) => t.id === tId);
    }

    const availableIds = matched
      .filter((t) => t.contactEmail && t.contactEmail.trim().length > 0)
      .map((t) => t.id);
    setSelectedRecipientIds(availableIds);
  };

  const handleSelectDivisionInModal = (divId: string) => {
    setEmailTargetDivisionId(divId);
    const nonBye = appData.teams.filter((t) => !t.isBye);
    const matched = nonBye.filter((t) => t.divisionId === divId);
    const availableIds = matched
      .filter((t) => t.contactEmail && t.contactEmail.trim().length > 0)
      .map((t) => t.id);
    setSelectedRecipientIds(availableIds);
  };

  const handleSelectTeamInModal = (teamId: string) => {
    setEmailTargetTeamId(teamId);
    const team = appData.teams.find((t) => t.id === teamId);
    if (team?.contactEmail?.trim()) {
      setSelectedRecipientIds([team.id]);
    } else {
      setSelectedRecipientIds([]);
    }
  };

  const handleToggleRecipient = (teamId: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSelectAllRecipients = () => {
    setSelectedRecipientIds(targetedWithEmail.map((t) => t.id));
  };

  const handleDeselectAllRecipients = () => {
    setSelectedRecipientIds([]);
  };

  // Generate mailto URL string
  const generatedMailtoUrl = useMemo(() => {
    if (activeRecipientEmails.length === 0) return '';

    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(emailBody);
    const emailsList = activeRecipientEmails.join(',');

    if (emailSendMode === 'to') {
      return `mailto:${emailsList}?subject=${encodedSubject}&body=${encodedBody}`;
    } else {
      // BCC mode: keeps recipients private and prevents massive Reply-All chains
      return `mailto:?bcc=${emailsList}&subject=${encodedSubject}&body=${encodedBody}`;
    }
  }, [activeRecipientEmails, emailSendMode, emailSubject, emailBody]);

  // Copy email list to clipboard
  const handleCopyEmails = (delimiter: ', ' | '\n' = ', ') => {
    if (activeRecipientEmails.length === 0) return;
    const text = activeRecipientEmails.join(delimiter);
    navigator.clipboard.writeText(text);
    setCopyFeedback(`Copied ${activeRecipientEmails.length} email addresses!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Copy full mailto link
  const handleCopyMailtoLink = () => {
    if (!generatedMailtoUrl) return;
    navigator.clipboard.writeText(generatedMailtoUrl);
    setCopyFeedback('Copied mailto link to clipboard!');
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Copy coach directory table text
  const handleCopyCoachDirectory = () => {
    const rows = targetTeamsForEmail.map((team) => {
      const div = divisionMap.get(team.divisionId);
      const coach = team.contactName || 'Unassigned Coach';
      const email = team.contactEmail || 'No email';
      const phone = team.contactPhone || 'No phone';
      return `${team.name} [${div?.name || 'N/A'}]: ${coach} <${email}> | Phone: ${phone}`;
    });
    navigator.clipboard.writeText(rows.join('\n'));
    setCopyFeedback(`Copied directory of ${rows.length} coaches!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setIsCreatingNew(false);
    setFormName(team.name);
    setFormDivisionId(team.divisionId);
    setFormSizeId(team.sizeId || appData.teamSizes[0]?.id || '');
    setFormPrimaryFieldId(team.primaryHomeFieldId || appData.fields[0]?.id || '');
    setFormAltFieldIds([...team.alternateHomeFieldIds]);
    setFormBlackoutDates(team.blackoutDates ? [...team.blackoutDates] : []);
    setNewBlackoutDate('');
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
    setFormBlackoutDates([]);
    setNewBlackoutDate('');
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

  const handleAddBlackoutDate = (dateToAdd?: string) => {
    const target = (dateToAdd || newBlackoutDate).trim();
    if (!target) return;
    if (!formBlackoutDates.includes(target)) {
      setFormBlackoutDates([...formBlackoutDates, target].sort());
    }
    setNewBlackoutDate('');
  };

  const handleRemoveBlackoutDate = (dateToRemove: string) => {
    setFormBlackoutDates(formBlackoutDates.filter((d) => d !== dateToRemove));
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
      blackoutDates: formBlackoutDates,
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Teams & Rosters</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage divisions, primary/alternate home pitches for conflict resolution, coach contact profiles, and mass email outreach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mass Communication & Mailto Button */}
          <button
            onClick={() => handleOpenEmailModal('all')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            title="Aggregate coach contact emails and generate a mass mailto link"
          >
            <Mail className="w-4 h-4" />
            <span>Email Coaches & Staff</span>
            <span className="ml-1 px-1.5 py-0.2 bg-blue-500 text-white text-[10px] rounded-full font-bold">
              {leagueEmailStats.withEmail}
            </span>
          </button>

          {/* Editable Team Sizes Button */}
          <button
            onClick={onOpenManageTeamSizes}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Team Sizes</span>
          </button>

          <button
            onClick={() => {
              const csv = exportTeamsToCsv(appData, filteredTeams);
              const fileName = `pitchmaster_teams_${new Date().toISOString().slice(0, 10)}.csv`;
              downloadCsv(fileName, csv);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs"
            title="Export current teams in standard CSV format compatible with CSV Importer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Teams (CSV)</span>
          </button>

          {onOpenCsvImport && (
            <button
              onClick={onOpenCsvImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              title="Import teams, coaches, and home fields from a CSV file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Teams (CSV)</span>
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Team</span>
          </button>
        </div>
      </div>

      {/* Filter & Quick Email Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <label className="font-medium text-slate-600">Division Filter:</label>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Divisions ({appData.divisions.length})</option>
              {appData.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Blackout Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <label className="font-medium text-slate-600">Availability:</label>
            <select
              value={blackoutFilter}
              onChange={(e) => setBlackoutFilter(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Teams</option>
              <option value="with-blackouts">
                With Blackout Dates ({appData.teams.filter((t) => !t.isBye && t.blackoutDates && t.blackoutDates.length > 0).length})
              </option>
              <option value="no-blackouts">No Blackout Dates</option>
            </select>
          </div>

          {/* Contextual Quick Email Action */}
          <button
            onClick={() =>
              handleOpenEmailModal(
                selectedDivision === 'all' ? 'all' : 'division',
                selectedDivision === 'all' ? undefined : selectedDivision
              )
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
            title="Open email composer pre-targeted to this division"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>
              {selectedDivision === 'all'
                ? `Email All Coaches (${leagueEmailStats.withEmail})`
                : `Email ${divisionMap.get(selectedDivision)?.name || 'Division'} Coaches`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-mono tabular-nums">
          <span>
            {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'} registered
          </span>
          {leagueEmailStats.missingEmail > 0 && selectedDivision === 'all' && (
            <span className="text-amber-600 font-sans text-[11px] flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {leagueEmailStats.missingEmail} missing email
            </span>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => {
          const division = divisionMap.get(team.divisionId);
          const size = sizeMap.get(team.sizeId);
          const primaryField = fieldMap.get(team.primaryHomeFieldId);
          const altFields = team.alternateHomeFieldIds.map((id) => fieldMap.get(id)).filter(Boolean) as Field[];
          const hasEmail = Boolean(team.contactEmail && team.contactEmail.trim().length > 0);

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
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
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

                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    {hasEmail ? (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[11px] truncate flex-1">
                        <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                        <a
                          href={`mailto:${team.contactEmail}?subject=${encodeURIComponent(`[${appData.seasonConfig?.seasonName || 'League'}] Message regarding ${team.name}`)}`}
                          className="truncate text-blue-700 hover:underline"
                          title={`Email ${team.contactName || team.name}`}
                        >
                          {team.contactEmail}
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 italic">
                        <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>No email on file</span>
                      </div>
                    )}

                    {/* Quick Single-Team Compose Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => handleOpenEmailModal('team', team.id)}
                      className="text-[11px] font-medium text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition-colors shrink-0"
                      title="Compose email targeted to this team"
                    >
                      Compose
                    </button>
                  </div>
                </div>

                {/* Blackout Dates (Unavailability) */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Blackout Dates:</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        team.blackoutDates && team.blackoutDates.length > 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {team.blackoutDates?.length || 0} {team.blackoutDates?.length === 1 ? 'Date' : 'Dates'}
                    </span>
                  </div>

                  {team.blackoutDates && team.blackoutDates.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {team.blackoutDates.map((dStr) => (
                        <span
                          key={dStr}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white text-slate-800 border border-slate-200 shadow-2xs"
                        >
                          {dStr}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Available all season dates (no team blackouts)
                    </p>
                  )}
                </div>

                {/* Notes preview */}
                {team.notes && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                    "{team.notes}"
                  </p>
                )}
              </div>

              {/* Action Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => handleOpenEmailModal('team', team.id)}
                  className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 text-[11px]"
                >
                  <Send className="w-3 h-3" />
                  <span>Send Mailto</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(team)}
                  className="font-medium text-slate-600 hover:text-slate-900"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MASS EMAIL COMMUNICATION MODAL ================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Coach Communication & Mailto Generator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aggregate contact emails, select scope, and launch in your default mail app or copy addresses.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Scope Selector Tabs */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Communication Scope
                </label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSelectScope('all')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      emailScope === 'all'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Teams ({leagueEmailStats.total})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectScope('division')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      emailScope === 'division'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Single Division</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectScope('team')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      emailScope === 'team'
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Single Team</span>
                  </button>
                </div>

                {/* Sub-selector for Division scope */}
                {emailScope === 'division' && (
                  <div className="pt-2 flex items-center gap-2 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                    <label className="text-xs font-medium text-slate-700 shrink-0">Select Division:</label>
                    <select
                      value={emailTargetDivisionId || appData.divisions[0]?.id || ''}
                      onChange={(e) => handleSelectDivisionInModal(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 bg-white p-2 font-medium text-slate-800"
                    >
                      {appData.divisions.map((d) => {
                        const countInDiv = appData.teams.filter((t) => !t.isBye && t.divisionId === d.id && t.contactEmail?.trim()).length;
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name} ({countInDiv} coaches with email)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Sub-selector for Team scope */}
                {emailScope === 'team' && (
                  <div className="pt-2 flex items-center gap-2 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                    <label className="text-xs font-medium text-slate-700 shrink-0">Select Team:</label>
                    <select
                      value={emailTargetTeamId || appData.teams.find((t) => !t.isBye)?.id || ''}
                      onChange={(e) => handleSelectTeamInModal(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 bg-white p-2 font-medium text-slate-800"
                    >
                      {appData.teams
                        .filter((t) => !t.isBye)
                        .map((team) => {
                          const div = divisionMap.get(team.divisionId);
                          return (
                            <option key={team.id} value={team.id}>
                              {team.name} ({div?.name || 'No Div'}) {team.contactEmail ? `· ${team.contactEmail}` : '(No email)'}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </div>

              {/* Recipient Aggregation Status Bar */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-800">
                      Recipients in Scope:
                    </span>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px]">
                      {activeRecipientEmails.length} Selected
                    </span>
                    <span className="text-slate-500">
                      ({targetedWithEmail.length} available with email)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllRecipients}
                      className="text-blue-700 hover:underline font-medium text-[11px]"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllRecipients}
                      className="text-slate-500 hover:underline text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Missing Email Alert */}
                {targetedMissingEmail.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 text-amber-800 p-2.5 rounded-lg border border-amber-200 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Notice:</span> {targetedMissingEmail.length} team(s) in this scope do not have a coach email listed:
                      <span className="font-medium ml-1">
                        {targetedMissingEmail.map((t) => t.name).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recipient Checkbox List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    2. Coach Recipient Checklist ({targetedWithEmail.length})
                  </span>
                  <span className="text-[11px]">Check to include / uncheck to omit</span>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {targetedWithEmail.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                      No coaches with valid email addresses found for this scope.
                    </div>
                  ) : (
                    targetedWithEmail.map((team) => {
                      const isSelected = selectedRecipientIds.includes(team.id);
                      const div = divisionMap.get(team.divisionId);

                      return (
                        <label
                          key={team.id}
                          className={`flex items-center justify-between p-2.5 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleRecipient(team.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 block truncate">
                                {team.name}
                              </span>
                              <span className="text-slate-500 text-[11px]">
                                {team.contactName || 'Coach'} · {div?.name || 'Division'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono text-[11px] text-blue-700 ml-2">
                            {team.contactEmail}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mode & Subject & Presets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    3. Email Options & Templates
                  </label>

                  {/* Mode: BCC vs TO */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 text-[11px]">Addressing Mode:</span>
                    <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="emailSendMode"
                        value="bcc"
                        checked={emailSendMode === 'bcc'}
                        onChange={() => setEmailSendMode('bcc')}
                        className="text-blue-600"
                      />
                      <span>BCC (Private)</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="emailSendMode"
                        value="to"
                        checked={emailSendMode === 'to'}
                        onChange={() => setEmailSendMode('to')}
                        className="text-blue-600"
                      />
                      <span>To (Direct)</span>
                    </label>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('schedule')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200"
                  >
                    Schedule Announcement
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('weather')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200"
                  >
                    Weather / Pitch Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('rules')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200"
                  >
                    Pre-Match Check-in
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEmailTemplate('general')}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200"
                  >
                    General Notice
                  </button>
                </div>

                {/* Subject Input */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="e.g. [Youth Soccer League] Schedule Update and Games"
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Body Textarea */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Message Body (Pre-fills in mail client)
                  </label>
                  <textarea
                    rows={4}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Enter announcement text for coaches..."
                    className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Copy Feedback notification */}
              {copyFeedback && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{copyFeedback}</span>
                </div>
              )}

              {/* Generated Mailto Bar & Launch Options */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                      Generated Mailto Action
                    </span>
                    <span className="text-xs text-slate-200">
                      {activeRecipientEmails.length} recipients · Mode:{' '}
                      <span className="font-mono text-emerald-400 font-bold">
                        {emailSendMode.toUpperCase()}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Copy Emails Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyEmails(', ')}
                      disabled={activeRecipientEmails.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg border border-slate-700 transition-colors"
                      title="Copy comma-separated list of emails"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Emails</span>
                    </button>

                    {/* Copy Mailto Link Button */}
                    <button
                      type="button"
                      onClick={handleCopyMailtoLink}
                      disabled={!generatedMailtoUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg border border-slate-700 transition-colors"
                      title="Copy full mailto: URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Link</span>
                    </button>

                    {/* Primary Open Mail Client Button */}
                    {generatedMailtoUrl ? (
                      <a
                        href={generatedMailtoUrl}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
                        title="Open default email application"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Open in Email App</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-lg opacity-50 cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Open in Email App</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Directory quick export */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Need a roster list? Export full coach contacts as text.
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCoachDirectory}
                    className="text-blue-400 hover:underline hover:text-blue-300 font-medium"
                  >
                    Copy Directory Text
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT / CREATE TEAM MODAL ================= */}
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
                  required
                  placeholder="e.g. Westside Rangers"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Division</label>
                  <select
                    value={formDivisionId}
                    onChange={(e) => setFormDivisionId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  >
                    {appData.divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Team Size / Format</label>
                  <select
                    value={formSizeId}
                    onChange={(e) => setFormSizeId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  >
                    {appData.teamSizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.playersPerSide}v{s.playersPerSide})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Primary Home Pitch</label>
                <select
                  value={formPrimaryFieldId}
                  onChange={(e) => setFormPrimaryFieldId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                >
                  {appData.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alternate Home Pitches (for conflict resolution)
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  {appData.fields.map((f) => {
                    const isChecked = formAltFieldIds.includes(f.id);
                    const isPrimary = formPrimaryFieldId === f.id;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 text-xs p-1 rounded ${
                          isPrimary ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isPrimary}
                          checked={isChecked}
                          onChange={() => handleToggleAltField(f.id)}
                          className="rounded text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-slate-800">
                          {f.name} {isPrimary && '(Primary Field)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Blackout Dates (Team-Specific Unavailability) */}
              <div className="border-t border-slate-200 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Blackout Dates (Team Unavailability)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automated match scheduling strictly avoids booking matches for this team on these dates.
                    </p>
                  </div>
                  {formBlackoutDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormBlackoutDates([])}
                      className="text-[11px] text-slate-400 hover:text-rose-600 underline font-medium"
                    >
                      Clear all ({formBlackoutDates.length})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newBlackoutDate}
                    onChange={(e) => setNewBlackoutDate(e.target.value)}
                    className="text-xs rounded border border-slate-300 p-2 bg-white font-mono flex-1 focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    disabled={!newBlackoutDate}
                    onClick={() => handleAddBlackoutDate()}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
                  >
                    Add Date
                  </button>
                </div>

                {formBlackoutDates.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                      Unavailable Match Dates ({formBlackoutDates.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {formBlackoutDates.map((dateStr) => (
                        <span
                          key={dateStr}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900 border border-amber-300 font-mono shadow-2xs"
                        >
                          <span>{dateStr}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlackoutDate(dateStr)}
                            className="text-amber-700 hover:text-rose-700 font-bold ml-0.5 text-xs"
                            title={`Remove ${dateStr}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    No blackout dates set. Team is free to be scheduled on all game days.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Contact & Details (Linked on schedule)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Primary Contact / Coach</label>
                    <input
                      type="text"
                      placeholder="e.g. Marco Rossi"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. (310) 555-0144"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-0.5">Contact Email</label>
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
