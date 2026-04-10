# Security Follow-ups

Updated: 2026-04-10

This file captures the remaining realistic security concerns after the recent runtime hardening, dependency cleanup, and worker reliability work. The list is ordered by practical priority for this template.

## 1. Secrets Handling In `.env` And Local Compose Use

Risk:
- The local Compose flow reads secrets directly from `.env`.
- Real credentials in local files are easy to leak through screenshots, shell history, copied configs, or accidental commits.

Why it matters:
- This is a higher-probability operational risk than the current production dependency audit findings.

Next steps:
- Add a documented secret-management path for non-local environments.
- Make sure example values stay fake in tracked files.
- Consider a startup guard that rejects obviously-placeholder secrets in production, similar to the Better Auth secret check.

## 2. Build/Deploy Tooling Supply Chain Surface

Risk:
- Prisma CLI is not part of the shipped app runtime, but it is still executed in build and migration flows.
- Build-time tooling compromise is still meaningful even when runtime dependencies are clean.

Why it matters:
- The current production audit is clean for shipped dependencies, but the deploy pipeline still has its own trust boundary.

Next steps:
- Keep treating `prisma`/tooling findings separately from runtime findings.
- Periodically review builder and migration image contents.
- Consider pinning and reviewing deploy-time tools more explicitly if the template becomes widely reused.

## 3. Authentication And Authorization Review Depth

Risk:
- Auth and user-admin flows are sensitive and deserve regular review even when tests pass.
- Mistakes here are usually higher-impact than queue or UI issues.

Why it matters:
- This starter includes local auth, Azure SSO, role changes, approval flows, and audit-sensitive user actions.

Next steps:
- Review admin-only routes and mutation endpoints for authorization consistency.
- Re-check SSO linking and revocation flows against the intended threat model.
- Verify cookie, proxy, and `AUTH_BASE_URL` behavior in real production topology.

## 4. Queue Abuse And Background Job Guardrails

Risk:
- The worker is now more reliable, but queue creation and execution still need abuse boundaries.
- A noisy or malformed producer could still create operational pressure.

Why it matters:
- Reliability is improved, but security also includes making sure queueing cannot be abused to create denial-of-service conditions or unexpected workload.

Next steps:
- Define allowed job types more explicitly at the API boundary.
- Add payload size limits and validation for queued jobs.
- Consider rate limiting or role-based restrictions around job creation endpoints if they grow beyond admin/internal use.

## 5. Runtime Hardening Around Deployment Defaults

Risk:
- Secure outcomes still depend on correct deployment choices.
- Misconfigured headers, TLS/proxy trust, file mounts, or database exposure can undercut otherwise-clean app code.

Why it matters:
- Templates get copied into environments with varying levels of operational discipline.

Next steps:
- Review production defaults for proxy/header trust and cookie security.
- Confirm container runtime users, writable paths, and volume expectations are as narrow as possible.
- Document the intended production deployment posture more explicitly.

## 6. Observability For Security-Relevant Events

Risk:
- Auditing exists, but security response is only as good as how visible suspicious activity is.

Why it matters:
- The template already tracks useful events, so improving operational visibility here has a good payoff.

Next steps:
- Review whether failed auth attempts, role changes, approval actions, and export actions are sufficiently surfaced.
- Decide which events should trigger alerts or operational review outside the app UI.

## 7. Dependency Policy Maintenance

Risk:
- The current dependency posture is much better, but it still relies on ongoing discipline.
- Allowlist-style exceptions can drift if not revisited.

Why it matters:
- The project intentionally uses `min-release-age=7`, strict production audit checks, and separate handling for runtime vs tooling dependencies.

Next steps:
- Revisit audit exceptions periodically and remove them as upstream fixes become usable.
- Keep the runtime audit (`--omit=dev --omit=optional`) strict.
- Continue treating "tooling only" as lower severity, not "ignore forever".

## Suggested Order For Tomorrow

1. Review secrets and production config handling.
2. Do a focused auth/authorization review.
3. Tighten queue input validation and abuse guardrails.
4. Revisit deploy-time tooling exposure and whether any extra hardening is worth the complexity.
