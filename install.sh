#!/usr/bin/env bash
#
# learn-it installer.
#
#   curl -fsSL https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.sh | bash
#
# What it does:
#   1. Installs Bun if it isn't already on your PATH.
#   2. Clones the repo (skipped if you run this from inside an existing clone).
#   3. Runs `bun install` and creates the SQLite database.
#
# Override the clone location with the first argument or $LEARN_IT_DIR:
#   curl -fsSL .../install.sh | bash -s -- ~/code/learn-it

set -euo pipefail

REPO_URL="https://github.com/fn-jakubkarp/learn-it.git"
TARGET_DIR="${1:-${LEARN_IT_DIR:-learn-it}}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
die()  { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

bold "learn-it installer"

# 1. Bun ---------------------------------------------------------------------
if ! command -v bun >/dev/null 2>&1; then
  info "Bun not found — installing from bun.sh..."
  curl -fsSL https://bun.sh/install | bash
  # Make bun usable for the rest of this script without a new shell.
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  command -v bun >/dev/null 2>&1 || die "Bun installed but not on PATH — open a new shell and re-run."
else
  info "Bun found: $(bun --version)"
fi

# 2. Source -------------------------------------------------------------------
# If we're already inside a learn-it checkout, use it. Otherwise clone.
if [ -f "src/learn-it.ts" ] && grep -q '"name": "learn-it"' package.json 2>/dev/null; then
  info "Existing checkout detected — installing here."
else
  command -v git >/dev/null 2>&1 || die "git is required but not installed."
  if [ -e "$TARGET_DIR" ]; then
    die "$TARGET_DIR already exists — remove it or pass a different path."
  fi
  info "Cloning into $TARGET_DIR..."
  git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
  cd "$TARGET_DIR"
fi

# 3. Dependencies + database --------------------------------------------------
info "Installing dependencies..."
bun install

info "Creating the database..."
bun src/init-db.ts

# Done ------------------------------------------------------------------------
echo
bold "Done."
INSTALL_PATH="$(pwd)"
cat <<EOF
  Next:
    cd "$INSTALL_PATH"

  Learn-it is driven by an AI. Open your agentic CLI from inside this
  directory, then run the skill:
    claude        # then: /learn-it

  Prefer solo review? The web dashboard needs no AI:
    bun src/dashboard.ts          # -> http://localhost:4321
EOF
