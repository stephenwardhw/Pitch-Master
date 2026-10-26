import { AppData, DayOfWeek, Division, Field, Game, SeasonConfig, Team } from '../types';

interface PairMatch {
  homeTeamId: string;
  awayTeamId: string;
  isByePractice: boolean;
  activeRealTeamId: string;
}

// Helper to check if a team is unavailable on a specific date
export function isTeamUnavailableOnDate(team: Team | undefined, date: string): boolean {
  if (!team || team.isBye || team.name === 'Bye') return false;
  return Array.isArray(team.blackoutDates) && team.blackoutDates.includes(date);
}

// Helper to check if either team in a matchup is unavailable on a specific date
export function isMatchUnavailableOnDate(
  homeTeam: Team | undefined,
  awayTeam: Team | undefined,
  date: string
): boolean {
  return isTeamUnavailableOnDate(homeTeam, date) || isTeamUnavailableOnDate(awayTeam, date);
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

  // Helper to check if a specific team is blacked out on a date
  const isTeamBlackedOut = (teamId: string, date: string): boolean => {
    const team = teamMap.get(teamId);
    if (!team || team.isBye || team.name === 'Bye') return false;
    return !!team.blackoutDates && team.blackoutDates.includes(date);
  };

  // Helper to check if either team in a matchup is blacked out on a date
  const isMatchBlackedOutOnDate = (homeId: string, awayId: string, date: string): boolean => {
    return isTeamBlackedOut(homeId, date) || isTeamBlackedOut(awayId, date);
  };

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

  // Helper to check if teams are free at that slot and not blacked out
  const areTeamsAvailable = (teamAId: string, teamBId: string, date: string, time: string): boolean => {
    // Strictly verify neither team is on a blackout date
    if (isTeamBlackedOut(teamAId, date) || isTeamBlackedOut(teamBId, date)) {
      return false;
    }
    const keyA = `${teamAId}_${date}_${time}`;
    const keyB = `${teamBId}_${date}_${time}`;
    if (occupiedTeamSlots.has(keyA)) return false;
    if (occupiedTeamSlots.has(keyB)) return false;
    return true;
  };

  // Helper to get candidate fields in priority order for a home team
  const getCandidateFields = (homeTeam: Team | undefined, divisionFields: string[]): string[] => {
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
    return candidateFields;
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

    // Track deferred matches that could not be scheduled on their scheduled round date due to team blackout dates
    interface DeferredMatchItem {
      homeTeamId: string;
      awayTeamId: string;
      isByePractice: boolean;
      roundNumber: number;
      originalDate: string;
    }
    const deferredMatches: DeferredMatchItem[] = [];

    // Helper to assign and record a game
    const scheduleMatchAtSlot = (
      homeId: string,
      awayId: string,
      isByePractice: boolean,
      roundNum: number,
      targetDate: string,
      targetTime: string,
      targetFieldId: string,
      mIndex: number
    ) => {
      const homeTeam = teamMap.get(homeId);
      const awayTeam = teamMap.get(awayId);
      const gameId = `g-${division.id}-r${roundNum}-m${mIndex + 1}-${targetDate.replace(/-/g, '')}`;

      occupiedFieldSlots.set(`${targetFieldId}_${targetDate}_${targetTime}`, gameId);
      if (homeId && !homeTeam?.isBye) {
        occupiedTeamSlots.set(`${homeId}_${targetDate}_${targetTime}`, gameId);
      }
      if (awayId && !awayTeam?.isBye) {
        occupiedTeamSlots.set(`${awayId}_${targetDate}_${targetTime}`, gameId);
      }

      newGames.push({
        id: gameId,
        divisionId: division.id,
        date: targetDate,
        time: targetTime,
        fieldId: targetFieldId,
        homeTeamId: homeId,
        awayTeamId: awayId,
        isByePractice,
        roundNumber: roundNum,
        status: 'scheduled',
        notes: isByePractice
          ? `Bye Practice Session on home / alternate pitch for ${homeTeam?.name || 'Home Team'}`
          : undefined,
      });
    };

    // 3. Fill available dates with round rotation from season start to season end
    let dateIdx = 0;
    let roundCycleIdx = 0;

    while (dateIdx < validDates.length) {
      const matchDate = validDates[dateIdx];
      const roundMatches = rounds[roundCycleIdx % rounds.length];
      const isReturnLeg = Math.floor(roundCycleIdx / rounds.length) % 2 === 1;

      for (let mIdx = 0; mIdx < roundMatches.length; mIdx++) {
        const rawMatch = roundMatches[mIdx];
        let homeTeamId = rawMatch.homeTeamId;
        let awayTeamId = rawMatch.awayTeamId;

        // If return leg, invert home/away for balance (unless bye practice)
        if (isReturnLeg && !rawMatch.isByePractice) {
          homeTeamId = rawMatch.awayTeamId;
          awayTeamId = rawMatch.homeTeamId;
        }

        // Check if either team is blacked out on this matchDate
        if (isMatchBlackedOutOnDate(homeTeamId, awayTeamId, matchDate)) {
          // Defer this match to be scheduled on an available date when both teams are free
          deferredMatches.push({
            homeTeamId,
            awayTeamId,
            isByePractice: rawMatch.isByePractice,
            roundNumber: roundCycleIdx + 1,
            originalDate: matchDate,
          });
          continue;
        }

        const homeTeam = teamMap.get(homeTeamId);
        const candidateFields = getCandidateFields(homeTeam, divisionFields);

        // Try to find a collision-free (field + time) slot on this matchDate
        let chosenFieldId = candidateFields[0] || divisionFields[0] || fields[0]?.id || 'f1';
        let chosenTime = timeSlots[mIdx % timeSlots.length];
        let assignedSlot = false;

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

        if (!assignedSlot) {
          // If no slot on candidate fields, try any field in division
          for (const timeSlot of timeSlots) {
            if (!areTeamsAvailable(homeTeamId, awayTeamId, matchDate, timeSlot)) continue;
            for (const fieldId of divisionFields) {
              if (isFieldAvailable(fieldId, matchDate, timeSlot)) {
                chosenFieldId = fieldId;
                chosenTime = timeSlot;
                assignedSlot = true;
                break;
              }
            }
            if (assignedSlot) break;
          }
        }

        // If a slot is available on matchDate, schedule it
        if (assignedSlot) {
          scheduleMatchAtSlot(
            homeTeamId,
            awayTeamId,
            rawMatch.isByePractice,
            roundCycleIdx + 1,
            matchDate,
            chosenTime,
            chosenFieldId,
            mIdx
          );
        } else {
          // Both teams are not blacked out today, but time/field was congested today;
          // check if teams are free at default slot or defer to avoid double booking
          if (areTeamsAvailable(homeTeamId, awayTeamId, matchDate, chosenTime)) {
            scheduleMatchAtSlot(
              homeTeamId,
              awayTeamId,
              rawMatch.isByePractice,
              roundCycleIdx + 1,
              matchDate,
              chosenTime,
              chosenFieldId,
              mIdx
            );
          } else {
            deferredMatches.push({
              homeTeamId,
              awayTeamId,
              isByePractice: rawMatch.isByePractice,
              roundNumber: roundCycleIdx + 1,
              originalDate: matchDate,
            });
          }
        }
      }

      // Check if any previously deferred match can take an open slot on this matchDate
      if (deferredMatches.length > 0) {
        for (let defIdx = deferredMatches.length - 1; defIdx >= 0; defIdx--) {
          const item = deferredMatches[defIdx];
          if (isMatchBlackedOutOnDate(item.homeTeamId, item.awayTeamId, matchDate)) {
            continue;
          }
          const itemHomeTeam = teamMap.get(item.homeTeamId);
          const candidateFields = getCandidateFields(itemHomeTeam, divisionFields);

          let foundDefSlot = false;
          let defTime = timeSlots[0];
          let defField = candidateFields[0];

          for (const timeSlot of timeSlots) {
            if (!areTeamsAvailable(item.homeTeamId, item.awayTeamId, matchDate, timeSlot)) {
              continue;
            }
            for (const fieldId of candidateFields) {
              if (isFieldAvailable(fieldId, matchDate, timeSlot)) {
                defTime = timeSlot;
                defField = fieldId;
                foundDefSlot = true;
                break;
              }
            }
            if (foundDefSlot) break;
          }

          if (foundDefSlot) {
            scheduleMatchAtSlot(
              item.homeTeamId,
              item.awayTeamId,
              item.isByePractice,
              item.roundNumber,
              matchDate,
              defTime,
              defField,
              defIdx
            );
            deferredMatches.splice(defIdx, 1);
          }
        }
      }

      dateIdx++;
      roundCycleIdx++;
    }

    // 4. Resolve any remaining deferred matches due to team blackout dates:
    // Find the earliest valid date where neither team is blacked out and an open slot exists
    for (let defIdx = 0; defIdx < deferredMatches.length; defIdx++) {
      const item = deferredMatches[defIdx];
      const itemHomeTeam = teamMap.get(item.homeTeamId);
      const candidateFields = getCandidateFields(itemHomeTeam, divisionFields);

      let scheduled = false;

      // Pass 1: Try to find a date in validDates where neither team is blacked out
      // and neither team has a match already scheduled on that date
      for (const candDate of validDates) {
        if (isMatchBlackedOutOnDate(item.homeTeamId, item.awayTeamId, candDate)) {
          continue;
        }

        // Check if teams already have games that day
        const homeHasGameOnDate = Array.from(occupiedTeamSlots.keys()).some(
          (k) => k.startsWith(`${item.homeTeamId}_${candDate}_`)
        );
        const awayHasGameOnDate = Array.from(occupiedTeamSlots.keys()).some(
          (k) => k.startsWith(`${item.awayTeamId}_${candDate}_`)
        );

        if (!homeHasGameOnDate && !awayHasGameOnDate) {
          for (const timeSlot of timeSlots) {
            if (!areTeamsAvailable(item.homeTeamId, item.awayTeamId, candDate, timeSlot)) continue;
            for (const fieldId of candidateFields) {
              if (isFieldAvailable(fieldId, candDate, timeSlot)) {
                scheduleMatchAtSlot(
                  item.homeTeamId,
                  item.awayTeamId,
                  item.isByePractice,
                  item.roundNumber,
                  candDate,
                  timeSlot,
                  fieldId,
                  defIdx
                );
                scheduled = true;
                break;
              }
            }
            if (scheduled) break;
          }
        }
        if (scheduled) break;
      }

      // Pass 2: If no open day exists, allow a different time slot on a valid date (with zero blackout violation)
      if (!scheduled) {
        for (const candDate of validDates) {
          if (isMatchBlackedOutOnDate(item.homeTeamId, item.awayTeamId, candDate)) {
            continue;
          }

          for (const timeSlot of timeSlots) {
            if (!areTeamsAvailable(item.homeTeamId, item.awayTeamId, candDate, timeSlot)) continue;
            for (const fieldId of candidateFields) {
              if (isFieldAvailable(fieldId, candDate, timeSlot)) {
                scheduleMatchAtSlot(
                  item.homeTeamId,
                  item.awayTeamId,
                  item.isByePractice,
                  item.roundNumber,
                  candDate,
                  timeSlot,
                  fieldId,
                  defIdx
                );
                scheduled = true;
                break;
              }
            }
            if (scheduled) break;
          }
          if (scheduled) break;
        }
      }

      // Pass 3: If every date in validDates was congested, search subsequent play days (makeup days)
      if (!scheduled) {
        const lastDate = validDates[validDates.length - 1] || seasonConfig.endDate;
        const lastDt = new Date(lastDate + 'T00:00:00');
        const blackoutSet = new Set(seasonConfig.blackoutDates || []);

        for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
          const nextDt = new Date(lastDt);
          nextDt.setDate(nextDt.getDate() + dayOffset);
          const dOfWeek = nextDt.getDay() as DayOfWeek;

          if (!division.playDays.includes(dOfWeek)) continue;

          const yyyy = nextDt.getFullYear();
          const mm = String(nextDt.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDt.getDate()).padStart(2, '0');
          const makeupDate = `${yyyy}-${mm}-${dd}`;

          if (blackoutSet.has(makeupDate)) continue;
          if (isMatchBlackedOutOnDate(item.homeTeamId, item.awayTeamId, makeupDate)) continue;

          const chosenTime = timeSlots[0] || '10:00';
          const chosenField = candidateFields[0] || divisionFields[0] || fields[0]?.id || 'f1';

          scheduleMatchAtSlot(
            item.homeTeamId,
            item.awayTeamId,
            item.isByePractice,
            item.roundNumber,
            makeupDate,
            chosenTime,
            chosenField,
            defIdx
          );
          scheduled = true;
          break;
        }
      }
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
