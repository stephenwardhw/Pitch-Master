import { AppData, Conflict, Field, Game, Referee } from '../types';

export function detectConflicts(appData: AppData, gamesToInspect?: Game[]): Conflict[] {
  const games = gamesToInspect || appData.games;
  const conflicts: Conflict[] = [];

  const fieldMap = new Map(appData.fields.map((f) => [f.id, f]));
  const teamMap = new Map(appData.teams.map((t) => [t.id, t]));
  const divisionMap = new Map(appData.divisions.map((d) => [d.id, d]));
  const seasonBlackoutSet = new Set(appData.seasonConfig?.blackoutDates || []);

  // 1. Group by field + date + time for double-booking
  const fieldSlotMap = new Map<string, Game[]>();
  // 2. Group by team + date + time for double-booking
  const teamSlotMap = new Map<string, Game[]>();

  for (const game of games) {
    if (game.status === 'cancelled') continue;

    // Field slots
    const fieldSlotKey = `${game.fieldId}_${game.date}_${game.time}`;
    if (!fieldSlotMap.has(fieldSlotKey)) {
      fieldSlotMap.set(fieldSlotKey, []);
    }
    fieldSlotMap.get(fieldSlotKey)!.push(game);

    // Team slots (check home & away, skip "Bye" teams)
    const homeTeam = teamMap.get(game.homeTeamId);
    if (homeTeam && !homeTeam.isBye && homeTeam.name !== 'Bye') {
      const homeSlotKey = `${homeTeam.id}_${game.date}_${game.time}`;
      if (!teamSlotMap.has(homeSlotKey)) {
        teamSlotMap.set(homeSlotKey, []);
      }
      teamSlotMap.get(homeSlotKey)!.push(game);
    }

    const awayTeam = teamMap.get(game.awayTeamId);
    if (awayTeam && !awayTeam.isBye && awayTeam.name !== 'Bye') {
      const awaySlotKey = `${awayTeam.id}_${game.date}_${game.time}`;
      if (!teamSlotMap.has(awaySlotKey)) {
        teamSlotMap.set(awaySlotKey, []);
      }
      teamSlotMap.get(awaySlotKey)!.push(game);
    }

    // 3. Check Field Blackout dates
    const field = fieldMap.get(game.fieldId);
    if (field && field.blackoutDates && field.blackoutDates.includes(game.date)) {
      // Find alternate fields for home team
      const homeTeamObj = teamMap.get(game.homeTeamId);
      const suggestedFields = (homeTeamObj?.alternateHomeFieldIds || []).filter(
        (altId) => altId !== game.fieldId && !fieldMap.get(altId)?.blackoutDates?.includes(game.date)
      );

      conflicts.push({
        id: `c-field-blackout-${game.id}`,
        type: 'field_blackout',
        severity: 'error',
        title: `Field Closed on Match Date`,
        description: `Field "${field.name}" is marked unavailable/blacked out on ${game.date}.`,
        gameIds: [game.id],
        date: game.date,
        time: game.time,
        fieldId: game.fieldId,
        suggestedResolution: suggestedFields.length > 0
          ? `Move to home team's alternate field: ${suggestedFields.map((fId) => fieldMap.get(fId)?.name || fId).join(', ')}`
          : `Reassign to another available division field.`,
        suggestedFieldIds: suggestedFields,
      });
    }

    // 4. Check Season Blackout dates
    if (seasonBlackoutSet.has(game.date)) {
      conflicts.push({
        id: `c-season-blackout-${game.id}`,
        type: 'season_blackout',
        severity: 'warning',
        title: `Season Blackout Holiday Date`,
        description: `Match is scheduled on ${game.date}, which is designated as a season holiday/break date.`,
        gameIds: [game.id],
        date: game.date,
        time: game.time,
        suggestedResolution: `Reschedule match to an official league game date.`,
      });
    }

    // 5. Check Division Field Allowed
    const division = divisionMap.get(game.divisionId);
    if (division && division.fieldIds.length > 0 && !division.fieldIds.includes(game.fieldId)) {
      const validFieldNames = division.fieldIds.map((fId) => fieldMap.get(fId)?.name || fId).join(', ');
      conflicts.push({
        id: `c-div-field-${game.id}`,
        type: 'field_not_in_division',
        severity: 'warning',
        title: `Field Not Assigned to Division`,
        description: `Field "${field?.name || game.fieldId}" is not in the approved field list for division "${division.name}".`,
        gameIds: [game.id],
        date: game.date,
        time: game.time,
        fieldId: game.fieldId,
        suggestedResolution: `Change field to an approved division pitch: ${validFieldNames}`,
        suggestedFieldIds: division.fieldIds,
      });
    }

    // 6. Check Referee Blackout dates
    if (appData.referees) {
      const refMap = new Map(appData.referees.map((r) => [r.id, r]));
      const assignedRefIds = [game.refereeId, game.assistantReferee1Id, game.assistantReferee2Id].filter(Boolean) as string[];
      for (const rId of assignedRefIds) {
        const ref = refMap.get(rId);
        if (ref && ref.blackoutDates && ref.blackoutDates.includes(game.date)) {
          conflicts.push({
            id: `c-ref-blackout-${rId}-${game.id}`,
            type: 'referee_blackout',
            severity: 'error',
            title: `Referee Unavailable (Blackout Date)`,
            description: `Referee ${ref.name} is scheduled on ${game.date}, which is marked on their unavailable blackout calendar.`,
            gameIds: [game.id],
            date: game.date,
            time: game.time,
            suggestedResolution: `Reassign match official in the Referee Directory or Match Editor.`,
          });
        }
      }
    }
  }

  // 1. Process Field double booking
  fieldSlotMap.forEach((bookedGames, key) => {
    if (bookedGames.length > 1) {
      const [fieldId, date, time] = key.split('_');
      const field = fieldMap.get(fieldId);
      const fieldName = field ? field.name : fieldId;

      // Check alternate fields of home teams involved
      const suggestedAlts: string[] = [];
      bookedGames.forEach((g) => {
        const hTeam = teamMap.get(g.homeTeamId);
        if (hTeam?.alternateHomeFieldIds) {
          hTeam.alternateHomeFieldIds.forEach((alt) => {
            if (!suggestedAlts.includes(alt) && alt !== fieldId) {
              suggestedAlts.push(alt);
            }
          });
        }
      });

      conflicts.push({
        id: `c-field-double-${key}`,
        type: 'field_double_booked',
        severity: 'error',
        title: `Pitch Overlap / Double Booking`,
        description: `${bookedGames.length} matches are booked simultaneously at "${fieldName}" on ${date} at ${time}.`,
        gameIds: bookedGames.map((g) => g.id),
        date,
        time,
        fieldId,
        suggestedResolution: `Reassign one match to an alternate field (e.g. ${suggestedAlts.map((id) => fieldMap.get(id)?.name || id).join(', ') || 'available division field'}) or another time slot.`,
        suggestedFieldIds: suggestedAlts,
      });
    }
  });

  // 2. Process Team double booking
  teamSlotMap.forEach((bookedGames, key) => {
    if (bookedGames.length > 1) {
      const [teamId, date, time] = key.split('_');
      const team = teamMap.get(teamId);
      const teamName = team ? team.name : teamId;

      conflicts.push({
        id: `c-team-double-${key}`,
        type: 'team_double_booked',
        severity: 'error',
        title: `Team Double Booked`,
        description: `Team "${teamName}" has ${bookedGames.length} matches scheduled simultaneously on ${date} at ${time}.`,
        gameIds: bookedGames.map((g) => g.id),
        date,
        time,
        teamId,
        suggestedResolution: `Move one of the games to another time slot or date.`,
      });
    }
  });

  // 3. Process Referee double booking
  if (appData.referees) {
    const refMap = new Map(appData.referees.map((r) => [r.id, r]));
    const refSlotMap = new Map<string, Game[]>();

    for (const game of games) {
      if (game.status === 'cancelled') continue;
      const assigned = [game.refereeId, game.assistantReferee1Id, game.assistantReferee2Id].filter(Boolean) as string[];
      for (const rId of assigned) {
        const slotKey = `${rId}_${game.date}_${game.time}`;
        if (!refSlotMap.has(slotKey)) {
          refSlotMap.set(slotKey, []);
        }
        refSlotMap.get(slotKey)!.push(game);
      }
    }

    refSlotMap.forEach((bookedGames, key) => {
      if (bookedGames.length > 1) {
        const [refId, date, time] = key.split('_');
        const ref = refMap.get(refId);
        const refName = ref ? ref.name : 'Referee';

        conflicts.push({
          id: `c-ref-double-${key}`,
          type: 'referee_double_booked',
          severity: 'error',
          title: `Referee Double Booked`,
          description: `Referee ${refName} is assigned to ${bookedGames.length} simultaneous games on ${date} at ${time}.`,
          gameIds: bookedGames.map((g) => g.id),
          date,
          time,
          suggestedResolution: `Reassign one of the games to another available official in the Referee Directory.`,
        });
      }
    });
  }

  return conflicts;
}

// Find open available fields at a specific date and time for a division
export function getAvailableFieldsAtSlot(
  appData: AppData,
  date: string,
  time: string,
  divisionId?: string,
  excludeGameId?: string
): Field[] {
  const division = divisionId ? appData.divisions.find((d) => d.id === divisionId) : undefined;
  const allowedFieldIds = division && division.fieldIds.length > 0 ? new Set(division.fieldIds) : null;

  const bookedFieldIds = new Set<string>();
  for (const game of appData.games) {
    if (game.id === excludeGameId || game.status === 'cancelled') continue;
    if (game.date === date && game.time === time) {
      bookedFieldIds.add(game.fieldId);
    }
  }

  return appData.fields.filter((field) => {
    // If division restricts fields, must be in division
    if (allowedFieldIds && !allowedFieldIds.has(field.id)) return false;
    // Check field blackout
    if (field.blackoutDates && field.blackoutDates.includes(date)) return false;
    // Check if booked
    if (bookedFieldIds.has(field.id)) return false;
    return true;
  });
}

// Find available certified referees at a specific date and time slot
export function getAvailableRefereesAtSlot(
  appData: AppData,
  date: string,
  time: string,
  divisionId?: string,
  excludeGameId?: string
): { referee: Referee; isBusy: boolean; isBlackout: boolean; isPreferred: boolean }[] {
  if (!appData.referees || appData.referees.length === 0) return [];

  const bookedRefIds = new Set<string>();
  for (const game of appData.games) {
    if (game.id === excludeGameId || game.status === 'cancelled') continue;
    if (game.date === date && game.time === time) {
      if (game.refereeId) bookedRefIds.add(game.refereeId);
      if (game.assistantReferee1Id) bookedRefIds.add(game.assistantReferee1Id);
      if (game.assistantReferee2Id) bookedRefIds.add(game.assistantReferee2Id);
    }
  }

  return appData.referees.map((ref) => {
    const isBusy = bookedRefIds.has(ref.id);
    const isBlackout = !!(ref.blackoutDates && ref.blackoutDates.includes(date));
    const isPreferred = !divisionId || ref.preferredDivisionIds.length === 0 || ref.preferredDivisionIds.includes(divisionId);
    return {
      referee: ref,
      isBusy,
      isBlackout,
      isPreferred,
    };
  });
}
