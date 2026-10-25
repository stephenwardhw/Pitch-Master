import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function leagueScheduleServerPlugin(): Plugin {
  return {
    name: 'league-schedule-server-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/publish-schedule', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const publicDir = path.resolve(import.meta.dirname, 'public');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }
              const payloadStr = JSON.stringify(parsed, null, 2);
              fs.writeFileSync(path.resolve(publicDir, 'league_schedule.json'), payloadStr);
              fs.writeFileSync(path.resolve(import.meta.dirname, 'league_schedule.json'), payloadStr);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  message: 'Successfully published to server file league_schedule.json',
                  updatedAt: new Date().toISOString(),
                })
              );
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Invalid JSON' }));
            }
          });
        }
      });

      // Handle /api/mysql in Vite dev server
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/mysql')) {
          return next();
        }

        const parseBody = () =>
          new Promise<any>((resolve) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => {
              try {
                resolve(JSON.parse(data || '{}'));
              } catch {
                resolve({});
              }
            });
          });

        res.setHeader('Content-Type', 'application/json');

        try {
          // Dynamic import of mysqlService
          const mysqlSvc = await import('./src/server/mysqlService');

          if (url === '/api/mysql/status' && req.method === 'GET') {
            const status = await mysqlSvc.initializeTable();
            res.statusCode = 200;
            return res.end(JSON.stringify({ ...status, config: mysqlSvc.getMySqlConfig() }));
          }

          if (url === '/api/mysql/test-connection' && req.method === 'POST') {
            const body = await parseBody();
            const result = await mysqlSvc.testConnection(body);
            res.statusCode = 200;
            return res.end(JSON.stringify(result));
          }

          if (url === '/api/mysql/config' && req.method === 'POST') {
            const body = await parseBody();
            mysqlSvc.setMySqlConfig(body);
            const status = await mysqlSvc.initializeTable();
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                success: true,
                message: 'Configuration updated. ' + status.message,
                config: mysqlSvc.getMySqlConfig(),
              })
            );
          }

          if (url === '/api/mysql/backups' && req.method === 'GET') {
            const list = await mysqlSvc.listBackups();
            res.statusCode = 200;
            return res.end(JSON.stringify(list));
          }

          if (url.startsWith('/api/mysql/backups/') && req.method === 'GET') {
            const id = decodeURIComponent(url.replace('/api/mysql/backups/', '').split('?')[0]);
            const backup = await mysqlSvc.getBackup(id);
            if (!backup.record || !backup.appData) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: `Backup "${id}" not found.` }));
            }
            res.statusCode = 200;
            return res.end(
              JSON.stringify({
                appData: backup.appData,
                metadata: {
                  id: backup.record.id,
                  name: backup.record.name,
                  syncToken: backup.record.sync_token,
                  lastModifiedBy: backup.record.last_modified_by,
                  lastModifiedAt: backup.record.last_modified_at,
                  createdAt: backup.record.created_at,
                  versionNumber: backup.record.version_number,
                },
                isLiveMySql: backup.isLiveMySql,
              })
            );
          }

          if (url === '/api/mysql/backups' && req.method === 'POST') {
            const body = await parseBody();
            const result = await mysqlSvc.saveBackup(body);
            res.statusCode = result.conflict ? 409 : 200;
            return res.end(JSON.stringify(result));
          }

          next();
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), leagueScheduleServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  };
});
