import { AppData } from '../types';

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
 * If running on a static Apache server without a Node.js backend, handles HTML responses gracefully.
 */
export async function publishScheduleToServer(
  data: AppData
): Promise<{ success: boolean; message: string; updatedAt?: string }> {
  let response: Response;
  try {
    response = await fetch('/api/publish-schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
 * Helper to download the current AppData as a ready-to-deploy league_schedule.json file.
 */
export function downloadLeagueScheduleJson(data: AppData, fileName = 'league_schedule.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

