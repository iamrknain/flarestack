#!/bin/bash
# ============================================
# FlareStack — Local Setup Script
# ============================================
#
# Usage: pnpm run setup
#
# Automates the full local dev bootstrap:
#   1. Install dependencies
#   2. Generate & apply DB migrations
#   3. Create local auth secrets
# ============================================

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

log_header "FlareStack  Local Setup"

# ── 1. Install Dependencies ─────────────────
log_step "${ICON_PACKAGE} Installing dependencies"
pnpm install
log_success "Dependencies installed"

echo ""

# ── 2. Database ─────────────────────────────
log_step "${ICON_DB} Generating DB schema & applying local migrations"
pnpm --filter @flarestack/db generate
npx wrangler d1 migrations apply flarestack-db \
  --local \
  --config apps/worker/wrangler.jsonc \
  --persist-to .wrangler/state
log_success "Database ready"

echo ""

# ── 3. Local Secrets ────────────────────────
log_step "${ICON_LOCK} Creating local auth secrets"
if [ ! -f apps/dashboard/.env ]; then
  cp apps/dashboard/.env.example apps/dashboard/.env
  SECRET=$(openssl rand -base64 32)
  # Replace placeholder with generated secret
  sed -i "s|your-better-auth-secret-here|$SECRET|g" apps/dashboard/.env
  log_success "apps/dashboard/.env created with a new random BETTER_AUTH_SECRET"
else
  log_warn "apps/dashboard/.env already exists — skipping"
fi

echo ""
log_divider
echo -e "${BOLD}${GREEN}${ICON_DONE} Local setup complete!${NC}"
echo ""
log_kv "Start dev" "pnpm dev"
log_link "Dashboard      → http://localhost:3000"
log_link "Worker (cron)  → http://localhost:8787/__scheduled"
log_info "Cron does not tick automatically locally — press 't' or visit /__scheduled to trigger it."
log_divider
echo ""
