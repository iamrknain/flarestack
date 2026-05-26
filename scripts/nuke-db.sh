#!/bin/bash
# ============================================
# FlareStack — Database-only Nuke & Reset
# ============================================
#
# Usage: pnpm run nuke:db
#
# Wipes:
#   - Local D1 databases (.wrangler state)
#   - Generated migration files
# ============================================

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

log_header "FlareStack  Nuke DB"

log_warn "This will delete your local database state and all generated migrations."
echo ""
read -p "$(echo -e "${BOLD}${RED}  Are you sure? (y/N) ${NC}")" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log_info "Aborted. No database files were deleted."
  exit 0
fi

echo ""
log_step "${ICON_CLEAN} Nuking Local Databases..."
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

echo ""
log_divider
echo -e "${BOLD}${GREEN}${ICON_DONE} Database nuked successfully.${NC}"
echo ""
log_kv "Next step" "pnpm run setup"
log_divider
echo ""
