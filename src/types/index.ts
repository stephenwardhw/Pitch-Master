export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday... 6=Saturday

export interface TeamSizeOption {
  id: string;
  name: string; // e.g., "11v11 Full", "9v9 Intermediate", "7v7 Small", "5v5 Futsal", "4v4 Micro"
  playersPerSide: number;
  typicalRoster: number;
  description?: string;
}

export interface FieldSizeOption {
  id: string;
  name: string;
}

export interface Field {
  id: string;
  name: string;
  address: string;
  googleMapsUrl?: string; // e.g., https://maps.google.com/?q=... or coordinates
  assignedDivisionIds: string[]; // Assigned to one or more divisions
  blackoutDates: string[]; // YYYY-MM-DD dates field unavailable
  size: string; // matches TeamSizeOption name or generic size like "11v11", "9v9", "7v7"
  surfaceType?: 'Natural Grass' | 'Artificial Turf' | 'Indoor / Futsal' | 'Hybrid';
  notes?: string;
}

export interface Team {
  id: string;
  name: string;
  divisionId: string;
  sizeId: string; // references TeamSizeOption id
  primaryHomeFieldId: string;
  alternateHomeFieldIds: string[]; // list of alternate fields scheduler can use for conflicts
  notes: string; // notes section for coach/team contact info
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  jerseyColor?: string;
  isBye?: boolean; // For "Bye" team
}

export interface Division {
  id: string;
  name: string; // e.g. "U12 Boys Competitive", "U10 Girls Rec"
  playDays: DayOfWeek[]; // e.g. [6] for Saturdays, [0] for Sundays, etc.
  playTimeSlots: string[]; // e.g. ["09:00", "10:30", "12:00", "13:30"]
  fieldIds: string[]; // fields that can be used in the schedule for that division
  matchDurationMinutes: number;
  colorTheme?: string;
}

export interface Game {
  id: string;
  divisionId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24-hour)
  fieldId: string;
  homeTeamId: string;
  awayTeamId: string;
  isByePractice: boolean; // Practice game when matched with Bye
  roundNumber: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  score?: {
    home: number;
    away: number;
  };
  notes?: string;
  refereeId?: string; // Center / Main match official
  assistantReferee1Id?: string; // Assistant referee 1 / Linesperson 1
  assistantReferee2Id?: string; // Assistant referee 2 / Linesperson 2
}

export type RefereeCertification =
  | 'Grassroots / Grade 8'
  | 'Regional / Grade 7'
  | 'National / Grade 6'
  | 'PRO / FIFA'
  | 'Junior Apprentice'
  | 'Club Official';

export interface Referee {
  id: string;
  name: string;
  email: string;
  phone: string;
  certificationLevel: RefereeCertification;
  badgeNumber?: string;
  experienceYears?: number;
  preferredDivisionIds: string[]; // Divisions certified or preferred to officiate
  blackoutDates: string[]; // YYYY-MM-DD dates unavailable
  maxGamesPerDay?: number;
  notes?: string;
  isActive: boolean;
}

export interface SeasonConfig {
  seasonName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  blackoutDates: string[]; // Dates when games are not to be scheduled (holidays/breaks)
}

export interface AppData {
  version: string;
  fileName: string;
  seasonConfig: SeasonConfig;
  teamSizes: TeamSizeOption[];
  fields: Field[];
  divisions: Division[];
  teams: Team[];
  games: Game[];
  referees?: Referee[];
  lastModified: string;
}

export type ConflictType =
  | 'field_double_booked'
  | 'field_blackout'
  | 'team_double_booked'
  | 'field_not_in_division'
  | 'season_blackout'
  | 'referee_double_booked'
  | 'referee_blackout';

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  gameIds: string[];
  date: string;
  time: string;
  fieldId?: string;
  teamId?: string;
  suggestedResolution?: string;
  suggestedFieldIds?: string[];
}

export interface TeamBalanceStats {
  team: Team;
  divisionName: string;
  totalGames: number;
  homeGames: number;
  awayGames: number;
  practiceGames: number;
  differential: number; // home - away
}

export interface TeamRecordStats {
  team: Team;
  divisionName: string;
  totalGames: number; // total games scheduled
  gamesPlayed: number; // games completed / with scores
  wins: number;
  losses: number;
  ties: number;
  points: number; // (wins * 3) + (ties * 1)
  winPercentage: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  awayWins: number;
  awayLosses: number;
  awayTies: number;
  recentForm: ('W' | 'L' | 'D')[];
}
