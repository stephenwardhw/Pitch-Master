# MySQL NoSQL Document Backup & Concurrency Setup Guide

This guide explains how to configure MySQL for PitchMaster's NoSQL document backup system, define the necessary environment variables, create the required database schemas for JSON payload storage, audit activity tracking, and configure Role-Based Access Control (RBAC).

---

## 1. Overview & Architecture

PitchMaster combines a high-performance **NoSQL document store pattern inside MySQL** with a relational user and audit tracking model:
- **`schedule_backups`**: Stores complete `AppData` JSON payloads (`data_json`) with cryptographic `sync_token` hashes for optimistic concurrency control. When multiple administrators work concurrently, this prevents accidental overwrites and triggers 3-way smart diff resolution.
- **`schedule_activity_log`**: Records revision history, timestamped change summaries, modification actions (`save`, `restore`, `unlink`), and entity metrics (division, team, and match counts).
- **`admin_users`**: Manages administrator authentication, salted PBKDF2 / SHA-256 password hashing, session tokens, and 4-tier Role-Based Access Control (`superadmin`, `admin`, `scheduler`, `viewer`).
- **Embedded NoSQL Fallback**: If a MySQL server is temporarily offline or not configured, the application automatically falls back to local file storage (`league_backups_nosql.json`, `league_activity_nosql.json`, and `.data/admin_users_fallback.json`), ensuring uninterrupted scheduling.

---

## 2. Environment Variables Configuration

Create or update your `.env` file in the project root with the following variables:

```bash
# ==============================================================================
# Server & Runtime Configuration
# ==============================================================================
PORT=3000

# Optional custom override for target league_schedule.json path on the server
# (If unset, automatically searches public/, dist/, and ./league_schedule.json)
SCHEDULE_JSON_PATH=/var/www/pitchmasternode/public/league_schedule.json

# ==============================================================================
# MySQL Database Configuration for NoSQL Document Backups
# ==============================================================================

# Database server hostname or IP address (e.g. localhost, 127.0.0.1, or remote host)
MYSQL_HOST=localhost

# Database server port (default MySQL port is 3306)
MYSQL_PORT=3306

# Database username (must have CREATE, SELECT, INSERT, UPDATE, DELETE permissions)
MYSQL_USER=pitch_user

# Database user password
MYSQL_PASSWORD=your_secure_password_here

# Database name
MYSQL_DATABASE=pitchmaster

# Primary table name where JSON backups are stored (defaults to schedule_backups)
MYSQL_TABLE=schedule_backups
```

> **Runtime Configuration**: You can also configure or override these connection settings at runtime directly within the application UI via **MySQL Backup &rarr; Configure DB** without restarting the Node server.

---

## 3. SQL Table Schemas

When the application connects to MySQL, it **automatically runs `CREATE TABLE IF NOT EXISTS`** for all required tables and seeds a default administrator account if the user table is empty.

To manually initialize the database and tables, execute the following SQL script:

```sql
-- Step 1: Create the database with full UTF-8 Unicode support
CREATE DATABASE IF NOT EXISTS `pitchmaster`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pitchmaster`;

-- Step 2: Create schedule_backups table for JSON payload storage
CREATE TABLE IF NOT EXISTS `schedule_backups` (
  `id` VARCHAR(128) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `data_json` LONGTEXT NOT NULL COMMENT 'JSON-encoded complete AppData payload',
  `sync_token` VARCHAR(128) NOT NULL COMMENT 'Optimistic concurrency revision token',
  `last_modified_by` VARCHAR(255) NOT NULL,
  `last_modified_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `version_number` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_last_modified_at` (`last_modified_at`),
  INDEX `idx_sync_token` (`sync_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Create schedule_activity_log table for change tracking & audit history
CREATE TABLE IF NOT EXISTS `schedule_activity_log` (
  `id` VARCHAR(128) NOT NULL,
  `backup_id` VARCHAR(128) NOT NULL,
  `backup_name` VARCHAR(255) NOT NULL,
  `version_number` INT NOT NULL DEFAULT 1,
  `action` VARCHAR(64) NOT NULL COMMENT 'save, restore, unlink, import',
  `modified_by` VARCHAR(255) NOT NULL,
  `modified_at` DATETIME NOT NULL,
  `summary` VARCHAR(255) NOT NULL,
  `divisions_count` INT NOT NULL DEFAULT 0,
  `teams_count` INT NOT NULL DEFAULT 0,
  `games_count` INT NOT NULL DEFAULT 0,
  `sync_token` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_backup_id` (`backup_id`),
  INDEX `idx_modified_at` (`modified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: Create admin_users table for administrator authentication & RBAC
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'admin' COMMENT 'superadmin, admin, scheduler, viewer',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` DATETIME NULL,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5 (Optional): Seed an initial administrator
-- (PitchMaster automatically seeds 'admin' / 'pitchmaster' as superadmin if the table is empty)
-- You can also insert users directly with SHA-256 or PBKDF2:
INSERT INTO `admin_users` (`username`, `password_hash`, `display_name`, `role`, `created_at`)
VALUES ('admin', SHA2('pitchmaster', 256), 'League Administrator', 'superadmin', NOW())
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);
```

---

## 4. Tables Breakdown

### 1. `schedule_backups` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(128)` | Unique document identifier (e.g. `main_schedule`, `spring_2026_v2`). Primary key. |
| `name` | `VARCHAR(255)` | Human-readable schedule title displayed in the backup manager. |
| `data_json` | `LONGTEXT` | Complete serialized JSON containing teams, games, divisions, fields, referees, and bulletins. |
| `sync_token` | `VARCHAR(128)` | Cryptographic token generated on each save to detect simultaneous multi-user edits. |
| `last_modified_by` | `VARCHAR(255)` | Name or email of the user/administrator who committed the last change. |
| `last_modified_at` | `DATETIME` | Timestamp of the most recent save in UTC. |
| `created_at` | `DATETIME` | Creation timestamp of the backup document. |
| `version_number` | `INT` | Monotonically increasing revision counter (1, 2, 3...). |

### 2. `schedule_activity_log` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(128)` | Unique activity event identifier. Primary key. |
| `backup_id` | `VARCHAR(128)` | Reference to the associated backup document. |
| `backup_name` | `VARCHAR(255)` | Name of the backup document at time of event. |
| `version_number` | `INT` | Document revision number associated with this action. |
| `action` | `VARCHAR(64)` | Action performed (`save`, `restore`, `unlink`, `import`). |
| `modified_by` | `VARCHAR(255)` | Administrator who performed the action. |
| `modified_at` | `DATETIME` | Timestamp of the action. |
| `summary` | `VARCHAR(255)` | Human-readable description of changes (e.g. *"Saved version 4 with 48 games"*). |
| `divisions_count` | `INT` | Number of divisions in dataset at time of save. |
| `teams_count` | `INT` | Number of teams in dataset at time of save. |
| `games_count` | `INT` | Number of scheduled matches at time of save. |
| `sync_token` | `VARCHAR(128)` | Concurrency revision token for audit verification. |

### 3. `admin_users` Table (Authentication & RBAC)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT` | Unique user ID. Primary key. |
| `username` | `VARCHAR(64)` | Login username (unique, case-insensitive). |
| `password_hash` | `VARCHAR(255)` | Hash string. Supports salted PBKDF2 (`pbkdf2$salt$hash`), SHA-256 (`SHA2(pass, 256)`), or plaintext fallback. |
| `display_name` | `VARCHAR(128)` | Administrator's display name shown in navbar, change history, and activity logs. |
| `role` | `VARCHAR(32)` | Permission level: `superadmin`, `admin`, `scheduler`, `viewer`. |
| `created_at` | `DATETIME` | Timestamp of user account creation. |
| `last_login_at` | `DATETIME` | Timestamp of the most recent successful login. |

---

## 5. Role-Based Access Control (RBAC)

PitchMaster enforces a 4-tier permission hierarchy:

| Permission / Action | `viewer` (1) | `scheduler` (2) | `admin` (3) | `superadmin` (4) |
| :--- | :---: | :---: | :---: | :---: |
| Browse matches, standings, pitches & contacts | ✅ | ✅ | ✅ | ✅ |
| Export CSV schedule, print PDF reports | ✅ | ✅ | ✅ | ✅ |
| Edit matches, assign referees, swap Home/Away | ❌ | ✅ | ✅ | ✅ |
| Re-run automated round-robin scheduler | ❌ | ✅ | ✅ | ✅ |
| Save schedule to MySQL / local JSON | ❌ | ✅ | ✅ | ✅ |
| **Publish to Web Server (`league_schedule.json`)** | ❌ | ✅ | ✅ | ✅ |
| Manage Divisions, Teams, Pitches & Referees | ❌ | ❌ | ✅ | ✅ |
| Modify Season Parameters & Date Windows | ❌ | ❌ | ✅ | ✅ |
| Post, edit, and archive league bulletins | ❌ | ❌ | ✅ | ✅ |
| Manage Admin Users (Create, Edit Roles, Reset Passwords) | ❌ | ❌ | ❌ | ✅ |

* **Viewer Enforcement**: Users logged in with the `viewer` role have strict read-only access. Save buttons, publish buttons, add/edit/delete buttons, and automated schedulers are hidden or disabled with explanatory tooltips, and backend endpoints reject modifications with `403 Forbidden`.
* **Server Publish Restriction**: Calling `POST /api/publish-schedule` requires `scheduler` role or higher.

---

## 6. Linux Permissions & File Publishing Diagnostics

When PitchMaster runs as a service user (e.g. `pitchmaster` or `www-data`), publishing `league_schedule.json` directly to the web server requires appropriate write permissions:

### Recommended Directory and File Permissions
```bash
# Set ownership to the application service user and web server group:
sudo chown -R pitchmaster:www-data /var/www/pitchmasternode/public
sudo chown -R pitchmaster:www-data /var/www/pitchmasternode/dist

# Set directories to 775 (user and group read/write/execute):
sudo chmod -R 775 /var/www/pitchmasternode/public
sudo chmod -R 775 /var/www/pitchmasternode/dist

# Set existing files to 664 (user and group read/write):
sudo chmod 664 /var/www/pitchmasternode/public/league_schedule.json
```

### Multi-Strategy Write Resilience
PitchMaster's backend employs multi-strategy file writing in `server.ts`:
1. **Direct Write (`writeFileSync`)** with `0o664` permissions.
2. **In-place Truncation**: Opens existing file in `r+` mode and truncates, allowing updates even when directory permissions prevent new file creation.
3. **Unlink and Recreate**: Removes and recreates the file if group write permissions permit recreation.
4. **Actionable Diagnostics**: If all write attempts fail, the API returns a detailed diagnostic message showing the exact process user, UID, GID, file permissions, and the exact `chown`/`chmod` shell command to resolve the issue.

---

## 7. MySQL User Privileges

To grant permissions to the database user:

```sql
-- Replace 'pitch_user' and 'your_password' with your desired credentials
CREATE USER IF NOT EXISTS 'pitch_user'@'%' IDENTIFIED BY 'your_password';

GRANT ALL PRIVILEGES ON `pitchmaster`.* TO 'pitch_user'@'%';
FLUSH PRIVILEGES;
```

---

## 8. Testing the Setup

1. Start your MySQL service:
   ```bash
   sudo systemctl start mysql
   ```
2. Start the PitchMaster application:
   ```bash
   npm run dev
   ```
3. Open the web interface at `http://localhost:3000` (or your configured port).
4. Log in using the default credentials (`admin` / `pitchmaster`).
5. Click **MySQL Backup** in the navigation bar.
6. Click **Configure DB** and then **Test Connection**:
   - When connected, you will see a green status badge: **"MySQL Live Database Connected"**.
   - If MySQL is stopped or unreachable, you will see an amber badge: **"Embedded NoSQL Backup Store Active"**.
7. Click **Save to MySQL** to confirm document persistence and audit logging.
