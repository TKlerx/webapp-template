param(
    [string]$JoernHome = (Join-Path $PSScriptRoot "../../../.artifacts/joern/toolchain/v4.0.650/joern-cli")
)

$ErrorActionPreference = "Stop"
$trialRoot = $PSScriptRoot
& "$trialRoot/run-input-models.ps1" -JoernHome $JoernHome -SkipCodeqlComparison
$runName = "application-$([guid]::NewGuid().ToString('N'))"
& node "$trialRoot/snapshot-app.mjs" $runName
if ($LASTEXITCODE -ne 0) { throw "Source snapshot failed." }
$runRoot = Join-Path $trialRoot $runName
foreach ($language in @("python", "javascript")) {
    $frontend = if ($language -eq "python") { "pysrc2cpg" } else { "jssrc2cpg.sh" }
    if ($IsWindows) { $frontend = $frontend.Replace('.sh', '') + '.bat' }
    $graph = Join-Path $runRoot "$language.cpg.bin"
    & (Join-Path $JoernHome $frontend) -J-Xmx2g "$runRoot/source" "--output=$graph" --enable-file-content *> "$runRoot/$language-extraction.log"
    if ($LASTEXITCODE -ne 0) { throw "Joern $language application extraction failed; see $runRoot." }
    & java -Xmx2g -cp "$JoernHome/lib/*" io.joern.joerncli.console.ReplBridge --script "$trialRoot/command-injection.sc" --param "cpgFile=$graph" --param "outFile=$runRoot/$language-results.json" *> "$runRoot/$language-query.log"
    if ($LASTEXITCODE -ne 0) { throw "Joern $language application query failed; see $runRoot." }
}
& node "$trialRoot/check-template-inputs.mjs" $runName
if ($LASTEXITCODE -ne 0) { throw "Application analysis failed; see $runRoot/summary.json." }
