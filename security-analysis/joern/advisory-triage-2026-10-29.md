# Joern advisory review, 2026-10-29

Reviewed the 17 JavaScript candidates from main CI run 40885832668 (commit
`d5ecbaa8c1da3ea3057b717271ea1233a08466ee`). There were no blocking or Python
findings. Candidates are data-flow paths, not distinct vulnerabilities.

## Confirmed guard gap and correction

Login and Azure SSO accepted local redirect paths containing backslashes or
TAB/CR/LF. URL parsing can normalize these characters, so checking only a leading
slash and excluding `//` was insufficient. Teams consent already rejected
backslashes and CR/LF but missed TAB. All four callers now use
`safeLocalRedirectPath`, which rejects these ambiguities before URL construction.
The login regression failed on four inputs before the fix; the shared guard and
32 focused auth/Teams tests pass after it. No live Teams configuration or send is
part of this change.

## Analysis correction

Joern leaves `@/` imports unresolved. Its default semantics can copy an input into
a synthetic call receiver and then into an unrelated configuration helper. The
query now recognizes an exact source-matched function declaration without
authored `this` and prevents that receiver contamination. It still conservatively
propagates positive arguments to other arguments and the return value. Unknown
targets, ambiguous declarations and arrow methods retain default semantics.

An alias receiver control failed before this change and passes after it. Unsafe
alias return and object-mutation controls must still be detected. This is not a
sanitizer exemption or a source/file/sink suppression.

## Remaining candidates

The fresh Windows snapshot represents 187/196 JavaScript/TypeScript files and
8/8 Python files. Only the existing nine frontend omissions remain. It reports
zero blocking findings and 15 advisory JavaScript paths (14 redirect, one logging),
with no Python findings. Review of every remaining path gives these groups:

| Sink | Paths | Disposition and evidence |
| --- | ---: | --- |
| CLI approval error redirect | 1 | Fixed configured base path plus `/cli-login?error=1`; `request.url` supplies the base origin. URL construction is modeled without component separation. |
| Logout redirect | 1 | Fixed configured base path plus `/login`; request URL is only the base. |
| Azure SSO local redirect helper | 2 | One base-URL path and one query-to-target path. Targets are fixed errors, `/pending`, or the newly guarded local path. The model does not understand the guard. |
| Azure SSO provider redirect | 1 | `provider: "microsoft"` is fixed. The guarded local callback is made absolute using configured auth origin and passed to Better Auth; the location comes from its social sign-in response. The model treats the response as wholly input-derived. |
| Teams consent start | 1 | `getTeamsAuthorizeUrl` constructs `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` with configured tenant/client. Request-derived values are query parameters; the model conflates them with the destination authority. |
| Teams consent callback | 7 | Three outcome redirects use a fixed suffix and a local state-cookie path checked by the shared guard (or a fixed admin fallback). Paths originate in request URL/base or token-exchange arguments; neither changes the redirect authority. State mismatch follows the error branch. |
| CLI authorization | 1 | Configured app origin plus fixed `/login?redirectTo=` and an encoded local approval path. `createAuthCode` returns a server-generated ID; whole-record taint incorrectly includes that ID. |
| Infrastructure diagnostic | 1 | `blockNames` projects Terraform `secret` blocks to `.name`, never `.value`. Output contains resource/environment/secret names, not credential values. Whole-object taint loses that distinction. |

These residual paths are reviewed precision limitations, not confirmed unresolved
vulnerabilities. Same-origin conclusions assume valid trusted deployment origin
and base-path configuration; they do not certify arbitrary proxy/Host settings.
No provider library or live tenant penetration test is claimed. The raw advisory
count remains visible: no alert dismissal, rule disablement or new extraction
allowlist was used to make it zero.

The final full control runner passes 37 unsafe, 32 safe and five unrelated-object input cases, the original Express/Flask controls and the CI gate regressions.

Evidence is in ignored `.artifacts/joern-triage-20261029/` and
`security-analysis/joern/codeql-port/application-triage-20261029-a/`. CI rebuilds
all controls and a fresh source snapshot and uploads equivalent evidence.

## Follow-up: individual decisions and implementation

The user requested a second review of every remaining path, implementation of all
warranted changes as one batch, and specification reconciliation. The baseline
for this table is main commit `1dadc332ff77a838e5612808e3e85744eaf73129`, CI run
40895796304. J01–J15 follow that artifact's finding order. Fingerprints are the
first 12 hexadecimal characters of SHA-256 over `JSON.stringify(finding)` in the
original `javascript-results.json`; they identify evidence, not suppressions.
Line numbers refer to that baseline, before this follow-up.

| Path | Fingerprint | Reviewed behavior | Decision and implementation |
| --- | --- | --- | --- |
| J01 | e853cacfa32b | CLI approval error, approve route:21, request URL base | Pin the local error to configured app origin using the shared builder; retain validated loopback success callbacks. Approval route regression failed before the change. |
| J02 | d1f9ff9e28ef | Logout, auth service:116, request URL base | Pin logout to configured app origin and preserve expired session cookies. Regression failed before the change. |
| J03 | 073ca84bd7fb | Infrastructure diagnostic:133, Terraform secret block | No value leak found: only `.name` is projected. Add a real-script regression with private value sentinels and forbidden names; retain useful diagnostics and the raw candidate. |
| J04 | 3862d2ab4a94 | CLI authorization:86, returned record taint | No destination control found: configured origin, fixed login path, encoded nested local path, generated record ID. Harden the shared URL builder's local/base-path validation and retain existing CLI integration/E2E coverage. Do not rewrite server-generated identifiers for the analyzer. |
| J05 | 719ac49db9a4 | SSO provider response:143 | Add a destination check at the response boundary: exact HTTPS Microsoft origin and configured tenant authorization path, no URL credentials. Invalid/malformed locations yield a local error. Seven rejected destinations failed regressions before the change; accepted OAuth query/cookies remain covered. |
| J06 | fb50fb506004 | Teams state-error:38, request URL base | Use the shared configured-origin outcome builder. Preserve query data and append the outcome with URL search parameters. State mismatch still prevents code exchange and grant persistence. |
| J07 | fe1d89c6a693 | Teams failed:50, request URL base | Same shared outcome fix; failure regression verifies canonical destination and no grant persistence. |
| J08 | 449aa36a7c40 | Teams connected:46, parsed request/code path | Same shared outcome fix; success regression verifies canonical destination and one grant save. Request/code values cannot select the redirect origin. |
| J09 | a5af5d089803 | Teams start:38, guarded path/state into fixed Microsoft URL | No authority control found. Add coverage of the actual authorization URL builder proving request/state strings remain query data on the fixed Microsoft endpoint and configured callback. No live Teams setup or send. |
| J10 | 0fffca103235 | Teams connected:46, request URL base | Same configured-origin success fix and outcome regression as J08. |
| J11 | e6b7ad648e4d | Teams failed:50, neighboring request URL base | Same configured-origin failure fix and outcome regression as J07. |
| J12 | b22aed5a6ee5 | SSO local helper:18, request URL base | Remove request-origin resolution; use the shared configured-origin URL builder for all local SSO outcomes. Regression failed before the change. |
| J13 | 4b46f3008d4a | SSO local helper:18, guarded return query | Retain the shared local-path guard; validate again at the absolute URL boundary, respect the configured base path once, and preserve legitimate query/fragment data. No generic sanitizer exemption. |
| J14 | 4904946d4c1a | Teams failed:50, parsed code path | Same shared outcome fix as J07; token exchange input cannot become an outcome destination. |
| J15 | fc74a427fae7 | Teams state-error:38, parsed request URL path | Same shared state-error fix as J06; local return paths remain guarded before use. |

The review found a worthwhile trust-policy inconsistency: local redirects used
the request URL even when a canonical auth origin was configured. Regression
tests demonstrate that behavior without attacking any deployed target. Provider
destination validation is additional boundary hardening; this review does not
claim that Better Auth generated malicious locations. Existing query concatenation
and cookie splitting also lost legitimate Teams return data; both are corrected
in the shared callback flow.

Current contracts are reconciled in `specs/base/auth-and-rbac.md`,
`specs/base/testing-and-quality.md` and consolidated FR-038 in
`.specify/memory/spec.md`. Original archived feature documents and IDs remain
unchanged. User-approved security maintenance continues while unfinished feature
014 remains deferred. Raw advisory counts must still be reported after a fresh
scan; this batch does not promise zero candidates or alter Joern detection policy.

### Follow-up scan and validation

The reduced-heap application rerun passes: 187/196 JS/TS files (the same nine
frontend omissions), 8/8 Python files, zero blocking findings, six advisory JS
paths (five redirects, one logging), and no Python findings. All 204 captured
source-file hashes match the current working files. The query and detection
policy are unchanged. This application rerun uses the existing controls for that
same query hash; fresh CI must rebuild the complete controls and application.
The earlier full local attempt failed on native Java allocation during a control
query and is not counted as successful evidence.

Every residual path was re-read:

| Current sink | Paths | Remaining model limitation and evidence |
| --- | ---: | --- |
| SSO local helper:17 | 2 | Request URL/header input crosses the mock-SSO authorization boolean, then a mock password into a synthetic receiver at a re-exported helper. That receiver is not an authored destination mutation. Actual destinations use the guarded canonical-origin builder. Local destination, rejected provider and positive E2E OAuth/CLI regressions remain required. |
| SSO provider redirect:149 | 1 | Whole-response taint persists through the explicit Microsoft origin/tenant/credential check. Seven rejected locations and an accepted OAuth URL/cookie are covered through the route. |
| CLI authorization:86 | 1 | Whole-record taint includes the server-generated ID in an encoded local approval query. Opaque URL-shaped state remains query data; the destination origin/path and callback contract are covered. |
| Teams consent start:38 | 1 | The fixed Microsoft authorization URL is tainted by its query parameters. The real URL builder test proves fixed authority/path, configured callback and opaque state preservation. |
| Infrastructure diagnostic:133 | 1 | Whole-block taint persists after projecting `.name`; the actual diagnostic script regression proves private value sentinels never reach output. |

Local validation passes 315 application tests across 72 files, 26 worker tests,
and lint/format/architecture/duplication/security/credential/logging/encoding/infra
checks. The first full command recorded a test-only JS import typing error;
that was corrected and a separate final typecheck passed. Evidence:
`.artifacts/joern-triage-20261029/boundaries-*.log` and
`security-analysis/joern/codeql-port/application-boundaries-20261029-a/`.
