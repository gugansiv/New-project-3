#!/usr/bin/env bash
# deploy.sh — build & start the Ignite QSR stack
set -euo pipefail

COMPOSE="docker compose"
# Fallback to docker-compose v1 if needed
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

# ── 1. Check .env ────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "❌  .env not found."
  echo "    Copy .env.example and fill in the values:"
  echo "    cp .env.example .env && nano .env"
  exit 1
fi

# ── 2. Warn about default passwords ──────────────────────────────
if grep -q 'CHANGE_ME' .env 2>/dev/null; then
  echo "⚠️   WARNING: .env still contains CHANGE_ME placeholders!"
  echo "    Edit .env before going live."
  echo ""
fi

# ── 3. Pull latest base images ───────────────────────────────────
echo "🔄  Pulling base images …"
$COMPOSE pull db caddy

# ── 4. Build app image ───────────────────────────────────────────
echo "🔨  Building Next.js image …"
$COMPOSE build --no-cache app

# ── 5. Bring stack up ────────────────────────────────────────────
echo "🚀  Starting stack …"
$COMPOSE up -d

# ── 6. Wait for app to be healthy ────────────────────────────────
echo "⏳  Waiting for app to start …"
for i in {1..30}; do
  if $COMPOSE exec -T app wget -qO- http://localhost:3000/api/stores &>/dev/null; then
    echo "✅  App is up!"
    break
  fi
  sleep 2
done

# ── 7. Show status ───────────────────────────────────────────────
echo ""
echo "📋  Container status:"
$COMPOSE ps

echo ""
echo "────────────────────────────────────────────────────"
echo "  🌐  https://ligerasynergy.co.uk"
echo "  Customer  → https://ligerasynergy.co.uk/?portal=customer"
echo "  Branch    → https://ligerasynergy.co.uk/?portal=branch"
echo "  Admin     → https://ligerasynergy.co.uk/?portal=admin"
echo "────────────────────────────────────────────────────"
echo ""
echo "  Tail live logs:   ./deploy.sh logs"
echo "  Stop stack:       docker compose down"
echo ""

# If called with 'logs' argument, tail logs
if [[ "${1:-}" == "logs" ]]; then
  $COMPOSE logs -f
fi
