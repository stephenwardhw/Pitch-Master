# MySQL NoSQL Document Backup & Concurrency Setup Guide

This guide explains how to configure MySQL for PitchMaster's NoSQL document backup system, define the necessary environment variables, and create the required schema for JSON payload storage with optimistic concurrency control.

---

## 1. Overview & Architecture

PitchMaster uses a **NoSQL document store pattern inside MySQL** to store league schedules, referee rosters, divisions, teams, game slots, and rules:
- **`data_json` (`LONGTEXT` or `JSON`)**: Encodes the entire `AppData` JSON payload directly into a single database column.
- **`sync_token` (`VARCHAR(128)`)**: Acts as a cryptographic revision token / timestamp hash. When two administrators edit the schedule simultaneously, this token guarantees that changes aren't silently overwritten, triggering the 3-way smart merge resolution modal.
- **Embedded NoSQL Fallback**: If a MySQL server is temporarily offline or not configured, the applet gracefully falls back to local file storage (`.data/mysql_backup_store.json`), allowing uninterrupted development and scheduling.

---

## 2. Environment Variables Configuration

Create or update your `.env` file in the project root with the following variables:

```bash
# ==============================================================================
# MySQL Database Configuration for NoSQL Document Backups
# ==============================================================================

# Database server hostname or IP address (e.g. localhost, 127.0.0.1, or a cloud host)
MYSQL_HOST=localhost

# Database server port (default MySQL port is 3306)
MYSQL_PORT=3306

# Database username (must have CREATE, SELECT, INSERT, UPDATE permissions)
MYSQL_USER=root

# Database user password
MYSQL_PASSWORD=your_secure_password_here

# Database name
MYSQL_DATABASE=pitchmaster

# Table name where JSON backups are stored (defaults to schedule_backups)
MYSQL_TABLE=schedule_backups
```

> **Note**: You can also configure or override these connection settings at runtime directly within the application UI via the **MySQL Backup &rarr; Configure DB** panel without needing to restart the dev server.

---

## 3. SQL Table Schema (`schedule_backups`)

When the application runs and successfully connects to MySQL, it will **automatically execute `CREATE TABLE IF NOT EXISTS`**.

If you prefer to initialize the database and table manually, run the following SQL script:

```sql
-- Step 1: Create the database with full UTF-8 Unicode support
CREATE DATABASE IF NOT EXISTS `pitchmaster`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pitchmaster`;

-- Step 2: Create the schedule_backups table for JSON payload storage
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

-- Step 3: Create the admin_users table for administrator authentication
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` DATETIME NULL,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4 (Optional): Seed an initial administrator manually
-- (PitchMaster automatically seeds 'admin' with password 'pitchmaster' if the table is empty)
-- You can also insert users directly with SHA-256 or plain text:
INSERT INTO `admin_users` (`username`, `password_hash`, `display_name`, `role`)
VALUES ('steve', SHA2('your_password', 256), 'Steve Ward', 'superadmin')
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);
```

### Table Schemas Breakdown

#### 1. `schedule_backups` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(128)` | Unique document identifier (e.g. `main_schedule`, `spring_2026_v2`). Primary key. |
| `name` | `VARCHAR(255)` | Human-readable schedule title displayed in the backup manager. |
| `data_json` | `LONGTEXT` | Complete serialized JSON containing teams, games, divisions, fields, referees, and rules. |
| `sync_token` | `VARCHAR(128)` | Token generated on each revision. Compared on save to detect simultaneous multi-user edits. |
| `last_modified_by` | `VARCHAR(255)` | Name or email of the user/administrator who committed the last change. |
| `last_modified_at` | `DATETIME` | Timestamp of the most recent save in UTC. |
| `created_at` | `DATETIME` | Creation timestamp of the backup. |
| `version_number` | `INT` | Monotonically increasing revision counter (1, 2, 3...). |

#### 2. `admin_users` Table (Authentication)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT` | Unique user ID. Primary key. |
| `username` | `VARCHAR(64)` | Login username (unique, case-insensitive). |
| `password_hash` | `VARCHAR(255)` | Password hash. Supports salted PBKDF2, SHA-256 (via `SHA2(pass, 256)`), or plaintext. |
| `display_name` | `VARCHAR(128)` | Administrator's display name shown in navigation bar and edit history. |
| `role` | `VARCHAR(32)` | Permission level (`superadmin`, `admin`, `scheduler`, `viewer`). |
| `created_at` | `DATETIME` | Timestamp of user creation. |
| `last_login_at` | `DATETIME` | Timestamp of the most recent successful login. |

---

## 4. MySQL User Permissions

To ensure PitchMaster can connect and manage the backup table, grant appropriate permissions:

```sql
-- Replace 'pitch_user' and 'your_password' with your desired credentials
CREATE USER IF NOT EXISTS 'pitch_user'@'%' IDENTIFIED BY 'your_password';

GRANT ALL PRIVILEGES ON `pitchmaster`.* TO 'pitch_user'@'%';
FLUSH PRIVILEGES;
```

---

## 5. Testing the Setup

1. Start your MySQL service (e.g. `sudo systemctl start mysql` or via Docker).
2. Start the application:
   ```bash
   npm run dev
   ```
3. Open the web interface and click **MySQL Backup** in the top navigation bar.
4. Click **Configure DB** and click **Test Connection**:
   - If connected, you will see a green indicator: **"MySQL Live Database Connected"**.
   - If MySQL is stopped, you will see an amber indicator: **"Embedded NoSQL Backup Store Active"**.
5. Click **Save Backup to MySQL** to test storing your current schedule.
