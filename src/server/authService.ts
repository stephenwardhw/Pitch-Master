import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPool } from './mysqlService';

export interface AdminUser {
  id: number | string;
  username: string;
  displayName: string;
  role: 'superadmin' | 'admin' | 'scheduler' | 'viewer';
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface AdminUserRecord {
  id: number | string;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'superadmin' | 'admin' | 'scheduler' | 'viewer';
  created_at: string;
  last_login_at: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const FALLBACK_USERS_FILE = path.resolve(DATA_DIR, 'admin_users_fallback.json');

// In-memory active session tokens: token -> { user: AdminUser, expiresAt: number }
interface SessionData {
  user: AdminUser;
  expiresAt: number;
}
const activeSessions = new Map<string, SessionData>();

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;

  // 1. Check if PBKDF2 formatted: pbkdf2$salt$hash
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const hash = parts[2];
      const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
      } catch {
        return false;
      }
    }
  }

  // 2. Check standard SHA-256 hash (in case inserted via MySQL SHA2('password', 256))
  const sha256 = crypto.createHash('sha256').update(password).digest('hex');
  if (storedHash.toLowerCase() === sha256.toLowerCase()) {
    return true;
  }

  // 3. Fallback check for plain-text password (supports direct manual SQL inserts)
  return storedHash === password;
}

function readFallbackUsers(): Record<string, AdminUserRecord> {
  try {
    if (fs.existsSync(FALLBACK_USERS_FILE)) {
      const raw = fs.readFileSync(FALLBACK_USERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

function writeFallbackUsers(data: Record<string, AdminUserRecord>) {
  try {
    fs.writeFileSync(FALLBACK_USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

/**
 * Initializes the MySQL admin_users table and seeds default admin if empty
 */
export async function initializeAuthTable(): Promise<{ isLiveMySql: boolean; message: string }> {
  const pool = await getPool();

  if (!pool) {
    // Check fallback store
    const fallback = readFallbackUsers();
    if (Object.keys(fallback).length === 0) {
      const defaultUser: AdminUserRecord = {
        id: 1,
        username: 'admin',
        password_hash: hashPassword('pitchmaster'),
        display_name: 'League Administrator',
        role: 'superadmin',
        created_at: new Date().toISOString(),
        last_login_at: null,
      };
      fallback['admin'] = defaultUser;
      writeFallbackUsers(fallback);
    }
    return {
      isLiveMySql: false,
      message: 'Using embedded NoSQL admin users store (MySQL currently offline).',
    };
  }

  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS \`admin_users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(64) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`display_name\` VARCHAR(128) NOT NULL,
        \`role\` VARCHAR(32) NOT NULL DEFAULT 'admin',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`last_login_at\` DATETIME NULL,
        INDEX \`idx_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createTableSql);

    // Check if table is empty
    const [rows]: any = await pool.query('SELECT COUNT(*) as cnt FROM `admin_users`');
    if (rows && rows[0] && rows[0].cnt === 0) {
      // Seed default administrator
      const seedSql = `
        INSERT INTO \`admin_users\` (\`username\`, \`password_hash\`, \`display_name\`, \`role\`, \`created_at\`)
        VALUES (?, ?, ?, 'superadmin', NOW())
      `;
      await pool.query(seedSql, ['admin', hashPassword('pitchmaster'), 'League Administrator']);
    }

    return {
      isLiveMySql: true,
      message: 'MySQL admin_users table initialized and verified.',
    };
  } catch (err: any) {
    return {
      isLiveMySql: false,
      message: `Failed to initialize MySQL admin_users: ${err.message}`,
    };
  }
}

/**
 * Authenticates an admin username and password against the MySQL table
 */
export async function authenticateAdmin(
  username: string,
  password: string
): Promise<{
  success: boolean;
  user?: AdminUser;
  token?: string;
  isLiveMySql: boolean;
  message: string;
}> {
  const trimmedUser = (username || '').trim().toLowerCase();
  if (!trimmedUser || !password) {
    return {
      success: false,
      isLiveMySql: false,
      message: 'Please provide both username and password.',
    };
  }

  // Ensure table exists
  await initializeAuthTable();

  const pool = await getPool();

  if (pool) {
    try {
      const [rows]: any = await pool.query(
        'SELECT * FROM `admin_users` WHERE LOWER(username) = LOWER(?) LIMIT 1',
        [trimmedUser]
      );

      if (rows && rows.length > 0) {
        const record = rows[0];
        const isValid = verifyPassword(password, record.password_hash);

        if (isValid) {
          // Update last_login_at
          try {
            await pool.query(
              'UPDATE `admin_users` SET `last_login_at` = NOW() WHERE `id` = ?',
              [record.id]
            );
          } catch {}

          const user: AdminUser = {
            id: record.id,
            username: record.username,
            displayName: record.display_name,
            role: record.role || 'admin',
            createdAt: record.created_at ? new Date(record.created_at).toISOString() : undefined,
            lastLoginAt: new Date().toISOString(),
          };

          const token = `adm_tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
          activeSessions.set(token, {
            user,
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
          });

          return {
            success: true,
            user,
            token,
            isLiveMySql: true,
            message: `Welcome back, ${user.displayName}!`,
          };
        }
      }

      return {
        success: false,
        isLiveMySql: true,
        message: 'Invalid username or password. Please verify and try again.',
      };
    } catch (err: any) {
      console.error('MySQL authentication error:', err);
      // Fall through to fallback store if error occurs
    }
  }

  // Local Fallback Authentication
  const fallback = readFallbackUsers();
  const record = fallback[trimmedUser];
  if (record && verifyPassword(password, record.password_hash)) {
    record.last_login_at = new Date().toISOString();
    fallback[trimmedUser] = record;
    writeFallbackUsers(fallback);

    const user: AdminUser = {
      id: record.id,
      username: record.username,
      displayName: record.display_name,
      role: record.role || 'admin',
      createdAt: record.created_at,
      lastLoginAt: record.last_login_at,
    };

    const token = `adm_tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    activeSessions.set(token, {
      user,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    return {
      success: true,
      user,
      token,
      isLiveMySql: false,
      message: `Authenticated via local admin store. Welcome, ${user.displayName}!`,
    };
  }

  return {
    success: false,
    isLiveMySql: false,
    message: 'Invalid username or password.',
  };
}

/**
 * Validates a session token
 */
export function validateSessionToken(token: string): AdminUser | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session.user;
}

/**
 * Clears an active session token
 */
export function logoutSession(token: string) {
  if (token) {
    activeSessions.delete(token);
  }
}

/**
 * Lists all admin users (for user management)
 */
export async function listAdminUsers(): Promise<{ isLiveMySql: boolean; users: AdminUser[] }> {
  const pool = await getPool();
  if (pool) {
    try {
      const [rows]: any = await pool.query(
        'SELECT id, username, display_name, role, created_at, last_login_at FROM `admin_users` ORDER BY id ASC'
      );
      const users: AdminUser[] = (rows || []).map((r: any) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        role: r.role,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
      }));
      return { isLiveMySql: true, users };
    } catch {}
  }

  const fallback = readFallbackUsers();
  const users: AdminUser[] = Object.values(fallback).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));
  return { isLiveMySql: false, users };
}

/**
 * Creates a new admin user in the MySQL table
 */
export async function createAdminUser(params: {
  username: string;
  password: string;
  displayName: string;
  role?: 'superadmin' | 'admin' | 'scheduler' | 'viewer';
}): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  const username = params.username.trim().toLowerCase();
  if (!username || !params.password) {
    return { success: false, message: 'Username and password are required.' };
  }

  const role = params.role || 'admin';
  const displayName = params.displayName.trim() || params.username;
  const passHash = hashPassword(params.password);
  const now = new Date().toISOString();

  const pool = await getPool();
  if (pool) {
    try {
      const [result]: any = await pool.query(
        'INSERT INTO `admin_users` (`username`, `password_hash`, `display_name`, `role`, `created_at`) VALUES (?, ?, ?, ?, NOW())',
        [username, passHash, displayName, role]
      );
      return {
        success: true,
        message: `Admin user "${username}" successfully created in MySQL table.`,
        user: {
          id: result.insertId,
          username,
          displayName,
          role,
          createdAt: now,
        },
      };
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, message: `Username "${username}" already exists.` };
      }
      return { success: false, message: err.message };
    }
  }

  const fallback = readFallbackUsers();
  if (fallback[username]) {
    return { success: false, message: `Username "${username}" already exists.` };
  }

  const id = Date.now();
  fallback[username] = {
    id,
    username,
    password_hash: passHash,
    display_name: displayName,
    role,
    created_at: now,
    last_login_at: null,
  };
  writeFallbackUsers(fallback);

  return {
    success: true,
    message: `Admin user "${username}" saved to local fallback store.`,
    user: { id, username, displayName, role, createdAt: now },
  };
}

/**
 * Updates an admin user's password
 */
export async function changeAdminPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: 'Password must be at least 4 characters long.' };
  }

  const passHash = hashPassword(newPassword);
  const pool = await getPool();

  if (pool) {
    try {
      await pool.query('UPDATE `admin_users` SET `password_hash` = ? WHERE LOWER(username) = LOWER(?)', [
        passHash,
        username,
      ]);
      return { success: true, message: 'Password successfully updated in MySQL.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  const fallback = readFallbackUsers();
  const lowerUser = username.toLowerCase();
  if (fallback[lowerUser]) {
    fallback[lowerUser].password_hash = passHash;
    writeFallbackUsers(fallback);
    return { success: true, message: 'Password updated in local store.' };
  }

  return { success: false, message: `User "${username}" not found.` };
}

/**
 * Deletes an admin user
 */
export async function deleteAdminUser(
  targetUsername: string,
  requestingUsername?: string
): Promise<{ success: boolean; message: string }> {
  const targetLower = targetUsername.trim().toLowerCase();
  if (!targetLower) {
    return { success: false, message: 'Target username is required.' };
  }

  if (requestingUsername && requestingUsername.trim().toLowerCase() === targetLower) {
    return { success: false, message: 'You cannot delete your own account while logged in.' };
  }

  const pool = await getPool();
  if (pool) {
    try {
      const [countRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM `admin_users`');
      if (countRows && countRows[0] && countRows[0].cnt <= 1) {
        return { success: false, message: 'Cannot delete the only remaining administrator account.' };
      }

      const [res]: any = await pool.query('DELETE FROM `admin_users` WHERE LOWER(username) = ?', [targetLower]);
      if (res.affectedRows === 0) {
        return { success: false, message: `Admin user "${targetUsername}" not found.` };
      }

      // Evict any sessions for this user
      for (const [token, session] of activeSessions.entries()) {
        if (session.user.username.toLowerCase() === targetLower) {
          activeSessions.delete(token);
        }
      }

      return { success: true, message: `User "${targetUsername}" successfully removed from MySQL.` };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  const fallback = readFallbackUsers();
  if (Object.keys(fallback).length <= 1) {
    return { success: false, message: 'Cannot delete the only remaining administrator account.' };
  }

  if (!fallback[targetLower]) {
    return { success: false, message: `Admin user "${targetUsername}" not found.` };
  }

  delete fallback[targetLower];
  writeFallbackUsers(fallback);

  for (const [token, session] of activeSessions.entries()) {
    if (session.user.username.toLowerCase() === targetLower) {
      activeSessions.delete(token);
    }
  }

  return { success: true, message: `User "${targetUsername}" deleted from local admin store.` };
}

/**
 * Updates an admin user's role or display name
 */
export async function updateAdminUser(
  targetUsername: string,
  updates: {
    displayName?: string;
    role?: 'superadmin' | 'admin' | 'scheduler' | 'viewer';
  }
): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  const targetLower = targetUsername.trim().toLowerCase();
  if (!targetLower) {
    return { success: false, message: 'Target username is required.' };
  }

  const pool = await getPool();
  if (pool) {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.displayName !== undefined) {
        fields.push('`display_name` = ?');
        values.push(updates.displayName.trim());
      }
      if (updates.role !== undefined) {
        fields.push('`role` = ?');
        values.push(updates.role);
      }

      if (fields.length === 0) {
        return { success: true, message: 'No updates specified.' };
      }

      values.push(targetLower);
      const sql = `UPDATE \`admin_users\` SET ${fields.join(', ')} WHERE LOWER(username) = ?`;
      const [res]: any = await pool.query(sql, values);

      if (res.affectedRows === 0) {
        return { success: false, message: `User "${targetUsername}" not found in MySQL.` };
      }

      // Query updated row
      const [rows]: any = await pool.query('SELECT id, username, display_name, role FROM `admin_users` WHERE LOWER(username) = ?', [targetLower]);
      const updatedUser: AdminUser | undefined = rows?.[0] ? {
        id: rows[0].id,
        username: rows[0].username,
        displayName: rows[0].display_name,
        role: rows[0].role,
      } : undefined;

      return { success: true, message: `User "${targetUsername}" updated successfully in MySQL.`, user: updatedUser };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  const fallback = readFallbackUsers();
  if (!fallback[targetLower]) {
    return { success: false, message: `User "${targetUsername}" not found.` };
  }

  if (updates.displayName !== undefined) {
    fallback[targetLower].display_name = updates.displayName.trim();
  }
  if (updates.role !== undefined) {
    fallback[targetLower].role = updates.role;
  }
  writeFallbackUsers(fallback);

  const updatedRec = fallback[targetLower];
  return {
    success: true,
    message: `User "${targetUsername}" updated in local store.`,
    user: {
      id: updatedRec.id,
      username: updatedRec.username,
      displayName: updatedRec.display_name,
      role: updatedRec.role,
    },
  };
}
