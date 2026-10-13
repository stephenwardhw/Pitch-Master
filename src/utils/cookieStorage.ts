import { AppData, Division, Field, Team, TeamSizeOption } from '../types';
import { generateLeagueSchedule } from './scheduler';

export const COOKIE_NAME = 'soccer_scheduler_last_file';
export const DEFAULT_FILE_NAME = 'spring_metro_soccer_league_2026.json';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// Initial default team sizes (editable by user)
export const initialTeamSizes: TeamSizeOption[] = [
  { id: 'size-11v11', name: '11v11 Full', playersPerSide: 11, typicalRoster: 18, description: 'Standard FIFA regulation field' },
  { id: 'size-9v9', name: '9v9 Intermediate', playersPerSide: 9, typicalRoster: 14, description: 'Youth U11-U12 development size' },
  { id: 'size-7v7', name: '7v7 Small', playersPerSide: 7, typicalRoster: 12, description: 'Youth U9-U10 small-sided pitch' },
  { id: 'size-5v5', name: '5v5 Futsal / Micro', playersPerSide: 5, typicalRoster: 9, description: 'Indoor hardcourt or turf cage' },
  { id: 'size-4v4', name: '4v4 Grassroots', playersPerSide: 4, typicalRoster: 7, description: 'U6-U8 development non-goalkeeper' },
];

// Initial default fields
export const initialFields: Field[] = [
  {
    id: 'f1',
    name: 'Memorial Park - Field 1 (South)',
    address: '1400 Olympic Blvd, Los Angeles, CA 90064',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1400+Olympic+Blvd+Los+Angeles+CA',
    assignedDivisionIds: ['div-u12-boys', 'div-u14-coed'],
    blackoutDates: ['2026-04-05'], // Easter Sunday
    size: '11v11 Full',
    surfaceType: 'Natural Grass',
    notes: 'Regulation full pitch with floodlights. Parking available on 14th St.',
  },
  {
    id: 'f2',
    name: 'Memorial Park - Field 2 (North)',
    address: '1400 Olympic Blvd, Los Angeles, CA 90064',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=1400+Olympic+Blvd+Los+Angeles+CA',
    assignedDivisionIds: ['div-u12-boys', 'div-u10-girls', 'div-u14-coed'],
    blackoutDates: [],
    size: '9v9 Intermediate',
    surfaceType: 'Artificial Turf',
    notes: 'All-weather synthetic turf. No metal cleats allowed.',
  },
  {
    id: 'f3',
    name: 'Clover Field - Pitch A',
    address: '2600 Ocean Park Blvd, Santa Monica, CA 90405',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=2600+Ocean+Park+Blvd+Santa+Monica+CA',
    assignedDivisionIds: ['div-u10-girls'],
    blackoutDates: ['2026-04-18'], // City Youth Track Meet
    size: '7v7 Small',
    surfaceType: 'Natural Grass',
    notes: 'Well maintained Bermuda grass, shaded spectator bleachers.',
  },
  {
    id: 'f4',
    name: 'Clover Field - Pitch B',
    address: '2600 Ocean Park Blvd, Santa Monica, CA 90405',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=2600+Ocean+Park+Blvd+Santa+Monica+CA',
    assignedDivisionIds: ['div-u10-girls', 'div-u12-boys'],
    blackoutDates: [],
    size: '7v7 Small',
    surfaceType: 'Natural Grass',
    notes: 'Adjacent to playground. Restrooms and hydration station nearby.',
  },
  {
    id: 'f5',
    name: 'Westside Sports Complex - Stadium Field',
    address: '11300 Wilshire Blvd, Los Angeles, CA 90025',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=11300+Wilshire+Blvd+Los+Angeles+CA',
    assignedDivisionIds: ['div-u14-coed', 'div-u12-boys'],
    blackoutDates: ['2026-05-25'], // Memorial Day maintenance
    size: '11v11 Full',
    surfaceType: 'Artificial Turf',
    notes: 'Scoreboard equipped, locker facilities open on match days.',
  },
];

// Initial default divisions
export const initialDivisions: Division[] = [
  {
    id: 'div-u12-boys',
    name: 'U12 Boys Premier',
    playDays: [6], // Saturdays
    playTimeSlots: ['09:00', '10:30', '12:00', '13:30'],
    fieldIds: ['f1', 'f2', 'f5'],
    matchDurationMinutes: 70,
    colorTheme: 'blue',
  },
  {
    id: 'div-u10-girls',
    name: 'U10 Girls Classic', // 5 teams (odd number to demonstrate Bye handling!)
    playDays: [6, 0], // Saturday and Sunday
    playTimeSlots: ['09:00', '10:15', '11:30'],
    fieldIds: ['f2', 'f3', 'f4'],
    matchDurationMinutes: 50,
    colorTheme: 'emerald',
  },
  {
    id: 'div-u14-coed',
    name: 'U14 Coed Metro',
    playDays: [0], // Sundays
    playTimeSlots: ['11:00', '13:00', '15:00'],
    fieldIds: ['f1', 'f5'],
    matchDurationMinutes: 80,
    colorTheme: 'purple',
  },
];

// Initial default teams
export const initialTeams: Team[] = [
  // U12 Boys (4 teams - even)
  {
    id: 't-u12-1',
    name: 'Pacific Strikers',
    divisionId: 'div-u12-boys',
    sizeId: 'size-9v9',
    primaryHomeFieldId: 'f1',
    alternateHomeFieldIds: ['f2', 'f5'],
    notes: 'Coach: Marco Rossi. Cell: (310) 555-0144. Email: coach.rossi@strikers.org. Primary jersey: Royal Blue.',
    contactName: 'Marco Rossi',
    contactPhone: '(310) 555-0144',
    contactEmail: 'coach.rossi@strikers.org',
    jerseyColor: 'Royal Blue',
  },
  {
    id: 't-u12-2',
    name: 'Canyon Rapids',
    divisionId: 'div-u12-boys',
    sizeId: 'size-9v9',
    primaryHomeFieldId: 'f2',
    alternateHomeFieldIds: ['f1', 'f5'],
    notes: 'Coach: Sarah Jenkins. Cell: (310) 555-0189. Email: sjenkins@rapidsfc.com. Primary jersey: Teal / Black.',
    contactName: 'Sarah Jenkins',
    contactPhone: '(310) 555-0189',
    contactEmail: 'sjenkins@rapidsfc.com',
    jerseyColor: 'Teal & Black',
  },
  {
    id: 't-u12-3',
    name: 'Bay City Storm',
    divisionId: 'div-u12-boys',
    sizeId: 'size-9v9',
    primaryHomeFieldId: 'f5',
    alternateHomeFieldIds: ['f1'],
    notes: 'Coach: David Chen. Cell: (213) 555-0192. Email: dchen@baycitystorm.net. Primary jersey: Red / White.',
    contactName: 'David Chen',
    contactPhone: '(213) 555-0192',
    contactEmail: 'dchen@baycitystorm.net',
    jerseyColor: 'Red & White',
  },
  {
    id: 't-u12-4',
    name: 'Harbor Sounders',
    divisionId: 'div-u12-boys',
    sizeId: 'size-9v9',
    primaryHomeFieldId: 'f1',
    alternateHomeFieldIds: ['f5', 'f2'],
    notes: 'Coach: Elena Alvarez. Cell: (310) 555-0131. Email: elena@harborsoccer.org. Primary jersey: Gold / Navy.',
    contactName: 'Elena Alvarez',
    contactPhone: '(310) 555-0131',
    contactEmail: 'elena@harborsoccer.org',
    jerseyColor: 'Gold & Navy',
  },

  // U10 Girls (5 teams - odd, to showcase automated Bye -> Practice Game logic!)
  {
    id: 't-u10-1',
    name: 'Wildcats SC',
    divisionId: 'div-u10-girls',
    sizeId: 'size-7v7',
    primaryHomeFieldId: 'f3',
    alternateHomeFieldIds: ['f4', 'f2'],
    notes: 'Coach: Tyler Vance. Cell: (424) 555-0118. Email: tvance@wildcats.org. Primary jersey: Purple.',
    contactName: 'Tyler Vance',
    contactPhone: '(424) 555-0118',
    contactEmail: 'tvance@wildcats.org',
    jerseyColor: 'Purple',
  },
  {
    id: 't-u10-2',
    name: 'Thunderbolts',
    divisionId: 'div-u10-girls',
    sizeId: 'size-7v7',
    primaryHomeFieldId: 'f4',
    alternateHomeFieldIds: ['f3'],
    notes: 'Coach: Jessica Morales. Cell: (310) 555-0177. Email: jessica@thunderboltsfc.com. Primary jersey: Yellow / Black.',
    contactName: 'Jessica Morales',
    contactPhone: '(310) 555-0177',
    contactEmail: 'jessica@thunderboltsfc.com',
    jerseyColor: 'Yellow & Black',
  },
  {
    id: 't-u10-3',
    name: 'Ocean Breeze',
    divisionId: 'div-u10-girls',
    sizeId: 'size-7v7',
    primaryHomeFieldId: 'f3',
    alternateHomeFieldIds: ['f4', 'f2'],
    notes: 'Coach: Brian O\'Connor. Cell: (310) 555-0164. Email: boconnor@oceanbreeze.org. Primary jersey: Sky Blue.',
    contactName: 'Brian O\'Connor',
    contactPhone: '(310) 555-0164',
    contactEmail: 'boconnor@oceanbreeze.org',
    jerseyColor: 'Sky Blue',
  },
  {
    id: 't-u10-4',
    name: 'Solar Flare',
    divisionId: 'div-u10-girls',
    sizeId: 'size-7v7',
    primaryHomeFieldId: 'f4',
    alternateHomeFieldIds: ['f2'],
    notes: 'Coach: Angela Wu. Cell: (213) 555-0155. Email: angela.wu@solarflare.com. Primary jersey: Orange.',
    contactName: 'Angela Wu',
    contactPhone: '(213) 555-0155',
    contactEmail: 'angela.wu@solarflare.com',
    jerseyColor: 'Orange',
  },
  {
    id: 't-u10-5',
    name: 'Coastal Stars',
    divisionId: 'div-u10-girls',
    sizeId: 'size-7v7',
    primaryHomeFieldId: 'f2',
    alternateHomeFieldIds: ['f3', 'f4'],
    notes: 'Coach: Marcus Reed. Cell: (310) 555-0123. Email: mreed@coastalstars.org. Primary jersey: Forest Green.',
    contactName: 'Marcus Reed',
    contactPhone: '(310) 555-0123',
    contactEmail: 'mreed@coastalstars.org',
    jerseyColor: 'Forest Green',
  },

  // U14 Coed (4 teams - even)
  {
    id: 't-u14-1',
    name: 'Metropolitan United',
    divisionId: 'div-u14-coed',
    sizeId: 'size-11v11',
    primaryHomeFieldId: 'f5',
    alternateHomeFieldIds: ['f1'],
    notes: 'Coach: Alex Becker. Cell: (310) 555-0199. Email: abecker@metrounited.org. Primary jersey: Crimson.',
    contactName: 'Alex Becker',
    contactPhone: '(310) 555-0199',
    contactEmail: 'abecker@metrounited.org',
    jerseyColor: 'Crimson',
  },
  {
    id: 't-u14-2',
    name: 'Apex Academy',
    divisionId: 'div-u14-coed',
    sizeId: 'size-11v11',
    primaryHomeFieldId: 'f1',
    alternateHomeFieldIds: ['f5'],
    notes: 'Coach: Rachel Kim. Cell: (213) 555-0112. Email: rkim@apexacademyfc.com. Primary jersey: Navy / Silver.',
    contactName: 'Rachel Kim',
    contactPhone: '(213) 555-0112',
    contactEmail: 'rkim@apexacademyfc.com',
    jerseyColor: 'Navy & Silver',
  },
  {
    id: 't-u14-3',
    name: 'Silverlake Rovers',
    divisionId: 'div-u14-coed',
    sizeId: 'size-11v11',
    primaryHomeFieldId: 'f5',
    alternateHomeFieldIds: ['f1'],
    notes: 'Coach: Kenneth Price. Cell: (310) 555-0145. Email: ken.price@roversfc.org. Primary jersey: Black / White.',
    contactName: 'Kenneth Price',
    contactPhone: '(310) 555-0145',
    contactEmail: 'ken.price@roversfc.org',
    jerseyColor: 'Black & White',
  },
  {
    id: 't-u14-4',
    name: 'Westside Alliance',
    divisionId: 'div-u14-coed',
    sizeId: 'size-11v11',
    primaryHomeFieldId: 'f1',
    alternateHomeFieldIds: ['f5'],
    notes: 'Coach: Carlos Mendoza. Cell: (424) 555-0182. Email: cmendoza@westsidealliance.org. Primary jersey: White / Green.',
    contactName: 'Carlos Mendoza',
    contactPhone: '(424) 555-0182',
    contactEmail: 'cmendoza@westsidealliance.org',
    jerseyColor: 'White & Green',
  },
];

export function getInitialAppData(fileName: string = DEFAULT_FILE_NAME): AppData {
  const baseData: AppData = {
    version: '1.0.0',
    fileName,
    seasonConfig: {
      seasonName: 'Spring 2026 Metro Youth Soccer Championship',
      startDate: '2026-03-28',
      endDate: '2026-05-30',
      blackoutDates: ['2026-04-05', '2026-05-24'], // Easter Sunday & Memorial Day weekend
    },
    teamSizes: initialTeamSizes,
    fields: initialFields,
    divisions: initialDivisions,
    teams: initialTeams,
    games: [],
    lastModified: new Date().toISOString(),
  };

  // Run round-robin scheduler to populate realistic season games
  try {
    const result = generateLeagueSchedule(baseData);
    baseData.games = result.games;
    if (result.syntheticTeams && result.syntheticTeams.length > 0) {
      baseData.teams.push(...result.syntheticTeams);
    }
  } catch (err) {
    console.error('Initial schedule generation error:', err);
  }

  return baseData;
}

// Storage helpers
export function saveAppData(data: AppData): void {
  try {
    const serialized = JSON.stringify(data);
    // Save under the specific file key
    localStorage.setItem(`soccer_dataset_${data.fileName}`, serialized);
    // Save under active fallback key
    localStorage.setItem('soccer_dataset_active', serialized);
    // Update client side cookie to keep track of data file last used
    setCookie(COOKIE_NAME, data.fileName);
  } catch (err) {
    console.error('Error saving app data:', err);
  }
}

export function loadAppData(): AppData {
  try {
    // 1. Check client-side cookie for last used filename
    const cookieFileName = getCookie(COOKIE_NAME);
    const targetFileName = cookieFileName || DEFAULT_FILE_NAME;

    // 2. Attempt to retrieve data associated with that filename
    const fileSaved = localStorage.getItem(`soccer_dataset_${targetFileName}`);
    if (fileSaved) {
      const parsed: AppData = JSON.parse(fileSaved);
      parsed.fileName = targetFileName;
      setCookie(COOKIE_NAME, targetFileName);
      return parsed;
    }

    // 3. Fallback to active key if present
    const activeSaved = localStorage.getItem('soccer_dataset_active');
    if (activeSaved) {
      const parsed: AppData = JSON.parse(activeSaved);
      if (!parsed.fileName) parsed.fileName = targetFileName;
      setCookie(COOKIE_NAME, parsed.fileName);
      return parsed;
    }
  } catch (err) {
    console.error('Error loading app data from storage:', err);
  }

  // 4. If no stored dataset, initialize and store default dataset
  const initialData = getInitialAppData(DEFAULT_FILE_NAME);
  saveAppData(initialData);
  return initialData;
}
