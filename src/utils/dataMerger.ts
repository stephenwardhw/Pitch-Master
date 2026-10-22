import { AppData, Game, Referee, Team, Field, Division } from '../types';

export interface GameConflictItem {
  gameId: string;
  gameLabel: string;
  localGame?: Game;
  remoteGame?: Game;
  diffs: string[];
}

export interface DiffReport {
  hasChanges: boolean;
  totalDiffCount: number;
  games: {
    addedLocally: Game[];
    addedRemotely: Game[];
    modified: GameConflictItem[];
    deletedLocally: Game[];
    deletedRemotely: Game[];
  };
  teams: {
    addedLocally: Team[];
    addedRemotely: Team[];
    modified: { id: string; name: string; local: Team; remote: Team }[];
  };
  fields: {
    addedLocally: Field[];
    addedRemotely: Field[];
    modified: { id: string; name: string; local: Field; remote: Field }[];
  };
  referees: {
    addedLocally: Referee[];
    addedRemotely: Referee[];
    modified: { id: string; name: string; local: Referee; remote: Referee }[];
  };
  divisions: {
    addedLocally: Division[];
    addedRemotely: Division[];
  };
  summary: string[];
}

/**
 * Computes deep differences between local and remote AppData
 */
export function computeDataDifferences(localData: AppData, remoteData: AppData): DiffReport {
  const localGamesMap = new Map<string, Game>(localData.games.map((g) => [g.id, g]));
  const remoteGamesMap = new Map<string, Game>(remoteData.games.map((g) => [g.id, g]));

  const addedLocally: Game[] = [];
  const addedRemotely: Game[] = [];
  const modifiedGames: GameConflictItem[] = [];

  // Check all local games
  for (const [id, localGame] of localGamesMap.entries()) {
    const remoteGame = remoteGamesMap.get(id);
    if (!remoteGame) {
      addedLocally.push(localGame);
    } else {
      // Compare fields
      const diffs: string[] = [];
      if (localGame.date !== remoteGame.date) {
        diffs.push(`Date: local "${localGame.date}" vs remote "${remoteGame.date}"`);
      }
      if (localGame.time !== remoteGame.time) {
        diffs.push(`Time: local "${localGame.time}" vs remote "${remoteGame.time}"`);
      }
      if (localGame.fieldId !== remoteGame.fieldId) {
        diffs.push(`Field: local "${localGame.fieldId}" vs remote "${remoteGame.fieldId}"`);
      }
      if (localGame.refereeId !== remoteGame.refereeId) {
        diffs.push(`Center Referee: local "${localGame.refereeId || 'none'}" vs remote "${remoteGame.refereeId || 'none'}"`);
      }
      if (
        localGame.score?.home !== remoteGame.score?.home ||
        localGame.score?.away !== remoteGame.score?.away
      ) {
        const localScore = localGame.score ? `${localGame.score.home}-${localGame.score.away}` : 'None';
        const remoteScore = remoteGame.score ? `${remoteGame.score.home}-${remoteGame.score.away}` : 'None';
        diffs.push(`Score: local ${localScore} vs remote ${remoteScore}`);
      }
      if (localGame.status !== remoteGame.status) {
        diffs.push(`Status: local "${localGame.status}" vs remote "${remoteGame.status}"`);
      }

      if (diffs.length > 0) {
        const teamNameLookup = (teamId: string) => {
          const t = localData.teams.find((tm) => tm.id === teamId) || remoteData.teams.find((tm) => tm.id === teamId);
          return t ? t.name : teamId;
        };
        const homeName = teamNameLookup(localGame.homeTeamId);
        const awayName = teamNameLookup(localGame.awayTeamId);

        modifiedGames.push({
          gameId: id,
          gameLabel: `${homeName} vs ${awayName} (${localGame.date})`,
          localGame,
          remoteGame,
          diffs,
        });
      }
    }
  }

  // Check for games only in remote
  for (const [id, remoteGame] of remoteGamesMap.entries()) {
    if (!localGamesMap.has(id)) {
      addedRemotely.push(remoteGame);
    }
  }

  // Referees diff
  const localRefs = new Map((localData.referees || []).map((r) => [r.id, r]));
  const remoteRefs = new Map((remoteData.referees || []).map((r) => [r.id, r]));
  const addedRefsLocally: Referee[] = [];
  const addedRefsRemotely: Referee[] = [];
  const modifiedRefs: { id: string; name: string; local: Referee; remote: Referee }[] = [];

  for (const [id, localRef] of localRefs.entries()) {
    const remoteRef = remoteRefs.get(id);
    if (!remoteRef) {
      addedRefsLocally.push(localRef);
    } else if (
      localRef.name !== remoteRef.name ||
      localRef.certificationLevel !== remoteRef.certificationLevel ||
      localRef.phone !== remoteRef.phone ||
      localRef.email !== remoteRef.email ||
      localRef.blackoutDates.join(',') !== remoteRef.blackoutDates.join(',')
    ) {
      modifiedRefs.push({ id, name: localRef.name, local: localRef, remote: remoteRef });
    }
  }
  for (const [id, remoteRef] of remoteRefs.entries()) {
    if (!localRefs.has(id)) {
      addedRefsRemotely.push(remoteRef);
    }
  }

  // Teams diff
  const localTeams = new Map(localData.teams.map((t) => [t.id, t]));
  const remoteTeams = new Map(remoteData.teams.map((t) => [t.id, t]));
  const addedTeamsLocally: Team[] = [];
  const addedTeamsRemotely: Team[] = [];
  const modifiedTeams: { id: string; name: string; local: Team; remote: Team }[] = [];

  for (const [id, localTeam] of localTeams.entries()) {
    const remoteTeam = remoteTeams.get(id);
    if (!remoteTeam) {
      addedTeamsLocally.push(localTeam);
    } else if (localTeam.name !== remoteTeam.name || localTeam.primaryHomeFieldId !== remoteTeam.primaryHomeFieldId) {
      modifiedTeams.push({ id, name: localTeam.name, local: localTeam, remote: remoteTeam });
    }
  }
  for (const [id, remoteTeam] of remoteTeams.entries()) {
    if (!localTeams.has(id)) {
      addedTeamsRemotely.push(remoteTeam);
    }
  }

  // Fields diff
  const localFields = new Map(localData.fields.map((f) => [f.id, f]));
  const remoteFields = new Map(remoteData.fields.map((f) => [f.id, f]));
  const addedFieldsLocally: Field[] = [];
  const addedFieldsRemotely: Field[] = [];
  const modifiedFields: { id: string; name: string; local: Field; remote: Field }[] = [];

  for (const [id, localField] of localFields.entries()) {
    const remoteField = remoteFields.get(id);
    if (!remoteField) {
      addedFieldsLocally.push(localField);
    } else if (localField.name !== remoteField.name || localField.address !== remoteField.address) {
      modifiedFields.push({ id, name: localField.name, local: localField, remote: remoteField });
    }
  }
  for (const [id, remoteField] of remoteFields.entries()) {
    if (!remoteFields.has(id)) {
      addedFieldsRemotely.push(remoteField);
    }
  }

  // Summary lines
  const summary: string[] = [];
  if (modifiedGames.length > 0) summary.push(`${modifiedGames.length} game(s) modified on both sides`);
  if (addedRemotely.length > 0) summary.push(`${addedRemotely.length} new game(s) added remotely in Drive`);
  if (addedLocally.length > 0) summary.push(`${addedLocally.length} new game(s) added locally`);
  if (addedRefsRemotely.length > 0 || modifiedRefs.length > 0) summary.push(`Referee updates detected`);
  if (addedTeamsRemotely.length > 0 || modifiedTeams.length > 0) summary.push(`Team updates detected`);
  if (addedFieldsRemotely.length > 0 || modifiedFields.length > 0) summary.push(`Field updates detected`);

  const totalDiffCount =
    modifiedGames.length +
    addedLocally.length +
    addedRemotely.length +
    modifiedRefs.length +
    addedRefsLocally.length +
    addedRefsRemotely.length +
    modifiedTeams.length +
    addedTeamsLocally.length +
    addedTeamsRemotely.length +
    modifiedFields.length +
    addedFieldsLocally.length +
    addedFieldsRemotely.length;

  return {
    hasChanges: totalDiffCount > 0,
    totalDiffCount,
    games: {
      addedLocally,
      addedRemotely,
      modified: modifiedGames,
      deletedLocally: [],
      deletedRemotely: [],
    },
    teams: {
      addedLocally: addedTeamsLocally,
      addedRemotely: addedTeamsRemotely,
      modified: modifiedTeams,
    },
    fields: {
      addedLocally: addedFieldsLocally,
      addedRemotely: addedFieldsRemotely,
      modified: modifiedFields,
    },
    referees: {
      addedLocally: addedRefsLocally,
      addedRemotely: addedRefsRemotely,
      modified: modifiedRefs,
    },
    divisions: {
      addedLocally: [],
      addedRemotely: [],
    },
    summary,
  };
}

/**
 * Executes a smart 3-way or non-conflicting merge:
 * - Retains all unique games, teams, fields, and referees from both sets.
 * - For conflicting games:
 *   - Merges non-overlapping fields (e.g. keeps remote scores if local didn't change score; keeps local referee if local assigned referee).
 *   - For directly conflicting values, uses localChoice preference.
 */
export function smartMergeAppData(
  localData: AppData,
  remoteData: AppData,
  options?: {
    conflictingGameChoice?: 'local' | 'remote';
  }
): AppData {
  const choice = options?.conflictingGameChoice || 'local';

  // 1. Merge Teams (Union by ID)
  const teamsMap = new Map<string, Team>();
  remoteData.teams.forEach((t) => teamsMap.set(t.id, t));
  localData.teams.forEach((t) => {
    // If present in both, merge or prefer local
    teamsMap.set(t.id, { ...(teamsMap.get(t.id) || {}), ...t });
  });
  const mergedTeams = Array.from(teamsMap.values());

  // 2. Merge Fields (Union by ID)
  const fieldsMap = new Map<string, Field>();
  remoteData.fields.forEach((f) => fieldsMap.set(f.id, f));
  localData.fields.forEach((f) => {
    fieldsMap.set(f.id, { ...(fieldsMap.get(f.id) || {}), ...f });
  });
  const mergedFields = Array.from(fieldsMap.values());

  // 3. Merge Divisions (Union by ID)
  const divisionsMap = new Map<string, Division>();
  remoteData.divisions.forEach((d) => divisionsMap.set(d.id, d));
  localData.divisions.forEach((d) => {
    divisionsMap.set(d.id, { ...(divisionsMap.get(d.id) || {}), ...d });
  });
  const mergedDivisions = Array.from(divisionsMap.values());

  // 4. Merge Referees (Union by ID)
  const refsMap = new Map<string, Referee>();
  (remoteData.referees || []).forEach((r) => refsMap.set(r.id, r));
  (localData.referees || []).forEach((r) => {
    refsMap.set(r.id, { ...(refsMap.get(r.id) || {}), ...r });
  });
  const mergedReferees = Array.from(refsMap.values());

  // 5. Merge Referee Certifications (Union by ID or Name)
  const certsMap = new Map<string, any>();
  (remoteData.refereeCertifications || []).forEach((c) => certsMap.set(c.name, c));
  (localData.refereeCertifications || []).forEach((c) => certsMap.set(c.name, c));
  const mergedCertifications = Array.from(certsMap.values());

  // 6. Merge Games
  const gamesMap = new Map<string, Game>();

  // Add remote games first
  remoteData.games.forEach((rg) => gamesMap.set(rg.id, rg));

  // Add/Merge local games
  localData.games.forEach((lg) => {
    const rg = gamesMap.get(lg.id);
    if (!rg) {
      gamesMap.set(lg.id, lg);
    } else {
      // Conflict resolution for this game
      if (choice === 'remote') {
        // Keep remote game as base, but inherit local notes or score if remote lacks them
        gamesMap.set(lg.id, {
          ...lg,
          ...rg,
          score: rg.score || lg.score,
          notes: rg.notes || lg.notes,
        });
      } else {
        // Keep local game as base, but inherit remote score if local hasn't scored
        gamesMap.set(lg.id, {
          ...rg,
          ...lg,
          score: lg.score || rg.score,
          refereeId: lg.refereeId || rg.refereeId,
          notes: lg.notes || rg.notes,
        });
      }
    }
  });

  const mergedGames = Array.from(gamesMap.values());

  return {
    ...localData,
    teams: mergedTeams,
    fields: mergedFields,
    divisions: mergedDivisions,
    referees: mergedReferees,
    refereeCertifications: mergedCertifications,
    games: mergedGames,
    lastModified: new Date().toISOString(),
  };
}
