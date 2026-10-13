import { AppData } from '../types';

/**
 * Fetches the league schedule data from the server-hosted league_schedule.json file.
 * Includes a cache-busting timestamp parameter to ensure fresh responses.
 */
export async function fetchServerLeagueSchedule(): Promise<AppData> {
  const response = await fetch(`/league_schedule.json?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} when fetching league_schedule.json`);
  }
  const data: AppData = await response.json();
  if (!data || !Array.isArray(data.divisions) || !Array.isArray(data.teams) || !Array.isArray(data.games)) {
    throw new Error('Invalid format: Missing divisions, teams, or games in league_schedule.json');
  }
  return data;
}

/**
 * Publishes the current league dataset to the server's league_schedule.json file via /api/publish-schedule.
 */
export async function publishScheduleToServer(
  data: AppData
): Promise<{ success: boolean; message: string; updatedAt?: string }> {
  const response = await fetch('/api/publish-schedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMsg = `Server returned HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // Ignore JSON parse error on non-ok response
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
