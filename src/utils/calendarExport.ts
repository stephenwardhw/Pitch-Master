import { Division, Field, Game, Team } from '../types';

export interface CalendarEventPayload {
  title: string;
  description: string;
  location: string;
  startIso: string; // YYYY-MM-DDTHH:MM:SS
  endIso: string;   // YYYY-MM-DDTHH:MM:SS
  startCompact: string; // YYYYMMDDTHHMMSS
  endCompact: string;   // YYYYMMDDTHHMMSS
  uid: string;
}

// Convert game, teams, division, and field into a clean event payload
export function buildEventPayload(
  game: Game,
  teams: Team[],
  divisions: Division[],
  fields: Field[]
): CalendarEventPayload {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const divisionMap = new Map(divisions.map((d) => [d.id, d]));
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  const homeTeam = teamMap.get(game.homeTeamId);
  const awayTeam = teamMap.get(game.awayTeamId);
  const division = divisionMap.get(game.divisionId);
  const field = fieldMap.get(game.fieldId);

  // Match title
  let title = '';
  if (game.isByePractice) {
    title = `${homeTeam?.name || 'Home Team'} - Practice Session (Bye Round)`;
  } else {
    title = `${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'} (${division?.name || 'Soccer Match'})`;
  }

  // Location string
  const locationParts: string[] = [];
  if (field?.name) locationParts.push(field.name);
  if (field?.address) locationParts.push(field.address);
  const location = locationParts.join(', ') || 'Soccer Field';

  // Description / Details
  const descLines: string[] = [];
  descLines.push(`Division: ${division?.name || 'League'}`);
  descLines.push(`Round: ${game.roundNumber}`);
  if (field?.size) descLines.push(`Pitch Format: ${field.size} (${field.surfaceType || 'Pitch'})`);

  if (homeTeam) {
    descLines.push('');
    descLines.push(`Home Team: ${homeTeam.name}`);
    if (homeTeam.contactName) descLines.push(`Coach: ${homeTeam.contactName}`);
    if (homeTeam.contactPhone) descLines.push(`Phone: ${homeTeam.contactPhone}`);
    if (homeTeam.contactEmail) descLines.push(`Email: ${homeTeam.contactEmail}`);
    if (homeTeam.jerseyColor) descLines.push(`Jersey: ${homeTeam.jerseyColor}`);
  }

  if (awayTeam && !game.isByePractice) {
    descLines.push('');
    descLines.push(`Away Team: ${awayTeam.name}`);
    if (awayTeam.contactName) descLines.push(`Coach: ${awayTeam.contactName}`);
    if (awayTeam.contactPhone) descLines.push(`Phone: ${awayTeam.contactPhone}`);
    if (awayTeam.contactEmail) descLines.push(`Email: ${awayTeam.contactEmail}`);
    if (awayTeam.jerseyColor) descLines.push(`Jersey: ${awayTeam.jerseyColor}`);
  }

  if (game.notes) {
    descLines.push('');
    descLines.push(`Notes: ${game.notes}`);
  }

  const description = descLines.join('\n');

  // Match duration (default 75 minutes if not specified)
  const durationMinutes = division?.matchDurationMinutes || 75;

  // Build timestamps
  const [yyyy, mm, dd] = game.date.split('-');
  const [hourStr, minStr] = game.time.split(':');
  const startHour = Number(hourStr) || 9;
  const startMin = Number(minStr) || 0;

  const startDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd), startHour, startMin, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const formatIso = (d: Date) => {
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D}T${h}:${m}:${s}`;
  };

  const formatCompact = (d: Date) => {
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}${M}${D}T${h}${m}${s}`;
  };

  return {
    title,
    description,
    location,
    startIso: formatIso(startDate),
    endIso: formatIso(endDate),
    startCompact: formatCompact(startDate),
    endCompact: formatCompact(endDate),
    uid: `pitchmaster-game-${game.id}@pitchmaster.app`,
  };
}

// Generate Google Calendar Event Link
export function createGoogleCalendarUrl(payload: CalendarEventPayload): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: payload.title,
    dates: `${payload.startCompact}/${payload.endCompact}`,
    details: payload.description,
    location: payload.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Outlook Calendar Event Link (Live / Office 365)
export function createOutlookCalendarUrl(payload: CalendarEventPayload): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: payload.title,
    startdt: payload.startIso,
    enddt: payload.endIso,
    body: payload.description,
    location: payload.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Escape special characters for RFC 5545 iCalendar values
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate full .ics file text for a list of games
export function generateIcsContent(
  games: Game[],
  teams: Team[],
  divisions: Division[],
  fields: Field[],
  calendarName: string = 'Soccer League Schedule'
): string {
  const now = new Date();
  const nowCompact = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PitchMaster//Soccer Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const game of games) {
    if (game.status === 'cancelled') continue;
    const payload = buildEventPayload(game, teams, divisions, fields);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${payload.uid}`);
    lines.push(`DTSTAMP:${nowCompact}`);
    lines.push(`DTSTART:${payload.startCompact}`);
    lines.push(`DTEND:${payload.endCompact}`);
    lines.push(`SUMMARY:${escapeIcsText(payload.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(payload.description)}`);
    lines.push(`LOCATION:${escapeIcsText(payload.location)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

// Trigger browser download of .ics file
export function downloadIcsFile(
  icsContent: string,
  filename: string = 'soccer_schedule.ics'
): void {
  const cleanName = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
