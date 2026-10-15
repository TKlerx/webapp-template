# Advisory security-analysis experiments

This directory preserves both the native CodeQL trial and the CodeQL-derived Joern command-injection queries. The Validate workflow runs Joern in a separate job on pull requests and pushes to main. CodeQL remains a local advisory comparison. Fixtures contain deliberately unsafe code: analyze them; never execute them.

Only query/check/runner sources, fixtures, upstream query references and license notices are tracked. Downloaded tools, generated graphs, databases, source snapshots, SARIF reports, logs and Joern's root `workspace/` remain ignored.

## Reproduce

Prerequisites: Node.js, PowerShell 7, Java and Joern 4.0.650, plus the CodeQL 2.27.2 bundle. Install tools separately; the runners default to the original local tool directories under `.artifacts/`. Pass `-Codeql` or `-JoernHome` for another installation of those versions.

From the repository root:

```powershell
pwsh -NoProfile -File security-analysis/codeql/run.ps1
pwsh -NoProfile -File security-analysis/joern/codeql-port/run-input-models.ps1
```

Run Joern independently of CodeQL, including a fresh application snapshot:

```powershell
pwsh -NoProfile -File security-analysis/joern/codeql-port/run-application.ps1
```

CI downloads Joern 4.0.650 with a pinned SHA-256 checksum, verifies positive and negative controls, and scans current app/worker/scripts/configuration sources. Extraction failures, control regressions and application findings fail its job. JSON evidence and logs are uploaded, including represented and omitted files; no CodeQL binary, license acceptance or previous scan output is required. The local `validate:full` command retains its existing checks; Joern is a parallel CI job. Its bounded command-injection model does not cover Go or replace the other security checks.

The CodeQL runner scans the current app and worker plus the original Express/Flask controls. The Joern runner rebuilds graphs for those same controls and the Next.js/worker controls, reruns the adapted query, and checks unsafe detections, safe cases, cross-file traces and agreement with CodeQL's control SARIF.

`joern/codeql-port/snapshot-app.mjs` can capture a fresh source snapshot with per-file hashes before an additional template scan. The original graph-inspection scripts are retained under `joern/`; their generated inputs are intentionally not committed.

## Evidence and limits

The packaging rerun on October 15 scanned all 160 runtime JavaScript/TypeScript files and all eight worker Python files with CodeQL security-extended: zero findings and zero SARIF warnings. Both unsafe Express/Flask controls were detected across files, with safe argument-list calls unflagged.

The October 15 trial detected all 12 unsafe Next.js/worker cases, left all 12 safe counterparts and three unrelated-object controls unflagged, and matched native CodeQL on the original Express/Flask controls. Its template snapshot represented 185 of 194 JavaScript/TypeScript files and all eight Python files, recognized 80 TypeScript input points and 12 worker payload reads, and reported no command-injection alerts. These are historical snapshot results, not a scan of every later commit.

Joern's source/sink and alias models remain bounded. Nine JavaScript/TypeScript files were omitted by its frontend; general aliases, reassignment, sanitizer handling and indirect shell arguments are not comprehensively modeled. Zero alerts do not establish complete coverage. Keep the existing validation and dependency audits.

CodeQL query reference versions and notices are preserved in `joern/codeql-port/LICENSE-CodeQL`, `license-source-commit.txt`, `upstream/`, and `codeql/control/LICENSE`. The adaptation uses CodeQL query/model sources with Joern's data-flow engine; it does not claim CodeQL-equivalent analysis.
