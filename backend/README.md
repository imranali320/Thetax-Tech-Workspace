# Theta Workplace API (FastAPI)

Phase 1 of the backend (per blueprint §23): login, password change, roles, employees, departments,
audit log. Replaces the in-memory `StoreContext` in the React app one module at a time.

## Local development

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env         # then edit DATABASE_URL and SECRET_KEY
python bootstrap.py            # creates tables + first owner account
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`. Point the Vite dev server's API base URL at
`http://localhost:8000` and set `FRONTEND_ORIGINS=http://localhost:5173` in `.env`.

## Deploying free, long-term: Oracle Cloud "Always Free" VM

Oracle's Always Free tier includes an Ampere A1 VM (up to 4 OCPUs / 24GB RAM, split across
instances) that is never billed and never expires — the only genuinely "free forever" option
that runs a persistent process (no cold starts, unlike Render/Railway free tiers).

### 1. Create the instance
1. Sign up at cloud.oracle.com (a card is required for identity verification; Always Free
   resources are never charged).
2. Compute → Create Instance → Image: **Ubuntu 22.04**, Shape: **VM.Standard.A1.Flex** (pick
   it from "Ampere" shapes, e.g. 2 OCPU / 12GB), under Always Free eligible shapes.
3. If you get "Out of capacity" on A1, retry a different Availability Domain, or fall back to
   the smaller `VM.Standard.E2.1.Micro` (also Always Free, x86, 1GB RAM — fine for this app's
   scale starting out).
4. Add your SSH key during creation; note the public IP.

### 2. Open the ports (the #1 thing people miss)
Oracle blocks traffic at the **VCN Security List** level in addition to the OS firewall. In the
console: your VCN → Security Lists → add Ingress Rules for TCP 80 and 443 from `0.0.0.0/0`.
Then on the VM itself:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

### 3. Install MySQL, Python, Nginx
```bash
sudo apt update && sudo apt install -y mysql-server python3-venv python3-pip nginx certbot python3-certbot-nginx
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE theta_workplace CHARACTER SET utf8mb4;
CREATE USER 'theta_app'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL ON theta_workplace.* TO 'theta_app'@'localhost'; FLUSH PRIVILEGES;"
```

### 4. Deploy the app
```bash
git clone <your-repo> /opt/theta-workplace
cd /opt/theta-workplace/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # edit: DATABASE_URL uses the mysql user above, real SECRET_KEY, FRONTEND_ORIGINS
.venv/bin/python bootstrap.py
```

### 5. Run it as a service (systemd)
`/etc/systemd/system/theta-api.service`:
```ini
[Unit]
Description=Theta Workplace API
After=network.target mysql.service

[Service]
User=ubuntu
WorkingDirectory=/opt/theta-workplace/backend
EnvironmentFile=/opt/theta-workplace/backend/.env
ExecStart=/opt/theta-workplace/backend/.venv/bin/gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now theta-api
```

### 6. Nginx reverse proxy + free HTTPS
`/etc/nginx/sites-available/theta-api`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # needed later for the chat WebSocket endpoint:
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/theta-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com   # free Let's Encrypt cert, auto-renews
```

Point a DNS A record for `api.yourdomain.com` at the VM's public IP first (a free subdomain
from afraid.freedns.org or similar also works if you don't have a domain yet).

### 7. Frontend
The React app stays on Hostinger (or anywhere static) per the existing README. Just point its
API base URL at `https://api.yourdomain.com` and add that same origin to `FRONTEND_ORIGINS`.

### Backups (free)
A cron job covers §22 without any paid service:
```bash
# /etc/cron.d/theta-backup
0 2 * * * ubuntu mysqldump theta_workplace | gzip > /opt/backups/db-$(date +\%F).sql.gz
```
Keep the VM's boot volume backups off by default (they're not Always-Free); the nightly
`mysqldump` plus occasionally copying `/opt/backups` off the box (e.g. `rclone` to a free
Google Drive/Backblaze B2 free tier) satisfies "store at least one backup separately."

## What's next (not built yet)
This scaffold covers Phase 1 only: auth, users, departments, audit log. Attendance (§7-8),
tasks/projects (§9, §13), chat (§11), files (§12), KPIs (§10), leave (§Leave), reports (§16)
follow the same pattern — a `db/models.py` addition, a `schemas/*.py`, an `api/*.py` router,
registered in `main.py`. Ask for the next module when you're ready to wire it up.
