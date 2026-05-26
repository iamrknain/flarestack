#!/bin/bash
# ============================================
# FlareStack — Full Clean & Reset Script
# ============================================
#
# Usage: pnpm run clean
#
# Wipes:
#   - Local D1 databases (.wrangler state)
#   - Generated migration files
#   - All node_modules
#   - Build artifacts (.next, dist, etc.)
# ============================================

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

log_header "FlareStack  Clean & Reset"

log_warn "This will delete node_modules, build artifacts, local databases, and migrations."
echo ""
read -p "$(echo -e "${BOLD}${RED}  Are you sure? (y/N) ${NC}")" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log_info "Aborted. Nothing was deleted."
  exit 0
fi

echo ""
log_step "${ICON_CLEAN} Cleaning Workspace..."
echo ""

# ── 1. Wrangler State (Local DBs) ───────────
log_step "Removing .wrangler state (local databases)"
rm -rf .wrangler
rm -rf apps/dashboard/.wrangler
rm -rf apps/worker/.wrangler
log_success "Wrangler state removed"

# ── 2. Generated Migrations ─────────────────
log_step "Removing generated migration files"
rm -rf packages/db/migrations
log_success "Migration files removed"

# ── 3. node_modules ─────────────────────────
log_step "Removing node_modules"
rm -rf node_modules
rm -rf apps/dashboard/node_modules
rm -rf apps/worker/node_modules
rm -rf packages/db/node_modules
rm -rf packages/types/node_modules
log_success "node_modules removed"

# ── 4. Build Artifacts ───────────────────────
log_step "Removing build artifacts"
rm -rf apps/dashboard/.next
rm -rf apps/worker/dist
log_success "Build artifacts removed"

echo ""
log_divider
echo -e "${BOLD}${GREEN}${ICON_DONE} Workspace cleaned successfully.${NC}"
echo ""
log_kv "Next step" "pnpm run setup"
log_divider
echo ""
