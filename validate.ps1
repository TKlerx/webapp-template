#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Backpressure script - runs after each task to validate the build.

.DESCRIPTION
    Usage: ./validate.ps1 [phase]
    Phases:
      all      - typecheck + lint + duplication + semgrep + test (default, same as CI)
      full     - all + continuity freshness + Playwright E2E tests (recommended before merge)
      continuity - refresh continuity files and fail if that created uncommitted changes
      quick    - typecheck only (use during scaffolding before tests exist)
      test     - tests only
      e2e      - Playwright E2E tests only
      quality  - lint + duplication + semgrep
      commit   - validate all, then git add + commit + push
#>

param(
    [ValidateSet("all", "full", "continuity", "quick", "test", "e2e", "quality", "commit")]
    [string]$Phase = "all"
)

$ErrorActionPreference = "Stop"

if ($Host.UI -and $Host.UI.RawUI) {
    $Host.UI.RawUI.WindowTitle = "resource-planning validate"
}

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Pass($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow }

function Invoke-ShellCommand([string]$commandLine, [switch]$CaptureOutput) {
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        if ($CaptureOutput) {
            $output = cmd /c $commandLine 2>&1
        } else {
            cmd /c $commandLine | Out-Host
        }
    } else {
        if ($CaptureOutput) {
            $output = /bin/sh -lc $commandLine 2>&1
        } else {
            /bin/sh -lc $commandLine | Out-Host
        }
    }

    if ($CaptureOutput) {
        return @{
            ExitCode = $LASTEXITCODE
            Output = @($output)
        }
    }

    return $LASTEXITCODE
}

function Invoke-NativeCommand([string]$commandLine) {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    try {
        return Invoke-ShellCommand $commandLine
    } finally {
        $script:ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-NativeCommandCaptured([string]$commandLine) {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    try {
        return Invoke-ShellCommand $commandLine -CaptureOutput
    } finally {
        $script:ErrorActionPreference = $previousErrorActionPreference
    }
}

function Remove-Ansi([string]$text) {
    if (-not $text) {
        return $text
    }

    return [regex]::Replace($text, '\x1B\[[0-9;]*[A-Za-z]', '')
}

function Test-HasPlaywrightSpecs {
    $roots = @("e2e", "tests/e2e")
    $patterns = @("*.spec.ts", "*.spec.tsx", "*.e2e.ts", "*.e2e.tsx")

    foreach ($root in $roots) {
        if (-not (Test-Path $root)) {
            continue
        }

        foreach ($pattern in $patterns) {
            if (Get-ChildItem -Path $root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue | Select-Object -First 1) {
                return $true
            }
        }
    }

    return $false
}

function Test-ContinuityFreshness {
    Write-Step "Continuity (CONTINUE.md / CONTINUE_LOG.md)"
    try {
        $exitCode = Invoke-NativeCommand "npm run continuity:update"
        if ($exitCode -ne 0) { throw "continuity update failed" }

        $changedFiles = git status --short -- CONTINUE.md CONTINUE_LOG.md
        if ($changedFiles) {
            Write-Host $changedFiles
            throw "continuity files changed"
        }

        Write-Pass "continuity files are current"
    } catch {
        Write-Fail "continuity files are out of date"
        Write-Host 'Run `npm run continuity:update`, review CONTINUE.md and CONTINUE_LOG.md, commit the updates, then try again.' -ForegroundColor Yellow
        $script:failures += "continuity"
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
        $result = Invoke-NativeCommandCaptured "npm run duplication"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "duplication check failed"
        }

        $threshold = ((Get-Content ".jscpd.json" -Raw | ConvertFrom-Json).threshold).ToString("0.##")
        $summaryLine = $result.Output |
            Select-String -Pattern 'Total:\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\(([\d.]+)%\)' |
            Select-Object -Last 1

        if ($summaryLine -and $summaryLine.Matches.Count -gt 0) {
            $duplicationPercent = $summaryLine.Matches[0].Groups[1].Value
            Write-Pass "duplication check passed ($duplicationPercent% <= $threshold%)"
        } else {
            Write-Pass "duplication check passed"
        }
    } catch {
        Write-Fail "duplication check failed"
        $failures += "duplication"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Security scan (semgrep)"
    try {
        $env:PYTHONUTF8 = "1"
        $result = Invoke-NativeCommandCaptured "npm run semgrep"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "semgrep failed"
        }

        $findingsLine = $result.Output |
            Select-String -Pattern 'Findings:\s+(\d+)\s+\((\d+)\s+blocking\)' |
            Select-Object -Last 1

        if ($findingsLine -and $findingsLine.Matches.Count -gt 0) {
            $findings = $findingsLine.Matches[0].Groups[1].Value
            $blocking = $findingsLine.Matches[0].Groups[2].Value
            Write-Pass "semgrep passed ($findings findings, $blocking blocking)"
        } else {
            Write-Pass "semgrep passed"
        }
    } catch {
        Write-Fail "semgrep failed"
        $failures += "semgrep"
    }
}

if ($Phase -in "all", "full", "test", "commit") {
    Write-Step "Tests (vitest)"
    try {
        $result = Invoke-NativeCommandCaptured "npm test"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "tests failed"
        }

        $filesLine = $result.Output |
            Select-String -Pattern 'Test Files\s+(\d+)\s+passed' |
            Select-Object -Last 1
        $testsLine = $result.Output |
            Select-String -Pattern 'Tests\s+(\d+)\s+passed' |
            Select-Object -Last 1
        $durationLine = $result.Output |
            Select-String -Pattern 'Duration\s+(.+)$' |
            Select-Object -Last 1

        $parts = @()
        if ($filesLine -and $filesLine.Matches.Count -gt 0) {
            $parts += "$($filesLine.Matches[0].Groups[1].Value) files"
        }
        if ($testsLine -and $testsLine.Matches.Count -gt 0) {
            $parts += "$($testsLine.Matches[0].Groups[1].Value) tests"
        }
        if ($durationLine) {
            $durationText = (Remove-Ansi($durationLine.Line) -replace '^\s*Duration\s+', '').Trim()
            $parts += $durationText
        }

        if ($parts.Count -gt 0) {
            Write-Pass "tests passed ($($parts -join ', '))"
        } else {
            Write-Pass "tests passed"
        }
    } catch {
        Write-Fail "tests failed"
        $failures += "tests"
    }
}

if ($Phase -in "full", "continuity") {
    Test-ContinuityFreshness
}

if ($Phase -in "full", "e2e") {
    Write-Step "E2E Tests (playwright)"
    if (-not (Test-HasPlaywrightSpecs)) {
        Write-Warn "playwright skipped (no e2e spec files found)"
    } else {
        try {
            $commandLine = if ($IsWindows -or $env:OS -eq "Windows_NT") {
                "set CI=1 && set E2E_PORT=3290 && npm run test:e2e"
            } else {
                "CI=1 E2E_PORT=3290 npm run test:e2e"
            }

            $result = Invoke-NativeCommandCaptured $commandLine
            if ($result.ExitCode -ne 0) {
                $result.Output | Out-Host
                throw "e2e tests failed"
            }

            $summaryLine = $result.Output |
                Select-String -Pattern '^\s*\d+\s+passed\s+\(.+\)$' |
                Select-Object -Last 1

            if ($summaryLine) {
                Write-Pass "e2e tests passed ($($summaryLine.Line.Trim()))"
            } else {
                Write-Pass "e2e tests passed"
            }
        } catch {
            Write-Fail "e2e tests failed"
            $failures += "e2e"
        }
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
