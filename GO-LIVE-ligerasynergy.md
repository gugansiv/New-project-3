# GO-LIVE Guide — ligerasynergy.co.uk
### Ignite QSR Platform · Crispy Chicken Co.

---

## Overview

This guide walks you through deploying the Ignite QSR platform to your own server so it's live at **https://ligerasynergy.co.uk**.

The stack is fully Docker-based:

| Container | Role |
|-----------|------|
| `ignite_db` | PostgreSQL 16 — all data lives here |
| `ignite_app` | Next.js 16 app (customer, branch & admin portals) |
| `ignite_caddy` | Caddy 2 — reverse proxy + automatic Let's Encrypt TLS |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Ubuntu 22.04 / Debian 12 VPS | Any cloud provider (DigitalOcean, Hetzner, AWS, etc.) |
| Public IPv4 address | You'll need this for the DNS step |
| Docker 24+ | Installation shown below |
| Ports 80 & 443 open | For HTTP challenge & HTTPS traffic |
| Domain: `ligerasynergy.co.uk` | Managed via GoDaddy |

---

## Step 1 — Repoint DNS at GoDaddy

> Allow **5-10 minutes** for propagation after saving.

1. Log into GoDaddy DNS Manager for `ligerasynergy.co.uk`
2. **Delete** any existing A records pointing to `3.33.130.190` or `15.197.148.33`
3. **Add** two A records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR.SERVER.PUBLIC.IP` | 600 |
| A | `www` | `YOUR.SERVER.PUBLIC.IP` | 600 |

### Verify DNS propagation

```bash
dig +short ligerasynergy.co.uk
dig +short www.ligerasynergy.co.uk
# Both must return YOUR.SERVER.PUBLIC.IP before Caddy can get a cert
```

---

## Step 2 — Prepare the Server

SSH into your server, then:

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Open firewall ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Step 3 — Deploy the Code

```bash
git clone https://github.com/gugansiv/New-project-3.git ignite-qsr
cd ignite-qsr
git checkout dev
```

---

## Step 4 — Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

| Variable | What to put |
|----------|-------------|
| `DB_USER` | Any username, e.g. `ignite` |
| `DB_PASSWORD` | Strong random password |
| `DB_NAME` | e.g. `ignite_qsr` |
| `JWT_SECRET` | Run: `openssl rand -hex 32` |
| `NEXT_PUBLIC_RAZORPAY_KEY` | Your Razorpay live key ID (`rzp_live_...`) |
| `RAZORPAY_SECRET` | Your Razorpay live key secret |

Never commit `.env` to Git — it is already in `.gitignore`.

---

## Step 5 — Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

What the script does:
1. Validates `.env` is present
2. Pulls latest Postgres and Caddy base images
3. Builds the Next.js production image
4. Brings up all three containers
5. Waits for the app to respond
6. Prints live URLs

---

## Step 6 — Watch for SSL Certificate

```bash
./deploy.sh logs
# or:
docker compose logs -f caddy
```

Look for: `certificate obtained successfully`

Once you see it, the site is live and secure.

---

## Live URLs

| Portal | URL |
|--------|-----|
| Customer Storefront | https://ligerasynergy.co.uk/ |
| Branch Manager | https://ligerasynergy.co.uk/branch |
| Admin Dashboard | https://ligerasynergy.co.uk/admin |

---

## First-Login Admin Setup

On a fresh database all tables are auto-created but no users exist. Create the first admin:

```bash
# Get the password hash
docker compose exec app node -e "
const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync('YOUR_STRONG_PASSWORD', salt, 64).toString('hex');
console.log(salt + ':' + hash);
"
```

Copy the output hash, then:

```bash
docker compose exec db psql -U ignite -d ignite_qsr
```

```sql
INSERT INTO users (id, name, email, password, role)
VALUES (
  gen_random_uuid()::text,
  'Admin',
  'admin@ligerasynergy.co.uk',
  'PASTE_HASH_HERE',
  'admin'
);
\q
```

Log in at https://ligerasynergy.co.uk/admin.

---

## Useful Commands

```bash
# View all logs
docker compose logs -f

# Restart app only
docker compose restart app

# Stop everything
docker compose down

# Pull updates and redeploy
git pull && ./deploy.sh

# Database backup
docker compose exec db pg_dump -U ignite ignite_qsr > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_YYYYMMDD.sql | docker compose exec -T db psql -U ignite ignite_qsr
```

---

## Troubleshooting

### Certificate not obtained after 5 minutes
- Check DNS: `dig +short ligerasynergy.co.uk` must return your server IP
- Check ports: `curl -I http://ligerasynergy.co.uk`
- Check Caddy logs: `docker compose logs caddy`

### App shows 502 Bad Gateway
- Next.js may still be starting — wait 30s and refresh
- Check: `docker compose logs app`

### Database connection errors
- Check: `docker compose ps` — db must be healthy
- If you changed `.env` after first boot: `docker compose down -v && ./deploy.sh`

### `CHANGE_ME` warning on deploy
- Open `.env` and replace every `CHANGE_ME_*` with real values

---

## Security Checklist

- [ ] Replace all `CHANGE_ME` values in `.env`
- [ ] Generate strong `JWT_SECRET` with `openssl rand -hex 32`
- [ ] Use Razorpay **live** keys (not test keys)
- [ ] Create admin user with a strong unique password
- [ ] Confirm HTTPS is working (green padlock)
- [ ] Set up regular database backups

---

*Ignite QSR — ligerasynergy.co.uk*
