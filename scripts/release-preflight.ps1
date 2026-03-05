#!/usr/bin/env pwsh
# release-preflight.ps1
# Local preflight script for Windows developers.
# Runs the exact same steps as the CI release workflow.
# Usage: .\scripts\release-preflight.ps1 [-SkipTests] [-SkipBuild]

param(
    [switch]$SkipTests,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Step([string]$Title) {
    Write-Host "`n──────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan
}

function Fail([string]$Msg) {
    Write-Host "`n[FAIL] $Msg" -ForegroundColor Red
    exit 1
}

# ── 1. Install dependencies ────────────────────────────────────────────────
Step "1/4  Installing dependencies"
pnpm --filter openclaw-secure-installer-desktop... install
if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed" }

# ── 2. Rust tests ─────────────────────────────────────────────────────────
if (-not $SkipTests) {
    Step "2/4  Running Rust tests"
    Push-Location desktop/src-tauri
    cargo test
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "cargo test failed" }
    Pop-Location
} else {
    Write-Host "  [SKIPPED] Rust tests (-SkipTests flag)" -ForegroundColor Yellow
}

# ── 3. Frontend build ─────────────────────────────────────────────────────
Step "3/4  Building frontend (Vite)"
pnpm --filter openclaw-secure-installer-desktop... build
if ($LASTEXITCODE -ne 0) { Fail "pnpm build failed" }

# ── 4. Tauri build ────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Step "4/4  Building Tauri app (MSI + NSIS)"
    pnpm -C desktop tauri:build -- --verbose
    if ($LASTEXITCODE -ne 0) { Fail "tauri:build failed" }
} else {
    Write-Host "  [SKIPPED] Tauri build (-SkipBuild flag)" -ForegroundColor Yellow
}

# ── Summary ───────────────────────────────────────────────────────────────
Step "Build complete — artifacts"
$BundleRoot = Join-Path $RepoRoot "desktop/src-tauri/target/release/bundle"
$Msi  = Get-ChildItem "$BundleRoot/msi/*.msi"  -ErrorAction SilentlyContinue
$Exe  = Get-ChildItem "$BundleRoot/nsis/*-setup.exe" -ErrorAction SilentlyContinue

if ($Msi)  { $Msi  | ForEach-Object { Write-Host "  MSI : $($_.FullName)" -ForegroundColor Green } }
else        { Write-Host "  MSI : [not found — did tauri:build run?]" -ForegroundColor Yellow }

if ($Exe)  { $Exe  | ForEach-Object { Write-Host "  EXE : $($_.FullName)" -ForegroundColor Green } }
else        { Write-Host "  EXE : [not found — did tauri:build run?]" -ForegroundColor Yellow }

Write-Host "`nPreflight OK. Tag and push when ready:" -ForegroundColor Green
Write-Host "  git tag v0.2.2 && git push origin main --tags" -ForegroundColor White
