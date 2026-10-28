import { AppData, Referee } from '../types';
import { saveOrExportJson } from './fileExport';

/**
 * Strips confidential referee contact information (phone, email, notes)
 * from the dataset before publishing to the publicly accessible league_schedule.json file.
 * Referee id, name, certificationLevel, and match assignments are preserved
 * so the public schedule displays properly without exposing personal contacts.
 */
export function sanitizeRefereesForPublicSchedule(referees?: Referee[]): Referee[] | undefined {
  if (!referees || !Array.isArray(referees)) return referees;
  return referees.map((r) => {
    const { email: _email, phone: _phone, notes: _notes, ...rest } = r;
    return {
      ...rest,
      email: '',
      phone: '',
    };
  });
}

/**
 * Prepares a sanitized copy of AppData for public publication in league_schedule.json.
 * All referee contact information (email, phone, private notes) is stripped.
 * Teams, fields, divisions, games, and bulletins remain intact.
 */
export function sanitizeDataForPublicPublish(data: AppData): AppData {
  return {
    ...data,
    referees: sanitizeRefereesForPublicSchedule(data.referees),
  };
}

/**
 * Fetches the league schedule data from the server-hosted league_schedule.json file.
 * Includes a cache-busting timestamp parameter to ensure fresh responses.
 * Guards against Apache/Nginx SPA fallback returning index.html as a 200 response.
 */
export async function fetchServerLeagueSchedule(): Promise<AppData> {
  const response = await fetch(`/league_schedule.json?t=${Date.now()}`);
  
  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} when fetching league_schedule.json`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  // Guard against SPA fallback: If Apache/server rewrites non-matching paths to index.html,
  // response.ok is 200 but the body contains "<!doctype html ...>"
  const trimmed = text.trim();
  if (
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<')
  ) {
    throw new Error(
      'Server returned HTML (index.html) instead of league_schedule.json. ' +
      'Apache rewrite rules are redirecting .json requests to the SPA fallback index.html.'
    );
  }

  let data: AppData;
  try {
    data = JSON.parse(text);
  } catch (err: any) {
    throw new Error(`Invalid JSON in league_schedule.json: ${err.message}`);
  }

  if (!data || !Array.isArray(data.divisions) || !Array.isArray(data.teams) || !Array.isArray(data.games)) {
    throw new Error('Invalid format: Missing divisions, teams, or games in league_schedule.json');
  }

  return data;
}

/**
 * Publishes the current league dataset to the server's league_schedule.json file via /api/publish-schedule.
 * Note: Referee contact information (phone, email, notes) is automatically stripped before publishing
 * to guarantee that private contacts are never publicly accessible in league_schedule.json.
 * Full contact information remains safe in the admin's downloaded JSON dataset and database backups.
 */
export async function publishScheduleToServer(
  data: AppData
): Promise<{ success: boolean; message: string; updatedAt?: string }> {
  // Strip private referee contact details exclusively for the public file
  const publicData = sanitizeDataForPublicPublish(data);

  let response: Response;
  try {
    response = await fetch('/api/publish-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(publicData),
    });
  } catch (err: any) {
    throw new Error(`Network error connecting to /api/publish-schedule: ${err.message}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const trimmed = text.trim();

  // Guard against SPA fallback rewriting /api/publish-schedule to index.html
  if (
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<')
  ) {
    throw new Error(
      'The server returned HTML instead of JSON. If running Apache without a Node.js backend proxy, ' +
      '/api/publish-schedule is being rewritten to index.html. Use the "Download league_schedule.json" ' +
      'button to place the updated file directly into your Apache document root.'
    );
  }

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Server returned unexpected non-JSON response: ${text.slice(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(result.error || `Server returned HTTP ${response.status}`);
  }

  return result;
}

/**
 * Helper to download or directly overwrite the current AppData as a ready-to-deploy league_schedule.json file.
 * Automatically sanitizes referee contact details (phone, email, notes) for public deployment.
 * If preferOverwrite is true and supported (Chrome/Edge), it prompts the browser's native file picker
 * allowing the user to select the existing file and overwrite it in-place without appending (1).
 */
export async function downloadLeagueScheduleJson(
  data: AppData,
  fileName = 'league_schedule.json',
  preferOverwrite = true
) {
  // Strip private referee contact details when generating public league_schedule.json
  const publicData = sanitizeDataForPublicPublish(data);
  return saveOrExportJson(publicData, fileName, { preferOverwrite });
}

