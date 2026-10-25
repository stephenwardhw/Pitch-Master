# Serving PitchMaster (Node.js) Behind an Apache Reverse Proxy

This guide explains how to host PitchMaster running on Node.js (port 3000) behind an **Apache HTTP Server** reverse proxy with SSL, WebSocket support, and persistent process management.

---

## 1. Prerequisites & Required Apache Modules

On Ubuntu / Debian / Raspberry Pi OS:

```bash
# Enable proxy, HTTP proxy, WebSocket tunnel, rewrite, and headers modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod ssl

# Restart Apache to load modules
sudo systemctl restart apache2
```

On RHEL / Rocky Linux / CentOS:
Ensure `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, and `mod_ssl` are enabled in `/etc/httpd/conf.modules.d/`.

---

## 2. Apache VirtualHost Configuration

Create a new VirtualHost file (e.g. `/etc/apache2/sites-available/pitchmaster.conf`):

```apache
<VirtualHost *:80>
    ServerName schedule.yourdomain.com
    # Optional alias:
    # ServerAlias www.schedule.yourdomain.com

    ServerAdmin webmaster@yourdomain.com

    # Turn on ProxyPreserveHost so Node.js receives the original Host header
    ProxyPreserveHost On
    ProxyRequests Off

    # Forward client IP and protocol headers to Node.js
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Port "80"

    # 1. Forward WebSocket connections (Vite HMR and real-time updates)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:3000/$1 [P,L]

    # 2. Reverse proxy all API routes and application traffic to Node.js on port 3000
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # Custom log paths
    ErrorLog ${APACHE_LOG_DIR}/pitchmaster_error.log
    CustomLog ${APACHE_LOG_DIR}/pitchmaster_access.log combined
</VirtualHost>
```

### Production HTTPS VirtualHost Configuration (with SSL / Certbot)

For secure production setups (strongly recommended for admin authentication):

```apache
<VirtualHost *:80>
    ServerName schedule.yourdomain.com
    Redirect permanent / https://schedule.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName schedule.yourdomain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/schedule.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/schedule.yourdomain.com/privkey.pem

    ProxyPreserveHost On
    ProxyRequests Off

    # Forward client SSL info to Node.js
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    # Forward WebSockets
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:3000/$1 [P,L]

    # Reverse proxy to Node.js
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog ${APACHE_LOG_DIR}/pitchmaster_ssl_error.log
    CustomLog ${APACHE_LOG_DIR}/pitchmaster_ssl_access.log combined
</VirtualHost>
```

Enable the site in Apache:

```bash
sudo a2ensite pitchmaster.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## 3. Important Note Regarding Apache `SetEnv`

You asked: *“Can I use the `SetEnv` apache command in the apache config to set the environment variables?”*

### How Apache Environment Variables Work:
- Apache's `SetEnv` directive sets internal Apache environment variables that are passed to **CGI / FastCGI scripts (like PHP or mod_perl)**.
- Because Apache acts as a **reverse proxy** over an HTTP/TCP socket to a separate Node.js process (`http://127.0.0.1:3000`), Apache's `SetEnv` variables are **not** inherited by the Node.js operating system environment.

### The Correct Ways to Set Environment Variables for Node.js:
1. **In the `.env` file** (Recommended):
   In the root directory of your project, create a `.env` file:
   ```bash
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=ichlpm
   MYSQL_PASSWORD=pitchmasterichl
   MYSQL_DATABASE=pitchmaster
   MYSQL_TABLE=schedule_backups
   PORT=3000
   ```
2. **In the systemd service file** (Production recommended):
   See Section 4 below to specify `Environment="MYSQL_HOST=127.0.0.1"` directly in systemd.

---

## 4. Running Node.js Continuously in the Background

To keep the application running automatically on system boot and restart on failures, use **systemd** or **PM2**.

### Option A: Using systemd (Recommended for Linux servers)

Create `/etc/systemd/system/pitchmaster.service`:

```ini
[Unit]
Description=PitchMaster Soccer Scheduler Node.js Server
After=network.target mysql.service

[Service]
Type=simple
User=steveward
WorkingDirectory=/home/steveward/Projects/Pitch-Master
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=MYSQL_HOST=127.0.0.1
Environment=MYSQL_PORT=3306
Environment=MYSQL_USER=ichlpm
Environment=MYSQL_PASSWORD=pitchmasterichl
Environment=MYSQL_DATABASE=pitchmaster

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

### Option B: Using PM2

```bash
sudo npm install -g pm2
cd ~/Projects/Pitch-Master

# Start PitchMaster
pm2 start server.ts --name "pitchmaster" --interpreter npx --interpreter-args tsx

# Save PM2 process list to start automatically on system boot
pm2 save
pm2 startup
```

---

## 5. Summary Checklist

| Component | Port / Path | Purpose |
| :--- | :--- | :--- |
| **Node.js Server** | `http://127.0.0.1:3000` | Backend API (`/api/auth/*`, `/api/mysql/*`), Vite SSR/SPA |
| **MySQL Server** | `127.0.0.1:3306` | Document backups (`schedule_backups`) & Admin logins (`admin_users`) |
| **Apache** | `80` / `443` | Reverse proxy, SSL termination, public URL access |
