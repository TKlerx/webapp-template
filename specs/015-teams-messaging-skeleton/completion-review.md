# Teams completion reconciliation — 2026-10-15

The user approved fixing delegated sending and fixed retries before archival, with incomplete 014 left open. The earlier app-only send design is superseded by the existing delegated-consent clarification.

Implemented:

- The worker submits a claimed Teams job ID to a dedicated authenticated app endpoint. The app uses persisted target/content, checks emergency controls and an active platform-admin target owner, refreshes that owner's encrypted delegated grant, and sends on their behalf. No delegated token or grant key crosses into jobs or the worker.
- Sending without a delegated grant fails closed. Read-only intake continues using application permissions.
- A row lock serializes delivery; the app saves the Graph receipt before responding. Successful receipts survive worker retries and are reused on replay. Graph success followed by database failure remains ambiguous and requires operator review.
- Teams delivery retries use the same configured interval for both retries, stop after at most three attempts, and leave other job retry schedules unchanged. The worker accepts the actual queued targetId field.
- Channel intake uses documented paged message listing instead of the unsupported channel delta path. Continuation links must remain within the approved channel; provider IDs deduplicate rescans. Queued polls recheck emergency controls.
- Admin health reports actual poll-job failures and the last successful poll, including empty reads. Ignored messages no longer count as read failures.
- Docker and Azure bind the dedicated delivery secret to app/worker, and the grant encryption key to the app alone. The optional Azure grant key falls back to the app auth secret when omitted.

Validation: final `pnpm run validate` passed with 279 application tests across 66 files, 26 PostgreSQL worker tests, and all mandatory type, formatting, architecture, duplication, CLI/Python quality, security, runtime-credential, logging, encoding, provenance, spec and OpenTofu gates. Evidence: `.runlogs/validation-teams-015-final.log`. Regression coverage includes refresh-token retention, missing consent, non-admin owners, persisted-content delivery, replay receipts, fixed retries, paging isolation and disabled intake. Initial typing, formatting, overview and test-fixture failures were corrected before this clean run.

Release evidence still needed: no live Teams send, Entra consent operation, Azure apply, pilot setup timing or tenant delivery/ingestion latency measurement was performed in this reconciliation. The existing source task claims are historical; this review does not assert fresh live verification. Full-history polling deliberately suits the documented small-team scope; reconsider change notifications if channel history makes it costly.
