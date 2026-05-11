#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Backpressure script - runs after each task to validate the build.

.DESCRIPTION
    Usage: ./validate.ps1 [phase]
    Phases:
      all      - typecheck + TS/Python/CLI quality + semgrep + test (default, pre-commit)
      full     - all quality checks + shipped-deps audit + Playwright E2E tests (recommended before merge; skips continuity freshness)
      continuity - check whether CONTINUE.md / CONTINUE_LOG.md need a refresh
      quick    - typecheck only (use during scaffolding before tests exist)
      test     - tests only
      e2e      - Playwright E2E tests only
      quality  - TS/Python/CLI quality + semgrep
      commit   - validate all + blocking shipped-deps audit + continuity, then git add + commit + push

    Set QUALITY_THRESHOLDS_BYPASS=1 to make configured quality thresholds
    advisory while keeping formatting, lint correctness, tests, and security
    checks blocking.
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
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor DarkGray }

$AllowedProductionAuditPackages = @(
    "@hono/node-server",
    "@prisma/dev",
    "defu",
    "drizzle-orm",
    "hono",
    "next",
    "postcss",
    "prisma",
    "vite"
)

$PackagePublishTimeCache = @{}

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

function Get-TrackedChangedFiles {
    $statusLines = @(git status --porcelain --untracked-files=no)
    $paths = @()

    foreach ($line in $statusLines) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) {
            continue
        }

        $status = $line.Substring(0, 2)
        if ($status.Contains("D")) {
            continue
        }

        $pathText = $line.Substring(3).Trim()
        if ($pathText -match ' -> ') {
            $pathText = ($pathText -split ' -> ')[-1]
        }

        if (-not [string]::IsNullOrWhiteSpace($pathText) -and (Test-Path $pathText -PathType Leaf)) {
            $paths += $pathText
        }
    }

    return $paths | Sort-Object -Unique
}

function Get-UntrackedCandidateFiles {
    $output = git ls-files --others --exclude-standard
    if (-not $output) {
        return @()
    }

    return $output.Split("`n") |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_ -PathType Leaf) } |
        Sort-Object -Unique
}

function Test-IsTextEncodingCandidate([string]$path) {
    $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    $textExtensions = @(
        ".c", ".cc", ".cfg", ".conf", ".cpp", ".cs", ".css", ".csv", ".env", ".example",
        ".gitignore", ".html", ".java", ".js", ".json", ".jsx", ".mjs", ".md", ".mts",
        ".ps1", ".py", ".rb", ".sh", ".sql", ".svg", ".toml", ".ts", ".tsx", ".txt",
        ".yaml", ".yml"
    )

    $fileName = [System.IO.Path]::GetFileName($path)
    $specialFileNames = @(
        ".dockerignore", ".editorconfig", ".eslintignore", ".eslintrc", ".gitattributes",
        ".gitignore", ".npmignore", ".prettierignore"
    )

    return $textExtensions.Contains($extension) -or $specialFileNames.Contains($fileName.ToLowerInvariant())
}

function Test-IsUtf8File([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -eq 0) {
        return $true
    }

    if ($bytes.Length -ge 2) {
        $bom2 = [System.BitConverter]::ToString($bytes, 0, 2)
        if ($bom2 -in @("FF-FE", "FE-FF")) {
            return $false
        }
    }

    if ($bytes.Length -ge 4) {
        $bom4 = [System.BitConverter]::ToString($bytes, 0, 4)
        if ($bom4 -in @("FF-FE-00-00", "00-00-FE-FF")) {
            return $false
        }
    }

    $utf8 = [System.Text.UTF8Encoding]::new($false, $true)
    try {
        [void]$utf8.GetString($bytes)
        return $true
    } catch {
        return $false
    }
}

function Test-Utf8Encoding {
    Write-Step "UTF-8 encoding (tracked changed files)"
    try {
        $files = @(
            @(Get-TrackedChangedFiles) + @(Get-UntrackedCandidateFiles)
        ) |
            Where-Object { Test-IsTextEncodingCandidate $_ } |
            Sort-Object -Unique

        if ($files.Count -eq 0) {
            Write-Pass "utf-8 encoding check passed (no text candidates)"
            return
        }

        $invalidFiles = @()
        foreach ($file in $files) {
            if (-not (Test-IsUtf8File $file)) {
                $invalidFiles += $file
            }
        }

        if ($invalidFiles.Count -gt 0) {
            $invalidFiles | ForEach-Object { Write-Host $_ }
            throw "utf-8 encoding check failed"
        }

        Write-Pass "utf-8 encoding check passed ($($files.Count) text files)"
    } catch {
        Write-Fail "utf-8 encoding check failed"
        $script:failures += "utf8"
    }
}

function Test-DependencyCooldownSupport {
    Write-Step "Dependency cooldown support (npm + uv)"
    try {
        if (-not (Test-Path ".npmrc" -PathType Leaf)) {
            throw ".npmrc is missing"
        }

        $npmrcContent = Get-Content ".npmrc" -Raw
        if ($npmrcContent -notmatch '(?m)^\s*min-release-age\s*=\s*7\s*$') {
            throw "project npm cooldown is not configured"
        }

        $npmHelp = Invoke-NativeCommandCaptured "npm install --help"
        if ($npmHelp.ExitCode -ne 0 -or -not (($npmHelp.Output -join "`n") -match '--min-release-age')) {
            throw "installed npm does not support --min-release-age"
        }

        if (-not (Test-Path "worker\pyproject.toml" -PathType Leaf)) {
            throw "worker/pyproject.toml is missing"
        }

        $workerPyproject = Get-Content "worker\pyproject.toml" -Raw
        if ($workerPyproject -notmatch '(?s)\[tool\.uv\].*?exclude-newer\s*=\s*"1 week"') {
            throw "project uv cooldown is not configured"
        }

        $uvVersion = Invoke-NativeCommandCaptured "uv --version"
        if ($uvVersion.ExitCode -ne 0) {
            throw "uv is not available"
        }

        $uvHelp = Invoke-NativeCommandCaptured "uv lock --help"
        if ($uvHelp.ExitCode -ne 0 -or -not (($uvHelp.Output -join "`n") -match '--exclude-newer')) {
            throw "installed uv does not support --exclude-newer"
        }

        Write-Pass "dependency cooldown support is available (npm min-release-age=7, uv exclude-newer=1 week)"
    } catch {
        Write-Fail "dependency cooldown support is not available"
        $message = $_.Exception.Message
        switch -Regex ($message) {
            '^\.npmrc is missing$' {
                Write-Host "Create .npmrc with `min-release-age=7` so npm installs respect the repo cooldown policy." -ForegroundColor Yellow
            }
            '^project npm cooldown is not configured$' {
                Write-Host "Set `min-release-age=7` in .npmrc to enforce the npm package release delay." -ForegroundColor Yellow
            }
            '^installed npm does not support --min-release-age$' {
                Write-Host "Upgrade npm to 11.10.0 or newer. This repo requires npm support for `--min-release-age` so fresh packages cannot bypass the 7-day delay." -ForegroundColor Yellow
            }
            '^worker/pyproject\.toml is missing$' {
                Write-Host "Restore worker/pyproject.toml so the repo-local uv cooldown policy can be validated." -ForegroundColor Yellow
            }
            '^project uv cooldown is not configured$' {
                Write-Host "Set `[tool.uv] exclude-newer = \"1 week\"` in worker/pyproject.toml to enforce the uv package release delay." -ForegroundColor Yellow
            }
            '^uv is not available$' {
                Write-Host "Install uv 0.11.0 or newer. This repo validates uv support for the local package cooldown policy." -ForegroundColor Yellow
            }
            '^installed uv does not support --exclude-newer$' {
                Write-Host "Upgrade uv to a version that supports `--exclude-newer`. This repo requires that feature for the worker dependency cooldown policy." -ForegroundColor Yellow
            }
            default {
                Write-Host $message -ForegroundColor Yellow
            }
        }
        $script:failures += "dependency-cooldown"
    }
}

function Test-TemplateProvenance {
    Write-Step "Template provenance"
    try {
        if (-not (Test-Path ".template-origin.json" -PathType Leaf)) {
            throw ".template-origin.json is missing"
        }

        if (-not (Test-Path "TEMPLATE_VERSION.md" -PathType Leaf)) {
            throw "TEMPLATE_VERSION.md is missing"
        }

        $origin = Get-Content ".template-origin.json" -Raw | ConvertFrom-Json
        $versionFile = Get-Content "TEMPLATE_VERSION.md" -Raw

        if (-not $origin.templateRepoUrl) {
            throw "templateRepoUrl is missing"
        }

        if (-not $origin.templateDefaultBranch) {
            throw "templateDefaultBranch is missing"
        }

        if (-not $origin.recordedUpstreamTemplateCommit) {
            throw "recordedUpstreamTemplateCommit is missing"
        }

        if (-not $origin.recordedUpstreamTemplateShortCommit) {
            throw "recordedUpstreamTemplateShortCommit is missing"
        }

        if ($origin.recordedUpstreamTemplateCommit -notmatch '^[0-9a-f]{40}$') {
            throw "recordedUpstreamTemplateCommit is not a full git SHA"
        }

        if ($origin.recordedUpstreamTemplateShortCommit -notmatch '^[0-9a-f]{7,12}$') {
            throw "recordedUpstreamTemplateShortCommit is not a short git SHA"
        }

        $expectedLines = @(
            "- Template repo: ``$($origin.templateRepoUrl)``",
            "- Default branch: ``$($origin.templateDefaultBranch)``",
            "- Recorded upstream template commit: ``$($origin.recordedUpstreamTemplateCommit)``",
            "- Short commit: ``$($origin.recordedUpstreamTemplateShortCommit)``",
            "- Recorded at: ``$($origin.templateRecordedAt)``",
            "- Version label: ``$($origin.templateVersionLabel)``"
        )

        foreach ($line in $expectedLines) {
            if ($versionFile -notmatch [regex]::Escape($line)) {
                throw "TEMPLATE_VERSION.md does not match .template-origin.json"
            }
        }

        $commitCheck = Invoke-NativeCommandCaptured "git rev-parse --verify $($origin.recordedUpstreamTemplateCommit)"
        if ($commitCheck.ExitCode -ne 0) {
            Write-Warn "recorded template commit is not present in local git history; keeping provenance as shipped baseline"
        }

        Write-Pass "template provenance files are present and internally consistent"
    } catch {
        Write-Fail "template provenance check failed"
        $message = $_.Exception.Message
        switch -Regex ($message) {
            '^\.template-origin\.json is missing$' {
                Write-Host "Restore .template-origin.json so downstream apps can track the upstream template baseline." -ForegroundColor Yellow
            }
            '^TEMPLATE_VERSION\.md is missing$' {
                Write-Host "Restore TEMPLATE_VERSION.md so the upstream template baseline stays visible to humans." -ForegroundColor Yellow
            }
            '^recordedUpstreamTemplateCommit is not a full git SHA$' {
                Write-Host "Set recordedUpstreamTemplateCommit in .template-origin.json to a 40-character git SHA." -ForegroundColor Yellow
            }
            '^recordedUpstreamTemplateShortCommit is not a short git SHA$' {
                Write-Host "Set recordedUpstreamTemplateShortCommit in .template-origin.json to the matching short git SHA." -ForegroundColor Yellow
            }
            '^TEMPLATE_VERSION\.md does not match \.template-origin\.json$' {
                Write-Host "Run `npm run template:stamp` or manually sync TEMPLATE_VERSION.md with .template-origin.json." -ForegroundColor Yellow
            }
            default {
                Write-Host $message -ForegroundColor Yellow
            }
        }
        $script:failures += "template-provenance"
    }
}

function Test-SpecOverview {
    Write-Step "Specs overview"
    try {
        if (-not (Test-Path "scripts\update-spec-overview.mjs" -PathType Leaf)) {
            throw "scripts/update-spec-overview.mjs is missing"
        }

        if (-not (Test-Path "specs\OVERVIEW.md" -PathType Leaf)) {
            throw "specs/OVERVIEW.md is missing"
        }

        if ($IsWindows -or $env:OS -eq "Windows_NT") {
            cmd /c "node scripts/update-spec-overview.mjs --check"
        } else {
            /bin/sh -lc "node scripts/update-spec-overview.mjs --check"
        }

        if ($LASTEXITCODE -ne 0) {
            throw "specs/OVERVIEW.md is out of date"
        }

        Write-Pass "specs overview is current"
    } catch {
        Write-Fail "specs overview check failed"
        $message = $_.Exception.Message
        switch -Regex ($message) {
            '^scripts/update-spec-overview\.mjs is missing$' {
                Write-Host "Restore scripts/update-spec-overview.mjs so the repo can regenerate specs/OVERVIEW.md." -ForegroundColor Yellow
            }
            '^specs/OVERVIEW\.md is missing$' {
                Write-Host "Run `npm run specs:overview:update` to create specs/OVERVIEW.md." -ForegroundColor Yellow
            }
            '^specs/OVERVIEW\.md is out of date$' {
                Write-Host "Run `npm run specs:overview:update` after spec changes so the repo-wide overview stays current." -ForegroundColor Yellow
            }
            default {
                Write-Host $message -ForegroundColor Yellow
            }
        }
        $script:failures += "spec-overview"
    }
}

function Test-SpecWorkflowStages {
    Write-Step "Spec workflow stages"
    try {
        if (-not (Test-Path "specs" -PathType Container)) {
            Write-Pass "spec workflow stages are valid (no specs directory)"
            return
        }

        $invalidFeatures = @()
        $featureDirs = Get-ChildItem "specs" -Directory | Where-Object { $_.Name -match '^\d{3}-' }

        foreach ($featureDir in $featureDirs) {
            $clarify = Join-Path $featureDir.FullName "clarify.md"
            $research = Join-Path $featureDir.FullName "research.md"
            $plan = Join-Path $featureDir.FullName "plan.md"
            $dataModel = Join-Path $featureDir.FullName "data-model.md"
            $tasks = Join-Path $featureDir.FullName "tasks.md"
            $quickstart = Join-Path $featureDir.FullName "quickstart.md"
            $contracts = Join-Path $featureDir.FullName "contracts"

            $hasClarify = Test-Path $clarify -PathType Leaf
            $hasResearch = Test-Path $research -PathType Leaf
            $hasPlanningArtifacts = (Test-Path $plan -PathType Leaf) -or
                (Test-Path $dataModel -PathType Leaf) -or
                (Test-Path $tasks -PathType Leaf) -or
                (Test-Path $quickstart -PathType Leaf) -or
                (Test-Path $contracts -PathType Container)

            if ((Test-Path $research -PathType Leaf) -and -not $hasClarify) {
                $invalidFeatures += "$($featureDir.Name): missing clarify.md before analyze/research"
            }

            if ($hasPlanningArtifacts -and -not $hasClarify) {
                $invalidFeatures += "$($featureDir.Name): missing clarify.md before planning/tasking"
            }

            if ($hasPlanningArtifacts -and -not $hasResearch) {
                $invalidFeatures += "$($featureDir.Name): missing research.md before planning/tasking"
            }
        }

        if ($invalidFeatures.Count -gt 0) {
            $invalidFeatures | ForEach-Object { Write-Host $_ }
            throw "spec workflow stages failed"
        }

        Write-Pass "spec workflow stages are valid"
    } catch {
        Write-Fail "spec workflow stage check failed"
        Write-Host "Every numbered spec must pass through clarify and analyze before planning/tasking. Add `clarify.md` and `research.md` before plan/data-model/tasks artifacts." -ForegroundColor Yellow
        $script:failures += "spec-workflow"
    }
}

function Test-ContinuityFreshness {
    Write-Step "Continuity (CONTINUE.md / CONTINUE_LOG.md)"
    try {
        $stagedContinuityFiles = @(git diff --cached --name-only -- CONTINUE.md CONTINUE_LOG.md) |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

        if ($stagedContinuityFiles.Count -gt 0) {
            $exitCode = Invoke-NativeCommand "npm run continuity:update"
            if ($exitCode -ne 0) {
                throw "continuity update failed"
            }

            $unstagedContinuityChanges = @(git diff --name-only -- CONTINUE.md CONTINUE_LOG.md) |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

            if ($unstagedContinuityChanges.Count -gt 0) {
                Write-Host (git status --short -- CONTINUE.md CONTINUE_LOG.md)
                throw "continuity files changed"
            }
        } else {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                cmd /c "node scripts/update-continuity.mjs --check"
            } else {
                /bin/sh -lc "node scripts/update-continuity.mjs --check"
            }

            if ($LASTEXITCODE -ne 0) {
                Write-Host (git status --short -- CONTINUE.md CONTINUE_LOG.md)
                throw "continuity files changed"
            }
        }

        Write-Pass "continuity files are current"
    } catch {
        Write-Fail "continuity files are out of date"
        Write-Host 'Run `npm run continuity:update`, review CONTINUE.md and CONTINUE_LOG.md, commit the updates, then try again.' -ForegroundColor Yellow
        $script:failures += "continuity"
    }
}

function Test-ProductionDependencyAudit([switch]$Blocking) {
    Write-Step "Production dependency audit (npm audit --omit=dev --omit=optional)"
    try {
        $result = Invoke-NativeCommandCaptured "npm audit --omit=dev --omit=optional --json"
        $rawOutput = ($result.Output -join "`n").Trim()

        if ($result.ExitCode -eq 0) {
            $audit = $null
            if ($rawOutput) {
                try {
                    $audit = $rawOutput | ConvertFrom-Json
                } catch {
                    $audit = $null
                }
            }

            if ($audit -and $audit.metadata -and $audit.metadata.vulnerabilities) {
                $vulns = $audit.metadata.vulnerabilities
                Write-Pass "production dependency audit passed ($($vulns.total) vulnerabilities)"
            } else {
                Write-Pass "production dependency audit passed"
            }

            return
        }

        $audit = $null
        if ($rawOutput) {
            try {
                $audit = $rawOutput | ConvertFrom-Json
            } catch {
                $audit = $null
            }
        }

        if ($audit -and $audit.metadata -and $audit.metadata.vulnerabilities) {
            $vulns = $audit.metadata.vulnerabilities
            $affectedPackages = @($audit.vulnerabilities.PSObject.Properties.Name | Sort-Object)
            $unexpectedPackages = @(
                $affectedPackages |
                    Where-Object { $AllowedProductionAuditPackages -notcontains $_ }
            )
            $packageStatuses = @(Get-AuditPackageStatuses $audit)
            $summary = "$($vulns.total) vulnerabilities ($($vulns.high) high, $($vulns.moderate) moderate, $($vulns.low) low, $($vulns.critical) critical)"

            $shouldFail = $Blocking -or $unexpectedPackages.Count -gt 0

            if ($shouldFail) {
                Write-Fail "production dependency audit failed"
            } else {
                Write-Warn "production dependency audit reported only allowlisted vulnerabilities"
            }

            Write-Host $summary -ForegroundColor Yellow
            if ($affectedPackages.Count -gt 0) {
                Write-Host ("Affected packages: " + ($affectedPackages -join ", ")) -ForegroundColor Yellow
            }
            if ($unexpectedPackages.Count -gt 0) {
                Write-Host ("Unexpected packages: " + ($unexpectedPackages -join ", ")) -ForegroundColor Yellow
            } else {
                Write-Host ("Allowlisted packages: " + ($AllowedProductionAuditPackages -join ", ")) -ForegroundColor Yellow
                Write-Host "This repo enforces npm min-release-age=7. If the fixed package versions are newer than that cooldown window, the allowlisted audit can stay red temporarily." -ForegroundColor Yellow
            }
            if ($packageStatuses.Count -gt 0) {
                Write-Host "Per-package fix status:" -ForegroundColor Yellow
                foreach ($packageStatus in $packageStatuses) {
                    $detail = $packageStatus.Status
                    if ($packageStatus.FixPackage -and $packageStatus.FixVersion) {
                        $detail += " -> $($packageStatus.FixPackage)@$($packageStatus.FixVersion)"
                    }
                    if ($packageStatus.PublishedAt) {
                        $detail += " (published $($packageStatus.PublishedAt.UtcDateTime.ToString('yyyy-MM-dd HH:mm')) UTC)"
                    }
                    if ($packageStatus.IsSemVerMajor) {
                        $detail += " [semver-major]"
                    }
                    Write-Host ("  - {0}: {1}" -f $packageStatus.PackageName, $detail) -ForegroundColor Yellow
                }
            }
        } else {
            if ($rawOutput) {
                $rawOutput | Out-Host
            }

            if ($Blocking) {
                Write-Fail "production dependency audit failed"
            } else {
                Write-Fail "production dependency audit failed"
            }
            Write-Host "npm audit returned a non-zero status but did not produce machine-readable details." -ForegroundColor Yellow
            $script:failures += "prod-audit"
            return
        }

        if ($Blocking -or ($unexpectedPackages -and $unexpectedPackages.Count -gt 0)) {
            $script:failures += "prod-audit"
        }
    } catch {
        Write-Fail "production dependency audit failed"
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        if ($Blocking) {
            $script:failures += "prod-audit"
        } else {
            Write-Host "Continuing because production audit is advisory in the `full` phase." -ForegroundColor Yellow
        }
    }
}

function Get-DuplicationThreshold {
    if (-not (Test-Path ".jscpd.json" -PathType Leaf)) {
        return $null
    }

    $config = Get-Content ".jscpd.json" -Raw | ConvertFrom-Json
    if ($null -eq $config.threshold) {
        return $null
    }

    return ([double]$config.threshold).ToString("0.##")
}

function Get-NpmMinReleaseAgeDays {
    if (-not (Test-Path ".npmrc" -PathType Leaf)) {
        return $null
    }

    $npmrcContent = Get-Content ".npmrc" -Raw
    $match = [regex]::Match($npmrcContent, '(?m)^\s*min-release-age\s*=\s*(\d+)\s*$')
    if (-not $match.Success) {
        return $null
    }

    return [int]$match.Groups[1].Value
}

function Get-PackagePublishTimestamp([string]$packageName, [string]$version) {
    if ([string]::IsNullOrWhiteSpace($packageName) -or [string]::IsNullOrWhiteSpace($version)) {
        return $null
    }

    $cacheKey = "$packageName@$version"
    if ($PackagePublishTimeCache.ContainsKey($cacheKey)) {
        return $PackagePublishTimeCache[$cacheKey]
    }

    $escapedPackageName = $packageName.Replace('"', '\"')
    $result = Invoke-NativeCommandCaptured "npm view ""$escapedPackageName"" time --json"
    if ($result.ExitCode -ne 0) {
        $PackagePublishTimeCache[$cacheKey] = $null
        return $null
    }

    $rawOutput = ($result.Output -join "`n").Trim()
    if (-not $rawOutput) {
        $PackagePublishTimeCache[$cacheKey] = $null
        return $null
    }

    try {
        $publishTime = $null
        $escapedVersion = [regex]::Escape($version)
        $regexMatch = [regex]::Match($rawOutput, '"' + $escapedVersion + '"\s*:\s*"([^"]+)"')
        if ($regexMatch.Success) {
            $publishTime = $regexMatch.Groups[1].Value
        }

        if (-not $publishTime) {
            $timeData = $rawOutput | ConvertFrom-Json
            $publishTimeProperty = $timeData.PSObject.Properties.Match($version) | Select-Object -First 1
            $publishTime = if ($publishTimeProperty) { $publishTimeProperty.Value } else { $null }
        }

        if (-not $publishTime) {
            $PackagePublishTimeCache[$cacheKey] = $null
            return $null
        }

        $parsedTimestamp = [DateTimeOffset]::Parse($publishTime)
        $PackagePublishTimeCache[$cacheKey] = $parsedTimestamp
        return $parsedTimestamp
    } catch {
        $PackagePublishTimeCache[$cacheKey] = $null
        return $null
    }
}

function Get-AuditPackageStatuses($audit) {
    $minReleaseAgeDays = Get-NpmMinReleaseAgeDays
    $cutoff = if ($null -ne $minReleaseAgeDays) {
        [DateTimeOffset]::UtcNow.AddDays(-$minReleaseAgeDays)
    } else {
        $null
    }

    $statuses = @()

    foreach ($property in $audit.vulnerabilities.PSObject.Properties) {
        $packageName = $property.Name
        $vulnerability = $property.Value
        $fixAvailable = $vulnerability.fixAvailable

        if ($null -eq $fixAvailable -or $fixAvailable -eq $false) {
            $statuses += [pscustomobject]@{
                PackageName = $packageName
                Status = "No fix available at all"
                FixPackage = $null
                FixVersion = $null
                PublishedAt = $null
                IsSemVerMajor = $false
            }
            continue
        }

        if ($fixAvailable -is [bool]) {
            $statuses += [pscustomobject]@{
                PackageName = $packageName
                Status = "Fix available (version not specified by npm audit)"
                FixPackage = $null
                FixVersion = $null
                PublishedAt = $null
                IsSemVerMajor = $false
            }
            continue
        }

        $fixPackageName = $fixAvailable.name
        $fixVersion = $fixAvailable.version
        $publishTimestamp = Get-PackagePublishTimestamp $fixPackageName $fixVersion
        $isSemVerMajor = [bool]$fixAvailable.isSemVerMajor

        $statusText = if ([string]::IsNullOrWhiteSpace($fixPackageName) -or [string]::IsNullOrWhiteSpace($fixVersion)) {
            "Fix available (version not specified by npm audit)"
        } elseif ($null -eq $publishTimestamp -or $null -eq $cutoff) {
            "Fix available (publish date unavailable)"
        } elseif ($publishTimestamp -gt $cutoff) {
            "Fix available (with release date skip)"
        } else {
            "Fix available (with normal min release date)"
        }

        $statuses += [pscustomobject]@{
            PackageName = $packageName
            Status = $statusText
            FixPackage = $fixPackageName
            FixVersion = $fixVersion
            PublishedAt = $publishTimestamp
            IsSemVerMajor = $isSemVerMajor
        }
    }

    return @($statuses | Sort-Object PackageName)
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

if ($Phase -in "all", "full", "quick", "commit") {
    Write-Step "Typecheck - Python (mypy)"
    try {
        Push-Location "worker"
        try {
            $mypyVersion = Invoke-NativeCommandCaptured "uv run mypy --version"
            if ($mypyVersion.ExitCode -ne 0) {
                Write-Warn "mypy not available (run: uv sync --all-groups in worker)"
            } else {
                $exitCode = Invoke-NativeCommand "uv run mypy --strict ."
                if ($exitCode -ne 0) { throw "mypy failed" }
                Write-Pass "Python mypy passed"
            }
        } finally { Pop-Location }
    } catch {
        Write-Fail "Python mypy failed"
        $failures += "mypy"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Lint (eslint)"
    try {
        $result = Invoke-NativeCommandCaptured "npm run lint"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "lint failed"
        }

        $cleanOutput = @($result.Output | ForEach-Object { Remove-Ansi ([string]$_) })
        $summaryLine = $cleanOutput |
            Select-String -Pattern '(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)' |
            Select-Object -Last 1

        if ($summaryLine -and $summaryLine.Matches.Count -gt 0) {
            $errorsCount = $summaryLine.Matches[0].Groups[2].Value
            $warningsCount = $summaryLine.Matches[0].Groups[3].Value
            $parts = @("$errorsCount errors", "$warningsCount warnings")

            $complexityMatches = @(
                $cleanOutput |
                    Select-String -Pattern 'has a complexity of (\d+)'
            )
            if ($complexityMatches.Count -gt 0) {
                $complexityScores = @(
                    $complexityMatches | ForEach-Object { [int]$_.Matches[0].Groups[1].Value }
                )
                $maxComplexity = ($complexityScores | Measure-Object -Maximum).Maximum
                $parts += "max complexity $maxComplexity"
            }

            $cognitiveMatches = @(
                $cleanOutput |
                    Select-String -Pattern 'Cognitive Complexity from (\d+)'
            )
            if ($cognitiveMatches.Count -gt 0) {
                $cognitiveScores = @(
                    $cognitiveMatches | ForEach-Object { [int]$_.Matches[0].Groups[1].Value }
                )
                $maxCognitive = ($cognitiveScores | Measure-Object -Maximum).Maximum
                $parts += "max cognitive $maxCognitive"
            }

            Write-Pass "lint passed ($($parts -join ', '))"
        } else {
            Write-Pass "lint passed (0 warnings)"
        }
    } catch {
        Write-Fail "lint failed"
        $failures += "lint"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Format check (prettier)"
    & {
        if (-not (Test-Path "node_modules/.bin/prettier")) {
            Write-Warn "prettier not installed (add to devDependencies)"
            return
        }
        $result = Invoke-NativeCommandCaptured "npx --no-install prettier --check ."
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            Write-Fail "Prettier format check failed"
            $script:failures += "prettier"
            return
        }
        Write-Pass "Prettier format check passed"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Architecture (dependency-cruiser)"
    try {
        $result = Invoke-NativeCommandCaptured "npm run architecture"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "architecture check failed"
        }

        $cleanOutput = @($result.Output | ForEach-Object { Remove-Ansi ([string]$_) })
        $summaryLine = $cleanOutput |
            Select-String -Pattern 'dependency violations \((\d+) errors?, (\d+) warnings?\)' |
            Select-Object -Last 1

        if ($summaryLine -and $summaryLine.Matches.Count -gt 0) {
            $errorsCount = $summaryLine.Matches[0].Groups[1].Value
            $warningsCount = $summaryLine.Matches[0].Groups[2].Value
            Write-Pass "architecture check passed ($errorsCount errors, $warningsCount warnings)"
        } else {
            Write-Pass "architecture check passed"
        }
    } catch {
        Write-Fail "architecture check failed"
        $failures += "architecture"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Duplication (jscpd)"
    try {
        $threshold = Get-DuplicationThreshold
        if ($threshold) {
            Write-Info "configured duplication threshold: $threshold%"
        }

        $result = Invoke-NativeCommandCaptured "npm run duplication"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "duplication check failed"
        }

        $summaryLine = $result.Output |
            Select-String -Pattern 'Total:\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\|\s+\d+\s+\(([\d.]+)%\)' |
            Select-Object -Last 1

        if ($summaryLine -and $summaryLine.Matches.Count -gt 0 -and $threshold) {
            $duplicationPercent = $summaryLine.Matches[0].Groups[1].Value
            Write-Pass "duplication check passed ($duplicationPercent% <= $threshold%)"
        } elseif ($summaryLine -and $summaryLine.Matches.Count -gt 0) {
            $duplicationPercent = $summaryLine.Matches[0].Groups[1].Value
            Write-Pass "duplication check passed ($duplicationPercent%)"
        } elseif ($threshold) {
            Write-Pass "duplication check passed (threshold $threshold%)"
        } else {
            Write-Pass "duplication check passed"
        }
    } catch {
        Write-Fail "duplication check failed"
        $failures += "duplication"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "Python quality (ruff, xenon, radon, complexipy)"
    try {
        $result = Invoke-NativeCommandCaptured "npm run quality:python"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "python quality failed"
        }

        $cleanOutput = @($result.Output | ForEach-Object { Remove-Ansi ([string]$_) })
        $averageLine = $cleanOutput |
            Select-String -Pattern 'Average complexity:\s+([A-F])\s+\(([\d.]+)\)' |
            Select-Object -Last 1
        $cognitiveLine = $cleanOutput |
            Select-String -Pattern '\.py\s+\S+\s+(\d+)$' |
            Select-Object -First 1
        $miLines = @(
            $cleanOutput |
                Select-String -Pattern '\.py\s+-\s+([A-F])\s+\(([\d.]+)\)'
        )

        $parts = @()
        if ($averageLine -and $averageLine.Matches.Count -gt 0) {
            $parts += "radon avg $($averageLine.Matches[0].Groups[1].Value) ($($averageLine.Matches[0].Groups[2].Value))"
        }
        if ($cognitiveLine -and $cognitiveLine.Matches.Count -gt 0) {
            $parts += "max cognitive $($cognitiveLine.Matches[0].Groups[1].Value)"
        }
        if ($miLines.Count -gt 0) {
            $miScores = @(
                $miLines | ForEach-Object { [double]$_.Matches[0].Groups[2].Value }
            )
            $minMi = ($miScores | Measure-Object -Minimum).Minimum
            $parts += "min MI $minMi"
        }

        if ($parts.Count -gt 0) {
            Write-Pass "python quality passed ($($parts -join ', '))"
        } else {
            Write-Pass "python quality passed"
        }
    } catch {
        Write-Fail "python quality failed"
        $failures += "python-quality"
    }
}

if ($Phase -in "all", "full", "quality", "commit") {
    Write-Step "CLI quality (gofmt, go vet, staticcheck, gocyclo, go test, go build)"
    try {
        $result = Invoke-NativeCommandCaptured "npm run quality:cli"
        if ($result.ExitCode -ne 0) {
            $result.Output | Out-Host
            throw "cli quality failed"
        }

        Write-Pass "cli quality passed"
    } catch {
        Write-Fail "cli quality failed"
        $failures += "cli-quality"
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

if ($Phase -in "all", "full", "quality", "commit") {
    Test-Utf8Encoding
}

if ($Phase -in "all", "full", "quality", "commit") {
    Test-DependencyCooldownSupport
}

if ($Phase -in "all", "full", "quality", "commit") {
    Test-TemplateProvenance
}

if ($Phase -in "all", "full", "quality", "commit") {
    Test-SpecOverview
}

if ($Phase -in "all", "full", "quality", "commit") {
    Test-SpecWorkflowStages
}

if ($Phase -in "all", "full", "test", "commit") {
    Write-Step "Tests - Python (pytest)"
    try {
        Push-Location "worker"
        try {
            $pytestVersion = Invoke-NativeCommandCaptured "uv run pytest --version"
            if ($pytestVersion.ExitCode -ne 0) {
                Write-Warn "pytest not available (run: uv sync --all-groups in worker)"
            } else {
                $result = Invoke-NativeCommandCaptured "uv run pytest -x --tb=short -q"
                if ($result.ExitCode -ne 0) {
                    $result.Output | Out-Host
                    throw "pytest failed"
                }

                $summaryLine = $result.Output |
                    Select-String -Pattern '(\d+)\s+passed' |
                    Select-Object -Last 1

                if ($summaryLine -and $summaryLine.Matches.Count -gt 0) {
                    Write-Pass "Python tests passed ($($summaryLine.Matches[0].Groups[1].Value) passed)"
                } else {
                    Write-Pass "Python tests passed"
                }
            }
        } finally { Pop-Location }
    } catch {
        Write-Fail "Python tests failed"
        $failures += "pytest"
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

if ($Phase -in "continuity", "commit") {
    Test-ContinuityFreshness
}

if ($Phase -in "full", "commit") {
    Test-ProductionDependencyAudit -Blocking:($Phase -eq "commit")
}

if ($Phase -in "full", "commit") {
    Write-Step "Production dependency audit (uv audit)"
    try {
        if (-not (Test-Path "worker\pyproject.toml" -PathType Leaf)) {
            Write-Warn "uv audit skipped (worker/pyproject.toml not found)"
        } else {
            Push-Location "worker"
            try {
                $result = Invoke-NativeCommandCaptured "uv audit --no-dev"
                if ($result.ExitCode -ne 0) {
                    $rawOutput = ($result.Output -join "`n").Trim()
                    Write-Fail "uv production audit found vulnerabilities"
                    if ($rawOutput) { Write-Host $rawOutput -ForegroundColor Yellow }
                    $script:failures += "uv-audit"
                } else {
                    Write-Pass "uv production audit passed"
                }
            } finally { Pop-Location }
        }
    } catch {
        Write-Fail "uv production audit failed"
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        $script:failures += "uv-audit"
    }
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
    Write-Step "Continuity refresh"
    $continuityExitCode = Invoke-NativeCommand "npm run continuity:update"
    if ($continuityExitCode -ne 0) {
        Write-Fail "continuity refresh failed"
        exit 1
    }

    git add CONTINUE.md CONTINUE_LOG.md
    Write-Pass "continuity files refreshed and staged"

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
