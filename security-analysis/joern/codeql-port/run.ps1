param(
    [string]$JoernHome = (Join-Path $PSScriptRoot "../../../.artifacts/joern/toolchain/v4.0.650/joern-cli")
)

$ErrorActionPreference = "Stop"
$trialRoot = $PSScriptRoot
$joernRoot = Split-Path $trialRoot -Parent
if (-not (Test-Path -LiteralPath (Join-Path $JoernHome "lib") -PathType Container)) {
    throw "Install Joern 4.0.650 separately and pass its joern-cli directory with -JoernHome."
}
foreach ($language in @("python", "javascript")) {
    $fixture = Join-Path $joernRoot "../codeql/control/$(if ($language -eq 'javascript') { 'typescript' } else { 'python' })"
    $frontend = if ($language -eq "python") { "pysrc2cpg" } else { "jssrc2cpg" }
    if ($IsWindows) { $frontend += ".bat" }
    $graph = Join-Path $joernRoot "control-$language.cpg.bin"
    & (Join-Path $JoernHome $frontend) -J-Xmx2g $fixture "--output=$graph" --enable-file-content *> (Join-Path $trialRoot "$language-control-extraction.log")
    if ($LASTEXITCODE -ne 0) { throw "Joern $language extraction failed; see its extraction log." }
    & java -Xmx2g -cp "$JoernHome/lib/*" io.joern.joerncli.console.ReplBridge --script "$trialRoot/command-injection.sc" --param "cpgFile=$graph" --param "outFile=$trialRoot/$language-control.json" *> "$trialRoot/$language-control.log"
    if ($LASTEXITCODE -ne 0) { throw "Joern $language query failed; see its control log." }
}
& node "$trialRoot/check-results.mjs"
if ($LASTEXITCODE -ne 0) { throw "Control result verification failed. Run the CodeQL controls first." }
