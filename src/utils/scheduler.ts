import { AppData, DayOfWeek, Division, Field, Game, SeasonConfig, Team } from '../types';

interface PairMatch {
  homeTeamId: string;
  awayTeamId: string;
  isByePractice: boolean;
  activeRealTeamId: string;
}

// Generate round robin pairings for an array of teams (adds "Bye" if odd)
export function generateRoundRobinPairings(
  teams: Team[],
  division: Division
): { rounds: PairMatch[][]; byeTeam: Team | null } {
  const teamList = [...teams];
  let byeTeam: Team | null = null;

  // Odd number of teams: add "Bye" team
  if (teamList.length % 2 !== 0) {
    byeTeam = {
      id: `bye-${division.id}`,
      name: 'Bye',
      divisionId: division.id,
      sizeId: teamList[0]?.sizeId || '',
      primaryHomeFieldId: '',
      alternateHomeFieldIds: [],
      notes: 'Automated bye slot. Opponent holds dedicated home practice game.',
      isBye: true,
    };
    teamList.push(byeTeam);
  }

  const n = teamList.length;
  if (n < 2) {
    return { rounds: [], byeTeam };
  }

  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const rounds: PairMatch[][] = [];

  // Berger tables algorithm with alternating home/away balance
  // Keep element 0 fixed, rotate elements 1 through n-1
  const indices = teamList.map((_, i) => i);

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches: PairMatch[] = [];

    for (let m = 0; m < matchesPerRound; m++) {
      const idxA = indices[m];
      const idxB = indices[n - 1 - m];

      const teamA = teamList[idxA];
      const teamB = teamList[idxB];

      const isABye = !!teamA.isBye || teamA.name === 'Bye';
      const isBBye = !!teamB.isBye || teamB.name === 'Bye';

      if (isABye && isBBye) continue;

      if (isABye) {
        // Spec: "ensure that the other team for this game is set to the home team on the home field.
        // This should become a practice game which is located on the teams home field or one of its alternate fields."
        roundMatches.push({
          homeTeamId: teamB.id,
          awayTeamId: teamA.id,
          isByePractice: true,
          activeRealTeamId: teamB.id,
        });
      } else if (isBBye) {
        roundMatches.push({
          homeTeamId: teamA.id,
          awayTeamId: teamB.id,
          isByePractice: true,
          activeRealTeamId: teamA.id,
        });
      } else {
        // Alternate home and away to achieve balanced home/away distribution
        const isAHome = (r + m) % 2 === 0;
        roundMatches.push({
          homeTeamId: isAHome ? teamA.id : teamB.id,
          awayTeamId: isAHome ? teamB.id : teamA.id,
          isByePractice: false,
          activeRealTeamId: isAHome ? teamA.id : teamB.id,
        });
      }
    }

    rounds.push(roundMatches);

    // Rotate indices: keep indices[0] fixed, shift remainder
    const last = indices.pop()!;
    indices.splice(1, 0, last);
  }

  return { rounds, byeTeam };
}

// Generate array of calendar date strings (YYYY-MM-DD) between start and end
export function getDatesForPlayDays(
  startDateStr: string,
  endDateStr: string,
  allowedDays: DayOfWeek[],
  blackoutDates: string[]
): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');
  const blackoutSet = new Set(blackoutDates);

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay() as DayOfWeek;
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (allowedDays.includes(dayOfWeek) && !blackoutSet.has(dateStr)) {
      dates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Full automated scheduling generator
export function generateLeagueSchedule(
  appData: AppData,
  targetDivisionId?: string
): {
  games: Game[];
  syntheticTeams: Team[];
  conflictCount: number;
} {
  const { seasonConfig, divisions, teams, fields } = appData;
  const isSingleDivision = targetDivisionId && targetDivisionId !== 'all';

  // If targeting a single division, preserve games from other divisions:
  const preservedGames = isSingleDivision
    ? appData.games.filter((g) => g.divisionId !== targetDivisionId)
    : [];

  const newGames: Game[] = [...preservedGames];
  const syntheticTeams: Team[] = [];

  // Track global field assignments across all divisions to prevent double booking:
  // key: `${fieldId}_${date}_${time}` -> gameId
  const occupiedFieldSlots = new Map<string, string>();
  // Track team commitments:
  // key: `${teamId}_${date}_${time}` -> gameId
  const occupiedTeamSlots = new Map<string, string>();

  // Pre-populate occupied slots from preserved games
  for (const pg of preservedGames) {
    if (pg.status === 'cancelled') continue;
    occupiedFieldSlots.set(`${pg.fieldId}_${pg.date}_${pg.time}`, pg.id);
    occupiedTeamSlots.set(`${pg.homeTeamId}_${pg.date}_${pg.time}`, pg.id);
    occupiedTeamSlots.set(`${pg.awayTeamId}_${pg.date}_${pg.time}`, pg.id);
  }

  // Map fields by id
  const fieldMap = new Map<string, Field>(fields.map((f) => [f.id, f]));
  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

  // Helper to check if a field is available at a given date/time
  const isFieldAvailable = (fieldId: string, date: string, time: string): boolean => {
    const field = fieldMap.get(fieldId);
    if (!field) return false;
    // Check field blackout date
    if (field.blackoutDates?.includes(date)) return false;
    // Check if slot already reserved
    const slotKey = `${fieldId}_${date}_${time}`;
    return !occupiedFieldSlots.has(slotKey);
  };

  // Helper to check if teams are free at that slot
  const areTeamsAvailable = (teamAId: string, teamBId: string, date: string, time: string): boolean => {
    const keyA = `${teamAId}_${date}_${time}`;
    const keyB = `${teamBId}_${date}_${time}`;
    if (occupiedTeamSlots.has(keyA)) return false;
    if (occupiedTeamSlots.has(keyB)) return false;
    return true;
  };

  for (const division of divisions) {
    if (isSingleDivision && division.id !== targetDivisionId) continue;
    const divTeams = teams.filter((t) => t.divisionId === division.id);
    if (divTeams.length === 0) continue;

    // 1. Generate round robin pairing rounds
    const { rounds, byeTeam } = generateRoundRobinPairings(divTeams, division);
    if (byeTeam) {
      syntheticTeams.push(byeTeam);
      teamMap.set(byeTeam.id, byeTeam);
    }

    if (rounds.length === 0) continue;

    // 2. Find available calendar dates for this division
    const validDates = getDatesForPlayDays(
      seasonConfig.startDate,
      seasonConfig.endDate,
      division.playDays,
      seasonConfig.blackoutDates
    );

    if (validDates.length === 0) continue;

    const timeSlots = division.playTimeSlots.length > 0 ? division.playTimeSlots : ['10:00'];
    const divisionFields = division.fieldIds.length > 0 ? division.fieldIds : fields.map((f) => f.id);

    // 3. Fill available dates with round rotation from season start to season end
    // "The scheduler should fill the game days with the game rotation starting on the season start and ending on the season end.
    // It does not matter if the teams play each other exactly the same number of times."
    let dateIdx = 0;
    let roundCycleIdx = 0;

    while (dateIdx < validDates.length) {
      const matchDate = validDates[dateIdx];
      // Pick round from round-robin rotation
      const roundMatches = rounds[roundCycleIdx % rounds.length];
      const isReturnLeg = Math.floor(roundCycleIdx / rounds.length) % 2 === 1;

      // Assign each match of this round to a time slot and field
      for (let mIdx = 0; mIdx < roundMatches.length; mIdx++) {
        const rawMatch = roundMatches[mIdx];
        let homeTeamId = rawMatch.homeTeamId;
        let awayTeamId = rawMatch.awayTeamId;

        // If this is a return cycle and not a bye game, invert home/away for balance
        if (isReturnLeg && !rawMatch.isByePractice) {
          homeTeamId = rawMatch.awayTeamId;
          awayTeamId = rawMatch.homeTeamId;
        }

        const homeTeam = teamMap.get(homeTeamId);
        const awayTeam = teamMap.get(awayTeamId);

        // Find candidate fields in order of priority:
        // Priority 1: Home team's primary home field (if assigned to division)
        // Priority 2: Home team's alternate fields ("If there is a conflict on the field, try choosing one of the teams alternate fields")
        // Priority 3: Any available division field
        const candidateFields: string[] = [];
        if (homeTeam?.primaryHomeFieldId && divisionFields.includes(homeTeam.primaryHomeFieldId)) {
          candidateFields.push(homeTeam.primaryHomeFieldId);
        }
        if (homeTeam?.alternateHomeFieldIds) {
          for (const altFieldId of homeTeam.alternateHomeFieldIds) {
            if (divisionFields.includes(altFieldId) && !candidateFields.includes(altFieldId)) {
              candidateFields.push(altFieldId);
            }
          }
        }
        for (const divFieldId of divisionFields) {
          if (!candidateFields.includes(divFieldId)) {
            candidateFields.push(divFieldId);
          }
        }

        // Try to find a collision-free (field + time) combination
        let chosenFieldId = candidateFields[0] || divisionFields[0] || fields[0]?.id || 'f1';
        let chosenTime = timeSlots[mIdx % timeSlots.length];
        let assignedSlot = false;

        // Strategy A: Iterate over time slots and candidate fields
        slotSearch: for (const timeSlot of timeSlots) {
          if (!areTeamsAvailable(homeTeamId, awayTeamId, matchDate, timeSlot)) {
            continue;
          }
          for (const fieldId of candidateFields) {
            if (isFieldAvailable(fieldId, matchDate, timeSlot)) {
              chosenFieldId = fieldId;
              chosenTime = timeSlot;
              assignedSlot = true;
              break slotSearch;
            }
          }
        }

        // If no completely free slot was found, pick primary or first candidate and record game
        if (!assignedSlot) {
          chosenFieldId = candidateFields[0] || divisionFields[0] || 'f1';
          chosenTime = timeSlots[mIdx % timeSlots.length];
        }

        const gameId = `g-${division.id}-r${roundCycleIdx + 1}-m${mIdx + 1}-${matchDate.replace(/-/g, '')}`;

        // Reserve slots in global tracking
        occupiedFieldSlots.set(`${chosenFieldId}_${matchDate}_${chosenTime}`, gameId);
        if (homeTeamId && !homeTeam?.isBye) {
          occupiedTeamSlots.set(`${homeTeamId}_${matchDate}_${chosenTime}`, gameId);
        }
        if (awayTeamId && !awayTeam?.isBye) {
          occupiedTeamSlots.set(`${awayTeamId}_${matchDate}_${chosenTime}`, gameId);
        }

        newGames.push({
          id: gameId,
          divisionId: division.id,
          date: matchDate,
          time: chosenTime,
          fieldId: chosenFieldId,
          homeTeamId,
          awayTeamId,
          isByePractice: rawMatch.isByePractice,
          roundNumber: roundCycleIdx + 1,
          status: 'scheduled',
          notes: rawMatch.isByePractice
            ? `Bye Practice Session on home / alternate pitch for ${homeTeam?.name || 'Home Team'}`
            : undefined,
        });
      }

      dateIdx++;
      roundCycleIdx++;
    }
  }

  // Sort games chronologically by date and time
  newGames.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return {
    games: newGames,
    syntheticTeams,
    conflictCount: 0,
  };
}
