#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Runs Trivy supply-chain audits for deployable template artifacts.

.DESCRIPTION
    Builds and scans the app, migration, and worker runtime images with Trivy,
    scans Azure OpenTofu and Docker/Compose configuration with Trivy config,
    and blocks on High/Critical findings or inconclusive scan results.

    The Trivy scanner itself runs from a repo-pinned digest image and must be
    older than the 7-day cooldown window unless an emergency override is used.
#>

param(
    [ValidateSet("all", "app", "migrate", "worker", "infra")]
    [string]$Artifact = "all",

    [string]$AppImage = "business-app-starter:latest",
    [string]$MigrateImage = "business-app-starter-migrate:latest",
    [string]$WorkerImage = "business-app-starter-worker:latest",
    [string]$TrivyImage = "",
    [string]$TrivyImageReleasedAt = "",
    [string]$ReportPath = ".artifacts/supply-chain-audit/report.json",

    [switch]$SkipBuild,
    [switch]$SkipImageScans,
    [switch]$SkipConfigScans,
    [switch]$AllowTrivyCooldownOverride
)

$ErrorActionPreference = "Stop"
$BlockingSeverities = @("HIGH", "CRITICAL")
$Now = [DateTimeOffset]::UtcNow
$TrivyCooldown = [TimeSpan]::FromDays(7)
$DefaultTrivyImage = "aquasec/trivy:0.71.0@sha256:016eae51fdcf989332a5404af7e8f625cd5d95d7c0907a221d080a996f556500"
$DefaultTrivyImageReleasedAt = [DateTimeOffset]::Parse("2026-06-01T00:00:00Z", [System.Globalization.CultureInfo]::InvariantCulture)
$ReportResults = @()
$ResolvedTrivyImage = $null

function Write-Step([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-ResultLine([object]$Result) {
    $color = switch ($Result.status) {
        "pass" { "Green" }
        "fail" { "Red" }
        default { "Yellow" }
    }
    Write-Host ("  [{0}] {1}/{2} findings={3} blocking={4}" -f `
            $Result.status.ToUpperInvariant(), $Result.artifact, $Result.source, `
            @($Result.findings).Count, @($Result.blocking_findings).Count) -ForegroundColor $color
}

function Invoke-CapturedCommand([string]$CommandLine, [string]$WorkingDirectory = $null) {
    $previousLocation = Get-Location
    if ($WorkingDirectory) {
        Set-Location $WorkingDirectory
    }

    try {
        $previousErrorActionPreference = $ErrorActionPreference
        $script:ErrorActionPreference = "Continue"
        try {
            if ($IsWindows -or $env:OS -eq "Windows_NT") {
                $output = cmd /c $CommandLine 2>&1
            } else {
                $output = /bin/sh -lc $CommandLine 2>&1
            }
        } finally {
            $script:ErrorActionPreference = $previousErrorActionPreference
        }

        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = @($output)
            Text = (@($output) -join "`n").Trim()
        }
    } finally {
        if ($WorkingDirectory) {
            Set-Location $previousLocation
        }
    }
}

function ConvertFrom-TrivyJsonOutput([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    $trimmed = $Text.Trim()
    try {
        return $trimmed | ConvertFrom-Json
    } catch {
        $start = $trimmed.IndexOf("{")
        $end = $trimmed.LastIndexOf("}")
        if ($start -lt 0 -or $end -le $start) {
            return $null
        }

        $jsonSlice = $trimmed.Substring($start, $end - $start + 1)
        try {
            return $jsonSlice | ConvertFrom-Json
        } catch {
            return $null
        }
    }
}

function Get-RepoRoot {
    $root = (& git rev-parse --show-toplevel).Trim()
    if (-not $root) {
        throw "Could not resolve git repository root."
    }
    return $root
}

function Resolve-RepoPath([string]$Path) {
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return Join-Path $script:RepoRoot $Path
}

function ConvertTo-RepoRelativePath([string]$Path) {
    $resolved = Resolve-RepoPath $Path
    return [System.IO.Path]::GetRelativePath($script:RepoRoot, $resolved).Replace("\", "/")
}

function ConvertTo-JsonDepth([object]$Value) {
    return $Value | ConvertTo-Json -Depth 16
}

function Resolve-TrivyImage {
    if ($script:ResolvedTrivyImage) {
        return $script:ResolvedTrivyImage
    }

    $imageReference = $TrivyImage
    if (-not $imageReference) {
        $imageReference = $env:WEBAPP_TEMPLATE_TRIVY_IMAGE
    }
    if (-not $imageReference) {
        $imageReference = $DefaultTrivyImage
    }

    if ($imageReference -notmatch "@sha256:[a-fA-F0-9]{64}$") {
        throw "Trivy scanner image must be pinned by digest. Use -TrivyImage or WEBAPP_TEMPLATE_TRIVY_IMAGE with a reference like aquasec/trivy:0.71.0@sha256:..."
    }

    $releasedAt = $DefaultTrivyImageReleasedAt
    if ($imageReference -ne $DefaultTrivyImage) {
        $releasedAtText = $TrivyImageReleasedAt
        if (-not $releasedAtText) {
            $releasedAtText = $env:WEBAPP_TEMPLATE_TRIVY_IMAGE_RELEASED_AT
        }
        if (-not $releasedAtText) {
            throw "Custom Trivy scanner images require -TrivyImageReleasedAt or WEBAPP_TEMPLATE_TRIVY_IMAGE_RELEASED_AT so the 7-day cooldown can be enforced."
        }
        try {
            $releasedAt = [DateTimeOffset]::Parse($releasedAtText, [System.Globalization.CultureInfo]::InvariantCulture)
        } catch {
            throw "Trivy scanner image release timestamp must be an ISO-8601 date/time, for example 2026-06-01T00:00:00Z."
        }
    }

    $overrideCooldown = $AllowTrivyCooldownOverride -or $env:WEBAPP_TEMPLATE_ALLOW_TRIVY_COOLDOWN_OVERRIDE -eq "1"
    if (($Now - $releasedAt) -lt $TrivyCooldown -and -not $overrideCooldown) {
        throw "Trivy scanner image is inside the 7-day cooldown window. Use an older pinned digest, or set -AllowTrivyCooldownOverride only for an approved emergency."
    }

    $script:ResolvedTrivyImage = $imageReference
    return $script:ResolvedTrivyImage
}

function New-Finding(
    [string]$Id,
    [string]$ArtifactName,
    [string]$SourceName,
    [string]$PackageName,
    [string]$InstalledVersion,
    [string]$Severity,
    [string]$FixedVersion
) {
    $normalizedSeverity = if ([string]::IsNullOrWhiteSpace($Severity)) { "UNKNOWN" } else { $Severity.ToUpperInvariant() }
    return [pscustomobject]@{
        id = if ([string]::IsNullOrWhiteSpace($Id)) { "UNKNOWN" } else { $Id }
        artifact = $ArtifactName
        source = $SourceName
        package_name = if ([string]::IsNullOrWhiteSpace($PackageName)) { "unknown" } else { $PackageName }
        installed_version = if ([string]::IsNullOrWhiteSpace($InstalledVersion)) { "unknown" } else { $InstalledVersion }
        severity = $normalizedSeverity
        fixed_version = if ([string]::IsNullOrWhiteSpace($FixedVersion)) { $null } else { $FixedVersion }
        blocking = $BlockingSeverities -contains $normalizedSeverity
    }
}

function Add-AuditResult(
    [string]$ArtifactName,
    [string]$SourceName,
    [string]$Command,
    [string]$Scanner,
    [string]$Status,
    [object[]]$Findings,
    [object]$Metadata = $null
) {
    $blocking = @($Findings | Where-Object { $_.blocking })
    if ($Status -eq "pass" -and $blocking.Count -gt 0) {
        $Status = "fail"
    }

    $result = [pscustomobject]@{
        artifact = $ArtifactName
        source = $SourceName
        command = $Command
        scanner = $Scanner
        status = $Status
        findings = @($Findings)
        blocking_findings = @($blocking)
        metadata = $Metadata
    }

    $script:ReportResults += $result
    Write-ResultLine $result
}

function Add-InconclusiveResult([string]$ArtifactName, [string]$SourceName, [string]$Command, [string]$Message) {
    Add-AuditResult `
        -ArtifactName $ArtifactName `
        -SourceName $SourceName `
        -Command $Command `
        -Scanner "validation-wrapper" `
        -Status "inconclusive" `
        -Findings @() `
        -Metadata ([pscustomobject]@{ message = $Message })
}

function Get-SelectedArtifacts {
    if ($Artifact -eq "all") {
        return @("app", "migrate", "worker")
    }
    if ($Artifact -eq "infra") {
        return @()
    }
    return @($Artifact)
}

function Get-ImageReference([string]$ArtifactName) {
    switch ($ArtifactName) {
        "app" { return $AppImage }
        "migrate" { return $MigrateImage }
        "worker" { return $WorkerImage }
        default { throw "Unknown artifact: $ArtifactName" }
    }
}

function Build-Image([string]$ArtifactName, [string]$ImageReference) {
    $command = switch ($ArtifactName) {
        "app" { "docker build --pull --no-cache --target runner -t `"$ImageReference`" -f Dockerfile.app ." }
        "migrate" { "docker build --pull --no-cache --target migrate-runner -t `"$ImageReference`" -f Dockerfile.app ." }
        "worker" { "docker build --pull --no-cache -t `"$ImageReference`" -f Dockerfile.worker ." }
        default { throw "Unknown artifact: $ArtifactName" }
    }

    Write-Step "Build $ArtifactName runtime image"
    $result = Invoke-CapturedCommand $command $RepoRoot
    if ($result.ExitCode -ne 0) {
        Add-InconclusiveResult $ArtifactName "runtime-image-scan" $command "Image build failed: $($result.Text)"
        return $false
    }

    Write-Host "  [OK] built $ImageReference" -ForegroundColor Green
    return $true
}

function ConvertFrom-TrivyResult([object]$Trivy, [string]$ArtifactName, [string]$SourceName) {
    $findings = @()
    foreach ($result in @($Trivy.Results)) {
        foreach ($vulnerability in @($result.Vulnerabilities | Where-Object { $null -ne $_ })) {
            $findings += New-Finding `
                -Id ([string]$vulnerability.VulnerabilityID) `
                -ArtifactName $ArtifactName `
                -SourceName $SourceName `
                -PackageName ([string]$vulnerability.PkgName) `
                -InstalledVersion ([string]$vulnerability.InstalledVersion) `
                -Severity ([string]$vulnerability.Severity) `
                -FixedVersion ([string]$vulnerability.FixedVersion)
        }
    }
    return @($findings)
}

function ConvertFrom-TrivyConfigResult([object]$Trivy, [string]$ArtifactName, [string]$SourceName) {
    $findings = @()
    foreach ($result in @($Trivy.Results)) {
        $target = if ([string]::IsNullOrWhiteSpace([string]$result.Target)) { "configuration" } else { [string]$result.Target }
        foreach ($misconfiguration in @($result.Misconfigurations | Where-Object { $null -ne $_ })) {
            $title = if ([string]::IsNullOrWhiteSpace([string]$misconfiguration.Title)) {
                [string]$misconfiguration.Message
            } else {
                [string]$misconfiguration.Title
            }
            $packageName = if ([string]::IsNullOrWhiteSpace($title)) { $target } else { "$target`: $title" }
            $findings += New-Finding `
                -Id ([string]$misconfiguration.ID) `
                -ArtifactName $ArtifactName `
                -SourceName $SourceName `
                -PackageName $packageName `
                -InstalledVersion "configuration" `
                -Severity ([string]$misconfiguration.Severity) `
                -FixedVersion $null
        }
    }
    return @($findings)
}

function Get-TrivyImageCommand([string]$ImageReference) {
    $scannerImage = Resolve-TrivyImage
    return "docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy_cache:/root/.cache `"$scannerImage`" image --quiet --ignore-unfixed --scanners vuln --format json --severity HIGH,CRITICAL `"$ImageReference`""
}

function Get-TrivyConfigCommand([string]$ScanPath) {
    $relativePath = ConvertTo-RepoRelativePath $ScanPath
    $containerPath = "/repo/$relativePath".Replace("\", "/")
    $scannerImage = Resolve-TrivyImage
    $skipDirs = "--skip-dirs /repo/infra/azure/.terraform --skip-dirs /repo/infra/azure/bootstrap/.terraform"
    return "docker run --rm -v `"$RepoRoot`":/repo:ro -v trivy_cache:/root/.cache `"$scannerImage`" config --quiet $skipDirs --format json --severity HIGH,CRITICAL `"$containerPath`""
}

function Invoke-TrivyImageScan([string]$ArtifactName, [string]$ImageReference) {
    Write-Step "$ArtifactName runtime image vulnerability scan"
    $command = Get-TrivyImageCommand $ImageReference
    $result = Invoke-CapturedCommand $command $RepoRoot
    if ($result.ExitCode -ne 0) {
        Add-InconclusiveResult $ArtifactName "runtime-image-scan" $command "Trivy image scan failed: $($result.Text)"
        return
    }

    $trivy = $null
    if ($result.Text) {
        $trivy = ConvertFrom-TrivyJsonOutput $result.Text
    }
    if (-not $trivy) {
        Add-InconclusiveResult $ArtifactName "runtime-image-scan" $command "Trivy did not produce parseable JSON."
        return
    }

    $findings = @(ConvertFrom-TrivyResult $trivy $ArtifactName "runtime-image-scan")
    $status = if (@($findings | Where-Object { $_.blocking }).Count -gt 0) { "fail" } else { "pass" }
    Add-AuditResult $ArtifactName "runtime-image-scan" $command "trivy" $status $findings ([pscustomobject]@{
            image_reference = $ImageReference
            schema_version = $trivy.SchemaVersion
            created_at = $trivy.CreatedAt
            artifact_name = $trivy.ArtifactName
            artifact_type = $trivy.ArtifactType
        })
}

function Invoke-TrivyConfigScan([string]$ArtifactName, [string]$ScanPath) {
    $resolvedScanPath = Resolve-RepoPath $ScanPath
    $sourceName = "config-scan"
    if (-not (Test-Path $resolvedScanPath)) {
        Add-InconclusiveResult $ArtifactName $sourceName "metadata check" "Configuration scan path is missing: $(ConvertTo-RepoRelativePath $resolvedScanPath)"
        return
    }

    Write-Step "$ArtifactName configuration misconfiguration scan"
    $command = Get-TrivyConfigCommand $resolvedScanPath
    $result = Invoke-CapturedCommand $command $RepoRoot
    if ($result.ExitCode -ne 0) {
        Add-InconclusiveResult $ArtifactName $sourceName $command "Trivy config scan failed: $($result.Text)"
        return
    }

    $trivy = $null
    if ($result.Text) {
        $trivy = ConvertFrom-TrivyJsonOutput $result.Text
    }
    if (-not $trivy) {
        Add-InconclusiveResult $ArtifactName $sourceName $command "Trivy config scan did not produce parseable JSON."
        return
    }

    $findings = @(ConvertFrom-TrivyConfigResult $trivy $ArtifactName $sourceName)
    $status = if (@($findings | Where-Object { $_.blocking }).Count -gt 0) { "fail" } else { "pass" }
    Add-AuditResult $ArtifactName $sourceName $command "trivy" $status $findings ([pscustomobject]@{
            scan_path = ConvertTo-RepoRelativePath $resolvedScanPath
            schema_version = $trivy.SchemaVersion
            created_at = $trivy.CreatedAt
            artifact_name = $trivy.ArtifactName
            artifact_type = $trivy.ArtifactType
        })
}

function Invoke-SelectedConfigScans {
    if ($Artifact -in @("all", "infra")) {
        Invoke-TrivyConfigScan "infra" "infra/azure"
    }
    if ($Artifact -in @("all", "app", "migrate")) {
        Invoke-TrivyConfigScan "app" "Dockerfile.app"
    }
    if ($Artifact -in @("all", "worker")) {
        Invoke-TrivyConfigScan "worker" "Dockerfile.worker"
    }
    if ($Artifact -in @("all", "infra")) {
        Invoke-TrivyConfigScan "compose" "docker-compose.yml"
    }
}

$RepoRoot = Get-RepoRoot
$selectedArtifacts = @(Get-SelectedArtifacts)

if (-not $SkipConfigScans) {
    Invoke-SelectedConfigScans
}

foreach ($selectedArtifact in $selectedArtifacts) {
    $imageReference = Get-ImageReference $selectedArtifact
    $imageReady = $true
    if (-not $SkipBuild) {
        $imageReady = Build-Image $selectedArtifact $imageReference
    }

    if (-not $SkipImageScans -and $imageReady) {
        Invoke-TrivyImageScan $selectedArtifact $imageReference
    }
}

$report = [pscustomobject]@{
    generated_at = $Now.ToString("o")
    policy = [pscustomobject]@{
        blocking_severities = $BlockingSeverities
        inconclusive_blocks = $true
        image_scans_ignore_unfixed = $true
        trivy_image = Resolve-TrivyImage
        trivy_cooldown_days = [int]$TrivyCooldown.TotalDays
    }
    results = @($ReportResults)
}

$resolvedReportPath = Resolve-RepoPath $ReportPath
$reportDirectory = Split-Path -Parent $resolvedReportPath
if ($reportDirectory -and -not (Test-Path $reportDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $reportDirectory | Out-Null
}
ConvertTo-JsonDepth $report | Set-Content -Path $resolvedReportPath -Encoding utf8NoBOM

$blockingResults = @($ReportResults | Where-Object { $_.status -in @("fail", "inconclusive") })
Write-Step "Supply-chain audit summary"
Write-Host "Report: $(ConvertTo-RepoRelativePath $resolvedReportPath)"
if ($blockingResults.Count -gt 0) {
    foreach ($result in $blockingResults) {
        Write-Host ("  - {0}/{1}: {2}" -f $result.artifact, $result.source, $result.status) -ForegroundColor Yellow
        foreach ($finding in @($result.blocking_findings)) {
            $fix = if ($finding.fixed_version) { $finding.fixed_version } else { "no fixed version reported" }
            Write-Host ("    {0} {1} {2}@{3} fix={4}" -f $finding.severity, $finding.id, $finding.package_name, $finding.installed_version, $fix) -ForegroundColor Yellow
        }
        if ($result.status -eq "inconclusive" -and $result.metadata.message) {
            Write-Host ("    {0}" -f $result.metadata.message) -ForegroundColor Yellow
        }
    }
    exit 1
}

Write-Host "ALL SUPPLY-CHAIN AUDITS PASSED" -ForegroundColor Green
