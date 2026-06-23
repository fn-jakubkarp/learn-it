#requires -Version 5.1
#
# learn-it installer (Windows / PowerShell).
#
#   irm https://raw.githubusercontent.com/fn-jakubkarp/learn-it/main/install.ps1 | iex
#
# What it does:
#   1. Installs Bun if it isn't already on your PATH.
#   2. Clones the repo (skipped if you run this from inside an existing clone).
#   3. Runs `bun install` and creates the SQLite database.
#
# Override the clone location by setting $env:LEARN_IT_DIR before running:
#   $env:LEARN_IT_DIR = "C:\code\learn-it"; irm .../install.ps1 | iex

$ErrorActionPreference = 'Stop'

function Info($m) { Write-Host "  $m" }
function Die($m)  { Write-Host "error: $m" -ForegroundColor Red; exit 1 }

Write-Host "learn-it installer"

$repo   = "https://github.com/fn-jakubkarp/learn-it.git"
$target = if ($env:LEARN_IT_DIR) { $env:LEARN_IT_DIR } else { "learn-it" }

# 1. Bun ---------------------------------------------------------------------
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Info "Bun not found - installing from bun.sh..."
  irm bun.sh/install.ps1 | iex
  # Make bun usable for the rest of this script without a new shell.
  $bunBin = Join-Path $env:USERPROFILE ".bun\bin"
  if (Test-Path $bunBin) { $env:Path = "$bunBin;$env:Path" }
  if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Die "Bun installed but not on PATH - open a new shell and re-run."
  }
} else {
  Info "Bun found: $(bun --version)"
}

# 2. Source -------------------------------------------------------------------
# If we're already inside a learn-it checkout, use it. Otherwise clone.
$haveCheckout = (Test-Path "src/learn-it.ts") -and (Test-Path "package.json") -and `
  (Select-String -Path "package.json" -Pattern '"name": "learn-it"' -Quiet)

if ($haveCheckout) {
  Info "Existing checkout detected - installing here."
} else {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git is required but not installed." }
  if (Test-Path $target) { Die "$target already exists - remove it or set `$env:LEARN_IT_DIR." }
  Info "Cloning into $target..."
  git clone --depth 1 $repo $target
  if ($LASTEXITCODE -ne 0) { Die "git clone failed." }
  Set-Location $target
}

# 3. Dependencies + database --------------------------------------------------
Info "Installing dependencies..."
bun install
if ($LASTEXITCODE -ne 0) { Die "bun install failed." }

Info "Creating the database..."
bun src/init-db.ts
if ($LASTEXITCODE -ne 0) { Die "database init failed." }

# Done ------------------------------------------------------------------------
Write-Host ""
Write-Host "Done."
$path = (Get-Location).Path
Write-Host @"
  Next:
    cd "$path"

  Learn-it is driven by an AI. Open your agentic CLI from inside this
  directory, then run the skill:
    claude        # then: /learn-it

  Prefer solo review? The web dashboard needs no AI:
    bun src/dashboard.ts          # -> http://localhost:4321
"@
