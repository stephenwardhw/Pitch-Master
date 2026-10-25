import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mysqlRouter } from './src/server/mysqlRouter';
import { authRouter } from './src/server/authRouter';

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

// Dedicated route to serve league_schedule.json
app.get('/league_schedule.json', (_req, res) => {
  const candidatePaths = [
    path.join(__dirname, 'public', 'league_schedule.json'),
    path.join(__dirname, 'dist', 'league_schedule.json'),
    path.join(__dirname, 'league_schedule.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(p);
    }
  }

  res.status(404).json({ error: 'league_schedule.json not found on server.' });
});

// Endpoint for league admins to publish updated schedule to the server's league_schedule.json
app.post('/api/publish-schedule', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.divisions || !data.teams) {
      return res.status(400).json({ error: 'Invalid dataset payload.' });
    }

    const payloadStr = JSON.stringify(data, null, 2);

    const publicPath = path.join(__dirname, 'public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    fs.writeFileSync(path.join(publicPath, 'league_schedule.json'), payloadStr);

    const rootPath = path.join(__dirname, 'league_schedule.json');
    fs.writeFileSync(rootPath, payloadStr);

    const distPublicPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPublicPath)) {
      fs.writeFileSync(path.join(distPublicPath, 'league_schedule.json'), payloadStr);
    }

    res.json({
      success: true,
      message: 'Successfully published to server file league_schedule.json',
      updatedAt: new Date().toISOString(),
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
