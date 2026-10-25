import express from 'express';
import {
  authenticateAdmin,
  validateSessionToken,
  logoutSession,
  listAdminUsers,
  createAdminUser,
  changeAdminPassword,
  initializeAuthTable,
} from './authService';

export const authRouter = express.Router();

function getBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return (req.query.token as string) || (req.headers['x-admin-token'] as string) || '';
}

// 1. Table status
authRouter.get('/status', async (_req, res) => {
  try {
    const status = await initializeAuthTable();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ isLiveMySql: false, message: err.message });
  }
});

// 2. Admin Login
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authenticateAdmin(username, password);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Current session check
authRouter.get('/me', (req, res) => {
  const token = getBearerToken(req);
  const user = validateSessionToken(token);

  if (!user) {
    return res.status(401).json({ authenticated: false, message: 'Invalid or expired session' });
  }

  res.json({ authenticated: true, user });
});

// 4. Logout
authRouter.post('/logout', (req, res) => {
  const token = getBearerToken(req) || req.body?.token;
  logoutSession(token);
  res.json({ success: true, message: 'Logged out successfully' });
});

// 5. List admin users
authRouter.get('/users', async (req, res) => {
  try {
    const token = getBearerToken(req);
    const user = validateSessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Admin session required' });
    }

    const result = await listAdminUsers();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Create admin user
authRouter.post('/users', async (req, res) => {
  try {
    const token = getBearerToken(req);
    const user = validateSessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Admin session required' });
    }

    const { username, password, displayName, role } = req.body;
    const result = await createAdminUser({ username, password, displayName, role });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Change password
authRouter.post('/change-password', async (req, res) => {
  try {
    const token = getBearerToken(req);
    const user = validateSessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { newPassword, targetUsername } = req.body;
    // Admins can change their own password, superadmins can change anyone's
    const target = (user.role === 'superadmin' && targetUsername) ? targetUsername : user.username;

    const result = await changeAdminPassword(target, newPassword);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
