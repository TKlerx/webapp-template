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
