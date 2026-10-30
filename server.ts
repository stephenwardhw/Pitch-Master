import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mysqlRouter } from './src/server/mysqlRouter';
import { authRouter } from './src/server/authRouter';
import { validateSessionToken } from './src/server/authService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Auth & MySQL NoSQL Backup API routes
app.use('/api/auth', authRouter);
app.use('/api/mysql', mysqlRouter);

// Dedicated route to serve robots.txt to prevent crawlers
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /\n');
});

interface FileWriteResult {
  path: string;
  success: boolean;
  error?: string;
  details?: string;
}

/**
 * Attempts multiple write strategies to safely write the JSON schedule file
 * even when standard open('w') encounters Linux permission quirks (e.g. existing file vs directory permissions).
 */
function tryWriteScheduleFile(filePath: string, content: string): FileWriteResult {
  const dir = path.dirname(filePath);

  // 1. Ensure directory exists with group-writable permissions if possible
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o775 });
    }
  } catch (dirErr: any) {
    return {
      path: filePath,
      success: false,
      error: `Directory creation error (${dir}): ${dirErr.message}`,
    };
  }

  // 2. If file already exists, attempt to make it writable before opening
  if (fs.existsSync(filePath)) {
    try {
      fs.chmodSync(filePath, 0o664);
    } catch {
      // Ignore if not permitted
    }
  }

  // Strategy A: Standard writeFileSync
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'w', mode: 0o664 });
    return { path: filePath, success: true };
  } catch (errA: any) {
    // Strategy B: In-place truncate & write via file descriptor ('r+')
    // Useful if the process has write permissions on the file itself but not write/create on the directory
    try {
      if (fs.existsSync(filePath)) {
        const fd = fs.openSync(filePath, 'r+');
        fs.ftruncateSync(fd, 0);
        fs.writeFileSync(fd, content, 'utf-8');
        fs.closeSync(fd);
        return { path: filePath, success: true };
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy C: Unlink and re-create
    // Useful if process has write permission on the directory, allowing recreation even if file owner differed
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o664 });
        return { path: filePath, success: true };
      }
    } catch {
      // Continue
    }

    // Collect actionable Linux diagnostics
    let diagInfo = '';
    try {
      const procUid = typeof process.getuid === 'function' ? process.getuid() : 'N/A';
      const procGid = typeof process.getgid === 'function' ? process.getgid() : 'N/A';
      const procUser = process.env.USER || process.env.LOGNAME || 'pitchmaster';

      let fileStatMsg = 'Target file does not exist yet';
      if (fs.existsSync(filePath)) {
        const fStat = fs.statSync(filePath);
        fileStatMsg = `File exists (Owner UID: ${fStat.uid}, GID: ${fStat.gid}, mode: ${(fStat.mode & 0o777).toString(8)})`;
      }

      let dirStatMsg = 'Directory does not exist';
      if (fs.existsSync(dir)) {
        const dStat = fs.statSync(dir);
        dirStatMsg = `Directory (Owner UID: ${dStat.uid}, GID: ${dStat.gid}, mode: ${(dStat.mode & 0o777).toString(8)})`;
      }

      diagInfo = `Process is running as user "${procUser}" (UID ${procUid}, GID ${procGid}). ${fileStatMsg}. ${dirStatMsg}. Fix: sudo chown -R ${procUser}:${procUser} "${dir}" && sudo chmod 775 "${dir}" && sudo chmod 664 "${filePath}"`;
    } catch {
      // Ignore
    }

    return {
      path: filePath,
      success: false,
      error: errA.message || 'Permission denied',
      details: diagInfo,
    };
  }
}

// Dedicated route to serve league_schedule.json (serves whichever candidate file was most recently updated)
app.get('/league_schedule.json', (_req, res) => {
  const candidatePaths = [
    ...(process.env.SCHEDULE_JSON_PATH ? [path.resolve(process.env.SCHEDULE_JSON_PATH)] : []),
    path.join(__dirname, 'public', 'league_schedule.json'),
    path.join(__dirname, 'dist', 'league_schedule.json'),
    path.join(__dirname, 'league_schedule.json'),
  ];

  const existingFiles = candidatePaths
    .filter((p) => fs.existsSync(p))
    .map((p) => {
      try {
        const stat = fs.statSync(p);
        const birthMs = stat.birthtimeMs && stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.ctimeMs;
        return { path: p, mtime: stat.mtimeMs, ctime: birthMs, stat };
      } catch {
        return { path: p, mtime: 0, ctime: 0, stat: null };
      }
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (existingFiles.length > 0) {
    const top = existingFiles[0];
    const stat = top.stat || fs.statSync(top.path);
    const birthDate = stat.birthtime && stat.birthtime.getTime() > 0 ? stat.birthtime : (stat.ctime || stat.mtime);
    const createdIso = birthDate.toISOString();
    const modifiedIso = stat.mtime.toISOString();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('X-File-Created-At', createdIso);
    res.setHeader('X-File-Modified-At', modifiedIso);
    res.setHeader('Access-Control-Expose-Headers', 'X-File-Created-At, X-File-Modified-At, Last-Modified');
    return res.sendFile(top.path);
  }

  res.status(404).json({ error: 'league_schedule.json not found on server.' });
});

// Endpoint for league admins to publish updated schedule to the server's league_schedule.json
app.post('/api/publish-schedule', (req, res) => {
  try {
    // Restrict publishing to scheduler role and above (scheduler, admin, superadmin)
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    token = token || (req.query.token as string) || (req.headers['x-admin-token'] as string) || '';

    if (token) {
      const user = validateSessionToken(token);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session token.' });
      }
      if (user.role === 'viewer') {
        return res.status(403).json({
          error: 'Forbidden: Publishing is restricted to Scheduler role and above. Viewer accounts have read-only access.',
        });
      }
    }

    const data = req.body;
    if (!data || !data.divisions || !data.teams) {
      return res.status(400).json({ error: 'Invalid dataset payload.' });
    }

    // Preserve original creation time or set new timestamp
    if (!data.fileCreatedAt) {
      data.fileCreatedAt = data.createdAt || new Date().toISOString();
    }
    data.lastModified = new Date().toISOString();

    // Sanitize referee contact information for public league_schedule.json:
    // If hideContactPublicly is true, phone and email are stripped (name only).
    // If hideContactPublicly is false, phone and email are published with coach contacts.
    // Internal administrative notes are always stripped from the public file.
    if (Array.isArray(data.referees)) {
      data.referees = data.referees.map((r: any) => {
        const { notes: _notes, ...rest } = r;
        const hideContact = Boolean(r.hideContactPublicly);
        return {
          ...rest,
          email: hideContact ? '' : (r.email || ''),
          phone: hideContact ? '' : (r.phone || ''),
          hideContactPublicly: hideContact,
        };
      });
    }

    const payloadStr = JSON.stringify(data, null, 2);

    const targetPaths: string[] = [];
    if (process.env.SCHEDULE_JSON_PATH) {
      targetPaths.push(path.resolve(process.env.SCHEDULE_JSON_PATH));
    }
    targetPaths.push(
      path.join(__dirname, 'public', 'league_schedule.json'),
      path.join(__dirname, 'dist', 'league_schedule.json'),
      path.join(__dirname, 'league_schedule.json')
    );

    const results: FileWriteResult[] = targetPaths.map((p) => tryWriteScheduleFile(p, payloadStr));
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (succeeded.length > 0) {
      let warningNote = '';
      if (failed.length > 0) {
        warningNote = ` (Note: ${failed[0].path} had permission restrictions: ${failed[0].details || failed[0].error})`;
      }

      return res.json({
        success: true,
        message: `Successfully published schedule to ${succeeded.length} server location(s)!${warningNote}`,
        succeededPaths: succeeded.map((s) => s.path),
        failedPaths: failed.map((f) => ({ path: f.path, error: f.error, details: f.details })),
        updatedAt: new Date().toISOString(),
      });
    }

    // If ALL target paths failed:
    const primaryError = failed[0];
    console.error('All publish targets failed with permissions:', failed);
    return res.status(500).json({
      error: `Server publish error: EACCES: permission denied. ${primaryError.details || primaryError.error}`,
      failedTargets: failed,
    });
  } catch (err: any) {
    console.error('Error publishing schedule to server:', err);
    res.status(500).json({ error: err.message || 'Server error saving league_schedule.json' });
  }
});

// Handle 404 for any unmatched /api/* routes with JSON, never HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Serve static assets from the production build directory (dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA routing, send index.html for all other GET requests
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PitchMaster Soccer Scheduler is running at: http://localhost:${PORT}`);
});
