import { AppData, Division, Field, Game, Team, TeamSizeOption } from '../types';

/**
 * Universal RFC 4180 compliant CSV parser.
 * Supports quoted values, escaped quotes (""), embedded newlines and commas, and BOM markers.
 */
export function parseCsv(rawText: string): string[][] {
  if (!rawText) return [];

  // Strip BOM if present
  let text = rawText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentVal.trim());
      currentVal = '';

      // Only push non-empty rows
      if (currentRow.some((col) => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  // Final column / row if file doesn't end with newline
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((col) => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes user-provided date string into standard YYYY-MM-DD format.
 * Supports YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, DD/MM/YYYY, and textual dates.
 */
export function normalizeDate(input: string): string | null {
  if (!input) return null;
  const str = input.trim();

  // 1. ISO format: 2026-04-12 or 2026/04/12
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 2. US format: 04/12/2026 or 4/12/2026 or 04-12-2026
  const usMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    const year = usMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Date.parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Normalizes user-provided time string into standard 24-hour HH:MM format.
 * Supports 09:00, 9:00, 9:00 AM, 1:30 PM, 13:30, 9am, 1:15pm, etc.
 */
export function normalizeTime(input: string): string | null {
  if (!input) return null;
  const str = input.trim().toLowerCase();

  // Match 12-hour AM/PM: e.g. "9:00 am", "09:30am", "1:15 pm", "12:00pm", "9am"
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? ampmMatch[2] : '00';
    const period = ampmMatch[3].toLowerCase();

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // Match 24-hour: e.g. "09:00", "9:00", "14:30"
  const militaryMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (militaryMatch) {
    const hour = parseInt(militaryMatch[1], 10);
    const minute = militaryMatch[2];
    if (hour >= 0 && hour <= 23 && parseInt(minute, 10) >= 0 && parseInt(minute, 10) <= 59) {
      return `${String(hour).padStart(2, '0')}:${minute}`;
    }
  }

  return null;
}

// -------------------------------------------------------------
// TEAMS IMPORT INTERFACES & PARSER
// -------------------------------------------------------------

export interface ParsedTeamRow {
  rowIndex: number;
  raw: Record<string, string>;
  teamName: string;
  divisionName: string;
  divisionId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  primaryFieldName: string;
  primaryFieldId: string;
  alternateFieldNames: string[];
  alternateFieldIds: string[];
  jerseyColor: string;
  sizeName: string;
  sizeId: string;
  notes: string;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
  isNewDivision: boolean;
  isNewField: boolean;
  isDuplicateTeam: boolean;
}

export interface TeamImportAnalysis {
  rows: ParsedTeamRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  newDivisions: { name: string; id: string }[];
  newFields: { name: string; id: string }[];
  duplicateTeams: string[];
  headersDetected: string[];
  columnMapping: Record<string, string>;
}

const TEAM_HEADER_ALIASES: Record<string, string[]> = {
  teamName: ['team', 'team name', 'team_name', 'name', 'club', 'teamname', 'club name'],
  division: ['division', 'division name', 'div', 'age group', 'category', 'flight', 'tier', 'division_name'],
  contactName: ['coach', 'coach name', 'contact', 'contact name', 'manager', 'coach_name', 'head coach'],
  contactEmail: ['email', 'coach email', 'contact email', 'coach_email', 'email address', 'mail'],
  contactPhone: ['phone', 'coach phone', 'contact phone', 'phone number', 'cell', 'coach_phone', 'mobile'],
  primaryField: ['home field', 'primary field', 'home pitch', 'field', 'pitch', 'primary_home_field', 'home_pitch', 'venue', 'location'],
  alternateFields: ['alternate fields', 'alternate field', 'alt fields', 'alternate home fields', 'secondary field', 'backup field'],
  jerseyColor: ['jersey', 'jersey color', 'color', 'uniform', 'uniform color', 'jersey_color', 'colors'],
  size: ['size', 'team size', 'format', 'match size', 'pitch size', 'game format'],
  notes: ['notes', 'comments', 'remarks', 'description', 'info'],
};

/**
 * Detects mapping from raw CSV headers to logical team fields.
 */
function detectTeamHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[-_]/g, ' '));

  for (const [key, aliases] of Object.entries(TEAM_HEADER_ALIASES)) {
    const idx = normalizedHeaders.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
    if (idx !== -1) {
      mapping[key] = headers[idx];
    }
  }

  return mapping;
}

/**
 * Parses and analyzes teams from CSV string.
 */
export function parseTeamsFromCsv(csvText: string, currentAppData: AppData): TeamImportAnalysis {
  const rawRows = parseCsv(csvText);
  if (rawRows.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      newDivisions: [],
      newFields: [],
      duplicateTeams: [],
      headersDetected: [],
      columnMapping: {},
    };
  }

  const rawHeaders = rawRows[0];
  const dataRows = rawRows.slice(1);
  const columnMapping = detectTeamHeaderMapping(rawHeaders);

  // Existing lookup maps
  const existingDivMap = new Map<string, Division>();
  currentAppData.divisions.forEach((d) => {
    existingDivMap.set(d.id.toLowerCase(), d);
    existingDivMap.set(d.name.toLowerCase().trim(), d);
  });

  const existingFieldMap = new Map<string, Field>();
  currentAppData.fields.forEach((f) => {
    existingFieldMap.set(f.id.toLowerCase(), f);
    existingFieldMap.set(f.name.toLowerCase().trim(), f);
  });

  const existingTeamsSet = new Set(currentAppData.teams.map((t) => t.name.toLowerCase().trim()));
  const newDivisionsMap = new Map<string, { name: string; id: string }>();
  const newFieldsMap = new Map<string, { name: string; id: string }>();
  const duplicateTeams: string[] = [];

  const parsedRows: ParsedTeamRow[] = [];

  dataRows.forEach((cols, index) => {
    // Build raw key-value record
    const raw: Record<string, string> = {};
    rawHeaders.forEach((h, hIdx) => {
      raw[h] = cols[hIdx] || '';
    });

    const getVal = (fieldKey: string): string => {
      const headerName = columnMapping[fieldKey];
      return headerName ? (raw[headerName] || '').trim() : '';
    };

    const teamName = getVal('teamName');
    const divisionInput = getVal('division') || (currentAppData.divisions[0]?.name || 'Premier Division');
    const contactName = getVal('contactName');
    const contactEmail = getVal('contactEmail');
    const contactPhone = getVal('contactPhone');
    const primaryFieldInput = getVal('primaryField');
    const alternateFieldsInput = getVal('alternateFields');
    const jerseyColor = getVal('jerseyColor') || 'Blue';
    const sizeInput = getVal('size');
    const notes = getVal('notes');

    const messages: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';

    if (!teamName) {
      status = 'error';
      messages.push('Missing team name.');
    }

    // Check duplicate
    const isDuplicate = existingTeamsSet.has(teamName.toLowerCase());
    if (isDuplicate) {
      duplicateTeams.push(teamName);
      if (status !== 'error') status = 'warning';
      messages.push('Team name already exists in league (will update or append).');
    }

    // Resolve Division
    let divisionId = '';
    let isNewDivision = false;
    const matchedDiv = existingDivMap.get(divisionInput.toLowerCase());

    if (matchedDiv) {
      divisionId = matchedDiv.id;
    } else {
      isNewDivision = true;
      const slug = `div-${divisionInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const divId = newDivisionsMap.get(divisionInput.toLowerCase())?.id || slug;
      divisionId = divId;
      newDivisionsMap.set(divisionInput.toLowerCase(), { name: divisionInput, id: divId });
      messages.push(`New division "${divisionInput}" will be auto-created.`);
    }

    // Resolve Primary Field
    let primaryFieldId = '';
    let isNewField = false;

    if (primaryFieldInput) {
      const matchedField = existingFieldMap.get(primaryFieldInput.toLowerCase());
      if (matchedField) {
        primaryFieldId = matchedField.id;
      } else {
        isNewField = true;
        const slug = `f-${primaryFieldInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const fId = newFieldsMap.get(primaryFieldInput.toLowerCase())?.id || slug;
        primaryFieldId = fId;
        newFieldsMap.set(primaryFieldInput.toLowerCase(), { name: primaryFieldInput, id: fId });
        messages.push(`New pitch "${primaryFieldInput}" will be auto-created.`);
      }
    } else if (currentAppData.fields.length > 0) {
      primaryFieldId = currentAppData.fields[0].id;
    }

    // Resolve Alternate Fields
    const alternateFieldNames: string[] = [];
    const alternateFieldIds: string[] = [];

    if (alternateFieldsInput) {
      const parts = alternateFieldsInput.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        alternateFieldNames.push(p);
        const match = existingFieldMap.get(p.toLowerCase());
        if (match) {
          alternateFieldIds.push(match.id);
        } else {
          const slug = `f-${p.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          const fId = newFieldsMap.get(p.toLowerCase())?.id || slug;
          alternateFieldIds.push(fId);
          newFieldsMap.set(p.toLowerCase(), { name: p, id: fId });
        }
      });
    }

    // Resolve Size
    let sizeId = 'size-11v11';
    let sizeName = '11v11 Full';
    if (sizeInput) {
      const matchedSize = currentAppData.teamSizes.find(
        (ts) => ts.name.toLowerCase().includes(sizeInput.toLowerCase()) || ts.id === sizeInput
      );
      if (matchedSize) {
        sizeId = matchedSize.id;
        sizeName = matchedSize.name;
      }
    } else if (currentAppData.teamSizes.length > 0) {
      sizeId = currentAppData.teamSizes[0].id;
      sizeName = currentAppData.teamSizes[0].name;
    }

    parsedRows.push({
      rowIndex: index + 2,
      raw,
      teamName,
      divisionName: divisionInput,
      divisionId,
      contactName,
      contactEmail,
      contactPhone,
      primaryFieldName: primaryFieldInput || currentAppData.fields[0]?.name || 'Default Field',
      primaryFieldId,
      alternateFieldNames,
      alternateFieldIds,
      jerseyColor,
      sizeName,
      sizeId,
      notes,
      status,
      messages,
      isNewDivision,
      isNewField,
      isDuplicateTeam: isDuplicate,
    });
  });

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount: parsedRows.filter((r) => r.status === 'valid').length,
    warningCount: parsedRows.filter((r) => r.status === 'warning').length,
    errorCount: parsedRows.filter((r) => r.status === 'error').length,
    newDivisions: Array.from(newDivisionsMap.values()),
    newFields: Array.from(newFieldsMap.values()),
    duplicateTeams: Array.from(new Set(duplicateTeams)),
    headersDetected: rawHeaders,
    columnMapping,
  };
}

// -------------------------------------------------------------
// SCHEDULE IMPORT INTERFACES & PARSER
// -------------------------------------------------------------

export interface ParsedScheduleRow {
  rowIndex: number;
  raw: Record<string, string>;
  date: string;
  time: string;
  homeTeamName: string;
  homeTeamId: string;
  awayTeamName: string;
  awayTeamId: string;
  divisionName: string;
  divisionId: string;
  fieldName: string;
  fieldId: string;
  roundNumber: number;
  isByePractice: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
  notes?: string;
  rowStatus: 'valid' | 'warning' | 'error';
  messages: string[];
  isNewHomeTeam: boolean;
  isNewAwayTeam: boolean;
  isNewField: boolean;
  isNewDivision: boolean;
}

export interface ScheduleImportAnalysis {
  rows: ParsedScheduleRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  newTeams: { name: string; id: string; divisionId: string }[];
  newFields: { name: string; id: string }[];
  newDivisions: { name: string; id: string }[];
  headersDetected: string[];
  columnMapping: Record<string, string>;
}

const SCHEDULE_HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'match date', 'game date', 'match_date', 'game_date', 'day'],
  time: ['time', 'start time', 'match time', 'kickoff', 'game time', 'start_time'],
  homeTeam: ['home team', 'home', 'hometeam', 'team 1', 'home_team', 'team1', 'club home'],
  awayTeam: ['away team', 'away', 'awayteam', 'team 2', 'away_team', 'team2', 'club away'],
  division: ['division', 'division name', 'div', 'age group', 'league', 'flight'],
  field: ['field', 'field name', 'pitch', 'pitch name', 'venue', 'location', 'facility', 'field_name'],
  round: ['round', 'week', 'round number', 'match day', 'matchday', 'gameweek', 'fixture'],
  status: ['status', 'match status', 'state'],
  matchType: ['match type', 'type', 'bye practice', 'game type'],
  homeScore: ['home score', 'home goals', 'score home', 'score_home', 'home_score'],
  awayScore: ['away score', 'away goals', 'score away', 'score_away', 'away_score'],
  notes: ['notes', 'comments', 'remarks', 'referee', 'officials'],
};

function detectScheduleHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[-_]/g, ' '));

  for (const [key, aliases] of Object.entries(SCHEDULE_HEADER_ALIASES)) {
    const idx = normalizedHeaders.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
    if (idx !== -1) {
      mapping[key] = headers[idx];
    }
  }

  return mapping;
}

/**
 * Parses and analyzes game schedule from CSV string.
 */
export function parseScheduleFromCsv(
  csvText: string,
  currentAppData: AppData,
  pendingTeams?: Team[]
): ScheduleImportAnalysis {
  const rawRows = parseCsv(csvText);
  if (rawRows.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      newTeams: [],
      newFields: [],
      newDivisions: [],
      headersDetected: [],
      columnMapping: {},
    };
  }

  const rawHeaders = rawRows[0];
  const dataRows = rawRows.slice(1);
  const columnMapping = detectScheduleHeaderMapping(rawHeaders);

  // Available pools of teams, divisions, fields
  const allTeams = [...currentAppData.teams, ...(pendingTeams || [])];
  const teamLookup = new Map<string, Team>();
  allTeams.forEach((t) => {
    teamLookup.set(t.id.toLowerCase(), t);
    teamLookup.set(t.name.toLowerCase().trim(), t);
  });

  const divisionLookup = new Map<string, Division>();
  currentAppData.divisions.forEach((d) => {
    divisionLookup.set(d.id.toLowerCase(), d);
    divisionLookup.set(d.name.toLowerCase().trim(), d);
  });

  const fieldLookup = new Map<string, Field>();
  currentAppData.fields.forEach((f) => {
    fieldLookup.set(f.id.toLowerCase(), f);
    fieldLookup.set(f.name.toLowerCase().trim(), f);
  });

  const newTeamsMap = new Map<string, { name: string; id: string; divisionId: string }>();
  const newFieldsMap = new Map<string, { name: string; id: string }>();
  const newDivisionsMap = new Map<string, { name: string; id: string }>();

  const parsedRows: ParsedScheduleRow[] = [];

  dataRows.forEach((cols, index) => {
    const raw: Record<string, string> = {};
    rawHeaders.forEach((h, hIdx) => {
      raw[h] = cols[hIdx] || '';
    });

    const getVal = (fieldKey: string): string => {
      const headerName = columnMapping[fieldKey];
      return headerName ? (raw[headerName] || '').trim() : '';
    };

    const dateInput = getVal('date');
    const timeInput = getVal('time');
    const homeTeamInput = getVal('homeTeam');
    const awayTeamInput = getVal('awayTeam');
    const divisionInput = getVal('division');
    const fieldInput = getVal('field');
    const roundInput = getVal('round');
    const statusInput = getVal('status').toLowerCase();
    const matchTypeInput = getVal('matchType').toLowerCase();
    const homeScoreInput = getVal('homeScore');
    const awayScoreInput = getVal('awayScore');
    const notes = getVal('notes');

    const messages: string[] = [];
    let rowStatus: 'valid' | 'warning' | 'error' = 'valid';

    // 1. Validate Date
    const normalizedDate = normalizeDate(dateInput);
    if (!normalizedDate) {
      rowStatus = 'error';
      messages.push(`Invalid date format: "${dateInput}". Expected YYYY-MM-DD or MM/DD/YYYY.`);
    }

    // 2. Validate Time
    const normalizedTime = normalizeTime(timeInput) || '09:00';
    if (!timeInput) {
      if (rowStatus !== 'error') rowStatus = 'warning';
      messages.push('Missing kickoff time, defaulted to 09:00.');
    }

    // 3. Validate Teams
    if (!homeTeamInput) {
      rowStatus = 'error';
      messages.push('Missing Home Team.');
    }
    if (!awayTeamInput) {
      rowStatus = 'error';
      messages.push('Missing Away Team.');
    }
    if (homeTeamInput && awayTeamInput && homeTeamInput.toLowerCase() === awayTeamInput.toLowerCase()) {
      rowStatus = 'error';
      messages.push('Home team and Away team cannot be the same.');
    }

    // Check Home Team
    let homeTeamId = '';
    let isNewHomeTeam = false;
    const matchedHome = teamLookup.get(homeTeamInput.toLowerCase());
    if (matchedHome) {
      homeTeamId = matchedHome.id;
    } else if (homeTeamInput) {
      isNewHomeTeam = true;
      const slug = `t-${homeTeamInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      homeTeamId = newTeamsMap.get(homeTeamInput.toLowerCase())?.id || slug;
      newTeamsMap.set(homeTeamInput.toLowerCase(), {
        name: homeTeamInput,
        id: homeTeamId,
        divisionId: '',
      });
      messages.push(`New team "${homeTeamInput}" will be auto-created.`);
    }

    // Check Away Team
    let awayTeamId = '';
    let isNewAwayTeam = false;
    const matchedAway = teamLookup.get(awayTeamInput.toLowerCase());
    if (matchedAway) {
      awayTeamId = matchedAway.id;
    } else if (awayTeamInput) {
      isNewAwayTeam = true;
      const slug = `t-${awayTeamInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      awayTeamId = newTeamsMap.get(awayTeamInput.toLowerCase())?.id || slug;
      newTeamsMap.set(awayTeamInput.toLowerCase(), {
        name: awayTeamInput,
        id: awayTeamId,
        divisionId: '',
      });
      messages.push(`New team "${awayTeamInput}" will be auto-created.`);
    }

    // Resolve Division
    let divisionName = divisionInput;
    let divisionId = '';
    let isNewDivision = false;

    if (divisionInput) {
      const match = divisionLookup.get(divisionInput.toLowerCase());
      if (match) {
        divisionId = match.id;
        divisionName = match.name;
      } else {
        isNewDivision = true;
        const slug = `div-${divisionInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        divisionId = newDivisionsMap.get(divisionInput.toLowerCase())?.id || slug;
        newDivisionsMap.set(divisionInput.toLowerCase(), { name: divisionInput, id: divisionId });
        messages.push(`New division "${divisionInput}" will be auto-created.`);
      }
    } else {
      // Infer division from matched home or away team
      const homeDivId = matchedHome?.divisionId;
      const awayDivId = matchedAway?.divisionId;
      const inferredDiv = currentAppData.divisions.find((d) => d.id === homeDivId || d.id === awayDivId);
      if (inferredDiv) {
        divisionId = inferredDiv.id;
        divisionName = inferredDiv.name;
      } else if (currentAppData.divisions.length > 0) {
        divisionId = currentAppData.divisions[0].id;
        divisionName = currentAppData.divisions[0].name;
      } else {
        divisionId = 'div-premier';
        divisionName = 'Premier Division';
        newDivisionsMap.set(divisionName.toLowerCase(), { name: divisionName, id: divisionId });
      }
    }

    // Link new teams to this division if unknown
    if (isNewHomeTeam && homeTeamInput) {
      const entry = newTeamsMap.get(homeTeamInput.toLowerCase());
      if (entry) entry.divisionId = divisionId;
    }
    if (isNewAwayTeam && awayTeamInput) {
      const entry = newTeamsMap.get(awayTeamInput.toLowerCase());
      if (entry) entry.divisionId = divisionId;
    }

    // Resolve Field
    let fieldName = fieldInput;
    let fieldId = '';
    let isNewField = false;

    if (fieldInput) {
      const match = fieldLookup.get(fieldInput.toLowerCase());
      if (match) {
        fieldId = match.id;
        fieldName = match.name;
      } else {
        isNewField = true;
        const slug = `f-${fieldInput.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        fieldId = newFieldsMap.get(fieldInput.toLowerCase())?.id || slug;
        newFieldsMap.set(fieldInput.toLowerCase(), { name: fieldInput, id: fieldId });
        messages.push(`New pitch "${fieldInput}" will be auto-created.`);
      }
    } else if (matchedHome?.primaryHomeFieldId) {
      fieldId = matchedHome.primaryHomeFieldId;
      fieldName = fieldLookup.get(fieldId)?.name || 'Home Pitch';
    } else if (currentAppData.fields.length > 0) {
      fieldId = currentAppData.fields[0].id;
      fieldName = currentAppData.fields[0].name;
    } else {
      fieldId = 'f1';
      fieldName = 'Field 1';
      newFieldsMap.set(fieldName.toLowerCase(), { name: fieldName, id: fieldId });
    }

    // Round number
    const roundNumber = parseInt(roundInput, 10) || Math.floor(index / 4) + 1;

    // Status
    let status: 'scheduled' | 'completed' | 'cancelled' = 'scheduled';
    if (statusInput.includes('comp') || statusInput.includes('finish') || statusInput.includes('final')) {
      status = 'completed';
    } else if (statusInput.includes('cancel') || statusInput.includes('postpon')) {
      status = 'cancelled';
    }

    // Bye practice
    const isByePractice =
      matchTypeInput.includes('bye') ||
      matchTypeInput.includes('pract') ||
      homeTeamInput.toLowerCase() === 'bye' ||
      awayTeamInput.toLowerCase() === 'bye';

    // Scores
    let score: { home: number; away: number } | undefined;
    if (homeScoreInput !== '' && awayScoreInput !== '') {
      const h = parseInt(homeScoreInput, 10);
      const a = parseInt(awayScoreInput, 10);
      if (!isNaN(h) && !isNaN(a)) {
        score = { home: h, away: a };
        status = 'completed';
      }
    }

    parsedRows.push({
      rowIndex: index + 2,
      raw,
      date: normalizedDate || dateInput,
      time: normalizedTime,
      homeTeamName: homeTeamInput,
      homeTeamId,
      awayTeamName: awayTeamInput,
      awayTeamId,
      divisionName,
      divisionId,
      fieldName,
      fieldId,
      roundNumber,
      isByePractice,
      status,
      homeScore: score?.home,
      awayScore: score?.away,
      notes,
      rowStatus,
      messages,
      isNewHomeTeam,
      isNewAwayTeam,
      isNewField,
      isNewDivision,
    });
  });

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount: parsedRows.filter((r) => r.rowStatus === 'valid').length,
    warningCount: parsedRows.filter((r) => r.rowStatus === 'warning').length,
    errorCount: parsedRows.filter((r) => r.rowStatus === 'error').length,
    newTeams: Array.from(newTeamsMap.values()),
    newFields: Array.from(newFieldsMap.values()),
    newDivisions: Array.from(newDivisionsMap.values()),
    headersDetected: rawHeaders,
    columnMapping,
  };
}

// -------------------------------------------------------------
// IMPORT EXECUTION
// -------------------------------------------------------------

export function applyTeamsImport(
  appData: AppData,
  analysis: TeamImportAnalysis,
  options: {
    mode: 'append' | 'replace';
    createMissingDivisions: boolean;
    createMissingFields: boolean;
  }
): AppData {
  const updatedAppData: AppData = {
    ...appData,
    divisions: [...appData.divisions],
    fields: [...appData.fields],
    teams: [...appData.teams],
    lastModified: new Date().toISOString(),
  };

  // 1. Auto-create new divisions if needed
  if (options.createMissingDivisions && analysis.newDivisions.length > 0) {
    const existingDivIds = new Set(updatedAppData.divisions.map((d) => d.id));
    analysis.newDivisions.forEach((nd) => {
      if (!existingDivIds.has(nd.id)) {
        updatedAppData.divisions.push({
          id: nd.id,
          name: nd.name,
          playDays: [6], // Saturdays by default
          playTimeSlots: ['09:00', '10:30', '12:00', '13:30'],
          fieldIds: [],
          matchDurationMinutes: 60,
          colorTheme: 'blue',
        });
        existingDivIds.add(nd.id);
      }
    });
  }

  // 2. Auto-create new fields if needed
  if (options.createMissingFields && analysis.newFields.length > 0) {
    const existingFieldIds = new Set(updatedAppData.fields.map((f) => f.id));
    analysis.newFields.forEach((nf) => {
      if (!existingFieldIds.has(nf.id)) {
        updatedAppData.fields.push({
          id: nf.id,
          name: nf.name,
          address: 'Community Sports Complex',
          assignedDivisionIds: updatedAppData.divisions.map((d) => d.id),
          blackoutDates: [],
          size: '11v11 Full',
          surfaceType: 'Natural Grass',
          notes: 'Auto-created via CSV Import',
        });
        existingFieldIds.add(nf.id);
      }
    });
  }

  // 3. Assemble new team records
  const validRows = analysis.rows.filter((r) => r.status !== 'error');
  const newTeamList: Team[] = validRows.map((r) => ({
    id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: r.teamName,
    divisionId: r.divisionId,
    sizeId: r.sizeId,
    primaryHomeFieldId: r.primaryFieldId || updatedAppData.fields[0]?.id || 'f1',
    alternateHomeFieldIds: r.alternateFieldIds,
    notes: r.notes || (r.contactName ? `Coach: ${r.contactName}` : ''),
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    jerseyColor: r.jerseyColor,
  }));

  if (options.mode === 'replace') {
    updatedAppData.teams = newTeamList;
  } else {
    // Append / Merge: update existing teams with same name or add new
    const teamMap = new Map(updatedAppData.teams.map((t) => [t.name.toLowerCase().trim(), t]));
    newTeamList.forEach((nt) => {
      const key = nt.name.toLowerCase().trim();
      if (teamMap.has(key)) {
        const existing = teamMap.get(key)!;
        // Merge attributes
        Object.assign(existing, {
          divisionId: nt.divisionId || existing.divisionId,
          contactName: nt.contactName || existing.contactName,
          contactEmail: nt.contactEmail || existing.contactEmail,
          contactPhone: nt.contactPhone || existing.contactPhone,
          primaryHomeFieldId: nt.primaryHomeFieldId || existing.primaryHomeFieldId,
          jerseyColor: nt.jerseyColor || existing.jerseyColor,
          notes: nt.notes || existing.notes,
        });
      } else {
        updatedAppData.teams.push(nt);
        teamMap.set(key, nt);
      }
    });
  }

  // Update divisions field associations
  updatedAppData.divisions.forEach((div) => {
    if (!div.fieldIds || div.fieldIds.length === 0) {
      div.fieldIds = updatedAppData.fields.map((f) => f.id);
    }
  });

  return updatedAppData;
}

export function applyScheduleImport(
  appData: AppData,
  analysis: ScheduleImportAnalysis,
  options: {
    mode: 'append' | 'replace';
    createMissingTeams: boolean;
    createMissingFields: boolean;
    createMissingDivisions: boolean;
  }
): AppData {
  const updatedAppData: AppData = {
    ...appData,
    divisions: [...appData.divisions],
    fields: [...appData.fields],
    teams: [...appData.teams],
    games: [...appData.games],
    lastModified: new Date().toISOString(),
  };

  // 1. Auto-create divisions
  if (options.createMissingDivisions && analysis.newDivisions.length > 0) {
    const existingDivIds = new Set(updatedAppData.divisions.map((d) => d.id));
    analysis.newDivisions.forEach((nd) => {
      if (!existingDivIds.has(nd.id)) {
        updatedAppData.divisions.push({
          id: nd.id,
          name: nd.name,
          playDays: [6, 0],
          playTimeSlots: ['09:00', '10:30', '12:00', '13:30', '15:00'],
          fieldIds: [],
          matchDurationMinutes: 60,
          colorTheme: 'blue',
        });
        existingDivIds.add(nd.id);
      }
    });
  }

  // 2. Auto-create fields
  if (options.createMissingFields && analysis.newFields.length > 0) {
    const existingFieldIds = new Set(updatedAppData.fields.map((f) => f.id));
    analysis.newFields.forEach((nf) => {
      if (!existingFieldIds.has(nf.id)) {
        updatedAppData.fields.push({
          id: nf.id,
          name: nf.name,
          address: 'League Facility',
          assignedDivisionIds: updatedAppData.divisions.map((d) => d.id),
          blackoutDates: [],
          size: '11v11 Full',
          surfaceType: 'Natural Grass',
          notes: 'Auto-created via Schedule CSV Import',
        });
        existingFieldIds.add(nf.id);
      }
    });
  }

  // 3. Auto-create teams
  const teamIdMap = new Map<string, string>();
  updatedAppData.teams.forEach((t) => {
    teamIdMap.set(t.name.toLowerCase().trim(), t.id);
  });

  if (options.createMissingTeams && analysis.newTeams.length > 0) {
    analysis.newTeams.forEach((nt) => {
      const key = nt.name.toLowerCase().trim();
      if (!teamIdMap.has(key)) {
        const newTeam: Team = {
          id: nt.id,
          name: nt.name,
          divisionId: nt.divisionId || updatedAppData.divisions[0]?.id || 'div-premier',
          sizeId: updatedAppData.teamSizes[0]?.id || 'size-11v11',
          primaryHomeFieldId: updatedAppData.fields[0]?.id || 'f1',
          alternateHomeFieldIds: [],
          notes: 'Auto-created from Schedule Import',
          jerseyColor: 'Navy',
        };
        updatedAppData.teams.push(newTeam);
        teamIdMap.set(key, newTeam.id);
      }
    });
  }

  // 4. Assemble new game records
  const validRows = analysis.rows.filter((r) => r.rowStatus !== 'error');
  const newGames: Game[] = validRows.map((r) => {
    const homeId = teamIdMap.get(r.homeTeamName.toLowerCase().trim()) || r.homeTeamId;
    const awayId = teamIdMap.get(r.awayTeamName.toLowerCase().trim()) || r.awayTeamId;

    const game: Game = {
      id: `g-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
      divisionId: r.divisionId || updatedAppData.divisions[0]?.id || 'div-premier',
      date: r.date,
      time: r.time,
      fieldId: r.fieldId || updatedAppData.fields[0]?.id || 'f1',
      homeTeamId: homeId,
      awayTeamId: awayId,
      isByePractice: r.isByePractice,
      roundNumber: r.roundNumber,
      status: r.status,
      notes: r.notes || '',
    };

    if (r.homeScore !== undefined && r.awayScore !== undefined) {
      game.score = { home: r.homeScore, away: r.awayScore };
    }

    return game;
  });

  if (options.mode === 'replace') {
    updatedAppData.games = newGames;
  } else {
    // Append mode with duplicate prevention (same date, time, field, and teams)
    const existingGameSignatures = new Set(
      updatedAppData.games.map((g) => `${g.date}_${g.time}_${g.fieldId}_${g.homeTeamId}_${g.awayTeamId}`)
    );

    newGames.forEach((ng) => {
      const sig = `${ng.date}_${ng.time}_${ng.fieldId}_${ng.homeTeamId}_${ng.awayTeamId}`;
      if (!existingGameSignatures.has(sig)) {
        updatedAppData.games.push(ng);
        existingGameSignatures.add(sig);
      }
    });
  }

  // Ensure seasonConfig covers new match dates
  if (updatedAppData.games.length > 0) {
    const dates = updatedAppData.games.map((g) => g.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (!updatedAppData.seasonConfig.startDate || minDate < updatedAppData.seasonConfig.startDate) {
      updatedAppData.seasonConfig.startDate = minDate;
    }
    if (!updatedAppData.seasonConfig.endDate || maxDate > updatedAppData.seasonConfig.endDate) {
      updatedAppData.seasonConfig.endDate = maxDate;
    }
  }

  return updatedAppData;
}

// -------------------------------------------------------------
// FIELDS IMPORT INTERFACES & PARSER
// -------------------------------------------------------------

export interface ParsedFieldRow {
  rowIndex: number;
  raw: Record<string, string>;
  fieldName: string;
  address: string;
  googleMapsUrl: string;
  assignedDivisionNames: string[];
  assignedDivisionIds: string[];
  size: string;
  surfaceType: 'Natural Grass' | 'Artificial Turf' | 'Indoor / Futsal' | 'Hybrid';
  blackoutDates: string[];
  notes: string;
  isDuplicate: boolean;
  isNewField: boolean;
  newDivisions: string[];
  status: 'valid' | 'warning' | 'error';
  messages: string[];
}

export interface FieldImportAnalysis {
  rows: ParsedFieldRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  newDivisions: { name: string; id: string }[];
  duplicateFields: string[];
  headersDetected: string[];
  columnMapping: Record<string, string>;
}

const FIELD_HEADER_ALIASES: Record<string, string[]> = {
  fieldName: ['field name', 'field', 'pitch', 'pitch name', 'name', 'venue', 'pitch_name', 'field_name'],
  address: ['address', 'facility address', 'location', 'street address', 'street', 'facility'],
  googleMapsUrl: ['google maps url', 'maps url', 'map url', 'google maps', 'maps link', 'map link', 'location url', 'maps'],
  assignedDivisions: ['assigned divisions', 'divisions', 'division', 'age groups', 'assigned division', 'assigned_divisions', 'divisions assigned'],
  size: ['field size', 'size', 'dimension', 'pitch size', 'format', 'field_size'],
  surfaceType: ['surface type', 'surface', 'turf', 'pitch surface', 'grass', 'surface_type'],
  blackoutDates: ['blackout dates', 'blackouts', 'blackout', 'unavailable dates', 'closed dates', 'blackout_dates'],
  notes: ['notes', 'comments', 'remarks', 'description', 'info'],
};

function detectFieldHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[-_]/g, ' '));

  for (const [key, aliases] of Object.entries(FIELD_HEADER_ALIASES)) {
    const idx = normalizedHeaders.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
    if (idx !== -1) {
      mapping[key] = headers[idx];
    }
  }

  return mapping;
}

export function parseFieldsFromCsv(csvText: string, currentAppData: AppData): FieldImportAnalysis {
  const rawRows = parseCsv(csvText);
  if (rawRows.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      newDivisions: [],
      duplicateFields: [],
      headersDetected: [],
      columnMapping: {},
    };
  }

  const rawHeaders = rawRows[0];
  const dataRows = rawRows.slice(1);
  const columnMapping = detectFieldHeaderMapping(rawHeaders);

  const existingDivMap = new Map<string, Division>();
  currentAppData.divisions.forEach((d) => {
    existingDivMap.set(d.id.toLowerCase(), d);
    existingDivMap.set(d.name.toLowerCase().trim(), d);
  });

  const existingFieldsSet = new Set(currentAppData.fields.map((f) => f.name.toLowerCase().trim()));
  const newDivisionsMap = new Map<string, { name: string; id: string }>();
  const duplicateFields: string[] = [];
  const parsedRows: ParsedFieldRow[] = [];

  dataRows.forEach((cols, index) => {
    const raw: Record<string, string> = {};
    rawHeaders.forEach((h, hIdx) => {
      raw[h] = cols[hIdx] || '';
    });

    const getVal = (fieldKey: string): string => {
      const headerName = columnMapping[fieldKey];
      return headerName ? (raw[headerName] || '').trim() : '';
    };

    const fieldName = getVal('fieldName');
    const address = getVal('address') || 'League Facility';
    const googleMapsUrl = getVal('googleMapsUrl');
    const assignedDivisionsInput = getVal('assignedDivisions');
    const sizeInput = getVal('size') || '11v11 Full';
    const surfaceInput = getVal('surfaceType').toLowerCase();
    const blackoutDatesInput = getVal('blackoutDates');
    const notes = getVal('notes');

    const messages: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';

    if (!fieldName) {
      status = 'error';
      messages.push('Missing field/pitch name.');
    }

    const isDuplicate = existingFieldsSet.has(fieldName.toLowerCase());
    if (isDuplicate) {
      duplicateFields.push(fieldName);
      if (status !== 'error') status = 'warning';
      messages.push('Field already exists in league (will update or append).');
    }

    // Surface Type resolution
    let surfaceType: 'Natural Grass' | 'Artificial Turf' | 'Indoor / Futsal' | 'Hybrid' = 'Natural Grass';
    if (surfaceInput.includes('turf') || surfaceInput.includes('artificial')) {
      surfaceType = 'Artificial Turf';
    } else if (surfaceInput.includes('indoor') || surfaceInput.includes('futsal')) {
      surfaceType = 'Indoor / Futsal';
    } else if (surfaceInput.includes('hybrid')) {
      surfaceType = 'Hybrid';
    }

    // Assigned Divisions resolution
    const assignedDivisionNames: string[] = [];
    const assignedDivisionIds: string[] = [];
    const newDivisions: string[] = [];

    if (assignedDivisionsInput) {
      const rawDivs = assignedDivisionsInput.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      rawDivs.forEach((divName) => {
        assignedDivisionNames.push(divName);
        const matched = existingDivMap.get(divName.toLowerCase());
        if (matched) {
          assignedDivisionIds.push(matched.id);
        } else {
          const slug = `div-${divName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          const divId = newDivisionsMap.get(divName.toLowerCase())?.id || slug;
          assignedDivisionIds.push(divId);
          newDivisions.push(divName);
          newDivisionsMap.set(divName.toLowerCase(), { name: divName, id: divId });
          messages.push(`New division "${divName}" will be auto-created.`);
        }
      });
    } else {
      currentAppData.divisions.forEach((d) => {
        assignedDivisionIds.push(d.id);
        assignedDivisionNames.push(d.name);
      });
    }

    // Blackout dates resolution
    const blackoutDates: string[] = [];
    if (blackoutDatesInput) {
      const rawDates = blackoutDatesInput.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      rawDates.forEach((d) => {
        const norm = normalizeDate(d);
        if (norm) {
          blackoutDates.push(norm);
        }
      });
    }

    parsedRows.push({
      rowIndex: index + 2,
      raw,
      fieldName,
      address,
      googleMapsUrl,
      assignedDivisionNames,
      assignedDivisionIds,
      size: sizeInput,
      surfaceType,
      blackoutDates,
      notes,
      isDuplicate,
      isNewField: !isDuplicate,
      newDivisions,
      status,
      messages,
    });
  });

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount: parsedRows.filter((r) => r.status === 'valid').length,
    warningCount: parsedRows.filter((r) => r.status === 'warning').length,
    errorCount: parsedRows.filter((r) => r.status === 'error').length,
    newDivisions: Array.from(newDivisionsMap.values()),
    duplicateFields: Array.from(new Set(duplicateFields)),
    headersDetected: rawHeaders,
    columnMapping,
  };
}

export function applyFieldsImport(
  appData: AppData,
  analysis: FieldImportAnalysis,
  options: {
    mode: 'append' | 'replace';
    createMissingDivisions: boolean;
  }
): AppData {
  const updatedAppData: AppData = {
    ...appData,
    divisions: [...appData.divisions],
    fields: [...appData.fields],
    lastModified: new Date().toISOString(),
  };

  // 1. Auto-create divisions if enabled
  if (options.createMissingDivisions && analysis.newDivisions.length > 0) {
    const existingDivIds = new Set(updatedAppData.divisions.map((d) => d.id));
    analysis.newDivisions.forEach((nd) => {
      if (!existingDivIds.has(nd.id)) {
        updatedAppData.divisions.push({
          id: nd.id,
          name: nd.name,
          playDays: [6, 0],
          playTimeSlots: ['09:00', '10:30', '12:00', '13:30', '15:00'],
          fieldIds: [],
          matchDurationMinutes: 60,
          colorTheme: 'blue',
        });
        existingDivIds.add(nd.id);
      }
    });
  }

  const validRows = analysis.rows.filter((r) => r.status !== 'error');

  const newFields: Field[] = validRows.map((r) => {
    const slug = `f-${r.fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return {
      id: slug,
      name: r.fieldName,
      address: r.address || 'League Facility',
      googleMapsUrl: r.googleMapsUrl || '',
      assignedDivisionIds: r.assignedDivisionIds,
      size: r.size || '11v11 Full',
      surfaceType: r.surfaceType,
      blackoutDates: r.blackoutDates,
      notes: r.notes || '',
    };
  });

  if (options.mode === 'replace') {
    updatedAppData.fields = newFields;
  } else {
    const fieldMap = new Map<string, Field>();
    updatedAppData.fields.forEach((f) => {
      fieldMap.set(f.name.toLowerCase().trim(), f);
    });

    newFields.forEach((nf) => {
      const key = nf.name.toLowerCase().trim();
      const existing = fieldMap.get(key);
      if (existing) {
        Object.assign(existing, {
          address: nf.address || existing.address,
          googleMapsUrl: nf.googleMapsUrl || existing.googleMapsUrl,
          assignedDivisionIds: Array.from(new Set([...existing.assignedDivisionIds, ...nf.assignedDivisionIds])),
          size: nf.size || existing.size,
          surfaceType: nf.surfaceType || existing.surfaceType,
          blackoutDates: Array.from(new Set([...existing.blackoutDates, ...nf.blackoutDates])),
          notes: nf.notes || existing.notes,
        });
      } else {
        updatedAppData.fields.push(nf);
        fieldMap.set(key, nf);
      }
    });
  }

  // Ensure divisions include their assigned field IDs
  updatedAppData.fields.forEach((f) => {
    f.assignedDivisionIds.forEach((divId) => {
      const div = updatedAppData.divisions.find((d) => d.id === divId);
      if (div) {
        if (!Array.isArray(div.fieldIds)) div.fieldIds = [];
        if (!div.fieldIds.includes(f.id)) {
          div.fieldIds.push(f.id);
        }
      }
    });
  });

  return updatedAppData;
}

// -------------------------------------------------------------
// CSV EXPORT FUNCTIONS (1:1 FORMAT PARITY WITH IMPORTERS)
// -------------------------------------------------------------

export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).trim();
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportTeamsToCsv(appData: AppData, teamsToExport?: Team[]): string {
  const teams = teamsToExport || appData.teams;
  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d.name]));
  const fieldMap = new Map(appData.fields.map((f) => [f.id, f.name]));
  const teamSizeMap = new Map(appData.teamSizes.map((s) => [s.id, s.name]));

  const headers = [
    'Team Name',
    'Division',
    'Coach Name',
    'Contact Email',
    'Contact Phone',
    'Home Field',
    'Alternate Home Fields',
    'Jersey Color',
    'Team Size',
    'Notes',
  ];

  const rows = teams
    .filter((t) => !t.isBye)
    .map((t) => {
      const divName = divisionMap.get(t.divisionId) || '';
      const homeFieldName = fieldMap.get(t.primaryHomeFieldId) || '';
      const altFieldNames = (t.alternateHomeFieldIds || [])
        .map((id) => fieldMap.get(id) || id)
        .filter(Boolean)
        .join('; ');
      const sizeName = teamSizeMap.get(t.sizeId) || t.sizeId || '';

      return [
        escapeCsvCell(t.name),
        escapeCsvCell(divName),
        escapeCsvCell(t.contactName || ''),
        escapeCsvCell(t.contactEmail || ''),
        escapeCsvCell(t.contactPhone || ''),
        escapeCsvCell(homeFieldName),
        escapeCsvCell(altFieldNames),
        escapeCsvCell(t.jerseyColor || ''),
        escapeCsvCell(sizeName),
        escapeCsvCell(t.notes || ''),
      ].join(',');
    });

  return [headers.join(','), ...rows].join('\n');
}

export function exportScheduleToCsv(appData: AppData, gamesToExport?: Game[]): string {
  const games = gamesToExport || appData.games;
  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d.name]));
  const teamMap = new Map(appData.teams.map((t) => [t.id, t.name]));
  const fieldMap = new Map(appData.fields.map((f) => [f.id, f.name]));

  const headers = [
    'Date',
    'Time',
    'Division',
    'Home Team',
    'Away Team',
    'Field',
    'Round',
    'Status',
    'Match Type',
    'Home Score',
    'Away Score',
    'Notes',
  ];

  const rows = games.map((g) => {
    const divName = divisionMap.get(g.divisionId) || '';
    const homeName = teamMap.get(g.homeTeamId) || (g.isByePractice ? 'Bye / Practice' : 'TBD');
    const awayName = teamMap.get(g.awayTeamId) || (g.isByePractice ? 'Practice / Solo' : 'TBD');
    const fieldName = fieldMap.get(g.fieldId) || '';
    const matchType = g.isByePractice ? 'Bye Practice' : 'Regular Match';
    const homeScore = g.score !== undefined ? g.score.home : '';
    const awayScore = g.score !== undefined ? g.score.away : '';

    return [
      escapeCsvCell(g.date),
      escapeCsvCell(g.time),
      escapeCsvCell(divName),
      escapeCsvCell(homeName),
      escapeCsvCell(awayName),
      escapeCsvCell(fieldName),
      escapeCsvCell(g.roundNumber || 1),
      escapeCsvCell(g.status || 'scheduled'),
      escapeCsvCell(matchType),
      escapeCsvCell(homeScore),
      escapeCsvCell(awayScore),
      escapeCsvCell(g.notes || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function exportFieldsToCsv(appData: AppData, fieldsToExport?: Field[]): string {
  const fields = fieldsToExport || appData.fields;
  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d.name]));

  const headers = [
    'Field Name',
    'Address',
    'Google Maps URL',
    'Assigned Divisions',
    'Field Size',
    'Surface Type',
    'Blackout Dates',
    'Notes',
  ];

  const rows = fields.map((f) => {
    const assignedDivNames = (f.assignedDivisionIds || [])
      .map((id) => divisionMap.get(id) || id)
      .filter(Boolean)
      .join('; ');
    const blackout = (f.blackoutDates || []).join('; ');

    return [
      escapeCsvCell(f.name),
      escapeCsvCell(f.address || ''),
      escapeCsvCell(f.googleMapsUrl || ''),
      escapeCsvCell(assignedDivNames),
      escapeCsvCell(f.size || ''),
      escapeCsvCell(f.surfaceType || ''),
      escapeCsvCell(blackout),
      escapeCsvCell(f.notes || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// SAMPLE TEMPLATES
// -------------------------------------------------------------

export function getTeamsCsvTemplate(): string {
  return [
    'Team Name,Division,Coach Name,Contact Email,Contact Phone,Home Field,Jersey Color,Team Size,Notes',
    '"Pacific Strikers","U12 Boys Premier","Marco Rossi","coach.rossi@strikers.org","(310) 555-0144","Memorial Park - Field 1 (South)","Royal Blue","11v11 Full","Defending spring champions"',
    '"Canyon Rapids","U12 Boys Premier","Sarah Jenkins","sjenkins@rapidsfc.com","(310) 555-0189","Memorial Park - Field 2 (North)","Teal & Black","11v11 Full","Roster updated with 14 players"',
    '"Golden Eagles","U10 Girls Classic","Elena Rostova","elena@eaglesfc.org","(310) 555-0219","Clover Field - Pitch A","Gold & Navy","7v7 Small","Under-10 development team"',
    '"Coastal Thunder","U10 Girls Classic","David Kim","dkim@thunder.org","(310) 555-0245","Clover Field - Pitch B","Sky Blue","7v7 Small","Prefers morning match slots"',
  ].join('\n');
}

export function getScheduleCsvTemplate(): string {
  return [
    'Date,Time,Division,Home Team,Away Team,Field,Round,Status,Home Score,Away Score,Notes',
    '"2026-04-11","09:00","U12 Boys Premier","Pacific Strikers","Canyon Rapids","Memorial Park - Field 1 (South)",1,"scheduled",,,"Opening weekend fixture"',
    '"2026-04-11","10:30","U12 Boys Premier","Bay City Storm","Valley United","Memorial Park - Field 1 (South)",1,"scheduled",,,"Referee assigned: Johnson"',
    '"2026-04-11","09:00","U10 Girls Classic","Golden Eagles","Coastal Thunder","Clover Field - Pitch A",1,"scheduled",,,"Small-sided pitch 7v7"',
    '"2026-04-18","09:00","U12 Boys Premier","Canyon Rapids","Bay City Storm","Memorial Park - Field 2 (North)",2,"scheduled",,,"Round 2 clash"',
  ].join('\n');
}

export function getFieldsCsvTemplate(): string {
  return [
    'Field Name,Address,Google Maps URL,Assigned Divisions,Field Size,Surface Type,Blackout Dates,Notes',
    '"Memorial Park - Field 1 (South)","1401 Olympic Blvd, Santa Monica, CA","https://maps.google.com/?q=Memorial+Park+Santa+Monica","U12 Boys Premier; U14 Coed Metro","11v11 Full","Natural Grass","2026-04-19; 2026-05-10","Main stadium pitch with floodlights"',
    '"Memorial Park - Field 2 (North)","1401 Olympic Blvd, Santa Monica, CA","https://maps.google.com/?q=Memorial+Park+Santa+Monica","U12 Boys Premier; U10 Girls Classic","11v11 Full","Artificial Turf","","Regulation artificial turf field"',
    '"Clover Field - Pitch A","2600 Ocean Park Blvd, Santa Monica, CA","https://maps.google.com/?q=Clover+Park+Santa+Monica","U10 Girls Classic","7v7 Small","Natural Grass","2026-04-26","Small-sided field for U10 matches"',
    '"Westside Sports Complex - Turf 1","11301 Wilshire Blvd, Los Angeles, CA","https://maps.google.com/?q=Westside+Complex","U14 Coed Metro","11v11 Full","Artificial Turf","","All-weather turf facility"',
  ].join('\n');
}
