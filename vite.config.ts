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
        const rawUrl = req.url || '';
        const url = rawUrl.split('?')[0].replace(/\/+$/, '') || '/';
        if (!rawUrl.startsWith('/api/mysql') && !rawUrl.startsWith('/api/auth')) {
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
          // Handle /api/auth routes
          if (url.startsWith('/api/auth')) {
            const authSvc = await import('./src/server/authService');

            if (url === '/api/auth/status' && req.method === 'GET') {
              const status = await authSvc.initializeAuthTable();
              res.statusCode = 200;
              return res.end(JSON.stringify(status));
            }

            if (url === '/api/auth/login' && req.method === 'POST') {
              const body = await parseBody();
              const result = await authSvc.authenticateAdmin(body.username, body.password);
              res.statusCode = result.success ? 200 : 401;
              return res.end(JSON.stringify(result));
            }

            if (url === '/api/auth/me' && req.method === 'GET') {
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ')
                ? authHeader.substring(7)
                : (req.headers['x-admin-token'] as string) || '';
              const user = authSvc.validateSessionToken(token);
              if (!user) {
                res.statusCode = 401;
                return res.end(JSON.stringify({ authenticated: false, message: 'Invalid or expired session' }));
              }
              res.statusCode = 200;
              return res.end(JSON.stringify({ authenticated: true, user }));
            }

            if (url === '/api/auth/logout' && req.method === 'POST') {
              const body = await parseBody();
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : body.token;
              authSvc.logoutSession(token);
              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, message: 'Logged out' }));
            }

            if (url === '/api/auth/users' && req.method === 'GET') {
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] as string) || '';
              const currentUser = authSvc.validateSessionToken(token);
              if (!currentUser || currentUser.role !== 'superadmin') {
                res.statusCode = 403;
                return res.end(JSON.stringify({ error: 'Forbidden: Superadmin role required' }));
              }
              const list = await authSvc.listAdminUsers();
              res.statusCode = 200;
              return res.end(JSON.stringify(list));
            }

            if (url === '/api/auth/users' && req.method === 'POST') {
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] as string) || '';
              const currentUser = authSvc.validateSessionToken(token);
              if (!currentUser || currentUser.role !== 'superadmin') {
                res.statusCode = 403;
                return res.end(JSON.stringify({ error: 'Forbidden: Superadmin role required' }));
              }
              const body = await parseBody();
              const result = await authSvc.createAdminUser(body);
              res.statusCode = result.success ? 200 : 400;
              return res.end(JSON.stringify(result));
            }

            if (url === '/api/auth/change-password' && req.method === 'POST') {
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] as string) || '';
              const currentUser = authSvc.validateSessionToken(token);
              const body = await parseBody();
              const target = (currentUser?.role === 'superadmin' && body.targetUsername) ? body.targetUsername : (body.username || currentUser?.username);
              if (body.targetUsername && body.targetUsername.toLowerCase() !== currentUser?.username.toLowerCase() && currentUser?.role !== 'superadmin') {
                res.statusCode = 403;
                return res.end(JSON.stringify({ error: 'Forbidden: Superadmin role required' }));
              }
              const result = await authSvc.changeAdminPassword(target, body.newPassword);
              res.statusCode = result.success ? 200 : 400;
              return res.end(JSON.stringify(result));
            }

            if (url === '/api/auth/delete-user' && req.method === 'POST') {
              const body = await parseBody();
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] as string) || '';
              const currentUser = authSvc.validateSessionToken(token);
              if (!currentUser || currentUser.role !== 'superadmin') {
                res.statusCode = 403;
                return res.end(JSON.stringify({ error: 'Forbidden: Superadmin role required' }));
              }
              const result = await authSvc.deleteAdminUser(body.targetUsername, currentUser?.username);
              res.statusCode = result.success ? 200 : 400;
              return res.end(JSON.stringify(result));
            }

            if (url === '/api/auth/update-user' && req.method === 'POST') {
              const body = await parseBody();
              const authHeader = req.headers.authorization || '';
              const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-admin-token'] as string) || '';
              const currentUser = authSvc.validateSessionToken(token);
              if (!currentUser || currentUser.role !== 'superadmin') {
                res.statusCode = 403;
                return res.end(JSON.stringify({ error: 'Forbidden: Superadmin role required' }));
              }
              const result = await authSvc.updateAdminUser(body.targetUsername, { displayName: body.displayName, role: body.role });
              res.statusCode = result.success ? 200 : 400;
              return res.end(JSON.stringify(result));
            }

            res.statusCode = 404;
            return res.end(JSON.stringify({ error: `Auth route not found: ${req.method} ${rawUrl}` }));
          }

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
            const id = decodeURIComponent(url.replace('/api/mysql/backups/', ''));
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

          res.statusCode = 404;
          return res.end(JSON.stringify({ error: `API route not found: ${req.method} ${rawUrl}` }));
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
