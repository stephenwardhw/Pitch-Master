export type AdminRole = 'superadmin' | 'admin' | 'scheduler' | 'viewer';

export interface AdminUser {
  id: number | string;
  username: string;
  displayName: string;
  role: AdminRole;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AdminUser | null;
  token: string | null;
}

export const ROLE_HIERARCHY: Record<AdminRole, number> = {
  viewer: 1,
  scheduler: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * Returns true if the user's role meets or exceeds the required minimum level.
 */
export function isRoleAtLeast(user: AdminUser | null | undefined, minRole: AdminRole): boolean {
  if (!user || !user.role) return false;
  const userRank = ROLE_HIERARCHY[user.role] ?? 0;
  const minRank = ROLE_HIERARCHY[minRole] ?? 0;
  return userRank >= minRank;
}

/**
 * Publish links and actions are restricted to scheduler and above (scheduler, admin, superadmin).
 */
export function canPublishSchedule(user: AdminUser | null | undefined): boolean {
  return isRoleAtLeast(user, 'scheduler');
}

/**
 * Match edits, reassignments, and automated schedule generation are allowed for scheduler and above.
 */
export function canEditSchedule(user: AdminUser | null | undefined): boolean {
  return isRoleAtLeast(user, 'scheduler');
}

/**
 * Entity administration (divisions, teams, fields, referees, bulletins, season rules)
 * is restricted to scheduler and above.
 */
export function canManageEntities(user: AdminUser | null | undefined): boolean {
  return isRoleAtLeast(user, 'scheduler');
}

/**
 * Returns true if the active account is at the Viewer level (strict read-only access).
 */
export function isViewerRole(user: AdminUser | null | undefined): boolean {
  return user?.role === 'viewer';
}

const TOKEN_KEY = 'pitchmaster_admin_token';
const USER_KEY = 'pitchmaster_admin_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AdminUser, remember = true) {
  try {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));

    // Clear the other storage to prevent sync confusion
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USER_KEY);
  } catch {}
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {}
}

/**
 * Defensive fetch to prevent HTML JSON.parse crashes
 */
async function safeFetchAuthJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const isHtml =
      contentType.includes('text/html') ||
      rawText.trim().startsWith('<!DOCTYPE') ||
      rawText.trim().startsWith('<html');

    if (isHtml) {
      return {
        ok: false,
        status: res.status,
        error: 'Backend API returned HTML instead of JSON. Ensure Node server is running on port 3000.',
      };
    }

    try {
      const data = JSON.parse(rawText || '{}');
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? data.message || data.error || `HTTP ${res.status}` : undefined,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        error: 'Failed to parse JSON response from authentication server.',
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err.message || 'Network error connecting to authentication server',
    };
  }
}

/**
 * Log in admin with credentials against MySQL admin_users table
 */
export async function loginAdmin(
  username: string,
  password: string,
  remember = true
): Promise<{
  success: boolean;
  user?: AdminUser;
  token?: string;
  isLiveMySql?: boolean;
  message: string;
}> {
  const result = await safeFetchAuthJson<any>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (result.ok && result.data && result.data.success) {
    storeSession(result.data.token, result.data.user, remember);
    return result.data;
  }

  // Fallback if client-only server mode: check default admin credential
  if (result.error && result.error.includes('returned HTML')) {
    if (username.trim().toLowerCase() === 'admin' && password === 'pitchmaster') {
      const fallbackUser: AdminUser = {
        id: 1,
        username: 'admin',
        displayName: 'League Administrator',
        role: 'superadmin',
      };
      const fallbackToken = `local_tok_${Date.now()}`;
      storeSession(fallbackToken, fallbackUser, remember);
      return {
        success: true,
        user: fallbackUser,
        token: fallbackToken,
        isLiveMySql: false,
        message: 'Logged in using local administrator fallback credentials.',
      };
    }
  }

  return {
    success: false,
    message: result.data?.message || result.error || 'Authentication failed. Please check credentials.',
  };
}

/**
 * Validate current stored session
 */
export async function checkAdminSession(): Promise<AdminUser | null> {
  const token = getStoredToken();
  const storedUser = getStoredUser();

  if (!token) return null;

  const result = await safeFetchAuthJson<{ authenticated: boolean; user?: AdminUser }>('/api/auth/me');

  if (result.ok && result.data?.authenticated && result.data.user) {
    return result.data.user;
  }

  // If server is temporarily unreachable but token exists, trust storedUser temporarily
  if (!result.ok && storedUser) {
    return storedUser;
  }

  clearStoredSession();
  return null;
}

/**
 * Log out admin
 */
export async function logoutAdmin(): Promise<void> {
  const token = getStoredToken();
  clearStoredSession();

  if (token) {
    await safeFetchAuthJson('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
}

/**
 * List all admin users (for superadmin management)
 */
export async function listAdminUsers(): Promise<{ users: AdminUser[]; isLiveMySql: boolean }> {
  const result = await safeFetchAuthJson<{ users: AdminUser[]; isLiveMySql: boolean }>('/api/auth/users');
  if (result.ok && result.data) {
    return result.data;
  }
  return { users: [], isLiveMySql: false };
}

/**
 * Create a new admin user in the MySQL table
 */
export async function createAdminUser(params: {
  username: string;
  password: string;
  displayName: string;
  role?: 'superadmin' | 'admin' | 'scheduler' | 'viewer';
}): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  const result = await safeFetchAuthJson<{ success: boolean; message: string; user?: AdminUser }>(
    '/api/auth/users',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
  if (result.ok && result.data) {
    return result.data;
  }
  return { success: false, message: result.error || 'Failed to create user.' };
}

/**
 * Change admin password
 */
export async function changeAdminPassword(
  newPassword: string,
  targetUsername?: string
): Promise<{ success: boolean; message: string }> {
  const result = await safeFetchAuthJson<{ success: boolean; message: string }>(
    '/api/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify({ newPassword, targetUsername }),
    }
  );
  if (result.ok && result.data) {
    return result.data;
  }
  return { success: false, message: result.error || 'Failed to change password.' };
}

/**
 * Delete an admin user
 */
export async function deleteAdminUserApi(
  targetUsername: string
): Promise<{ success: boolean; message: string }> {
  const result = await safeFetchAuthJson<{ success: boolean; message: string }>(
    '/api/auth/delete-user',
    {
      method: 'POST',
      body: JSON.stringify({ targetUsername }),
    }
  );
  if (result.ok && result.data) {
    return result.data;
  }
  return { success: false, message: result.error || 'Failed to delete user.' };
}

/**
 * Update an admin user's role or display name
 */
export async function updateAdminUserApi(
  targetUsername: string,
  updates: { displayName?: string; role?: 'superadmin' | 'admin' | 'scheduler' | 'viewer' }
): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  const result = await safeFetchAuthJson<{ success: boolean; message: string; user?: AdminUser }>(
    '/api/auth/update-user',
    {
      method: 'POST',
      body: JSON.stringify({ targetUsername, ...updates }),
    }
  );
  if (result.ok && result.data) {
    return result.data;
  }
  return { success: false, message: result.error || 'Failed to update user.' };
}
