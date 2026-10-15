param(
    [string]$JoernHome = (Join-Path $PSScriptRoot "../../../.artifacts/joern/toolchain/v4.0.650/joern-cli"),
    [switch]$SkipCodeqlComparison
)

$ErrorActionPreference = "Stop"
$trialRoot = $PSScriptRoot
& (Join-Path $trialRoot "run.ps1") -JoernHome $JoernHome -SkipCodeqlComparison:$SkipCodeqlComparison
foreach ($language in @("python", "javascript")) {
    $graph = "$trialRoot/$language-input-controls.cpg.bin"
    $output = "$trialRoot/$language-input-controls.json"
    $fixture = Join-Path $trialRoot "input-controls/$(if ($language -eq 'javascript') { 'typescript' } else { 'python' })"
    $frontend = if ($language -eq "python") { "pysrc2cpg" } else { "jssrc2cpg" }
    if ($IsWindows) { $frontend += ".bat" }
    elseif ($language -eq "javascript") { $frontend += ".sh" }
    & (Join-Path $JoernHome $frontend) -J-Xmx2g $fixture "--output=$graph" --enable-file-content *> "$trialRoot/$language-input-extraction.log"
    if ($LASTEXITCODE -ne 0) { throw "Joern $language input extraction failed; see its extraction log." }
    & java -Xmx2g -cp "$JoernHome/lib/*" io.joern.joerncli.console.ReplBridge --script "$trialRoot/command-injection.sc" --param "cpgFile=$graph" --param "outFile=$output" *> "$trialRoot/$language-input-rerun.log"
    if ($LASTEXITCODE -ne 0) { throw "Joern $language input query failed; see its rerun log." }
}
& node "$trialRoot/check-input-models.mjs"
if ($LASTEXITCODE -ne 0) { throw "Input model verification failed." }
