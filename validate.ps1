#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Backpressure script - runs after each task to validate the build.

.DESCRIPTION
    Usage: ./validate.ps1 [phase]
    Phases:
      all      - typecheck + lint + duplication + semgrep + test (default, same as CI)
      full     - all + Playwright E2E tests (recommended before merge)
      quick    - typecheck only (use during scaffolding before tests exist)
      test     - tests only
      e2e      - Playwright E2E tests only
      quality  - lint + duplication + semgrep
      commit   - validate all, then git add + commit + push
#>

param(
    [ValidateSet("all", "full", "quick", "test", "e2e", "quality", "commit")]
    [string]$Phase = "all"
)

$ErrorActionPreference = "Stop"

if ($Host.UI -and $Host.UI.RawUI) {
    $Host.UI.RawUI.WindowTitle = "resource-planning validate"
}

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Pass($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

function Invoke-NativeCommand([string]$commandLine) {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    try {
        cmd /c $commandLine | Out-Host
        return $LASTEXITCODE
    } finally {
        $script:ErrorActionPreference = $previousErrorActionPreference
    }
}

$failures = @()

if ($Phase -in "all", "full", "quick", "commit") {
    Write-Step "Typecheck (tsc --noEmit)"
    try {
        $exitCode = Invoke-NativeCommand "npm run typecheck"
        if ($exitCode -ne 0) { throw "typecheck failed" }
        Write-Pass "typecheck passed"
    } catch {
        Write-Fail "typecheck failed"
        $failures += "typecheck"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Lint (eslint)"
    try {
        $exitCode = Invoke-NativeCommand "npm run lint"
        if ($exitCode -ne 0) { throw "lint failed" }
        Write-Pass "lint passed"
    } catch {
        Write-Fail "lint failed"
        $failures += "lint"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Duplication (jscpd)"
    try {
        $exitCode = Invoke-NativeCommand "npm run duplication"
        if ($exitCode -ne 0) { throw "duplication check failed" }
        Write-Pass "duplication check passed"
    } catch {
        Write-Fail "duplication check failed"
        $failures += "duplication"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Security scan (semgrep)"
    try {
        $env:PYTHONUTF8 = "1"
        $exitCode = Invoke-NativeCommand "npm run semgrep"
        if ($exitCode -ne 0) { throw "semgrep failed" }
        Write-Pass "semgrep passed"
    } catch {
        Write-Fail "semgrep failed"
        $failures += "semgrep"
    }
}

if ($Phase -in "all", "full", "test", "commit") {
    Write-Step "Tests (vitest)"
    try {
        $exitCode = Invoke-NativeCommand "npm test"
        if ($exitCode -ne 0) { throw "tests failed" }
        Write-Pass "tests passed"
    } catch {
        Write-Fail "tests failed"
        $failures += "tests"
    }
}

if ($Phase -in "full", "e2e") {
    Write-Step "E2E Tests (playwright)"
    try {
        $exitCode = Invoke-NativeCommand "set CI=1 && set E2E_PORT=3290 && npm run test:e2e"
        if ($exitCode -ne 0) { throw "e2e tests failed" }
        Write-Pass "e2e tests passed"
    } catch {
        Write-Fail "e2e tests failed"
        $failures += "e2e"
    }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "FAILED: $($failures -join ', ')" -ForegroundColor Red
    Write-Host "Fix failures before proceeding to the next task." -ForegroundColor Yellow
    exit 1
}

Write-Host "ALL CHECKS PASSED" -ForegroundColor Green

if ($Phase -eq "commit") {
    Write-Step "Git commit"
    git add -A
    $msg = Read-Host "Commit message"
    if ($msg) {
        git commit -m $msg
        Write-Pass "committed: $msg"
        $branch = git branch --show-current
        git push origin $branch
    } else {
        Write-Host "Commit skipped (empty message)" -ForegroundColor Yellow
    }
}
