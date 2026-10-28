# Security analysis

This directory preserves the native CodeQL trial and Joern security-flow queries. The Validate workflow runs Joern in a separate job on pull requests and pushes to main. CodeQL remains a local advisory comparison. Fixtures contain deliberately unsafe code: analyze them; never execute them.

Only query/check/runner sources, fixtures, upstream query references and license notices are tracked. Downloaded tools, generated graphs, databases, source snapshots, SARIF reports, logs and Joern's root `workspace/` remain ignored.

## Reproduce

Prerequisites: Node.js, PowerShell 7, Java and Joern 4.0.650, plus the CodeQL 2.27.2 bundle. Install tools separately; the runners default to the original local tool directories under `.artifacts/`. Pass `-Codeql` or `-JoernHome` for another installation of those versions.

CI sets `JAVA_TOOL_OPTIONS=-XX:ActiveProcessorCount=2 -Xmx768m -Xms64m` to bound the Scala compiler subprocess. On memory-constrained local machines, set the same environment variable before running Joern; the extraction/query launchers retain their explicit 2 GB maximum heap.

From the repository root:

```powershell
pwsh -NoProfile -File security-analysis/codeql/run.ps1
pwsh -NoProfile -File security-analysis/joern/codeql-port/run-input-models.ps1
```

Run Joern independently of CodeQL, including a fresh application snapshot:

```powershell
pwsh -NoProfile -File security-analysis/joern/codeql-port/run-application.ps1
```

CI downloads Joern 4.0.650 with a pinned SHA-256 checksum, verifies positive and negative controls, and scans current app/worker/scripts/configuration sources. Extraction/engine failures, control regressions and blocking application findings fail its job. Redirect and sensitive-logging findings are currently advisory while guard/redactor precision is calibrated; all other rule families block, as do unknown rule IDs. Every family's unsafe/safe controls remain mandatory. JSON evidence and logs are uploaded, including represented and omitted files and recognized sink counts; a GitHub step summary separates blocking/advisory counts. No CodeQL binary, license acceptance or previous scan output is required. The local `validate:full` command retains its existing checks; Joern is a parallel CI job. Its bounded security models do not cover Go or replace the other security checks.

## Security rules

The `Joern security analysis` check is required alongside `validate` by main's branch protection. Keep both requirements when changing CI; a failed or missing Joern run must prevent merging.

The application checker permits only the nine explicitly reviewed JavaScript/TypeScript frontend omissions listed in `check-template-inputs.mjs`. Any additional omission fails the job. Python requires complete extraction. The real-process gate regression checks both a known omission and a newly omitted route, alongside finding policy, engine errors and snapshot integrity.

The historical `command-injection.sc` filename now contains all of these models. These are Joern implementations informed by the linked CodeQL references, not executions of the CodeQL queries or claims of equivalent coverage. Rule IDs in the JSON use local `js/` and `py/` names.

| Family | TypeScript / JavaScript sinks | Python sinks | Reference |
| --- | --- | --- | --- |
| Command injection | Node child_process APIs | subprocess APIs | [CodeQL](https://codeql.github.com/codeql-query-help/javascript/js-command-line-injection/) |
| SSRF | Global fetch, imported undici/http/https | urllib Request/urlopen, requests/httpx HTTP verbs | [JavaScript](https://codeql.github.com/codeql-query-help/javascript/js-request-forgery/), [Python](https://codeql.github.com/codeql-query-help/python/py-full-ssrf/) |
| SQL injection | Typed pg query, typed/imported Prisma unsafe raw APIs | Typed psycopg cursor/connection and conventional cursor variables in psycopg modules | [JavaScript](https://codeql.github.com/codeql-query-help/javascript/js-sql-injection/), [Python](https://codeql.github.com/codeql-query-help/python/py-sql-injection/) |
| Path traversal | Imported Node fs/fs-promises reads/writes | Built-in open, selected os/shutil APIs | [JavaScript](https://codeql.github.com/codeql-query-help/javascript/js-path-injection/), [Python](https://codeql.github.com/codeql-query-help/python/py-path-injection/) |
| Open redirects | NextResponse.redirect, next/navigation redirect | Flask/Django redirects | [CodeQL](https://codeql.github.com/codeql-query-help/javascript/js-server-side-unvalidated-url-redirection/) |
| Sensitive logging | Direct console calls | logging functions and typed standard Logger calls | [JavaScript](https://codeql.github.com/codeql-query-help/javascript/js-clear-text-logging/), [Python](https://codeql.github.com/codeql-query-help/python/py-clear-text-logging-sensitive-data/) |
| Code injection | eval and Function constructor | Built-in eval/exec | [CodeQL](https://codeql.github.com/codeql-query-help/javascript/js-code-injection/) |
| Unsafe deserialization | — | pickle/marshal load(s), unsafe YAML loading | [CodeQL](https://codeql.github.com/codeql-query-help/python/py-unsafe-deserialization/) |
| Prototype pollution | Imported lodash merge/mergeWith/defaultsDeep/set | — | [CodeQL](https://codeql.github.com/codeql-query-help/javascript/js-prototype-pollution/) |

SQL checks select query text rather than bound parameters. Path normalization is never a sanitizer. SSRF currently checks full destination/authority control: proven fixed literal origins (including uniquely assigned module constants) are excluded; URL-path authorization and redirects followed by HTTP clients are outside this model. Request-object construction checks the URL separately from its body/headers. Precise non-mutating data-flow semantics for selected urllib/json/logging, JavaScript JSON/console/fetch and Node fs/path APIs prevent their arguments from contaminating each other or the imported module. Logging uses named credential sources rather than treating every request value as confidential. Known literal masking and explicit YAML SafeLoader controls remain unflagged; schema/shape validation and arbitrary helper names confer no sanitization exemption.

Controls cover cross-file unsafe flows, safe parameter values/fixed targets, unsafe normalized paths and unrelated method lookalikes. Models remain bounded: general alias/reassignment and namespace-import propagation, arbitrary receiver types, control-flow host/path allowlists, SQL identifier-composition sanitizers, request-object mutation and custom logging/redaction wrappers are not comprehensively modeled. The logging rule does not certify structured metadata redaction or persisted-secret safety; existing regression tests and guards remain required. XSS/eval bans and basic configuration checks stay with existing Semgrep rules.

The CodeQL runner scans the current app and worker plus the original Express/Flask controls. The Joern runner rebuilds graphs for those same controls and the Next.js/worker controls, reruns the adapted query, and checks unsafe detections, safe cases, cross-file traces and agreement with CodeQL's control SARIF.

`joern/codeql-port/snapshot-app.mjs` can capture a fresh source snapshot with per-file hashes before an additional template scan. The original graph-inspection scripts are retained under `joern/`; their generated inputs are intentionally not committed.

## Evidence and limits

The expanded-rule rerun on October 15 passed all 34 unsafe, 30 safe and five unrelated-object input cases, the original Express/Flask controls and the CI gate regressions. The application scan represented 186/195 JavaScript/TypeScript files and 8/8 Python files, with zero blocking findings and 17 advisory JavaScript candidates (16 redirects, one logging); Python had zero findings. Advisory candidates include guarded OAuth redirects and infrastructure diagnostics that print secret names, so they require guard/redactor precision review rather than automatic vulnerability claims. Evidence is retained locally in `.runlogs/joern-expanded-final.log` and generated application summaries; CI uploads the equivalent evidence. A fresh Linux CI execution is not claimed by this local Windows run.

The packaging rerun on October 15 scanned all 160 runtime JavaScript/TypeScript files and all eight worker Python files with CodeQL security-extended: zero findings and zero SARIF warnings. Both unsafe Express/Flask controls were detected across files, with safe argument-list calls unflagged.

The October 15 trial detected all 12 unsafe Next.js/worker cases, left all 12 safe counterparts and three unrelated-object controls unflagged, and matched native CodeQL on the original Express/Flask controls. Its template snapshot represented 185 of 194 JavaScript/TypeScript files and all eight Python files, recognized 80 TypeScript input points and 12 worker payload reads, and reported no command-injection alerts. These are historical snapshot results, not a scan of every later commit.

Joern's source/sink and alias models remain bounded. Nine JavaScript/TypeScript files were omitted by its frontend; general aliases, reassignment, sanitizer handling and indirect shell arguments are not comprehensively modeled. Zero alerts do not establish complete coverage. Keep the existing validation and dependency audits.

CodeQL query reference versions and notices are preserved in `joern/codeql-port/LICENSE-CodeQL`, `license-source-commit.txt`, `upstream/`, and `codeql/control/LICENSE`. The adaptation uses CodeQL query/model sources with Joern's data-flow engine; it does not claim CodeQL-equivalent analysis.
