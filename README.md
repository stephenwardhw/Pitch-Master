# PitchMaster Soccer League Scheduler & Public Portal

**PitchMaster** is a soccer league and tournament scheduling platform built for league administrators, club organizers, coaches, and parents. It combines a round-robin schedule generator, field conflict resolver, and coach contact manager with a public portal (`/portal`) for match lookup, GPS field directions, iCalendar sync, and multi-page PDF printing.

---

## Table of Contents

1. [Features Overview](#features-overview)
2. [Application Architecture](#application-architecture)
3. [Admin Guide (`/admin` or `/`)](#admin-guide-admin-or-)
   - [1. Season Configuration](#1-season-configuration)
   - [2. Pitch & Facility Management](#2-pitch--facility-management)
   - [3. Divisions & Teams Setup](#3-divisions--teams-setup)
   - [4. Schedule Generation & Round-Robin Balancing](#4-schedule-generation--round-robin-balancing)
   - [5. Conflict Detection & Manual Match Rescheduling](#5-conflict-detection--manual-match-rescheduling)
   - [6. Publishing & Exporting `league_schedule.json`](#6-publishing--exporting-league_schedulejson)
4. [Public Coach & Parent Portal Guide (`/portal`)](#public-coach--parent-portal-guide-portal)
   - [1. Finding Your Team's Matches](#1-finding-your-teams-matches)
   - [2. Game Details & GPS Field Directions](#2-game-details--gps-field-directions)
   - [3. Coach & Team Contacts Directory](#3-coach--team-contacts-directory)
   - [4. Calendar Export (Google, Apple, Outlook)](#4-calendar-export-google-apple-outlook)
   - [5. Printing & PDF Export (Game Week Page Breaks)](#5-printing--pdf-export-game-week-page-breaks)
5. [Deployment & Apache Server Setup](#deployment--apache-server-setup)
   - [Building for Production](#building-for-production)
   - [Apache VirtualHost Configuration](#apache-virtualhost-configuration)
   - [Basic Auth for `/admin`](#basic-auth-for-admin)
   - [Live Schedule File Sync](#live-schedule-file-sync)
6. [Print Stylesheet (`print.css`)](#print-stylesheet-printcss)

---

## Features Overview

- **Automated Round-Robin Scheduling**: Fair rotation, home/away balancing, and automatic bye-round / dedicated practice slot allocations for odd-numbered divisions.
- **Zero Pitch Conflicts**: Intelligent engine ensures no field has overlapping games, respecting slot durations and pitch availability windows.
- **Full Contact Management**: Dedicated records for head coaches, team managers, jersey colors, phone numbers, emails, and home pitch assignments.
- **Standalone Coach & Parent Portal (`/portal`)**: Clean, public, read-only interface without admin links or edit tools.
- **GPS Pitch Navigation**: Instant 1-click links to Google Maps for every match venue and address.
- **1-Click iCalendar Subscription**: Download `.ics` files compatible with Apple Calendar, Google Calendar, Microsoft Outlook, and mobile devices.
- **Print & PDF Engine**: Custom `print.css` with forced page breaks between game weeks, table header repetition, and anti-truncation styling.

---

## Application Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS.
- **State & Data Store**: Fast client-side memory store with browser persistence and fallback to static server file `league_schedule.json`.
- **Styling & Print**: `@import "tailwindcss"` + dedicated `print.css` targeting `@media print`.
- **Web Server**: Apache 2.4+ with SSL, `mod_rewrite` for SPA fallback, and Basic Authentication protecting the administrative area.

---

## Admin Guide (`/admin` or `/`)

The Admin area provides league administrators with full control over season parameters, venues, divisions, teams, and the generated match calendar.

> **Accessing Admin**: Navigate to `https://pm.ichl.club/admin` (or `https://pm.ichl.club/`). If deployed on Apache with Basic Authentication enabled, enter your administrator credentials when prompted by the browser.

### 1. Season Configuration
1. Open the **Season Configuration** tab.
2. Define the **Season Name** (e.g., *"Spring 2026 Youth Soccer League"*).
3. Set the **Start Date** and **End Date**.
4. Choose allowed game days (Saturdays, Sundays, or Weekday evenings).
5. Specify the default **Match Slot Duration** (e.g., 60 minutes) and buffer time between consecutive games on the same pitch.

### 2. Pitch & Facility Management
1. Navigate to the **Pitches / Fields** section.
2. Click **Add Field** to register facilities.
3. For each pitch, enter:
   - **Pitch Name** (e.g., *"Memorial Turf Field 1"*)
   - **Physical Address** (e.g., *"1200 Soccer Way, Springfield"*)
   - **Format / Size** (e.g., *7v7*, *9v9*, *11v11*)
   - **Google Maps URL** (or paste the address so automatic Google Maps links can be generated)
   - **Available Time Windows** (earliest and latest kickoff times per day)

### 3. Divisions & Teams Setup
1. In the **Divisions** panel, create your age groups (e.g., *U10 Boys*, *U12 Girls*, *Co-Ed High School*).
2. In the **Teams** panel:
   - Assign each team to their respective division.
   - Enter **Team Name** and **Jersey Colors** (Home & Away kit colors help prevent kit clashes).
   - Assign the **Primary Home Pitch**.
   - Fill in **Coach & Contact Information**:
     - Head Coach / Team Manager Name
     - Contact Phone Number (cellular for SMS updates)
     - Contact Email Address
     - Notes / Emergency contact instructions

### 4. Schedule Generation & Round-Robin Balancing
1. Go to the **Scheduler** view.
2. Select the target division or click **Generate Entire League Schedule**.
3. The scheduler executes a round-robin pairing algorithm:
   - Minimizes back-to-back home or away games.
   - Balances matchups so each team plays opponents equally.
   - Allocates dedicated practice slots on home pitches during bye rounds for odd team counts.
4. Review the generated schedule matrix and timeline.

### 5. Conflict Detection & Manual Match Rescheduling
- The scheduler automatically flags:
  - **Pitch Overlaps**: Two games booked on the same pitch at the same time.
  - **Team Double-Bookings**: A team scheduled in two matches simultaneously.
  - **Time Window Violations**: Games scheduled outside a venue's operating hours.
- To resolve a conflict or adjust for weather/requests:
  - Drag or click a match card to change its date, kickoff time, or field assignment.
  - Changes update immediately.

### 6. Publishing & Exporting `league_schedule.json`
Once the schedule is finalized:
1. Click **Export / Save Schedule**.
2. Select **Export as JSON** (`league_schedule.json`).
3. Deploy or copy `league_schedule.json` to your Apache document root (`/var/www/pitchmaster/league_schedule.json`).
4. Once in place, the public portal (`/portal`) will immediately load this file as the live source of truth.

---

## Public Coach & Parent Portal Guide (`/portal`)

The Coach & Parent Portal is accessible at:
```
https://pm.ichl.club/portal
```
It is designed specifically for mobile and desktop use by families and team staff. All administrative controls and edit forms are omitted.

### 1. Finding Your Team's Matches
1. **Quick Team Selector**:
   - In the *"Find Your Team's Games"* box at the top, choose your team from the **Select My Team** dropdown.
   - The portal instantly filters the schedule to display only your team's matches, highlighting whether you are the **HOME** or **AWAY** team.
2. **Division Filter**:
   - Filter by age bracket or division to see the full standings and schedule across all teams in that group.
3. **Keyword Search**:
   - Type an opponent name or pitch name (e.g., *"Memorial Turf"*) in the search box for real-time match filtering.
4. **Upcoming vs. All Games**:
   - Toggle between **All Season Games** and **Upcoming Only** to focus on the next game days.

### 2. Game Details & GPS Field Directions
Each match card displays:
- **Kickoff Time & Round Number** (e.g., `10:00 AM · Round 3`)
- **Division** (e.g., `U10 Boys`)
- **Matchup**: Home team vs. Away team, with kit/jersey colors displayed so parents know which jersey to pack.
- **Pitch Name & Format**: Field size (7v7, 9v9, 11v11).
- **Google Maps Button**: Direct link that opens Google Maps or Apple Maps with the field's exact driving address for instant turn-by-turn navigation.

### 3. Coach & Team Contacts Directory
- Click the **Coach Contacts** link on any match card to open the contact information for **both teams**:
  - Home Team Coach name, phone number, and email.
  - Away Team Coach name, phone number, and email.
- This allows coaches and team managers to coordinate kit colors, verify kickoff changes, or notify each other of weather delays.

### 4. Calendar Export (Google, Apple, Outlook)
- **Single Team iCal**: When a specific team is selected, click **Download [Team] iCal** to download a `.ics` calendar file with all season matches, field addresses, and reminders.
- **Full Season Calendar**: Click **Add Season to Calendar** to export the entire league schedule into Apple Calendar, Google Calendar, or Microsoft Outlook.

### 5. Printing & PDF Export (Game Week Page Breaks)
To print or save an official PDF copy:
1. Click the **Print (PDF)** button in the header (or press <kbd>Ctrl</kbd>+<kbd>P</kbd> / <kbd>Cmd</kbd>+<kbd>P</kbd> in your browser).
2. The print preview opens with:
   - Clean, official league header with season dates and match counts.
   - Match schedule organized by game date.
   - **Forced Page Breaks Between Game Weeks**: Each game week/round prints cleanly on its own page without truncated cards or split rows.
   - **Team Contact Directory**: Complete table with coaches, phone numbers, emails, and home pitches.
   - **Pitch Directory**: Table with all venues and driving addresses.
3. Check or uncheck **Page Break Per Week**, **Team Contacts**, or **Pitch Directory** in the toolbar to customize the output before printing.
4. In the browser print dialog, choose **Save as PDF** or select your printer.

---

## Deployment & Apache Server Setup

### Building for Production
From the repository root:
```bash
npm run build
```
This compiles the application into the `dist/` directory:
- `dist/index.html`
- `dist/print.css`
- `dist/assets/index-[hash].js` & `dist/assets/index-[hash].css`
- `dist/league_schedule.json`
- `dist/.htaccess`

Copy the contents of `dist/` to your Apache web root:
```bash
cp -r dist/* /var/www/pitchmaster/
```

### Apache VirtualHost Configuration
Ensure your Apache site configuration (`/etc/apache2/sites-available/pm.ichl.club.conf`) includes:

```apache
<VirtualHost *:443>
    ServerName pm.ichl.club
    ServerAdmin webmaster@localhost
    UseCanonicalName Off
    DocumentRoot /var/www/pitchmaster

    RewriteEngine On

    <Directory /var/www/pitchmaster>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Restrict administrative area with Basic Authentication
    <Location /admin>
        AuthType Basic
        AuthName "Restricted Admin Area"
        AuthUserFile /etc/apache2/.htpasswd
        Require valid-user
    </Location>

    # Do not rewrite static build assets (JS, CSS, images, fonts, print.css)
    RewriteCond %{REQUEST_URI} \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$ [NC]
    RewriteRule ^ - [L]

    # SPA Fallback for client-side routing (/portal, /admin, etc.)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ /index.html [L]

    # SSL Configuration (Let's Encrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/pm.ichl.club/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/pm.ichl.club/privkey.pem
</VirtualHost>
```

### Basic Auth for `/admin`
To create or update the admin credentials:
```bash
sudo htpasswd -c /etc/apache2/.htpasswd admin_username
```
Reload Apache:
```bash
sudo systemctl reload apache2
```

### Live Schedule File Sync
The public portal (`/portal`) automatically looks for:
```
https://pm.ichl.club/league_schedule.json
```
Whenever administrators update the schedule, save the file to `/var/www/pitchmaster/league_schedule.json`. Portal visitors will instantly see the latest schedule without needing to clear browser cookies.

---

## Print Stylesheet (`print.css`)

PitchMaster includes a dedicated print stylesheet (`print.css`) specifically engineered for printing long sports schedules.

Key capabilities:
- **`break-before: page !important;`**: Automatically forces page breaks between game weeks (`.print-game-week + .print-game-week`).
- **`break-inside: avoid !important;`**: Prevents match cards and table rows from being sliced in half across page margins.
- **`thead { display: table-header-group !important; }`**: Ensures table column headers automatically repeat at the top of each page.
- **Unconstrained Viewport**: Resets `position: fixed` and `overflow-y: auto` containers to `position: static` and `overflow: visible` during print so multi-page documents paginate continuously across pages 1, 2, 3, etc.
- **No-Print Exclusion**: Automatically suppresses search inputs, dropdowns, buttons, and navigation bars from physical printouts.

---

## Summary of URLs

| URL | Description | Access |
|---|---|---|
| `https://pm.ichl.club/portal` | Coach & Parent Portal (Read-only schedule, directions, iCal, PDF print) | **Public** (No login required) |
| `https://pm.ichl.club/admin` | Full League Administration (Teams, fields, round-robin generator, conflict editor) | **Protected** (Basic Auth) |
| `https://pm.ichl.club/league_schedule.json` | Live JSON data payload served statically | **Public** (Read-only) |
| `https://pm.ichl.club/print.css` | Dedicated print media stylesheet | **Public** (Static asset) |
