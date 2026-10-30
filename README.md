# PitchMaster Soccer League Scheduler & Public Portal

**PitchMaster** is an all-in-one soccer league, tournament scheduling, and club management platform. Built for league administrators, schedulers, club directors, coaches, and soccer families, it combines an automated round-robin generator, pitch conflict resolver, referee manager with privacy controls, bulletin announcement system, and team directory with a mobile-optimized public portal (`/portal`) featuring collapsible sections, GPS pitch navigation, iCalendar subscription, and print-ready PDF reports.

---

## Table of Contents

1. [Key Features Overview](#key-features-overview)
2. [Application Architecture](#application-architecture)
3. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
4. [Admin & Scheduler Guide (`/admin`)](#admin--scheduler-guide-admin)
   - [1. Authentication & Security](#1-authentication--security)
   - [2. Season Configuration & Game Windows](#2-season-configuration--game-windows)
   - [3. Pitches, Facilities & Graphical Field Layouts](#3-pitches-facilities--graphical-field-layouts)
   - [4. Divisions, Teams & Coach Management](#4-divisions-teams--coach-management)
   - [5. Referee Management & Privacy Controls](#5-referee-management--privacy-controls)
   - [6. Round-Robin Generator & Odd-Team Byes](#6-round-robin-generator--odd-team-byes)
   - [7. Conflict Detection & Manual Drag/Click Rescheduling](#7-conflict-detection--manual-dragclick-rescheduling)
   - [8. Head-to-Head Matchup Matrix](#8-head-to-head-matchup-matrix)
   - [9. Rich HTML Bulletins & Announcements](#9-rich-html-bulletins--announcements)
   - [10. Live Publishing & Multi-Strategy Storage](#10-live-publishing--multi-strategy-storage)
5. [Public Coach & Parent Portal Guide (`/portal`)](#public-coach--parent-portal-guide-portal)
   - [1. Mobile-First Collapsible Architecture](#1-mobile-first-collapsible-architecture)
   - [2. Announcements & Priority Alerts Accordion](#2-announcements--priority-alerts-accordion)
   - [3. Team & Division Filters](#3-team--division-filters)
   - [4. Selected Team Spotlight (Click-to-Call / Email)](#4-selected-team-spotlight-click-to-call--email)
   - [5. Match Schedule by Date Accordions](#5-match-schedule-by-date-accordions)
   - [6. Referee & Coach Contacts in Match Cards](#6-referee--coach-contacts-in-match-cards)
   - [7. Pitch Directory & Interactive Field Layout Graphics](#7-pitch-directory--interactive-field-layout-graphics)
   - [8. 1-Click iCalendar Subscription (.ics)](#8-1-click-icalendar-subscription-ics)
   - [9. Multi-Page Print & PDF Engine](#9-multi-page-print--pdf-engine)
6. [REST API Endpoints](#rest-api-endpoints)
7. [MySQL Database Setup & Document Store](#mysql-database-setup--document-store)
8. [Production Deployment & Apache Setup](#production-deployment--apache-setup)
   - [Node.js Express Service Setup (`systemd`)](#nodejs-express-service-setup-systemd)
   - [Apache Reverse Proxy Configuration (`/api` ProxyPass)](#apache-reverse-proxy-configuration-api-proxypass)
   - [Linux Permissions & `league_schedule.json` Write Resilience](#linux-permissions--league_schedulejson-write-resilience)
   - [Environment Variables (`.env`)](#environment-variables-env)
9. [Print Stylesheet (`print.css`)](#print-stylesheet-printcss)
10. [License](#license)

---

## Key Features Overview

- **Mobile-First Collapsible Portal (`/portal`)**: Seamlessly adapts to standard smartphone screens with accordion sections, collapsible game weeks, and quick-tap filters.
- **Automated Round-Robin Scheduling**: Fair rotation, home/away balancing, and automated bye-round / dedicated practice slot allocations for divisions with an odd number of teams.
- **Zero Pitch Conflicts**: Intelligent engine detects field overlaps, double-booked teams, and operating window violations in real time.
- **Multi-Tier RBAC Security**: Built-in 4-tier permission model (`superadmin`, `admin`, `scheduler`, `viewer`) protecting schedule generation, live publishing, and user administration.
- **Referee Management with Privacy Controls**: Assign referees to matches, track certifications, and use the `hideContactPublicly` privacy flag to keep referee emails and phone numbers private on public portals while retaining full details in admin downloads and MySQL backups.
- **Interactive Visual Field Layout Graphics (`FieldMapModal`)**: Simplified graphical field view displaying pitch boundaries, penalty boxes, center circle, goal areas, corner arcs, and dimension markings (7v7, 9v9, 11v11).
- **Rich HTML Bulletin Board**: Create formatted announcements with headlines, images, links, priorities (Urgent, Alert, Info), and audience targeting.
- **Live Publish Engine with Multi-Strategy Resilience**: One-click publishing to `league_schedule.json` with fallback file write strategies and MySQL multi-revision backups.
- **GPS Turn-by-Turn Directions**: Direct Google Maps / Apple Maps integration for every pitch.
- **iCalendar Sync**: Export single-team or full-league `.ics` calendars for Google Calendar, Apple Calendar, and Outlook.
- **Print & PDF Engine**: Custom `@media print` CSS enforcing page breaks per game week and repeating table headers.

---

## Application Architecture

```
                  ┌────────────────────────────────────────┐
                  │          Internet / Clients            │
                  │   Desktop Browsers & Mobile Devices    │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ HTTPS (Port 443)
                  ┌────────────────────────────────────────┐
                  │             Apache 2.4+                │
                  │   • SSL Termination (Let's Encrypt)    │
                  │   • Static Asset Serving (dist/)       │
                  │   • Reverse Proxy: /api/* -> Node.js   │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ ProxyPass (Port 3000)
┌──────────────────────────────────────────────────────────────────────────┐
│                       Node.js + Express (server.ts)                      │
│                                                                          │
│  ┌───────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │   REST API Handlers   │  │              Vite Middleware             │ │
│  │ • /api/auth/*         │  │ • Hot Module Replacement (dev)           │ │
│  │ • /api/mysql/*        │  │ • SPA Static Fallback (prod)             │ │
│  │ • /api/publish-schedule│  └──────────────────────────────────────────┘ │
│  │ • /api/public-schedule│                                               │
│  └───────────┬───────────┘                                               │
└──────────────┼─────────────────────────────┬─────────────────────────────┘
               │                             │
               ▼                             ▼
┌─────────────────────────────┐  ┌─────────────────────────────────────────┐
│     Filesystem Storage      │  │        MySQL Database (Optional)        │
│   • league_schedule.json    │  │ • schedule_backups (JSON documents)     │
│   (Sanitized public copy)   │  │ • schedule_activity_log (Audit trail)   │
│   • Multi-path fallback     │  │ • admin_users (PBKDF2/SHA-256 RBAC)     │
└─────────────────────────────┘  └─────────────────────────────────────────┘
```

- **Frontend**: React 19 SPA, TypeScript, Vite, Tailwind CSS.
- **Full-Stack Server**: Express server in `server.ts` providing authenticated REST endpoints, public schedule proxy, and atomic file publication.
- **NoSQL Document Storage**: Dual-tier persistence using live `league_schedule.json` for edge speed and MySQL for versioned history and transactional integrity.

---

## Role-Based Access Control (RBAC)

PitchMaster enforces strict permission checks on both the client interface and server API endpoints:

| Role | Admin View Access | Edit Matches & Conflicts | Generate / Clear Schedules | Publish to Live Portal | User Management & DB Tools |
|---|:---:|:---:|:---:|:---:|:---:|
| **`superadmin`** | Yes (Full) | Yes | Yes | **Yes** | **Yes** (Add/Edit Users, Passwords, MySQL) |
| **`admin`** | Yes (Full) | Yes | Yes | **Yes** | Read users; Manage backups & bulletins |
| **`scheduler`** | Yes (Dashboard) | Yes | Yes | **Yes** | No user management |
| **`viewer`** | Read-Only | Read-Only (Disabled) | Disabled | **Disabled** (Hidden/Blocked) | Disabled |

- **Viewer Guard**: Users logged in with `viewer` role can inspect the administrative dashboard, match calendars, team details, and the matchup matrix, but cannot modify records, generate schedules, or publish data.
- **Publish Restriction**: Live publishing to `league_schedule.json` requires `scheduler`, `admin`, or `superadmin` role.

---

## Admin & Scheduler Guide (`/admin`)

Access the administrative interface at `/admin` (or `/`).

### 1. Authentication & Security
- Sign in using your registered username and password.
- PitchMaster supports database-backed users in `admin_users` (salted PBKDF2 with SHA-256 fallback) as well as environment fallback credentials.
- Session tokens are securely managed via HTTP Authorization headers.

### 2. Season Configuration & Game Windows
- Set **Season Name**, **Start Date**, and **End Date**.
- Configure permissible match days (Saturdays, Sundays, or Weekdays).
- Define default **Match Duration** (e.g. 60 or 75 minutes) and required **Buffer Time** between consecutive matches on the same pitch (e.g. 15 minutes).

### 3. Pitches, Facilities & Graphical Field Layouts
- Register pitches with full physical addresses and driving instructions.
- Specify field format: `7v7`, `9v9`, `11v11`, or custom dimensions (e.g. 105 × 68 meters).
- Set venue operating hours (earliest kickoff and latest final whistle).
- **Interactive Pitch Layout**: Click the **View Pitch Layout** button on any field card or modal to render a visual representation of field markings, penalty areas, center circle, and goal dimensions.

### 4. Divisions, Teams & Coach Management
- Organize leagues into age brackets and skill divisions (e.g. *U10 Boys*, *U12 Girls Division A*).
- Configure teams with:
  - Official team name and primary home field.
  - Home and Away kit/jersey colors to prevent kit clashes.
  - Head Coach and Team Manager contact details (name, cell phone for SMS alerts, email).

### 5. Referee Management & Privacy Controls
- Register match officials, assistant referees, and assignors.
- Record referee phone numbers, email addresses, badge certification levels, and availability notes.
- **Privacy Flag (`hideContactPublicly` / `showContactOnPublicPortal`)**:
  - By default, referee phone numbers and emails are hidden from public portal visitors.
  - Schedulers can toggle this setting per referee. When set to private, only the referee's name is published.
  - Full contact records remain safely preserved in administrative exports and MySQL revision backups for scheduler contact access.

### 6. Round-Robin Generator & Odd-Team Byes
- Run round-robin schedule generation for individual divisions or the entire league.
- Features:
  - Balances home/away allocations across the season.
  - Minimizes consecutive home or away stretches.
  - **Odd-Team Divisions**: Automatically schedules **Dedicated Practice Slots** on home pitches for teams on a bye week.

### 7. Conflict Detection & Manual Drag/Click Rescheduling
- Real-time diagnostic monitors identify:
  - **Pitch Overlaps**: Two matches scheduled simultaneously on the same pitch.
  - **Team Double-Bookings**: A team assigned to two games at the same time.
  - **Operating Window Violations**: Matches starting before venue opens or ending after closing.
- Click or drag matches to reassign kickoff times, game dates, or fields with instant conflict recalculation.

### 8. Head-to-Head Matchup Matrix
- Audit schedule balance with the interactive 2D cross-tabulated matrix.
- View meeting frequencies (0, 1, 2, 3+), home/away ratios (e.g. `1H / 1A`), unplayed opponent warnings, and repeat-pairing diagnostics.
- Export full matrix tables to CSV or PDF for league committee review.

### 9. Rich HTML Bulletins & Announcements
- Publish league notices, rainout alerts, tournament brackets, and picture day schedules.
- Features:
  - Rich text formatting: Headlines, bold/italic, bulleted lists, hyperlinked PDFs, and inline image banners.
  - Priority levels: `Urgent Alert` (red banner), `Important Notice` (amber), or `Information` (blue).
  - Target Audience: `General Public`, `Coaches Only`, or `Referees`.
  - Date scheduling: Set publish and expiration dates for seasonal notices.

### 10. Live Publishing & Multi-Strategy Storage
- Click **Publish to Live Site** (available to Scheduler, Admin, Superadmin).
- The publish engine:
  1. Validates the schedule payload.
  2. Applies referee privacy sanitization (removes sensitive phone/email for private officials).
  3. Writes to `league_schedule.json` using atomic replace to prevent partial writes.
  4. Automatically tries secondary and fallback paths (`SCHEDULE_JSON_PATH`, `./dist`, `./public`) if default permissions restrict access.
  5. Commits a multi-revision backup snapshot to the MySQL `schedule_backups` table with detailed activity logging.

---

## Public Coach & Parent Portal Guide (`/portal`)

The public portal is accessible at `/portal` (e.g. `https://pm.ichl.club/portal`). It requires no login and is engineered specifically for coaches, players, and families.

### 1. Mobile-First Collapsible Architecture
On mobile devices (iOS / Android smartphones), the portal organizes information into clear, collapsible accordion sections so users can find matches without endless scrolling:
- **Collapsible Section Controls**: Each section features an expand/collapse toggle with visual state indicators and badge counters.
- **Viewport Optimization**: Elements are touch-friendly, cards use native padding, and horizontal scrollbars are eliminated.

### 2. Announcements & Priority Alerts Accordion
- Shows the latest announcements, field closures, or weather alerts.
- Displays an unread count badge.
- Urgent bulletins expand with high-contrast alert styling and actionable links.

### 3. Team & Division Filters
- **Division Selector**: View all games in a specific age division.
- **Team Dropdown**: Select your specific team to spotlight its season.
- **Search Bar**: Instant keyword filter by team name, venue, or opponent.
- **Upcoming Toggle**: Filter between all season games and upcoming fixtures.

### 4. Selected Team Spotlight (Click-to-Call / Email)
When a team is selected, an accordion card highlights:
- Primary Home Pitch with 1-click GPS navigation.
- Home and Away jersey colors.
- Head Coach and Team Manager contact card with click-to-call (`tel:`) and click-to-email (`mailto:`).
- Dedicated single-team iCalendar download button.

### 5. Match Schedule by Date Accordions
- Matches are grouped by date and round.
- Each game week acts as a collapsible accordion item.
- Match cards highlight:
  - Kickoff time and duration.
  - Division badge and Round indicator.
  - Home vs. Away matchup with kit color indicators.
  - Pitch name and field format (7v7, 9v9, 11v11).
  - Assigned referee (name and public contact info if permitted).

### 6. Referee & Coach Contacts in Match Cards
- Tap **Contact Info** on any match card to open the contact sheet:
  - Home & Away coach phone numbers and emails for pre-game coordination.
  - Assigned referee contact info (if permitted by the referee's privacy setting).

### 7. Pitch Directory & Interactive Field Layout Graphics
- Collapsible venue directory listing all facility locations.
- **Google Maps Navigation**: Tap any address to launch driving directions in Google Maps or Apple Maps.
- **Field Layout Button**: Tap **View Field Layout** to view a graphical soccer field model showing dimensions, penalty boxes, center circle, and goal areas.

### 8. 1-Click iCalendar Subscription (.ics)
- **Team Calendar**: Download all games for a specific team with pitch locations, addresses, opponent details, and alerts pre-configured.
- **Full League Calendar**: Export every match across all divisions into Apple Calendar, Google Calendar, or Microsoft Outlook.

### 9. Multi-Page Print & PDF Engine
- Tap **Print (PDF)** or press `Cmd+P` / `Ctrl+P`.
- Features:
  - Automatic page breaks before each game week (`break-before: page`).
  - Table headers repeat automatically across page splits.
  - Navigation elements, search inputs, and filter bars are cleanly excluded.
  - Optional toggle to include team coach directories and pitch address indexes.

---

## REST API Endpoints

The Node.js Express backend (`server.ts`) exposes the following endpoints:

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/league_schedule.json` | Public | Live published schedule file with HTTP caching headers |
| `GET` | `/api/public-schedule` | Public | Sanitized public schedule payload with referee privacy enforced |
| `POST` | `/api/auth/login` | Public | Authenticates user; returns token and user role |
| `GET` | `/api/auth/me` | Authenticated | Verifies active session token and permissions |
| `POST` | `/api/auth/logout` | Authenticated | Terminates active user session |
| `GET` | `/api/auth/users` | Superadmin / Admin | Lists registered administrative users |
| `POST` | `/api/auth/users` | Superadmin | Creates a new user with specific role |
| `PUT` | `/api/auth/users/:id` | Superadmin | Updates user role, email, or credentials |
| `DELETE` | `/api/auth/users/:id` | Superadmin | Removes an administrative user |
| `POST` | `/api/publish-schedule` | Scheduler+ | Publishes schedule: strips private referee data, writes file, saves MySQL backup |
| `GET` | `/api/mysql/status` | Authenticated | Checks MySQL connection health, table status, and latency |
| `GET` | `/api/mysql/backups` | Authenticated | Lists revision history snapshots with metadata |
| `GET` | `/api/mysql/backups/:id` | Authenticated | Fetches full JSON document payload for a backup revision |
| `POST` | `/api/mysql/sync` | Scheduler+ | Manually synchronizes active schedule document to MySQL |
| `GET` | `/api/mysql/logs` | Authenticated | Retrieves audit activity logs |

---

## MySQL Database Setup & Document Store

PitchMaster features an optional MySQL document store for revision history, audit tracking, and RBAC accounts.

Detailed instructions, complete SQL schemas (`schedule_backups`, `schedule_activity_log`, `admin_users`), and database setup commands are documented in **[MYSQL_SETUP.md](MYSQL_SETUP.md)**.

### Quick Schema Initialization
```sql
CREATE DATABASE IF NOT EXISTS pitchmaster CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pitchmaster;

-- 1. Document Backups Table
CREATE TABLE IF NOT EXISTS schedule_backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    schedule_data LONGTEXT NOT NULL,
    divisions_count INT DEFAULT 0,
    teams_count INT DEFAULT 0,
    games_count INT DEFAULT 0,
    fields_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT FALSE,
    sync_token VARCHAR(64) NULL,
    INDEX idx_created_at (created_at),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Activity Audit Log
CREATE TABLE IF NOT EXISTS schedule_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_id INT NULL,
    action_type VARCHAR(50) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (backup_id) REFERENCES schedule_backups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. RBAC Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NULL,
    role ENUM('superadmin', 'admin', 'scheduler', 'viewer') NOT NULL DEFAULT 'scheduler',
    display_name VARCHAR(150),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Production Deployment & Apache Setup

### Building for Production
From the repository root:
```bash
npm run build
```
This produces optimized production assets in `dist/` (`dist/index.html`, `dist/assets/*`, `dist/print.css`, and static fallbacks).

---

### Node.js Express Service Setup (`systemd`)

Run the Node.js backend continuously using a systemd service:

Create `/etc/systemd/system/pitchmaster.service`:
```ini
[Unit]
Description=PitchMaster Soccer Scheduler Service
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/pitchmasternode
EnvironmentFile=/var/www/pitchmasternode/.env
ExecStart=/usr/bin/npx tsx /var/www/pitchmasternode/server.ts
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=pitchmaster

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pitchmaster
sudo systemctl start pitchmaster
sudo systemctl status pitchmaster
```

---

### Apache Reverse Proxy Configuration (`/api` ProxyPass)

Enable Apache proxy modules:
```bash
sudo a2enmod proxy proxy_http rewrite headers ssl
sudo systemctl restart apache2
```

Configure your Apache VirtualHost (`/etc/apache2/sites-available/pm.ichl.club.conf`):

```apache
<VirtualHost *:443>
    ServerName pm.ichl.club
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/pitchmasternode/dist

    # SSL Configuration (Let's Encrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/pm.ichl.club/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/pm.ichl.club/privkey.pem

    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"

    # Forward all /api requests to the Node.js Express backend on port 3000
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:3000/api
    ProxyPassReverse /api http://127.0.0.1:3000/api

    # Forward live schedule requests to Node.js for cached/dynamic serving
    ProxyPass /league_schedule.json http://127.0.0.1:3000/league_schedule.json
    ProxyPassReverse /league_schedule.json http://127.0.0.1:3000/league_schedule.json

    <Directory /var/www/pitchmasternode/dist>
        Options -Indexes -MultiViews +FollowSymLinks
        AllowOverride All
        Require all granted

        # Rewrite engine for Single Page Application client routing (/portal, /admin)
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.html [L]
    </Directory>
</VirtualHost>
```

Reload Apache:
```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

### Linux Permissions & `league_schedule.json` Write Resilience

When the publishing tool executes, it attempts to write `league_schedule.json`. If permissions are misconfigured, Node may return `EACCES: permission denied`.

To prevent this:
1. Ensure the directory containing the public files is writable by the user running Node (`www-data`):
   ```bash
   sudo chown -R www-data:www-data /var/www/pitchmasternode/public /var/www/pitchmasternode/dist
   sudo chmod -R 775 /var/www/pitchmasternode/public /var/www/pitchmasternode/dist
   ```
2. If `league_schedule.json` already exists:
   ```bash
   sudo touch /var/www/pitchmasternode/public/league_schedule.json
   sudo chown www-data:www-data /var/www/pitchmasternode/public/league_schedule.json
   sudo chmod 664 /var/www/pitchmasternode/public/league_schedule.json
   ```
3. PitchMaster's backend employs **Multi-Strategy Write Resilience**:
   - Strategy 1: Writes to configured `SCHEDULE_JSON_PATH` if specified.
   - Strategy 2: Writes to `/var/www/pitchmasternode/public/league_schedule.json`.
   - Strategy 3: Writes to `./dist/league_schedule.json`.
   - Strategy 4: Writes to `./public/league_schedule.json`.
   - Fallback: Writes atomically using temporary files and renames (`.tmp` -> `.json`).

---

### Environment Variables (`.env`)

Configure your environment settings in `.env`:

```env
# Server Port (default: 3000)
PORT=3000

# Explicit custom filesystem path for publishing league_schedule.json
SCHEDULE_JSON_PATH="/var/www/pitchmasternode/public/league_schedule.json"

# MySQL Database Configuration
MYSQL_HOST="localhost"
MYSQL_PORT="3306"
MYSQL_USER="pitchmaster_user"
MYSQL_PASSWORD="strong_password_here"
MYSQL_DATABASE="pitchmaster"
MYSQL_TABLE="schedule_backups"

# Public App Base URL
APP_URL="https://pm.ichl.club"
```

---

## Print Stylesheet (`print.css`)

PitchMaster includes a dedicated print stylesheet for clean physical printing and PDF generation:

- **Forced Week Breaks (`break-before: page`)**: Each game week/round automatically begins at the top of a new printed page.
- **Card Boundary Integrity (`break-inside: avoid`)**: Prevents game cards and coach contact rows from splitting horizontally across page margins.
- **Repeating Headers (`thead { display: table-header-group }`)**: Table headers repeat automatically at the top of every page.
- **Form & Navigation Stripping**: Buttons, dropdowns, searches, and navigation bars are hidden on printouts.

---

## License

This project is licensed under the [MIT License](LICENSE) — free for use in commercial, non-profit, youth, and club leagues.
