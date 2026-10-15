param(
    [string]$Codeql = (Join-Path $PSScriptRoot "../../.artifacts/codeql/toolchain/v2.27.2/codeql/codeql.exe")
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
if (-not (Test-Path -LiteralPath $Codeql -PathType Leaf)) {
    throw "Install CodeQL 2.27.2 separately and pass its executable with -Codeql."
}

function Invoke-Codeql([string[]]$Arguments) {
    & $Codeql @Arguments
    if ($LASTEXITCODE -ne 0) { throw "CodeQL failed: $($Arguments -join ' ')" }
}

$version = (& $Codeql version --format=json | ConvertFrom-Json).version
if ($LASTEXITCODE -ne 0 -or $version -ne "2.27.2") { throw "This trial requires CodeQL 2.27.2." }
New-Item -ItemType Directory -Force (Join-Path $PSScriptRoot "databases") | Out-Null

foreach ($language in @("javascript", "python")) {
    $extractor = if ($language -eq "javascript") { "javascript-typescript" } else { "python" }
    $suite = "codeql/$language-queries:codeql-suites/$language-security-extended.qls"
    foreach ($kind in @("application", "control")) {
        $prefix = if ($kind -eq "control") { "control-$language" } else { $language }
        $source = if ($kind -eq "control") {
            Join-Path $PSScriptRoot "control/$(if ($language -eq 'javascript') { 'typescript' } else { 'python' })"
        } else { $repoRoot }
        $database = Join-Path $PSScriptRoot "databases/$prefix"
        $create = @("database", "create", $database, "--language=$extractor", "--source-root=$source", "--overwrite")
        if ($kind -eq "application") { $create += "--codescanning-config=$(Join-Path $PSScriptRoot 'config.yml')" }
        Invoke-Codeql $create
        $log = Join-Path $PSScriptRoot "$prefix-analysis.log"
        Invoke-Codeql @("database", "analyze", $database, $suite, "--format=sarif-latest", "--output=$(Join-Path $PSScriptRoot "$prefix.sarif")", "--threads=2", "--ram=2048") *> $log
    }
}
& node (Join-Path $PSScriptRoot "check-results.mjs")
if ($LASTEXITCODE -ne 0) { throw "CodeQL result verification failed." }
