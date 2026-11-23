# Project review

Reviewed on 2026-11-23 at commit `64304a5` on `main`. P1 findings should be addressed before using this commit as a production baseline. P2 findings affect correctness or reliability. P3 findings have a more limited impact. GitHub source links are pinned to the reviewed commit so line references remain stable.

## First pass

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             2 |               4 |            1 |

### R01 · P1 · Shared authorization guards omit the required first-login password change

Login redirects flagged users to the password-change page, but shared page and API guards still authorize them. A privileged account using its temporary password can reach protected functionality and create a personal access token. Enforce `mustChangePassword` in the shared guards, with explicit allowances for password change and sign-out. [Login redirect](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/auth/login/route.ts#L152) · [Page guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/auth.ts#L59) · [API guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/route-context.ts#L11) · [Token issuance](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/tokens/route.ts#L36)

### R02 · P1 · Azure provisioning can change the live release before migrations pass

OpenTofu manages the app image and directs traffic to the latest ready revision. The workflow applies that configuration before migration and separately promotes the requested image through Azure CLI. A later apply can restore an environment's configured image and redirect traffic before the migration gate. The smoke check can also pass on an older healthy revision. Assign one owner to live image and traffic changes, migrate before promotion, and verify the exact requested app and worker revisions. [Deploy workflow](https://github.com/TKlerx/webapp-template/blob/64304a5/.github/workflows/deploy-azure.yml#L151) · [Traffic configuration](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/app.tf#L41) · [Smoke check](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L318) · [Azure revision behavior](https://learn.microsoft.com/en-us/azure/container-apps/revisions)

### R03 · P2 · An expired worker claim can overwrite a newer attempt

An isolated PostgreSQL check confirmed that attempt 1 could mark a job completed after attempt 2 claimed it. Completion and failure writes match only the job ID. Require the current claim or attempt identifier on both writes and renew claims for jobs that can run longer than the expiry window. [Completion write](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L46) · [Stale recovery and failure writes](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L459)

### R04 · P2 · Teams intake drops messages when provider IDs repeat across channels

Microsoft Graph guarantees uniqueness within a channel. The worker and schema treat IDs as globally unique. With two mocked channels returning distinct messages with the same ID, the worker persisted one and counted the other as a duplicate. Use a generated row ID and an atomic uniqueness constraint on team, channel, and provider message ID. [Worker intake](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L87) · [Prisma model](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L438) · [Microsoft Graph ID contract](https://learn.microsoft.com/en-us/graph/api/resources/chatmessage?view=graph-rest-1.0)

### R05 · P2 · Valid assistant conversations can outgrow the chat endpoint

The client keeps up to 24 turns per request and accepts 6,000 characters per input. The API caps the serialized body at 64 KiB. Twelve valid 6,000-character ASCII turns already exceed the cap. Budget the serialized UTF-8 payload on the client, preserving the newest prompt and trimming older context as needed. [Chat transport](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L37) · [Input limit](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L337) · [Server cap](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/assistant.ts#L96)

### R06 · P2 · Audit PDFs corrupt multilingual text and clip long details

A synthetic export confirmed both defects. The exporter writes UTF-8 bytes to a built-in Helvetica font and positions each detail as a single line. Use embedded Unicode fonts and wrap and paginate the record content. [PDF exporter](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/audit-export.ts#L128)

### R07 · P3 · CLI downloads pull unrelated checkout files into the runtime bundle

The production build emitted broad filesystem-tracing warnings and copied 653 tracked checkout files into the local standalone output. The runtime Dockerfile copies that output. Scope tracing to release assets and check the standalone file list in CI. [CLI release service](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-release-service.ts#L139) · [Runtime image](https://github.com/TKlerx/webapp-template/blob/64304a5/Dockerfile.app#L82)

### First-pass verification

All 366 application tests, 35 worker tests, Go tests and vet, TypeScript and Python quality checks, and the production build passed. Chromium passed 25 tests with two skips for Teams and live Azure voice. The browser run used directly provisioned, isolated PostgreSQL in place of Docker-only setup. npm, Python, and Go advisory checks and the tracked-tree secret scan returned zero findings. Both GitHub validation jobs passed on the reviewed revision. [GitHub Validate run](https://github.com/TKlerx/webapp-template/actions/runs/45183878110)

## Second pass

The follow-up reviewed PostgreSQL recovery, CLI authentication and audit commands, and the notification worker's delivery and intake paths at the same commit. All six findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             2 |               4 |            0 |

### R08 · P1 · A failed PostgreSQL restore can leave the target partially overwritten

The restore script validates the archive's table of contents and then runs `pg_restore --clean --if-exists` directly against the target. Individual statements can commit before another statement fails. In disposable PostgreSQL databases, a restore with the script's flags exited with an error while replacing an unrelated table's contents. Running the same restore with `--single-transaction` preserved the target row after the error. Use an atomic restore or restore and verify a separate database before switching over. A table-of-contents check should be supplemented by a test restore for recovery-critical backups. [Archive check](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/restore-postgres.sh#L43) · [Restore command](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/restore-postgres.sh#L69) · [PostgreSQL restore options](https://www.postgresql.org/docs/18/app-pgrestore.html)

### R09 · P1 · Verbose CLI login writes the issued token to stderr

Browser login enables generic verbose HTTP logging for the code exchange. The API returns the issued token in the response body and the client prints that body verbatim to stderr. This can place a usable credential in terminal captures and support or CI logs. Keep method, path, and status in verbose output and suppress credential-bearing response bodies. Add a regression that verifies the issued token is absent from diagnostics. [Browser exchange](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/auth/browser.go#L114) · [Raw response logging](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/client/client.go#L127) · [Token response](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-auth.ts#L191)

### R10 · P2 · Worker-sent email lacks the identifier required for bounce correlation

The worker sends notifications through Microsoft Graph `sendMail`, which returns an empty `202 Accepted` response. The sent-state update never populates `providerMessageId`, while inbound bounce handling requires that field to correlate the original message. Ordinary sends through this path therefore cannot be reconciled with later nondelivery reports. Persist a trusted outbound identifier that matches the message references carried by nondelivery reports. Verify the full send-to-bounce flow without prepopulating the identifier in the fixture. Report provider acceptance separately from confirmed delivery. [Send call](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/graph_mail.py#L58) · [Sent-state update](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L83) · [Bounce lookup](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L296) · [Graph sendMail response contract](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)

### R11 · P2 · Retried mailbox polls skip messages interrupted during processing

The worker commits a new inbound row as `RECEIVED` before classifying it or linking it to another record. The next poll skips any matching provider ID, regardless of processing status. In an isolated PostgreSQL check, an injected failure after insert left the message in `RECEIVED`, and the next poll counted it as a duplicate. Resume unfinished rows and make classification and its database side effects atomic or idempotent. [Duplicate check](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L150) · [Inbound insert and commit](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L140)

### R12 · P2 · Mailbox polling repeatedly reads only the newest Graph page

The mailbox client requests messages in descending receipt order with a bounded page size and discards `@odata.nextLink`. Messages past the first page can remain unseen even after every item on that page has been processed. A two-page mock confirmed that the client makes only one request. Follow validated continuation links and persist progress for large mailboxes. [Mailbox list request](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/graph_mail.py#L68) · [Graph list-message pagination](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0)

### R13 · P2 · The CLI silently returns incomplete audit exports

JSON export uses the paginated list endpoint, requests only the default 25 rows, and discards the total count. CSV export passes through the bounded server response and ignores the truncation header. A loopback mock confirmed that 26 matching entries yielded 25 JSON rows and that a flagged CSV response produced no warning. Page through the JSON results with stable ordering and report CSV truncation on stderr, or provide a paginated export contract for both formats. [CLI export command](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/audit.go#L146) · [Audit list pagination](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/audit-filters.ts#L17) · [CSV truncation header](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/audit/export/route.ts#L18)

### Second-pass verification

Ran the Go and Python worker suites. Targeted checks used disposable PostgreSQL databases for the restore and mailbox-retry behavior, a mocked Graph response for mailbox pagination, and a loopback mock for CLI exports. Credential logging and bounce correlation were verified by tracing the source and the documented provider response. No live mail was sent.

## Third pass

The follow-up reviewed credential lifecycle, assistant autosave, notification delivery recovery, and CLI release selection at the same commit. All five findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               5 |            0 |

### R14 · P2 · Reactivating a user restores access for old credentials

Deactivation changes the user status, while existing session rows and active personal access tokens retain their previous state. The authorization checks reject those credentials while the user is inactive. Once the user is reactivated, any still-valid credentials can authenticate again. This matters when an account was disabled during incident response and later returned to service. Revoke sessions and active tokens in the deactivation transaction, or invalidate them through a credential version that reactivation preserves. [Status update](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L280) · [Session check](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/auth.ts#L38) · [Token validation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L243) · [Token invalidation requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/012-openapi-and-pat/spec.md#L191)

### R15 · P2 · The password policy checks characters bcrypt can silently discard

The shared validator checks the whole password for required character classes and imposes no UTF-8 byte limit. The hasher passes the password directly to bcrypt.js, which uses only the first 72 bytes. A password can therefore satisfy the policy on input while its hashed portion fails it. Apply a consistent byte limit when setting new bcrypt passwords, or adopt a versioned password hash that accepts longer inputs. Preserve verification for existing hashes during migration and cover multibyte inputs at the boundary. [Password validator](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/auth.ts#L22) · [Hash and verification](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/password.ts#L1) · [bcrypt.js input limit](https://github.com/dcodeIO/bcrypt.js#security-considerations)

### R16 · P2 · A lost autosave response can turn the next assistant save into a false conflict

The server commits a save and increments its revision. The browser updates its revision only after reading the response. A dropped response leaves the browser retrying a revision that its own save superseded. In Chromium against the production build and isolated PostgreSQL, the first save committed, its response was dropped, and a follow-up message hit a conflict. The offered reload discarded the unsaved follow-up after confirmation. Use a save identifier or compare the persisted snapshot with the last attempted save before presenting a conflict. Keep the local follow-up available during recovery. [Client save and revision update](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/use-conversations.ts#L76) · [Server revision check](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/assistant/conversations/route.ts#L94) · [Conflict recovery](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L239)

### R17 · P2 · A worker interruption can leave an accepted notification permanently marked as sending

The worker records the background job as `COMPLETED` and commits that transaction before it updates the notification to `SENT`. A process interruption between those writes leaves the notification in `SENDING`, and the worker cannot claim the completed job again. A mocked-provider check against PostgreSQL confirmed one send call, a completed job that could no longer be claimed, and a notification still marked `SENDING`. Commit the job result and notification state together, and provide a reconciliation path for existing mismatched rows. [Worker completion order](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L496) · [Job completion commit](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L46) · [Job claim query](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L419)

### R18 · P2 · CLI downloads can serve an older artifact absent from the published checksum manifest

The installer copies every matching archive and a single checksum file. The download service chooses the lexicographically last filename per target. In a temporary release directory containing versions 1.9.0 and 1.10.0 and the 1.10.0 checksum manifest, the installed service selected 1.9.0, which had no entry in the manifest. Install and validate a single release manifest, or use semantic version ordering and verify that each selected archive has a corresponding checksum. [Release installer](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/install-cli-releases.sh#L19) · [Archive selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-release-service.ts#L84) · [Manifest read](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-release-service.ts#L166)

### Third-pass verification

The nine focused unit tests passed. Targeted checks verified the assistant save failure in Chromium, notification recovery against isolated PostgreSQL with a mocked mail provider, and release selection through the installer and service using temporary files. Account-state and bcrypt findings were verified by source review and the bcrypt.js input contract.

## Fourth pass

The follow-up reviewed PostgreSQL backup creation and retention, Teams notification routing, worker retry limits, and operational health evidence at the same commit. All five findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             1 |               4 |            0 |

### R19 · P1 · PostgreSQL backups inherit permissions that can expose the database dump

The backup script creates the directory and redirects the full database dump to a file without setting restrictive permissions. With a shell umask of `022`, the script created a dump with mode `0644`. Other local users can read it if they can traverse the directory. A real dump can contain password hashes, application records, and integration data. Set a restrictive umask before creating anything, write to an owner-only temporary file, and publish it only after verification. [Backup directory and file creation](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L22)

### R20 · P2 · Backup age pruning deletes archives outside the configured backup set

The count-based retention filter uses `BACKUP_NAME_PREFIX`, but the age-based filter deletes every old `*.dump` under `BACKUP_DIR`, including subdirectories. A scratch-directory run removed a synthetic archive with another project's prefix even though count pruning was disabled. Limit both retention passes to archives owned by the same backup set. [Age and count pruning](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L49)

### R21 · P2 · Disabling an email event suppresses Teams delivery

The notification service returns before it queues any Teams jobs when the email event is disabled or has no recipients. In isolated PostgreSQL, a supported event produced zero Teams messages with email disabled and one with email enabled, while Teams sending and its target stayed enabled throughout. This conflicts with the requirement for independent controls. Create the shared event and evaluate each delivery channel under its own settings. [Email configuration guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/notifications/service.ts#L190) · [Teams enqueue](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/notifications/service.ts#L274) · [Independence requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/015-teams-messaging-skeleton/spec.md#L70)

### R22 · P2 · Expired worker claims bypass the configured retry limit

The normal failure path checks the configured attempt limit. Stale-claim recovery returns an expired job to `PENDING` regardless of its attempt count, and the claim query will pick it up again. A PostgreSQL check claimed a Teams job four times under a three-attempt limit and found it eligible for another claim after expiry. Apply the attempt budget during recovery and persist terminal failure and the corresponding delivery outcome when the budget is exhausted. [Claim query](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L419) · [Stale-claim recovery](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L459) · [Attempt cap](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/config.py#L24)

### R23 · P2 · Maintenance can make old worker activity look recent

The Ops Health snapshot uses a terminal job's `updatedAt` to decide whether a worker recently ran. The historical payload cleanup updates that timestamp without executing a job. With a three-day-old completed job and no worker process running, the snapshot changed from `unknown` to `healthy` after cleanup. Use the worker's recorded `finishedAt` as evidence and leave the worker status unknown when no recent completion or terminal failure exists. [Worker evidence query](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/ops-health.ts#L222) · [Maintenance update](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/background-jobs.ts#L173) · [Job timestamps](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L269)

### Fourth-pass verification

All 25 focused Vitest tests and all 35 Python worker tests passed. Targeted checks confirmed backup permissions and retention with synthetic archives and a stubbed Docker command. Checks for Teams routing, retry limits, and health reporting used isolated PostgreSQL. The Teams check inspected queued messages.

## Fifth pass

This pass covered Teams poll isolation, API-to-worker validation, audit filters and role history, and CLI argument handling at the same commit. All five findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            2 |

### R24 · P2 · One unavailable Teams channel blocks polling of later channels

The worker polls active subscriptions in creation order. An error from a channel's Graph request exits the entire poll job. Every retry starts with the same ordering, so a persistent permission failure can keep later, healthy channels from being read. In isolated PostgreSQL with two subscriptions and a mocked Graph client, two poll attempts contacted only the first channel and left the healthy channel's last-polled time unset. Poll each subscription independently and record per-channel outcomes so administrators can identify the failing channel. [Subscription order](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L348) · [Poll loop](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L70)

### R25 · P2 · The job API accepts delivery requests the worker will always reject

Job creation accepts any JSON payload for an allowed type, while the worker requires specific fields for delivery jobs. An empty notification delivery payload was persisted as `PENDING` by the application service, then rejected by the worker for five missing fields before any provider call. The generic failure path can spend retries on the same invalid payload. Enforce job-specific contracts before persistence for delivery jobs and preserve the existing arbitrary JSON contract for job types that support it. [API body schema](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/background-jobs/route.ts#L6) · [Persistence checks](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/background-jobs.ts#L115) · [Worker payload contract](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/contracts.py#L6) · [Worker failure handling](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L506)

### R26 · P3 · Invalid audit date filters reach Prisma and fail as server errors

The shared audit filter parser constructs dates without checking validity. Both the list and CSV-export service calls threw a Prisma validation error after their parsers accepted an invalid date. The handlers allow that query failure to propagate. Validate each supplied date at the filter boundary and return a clear `400` for malformed or reversed ranges. [Shared date parser](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/audit-filters.ts#L52) · [Audit list handler](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/audit/route.ts#L12) · [Audit export handler](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/audit/export/route.ts#L13)

### R27 · P3 · A malformed server URL crashes CLI browser login

Browser login discards the URL parsing error and dereferences the parsed URL. The compiled CLI panicked on malformed local server configuration instead of returning a configuration error. Parse and validate the server URL before opening the loopback listener or attempting to launch a browser. [CLI login input](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/login.go#L21) · [Authorization URL construction](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/auth/browser.go#L104)

### R28 · P2 · Concurrent role changes can record the wrong previous role

The role-change transaction re-reads the target before updating it, but the audit record and notification use the role from an earlier read outside the transaction. If another admin commits a role change between those reads, the second action records a transition from a role the user no longer held. Return the previous and new roles from the successful transaction and use those values for audit and notification records. [Pre-transaction read](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L174) · [Transactional re-read](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L334) · [Audit and notification writes](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L373)

### Fifth-pass verification

All 26 focused Vitest tests, 35 Python worker tests, and the Go test suite passed. Targeted checks used isolated PostgreSQL for Teams polling, job validation, and audit dates, and a temporary configuration directory for CLI login. The role-history finding was verified by tracing the two reads and their consumers. No live messages were sent.

## Sixth pass

This pass covered Compose runtime wiring, PostgreSQL restore safeguards, concurrent Teams settings, and credential lifecycle behavior at the same commit. All six findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             1 |               4 |            1 |

### R29 · P2 · The Compose app cannot see CLI archives installed on the host

The app points at `/app/cli-releases` by default. Compose mounts the host release directory on the migration container only, and the build context excludes the default host artifacts. The download routes therefore cannot see archives installed by the documented deploy workflow. Mount the release directory read-only on the app service and keep the configured path aligned with the mount destination. [App release directory](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L49) · [Migration mount](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L103) · [App mounts](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L132) · [Build exclusions](https://github.com/TKlerx/webapp-template/blob/64304a5/.dockerignore#L21)

### R30 · P1 · Restore proceeds when Compose fails to stop the app and worker

The restore script discards the service-stop error and immediately invokes `pg_restore --clean`. If the app or worker remains online, it can continue operating while tables are being replaced. A stubbed Compose command returned a stop failure, and the script still invoked restore and reported success. Make the stop step a hard gate and verify that the intended services are quiescent before restoring. [Restore stop and overwrite steps](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/restore-postgres.sh#L69)

### R31 · P2 · Compose does not pass assistant settings to the app

The assistant requires server-side `AZURE_OPENAI_*` settings, but the app's Compose environment allowlist includes none of them. The wrapper's `--env-file` options make values available for Compose interpolation. An app environment entry or service-level env file is still required to inject those values. As a result, adding the documented settings to the usual Compose environment files leaves chat and voice unconfigured. Pass the supported settings explicitly to the app and document how to supply the API key or workload identity. [Compose wrapper](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/docker-compose.mjs#L15) · [App environment allowlist](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L40) · [Assistant configuration guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/assistant.ts#L17) · [Docker container environment rules](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)

### R32 · P2 · Concurrent Teams switches can undo each other's emergency disable

The API accepts partial settings updates, but the service reads the current row and writes both flags, supplying the previous value for an omitted flag. In isolated PostgreSQL, two successful concurrent requests to disable different flags left sending enabled and intake disabled. Update only fields explicitly supplied by the caller so separate switches can change independently. [Optional flags in the API](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/integrations/teams/route.ts#L10) · [Read-and-write implementation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/teams/admin.ts#L37) · [Emergency controls requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/015-teams-messaging-skeleton/spec.md#L79)

### R33 · P2 · Token renewal can raise the active-token count above its limit

Creation excludes expired tokens from the active-token count. Renewal checks for revocation and rewrites the expiry without requiring the token to be unexpired or checking whether a slot is available. The API can therefore return an expired token record to the active set even when the account is already at its cap. The UI already offers renewal only for unexpired active tokens. Enforce that same rule atomically in the renewal write, or apply the quota transactionally if expired-token renewal is intended. [Active-token count and creation guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L155) · [Renewal guard and update](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L354) · [UI eligibility](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-list.tsx#L317)

### R34 · P3 · CLI logout persists a temporary server override

Logout loads the effective configuration with environment overrides applied, blanks the token, and saves the full configuration. Running the compiled CLI with a temporary `STARTERCTL_SERVER_URL` replaced the saved server URL in a scratch config. A later login can therefore target a different environment after the override is removed. Read the persisted configuration for logout and update its token independently of the effective runtime settings. [Logout save](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/logout.go#L16) · [Configuration load](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/config/config.go#L40) · [Environment overrides](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/config/config.go#L87)

### Sixth-pass verification

All 46 focused Vitest tests and the Go test suite passed. The Compose findings were verified against the parsed YAML, image build exclusions, and the documented environment rules. No containers were launched. The restore check used a stubbed Docker command and a synthetic archive. Teams concurrency used isolated PostgreSQL. CLI logout used a scratch configuration. The token renewal finding was verified by source review.

## Seventh pass

This pass covered Azure migration startup, database role provisioning and seeding, overlapping Teams poll scheduling, and CLI version reporting at the same commit. All five findings are high confidence.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             1 |               3 |            1 |

### R35 · P1 · The Azure migration job points to a Prisma config the image does not contain

The Azure job sets `PRISMA_CONFIG_PATH=prisma.config.postgres.ts` and also passes that filename to `prisma migrate deploy`. The migration image copies only `prisma.config.ts`. The workflow selects an image and starts the job without replacing the configured command. The local pre-deploy check failed with the job's configured path and passed with the shipped config against the same test database. Align the job's pre-deploy and migration commands with the packaged config and validate the actual job command in CI. [Azure job command and environment](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/job.tf#L69) · [Migration image contents](https://github.com/TKlerx/webapp-template/blob/64304a5/Dockerfile.app#L57) · [Workflow job start](https://github.com/TKlerx/webapp-template/blob/64304a5/.github/workflows/deploy-azure.yml#L184)

### R36 · P2 · The provisioned worker role can access authentication and audit tables

The Azure bootstrap gives both runtime roles read and write privileges on all public tables and applies the same policy to tables subsequently created by the migration role. PostgreSQL privilege checks after running the bootstrap in an isolated cluster confirmed that the worker role could read the account table and held write privileges on sessions, audit records, and migration history. These grants expand the impact of a worker credential compromise. Provision explicit table and operation grants per runtime and remove excessive grants from existing roles. Add a database-level privilege check covering the excluded tables. [Runtime grants](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/postgres-provision-roles.mjs#L57) · [App and worker provisioning](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/postgres-provision-roles.mjs#L89) · [Database credential boundary](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/016-runtime-credential-separation/spec.md#L30)

### R37 · P2 · Initial admin seed succeeds with no active platform admin

Both seed entry points skip seeding once they find any platform admin role. They ignore account status. In a disposable database with one inactive platform admin and no active admin, both seed commands exited successfully and left the database without an active administrator. This can leave a restored or imported environment inaccessible to admins. Require an active administrator before treating an existing database as bootstrapped and fail with an explicit recovery message when none exists. [Container seed](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/seed-initial-admin.mjs#L49) · [Prisma seed](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/seed.ts#L54)

### R38 · P2 · Concurrent workers can both schedule the same Teams intake poll

Each worker checks for pending or in-progress polling jobs and then inserts a new job in a separate statement. The check has no database-enforced singleton. Two scheduler calls against isolated PostgreSQL both returned success and left two pending poll jobs after reaching the insert concurrently. This can occur when more than one worker replica is configured. Use an atomic enqueue backed by a database constraint or lock and verify that concurrent calls yield one pending or in-progress poll. [Scheduler call](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L468) · [Check and insert](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L363) · [Worker replicas](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/worker.tf#L35)

### R39 · P3 · The CLI looks for server version in the health response

Both `starterctl version` and `starterctl health` decode a version from `/api/health`, whose response has no version field. The actual metadata is served by `/api/version`. In a loopback check using the current response shapes, the version command omitted the server version and the health command returned an empty version in JSON. Read server version from the dedicated endpoint and define how the CLI surfaces unavailable metadata. [CLI version command](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/version.go#L28) · [CLI health command](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/health.go#L12) · [Health response](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/health/route.ts#L16) · [Version endpoint](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/version/route.ts#L1)

### Seventh-pass verification

All 10 focused Vitest tests, all 35 worker tests, and the Go suite passed. Targeted checks used isolated PostgreSQL for the migration path, privilege metadata, seed status, and poll scheduling. The CLI version check used a loopback mock. The Azure migration finding was verified against the shipped job command and image contents, with the failing and working Prisma config paths tested locally.

## Eighth pass

This pass reviewed OAuth callback construction, Azure SSO provisioning, Graph mail query and identity handling, and CLI update notices at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            2 |

### R40 · P2 · Teams consent duplicates the deployment base path in its callback URL

The Teams consent helper appends the configured base path to `AUTH_BASE_URL` even when the URL already contains it. The Docker example provides the path in both settings, and Azure builds the same URL shape for deployments under a subpath. Passing the example settings to the callback helper produced `/webapp-template/webapp-template/api/integrations/teams/consent/callback`. Entra receives a redirect URI that differs from the app's actual callback. Normalize the public URL once and test the consent request with both root and subpath deployments. [URL construction](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/azure-auth.ts#L17) · [Consent redirect URI](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/teams/consent.ts#L95) · [Docker settings](https://github.com/TKlerx/webapp-template/blob/64304a5/.env.docker.example#L13) · [Azure URL configuration](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/locals.tf#L4) · [Redirect contract](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/base/auth-and-rbac.md#L136)

### R41 · P2 · Both Graph mail clients build an invalid unread-message query

When `unreadOnly` is enabled, both clients send `$orderby=receivedDateTime DESC` with `$filter=isRead eq false`. Graph requires the ordering property to appear first in the filter and documents an `InefficientFilter` error when that rule is violated. Request captures confirmed the invalid combination in both clients, including the TypeScript call shown in the mail guide. Use a Graph-compatible filter that preserves receipt ordering, or remove the ordering from the unread query if the caller does not require it. Assert the resulting request in both clients' tests. [TypeScript request](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/mail/graph.ts#L186) · [Python request](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/graph_mail.py#L68) · [Mail guide example](https://github.com/TKlerx/webapp-template/blob/64304a5/docs/mail.md#L47) · [Graph query rules](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0)

### R42 · P2 · Moving a mailbox message can make the worker ingest it twice

Graph's default Outlook message ID can change when an item moves to another folder. The worker does not request immutable IDs and deduplicates solely by the returned Graph ID. Two mocked polls of the same underlying message before and after a simulated move each counted it as new, and isolated PostgreSQL held two inbound rows with the same Internet message ID. This can duplicate stored mail and processing if the moved item appears in a later poll. Request immutable IDs consistently during listing and retrieval, and reconcile previously stored IDs when rolling out the change. [Worker request headers](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/graph_mail.py#L179) · [Deduplication check](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L150) · [Database key](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L339) · [Graph immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id)

### R43 · P3 · Azure provisioning ties Microsoft SSO to Teams

With `enable_teams=false`, the OpenTofu configuration discards the supplied Entra identity values when building Key Vault secrets and omits the corresponding app environment entries. The Microsoft sign-in route requires all three values and redirects to the SSO configuration error when they are missing. Operators who want Microsoft sign-in without Teams therefore need to change the provisioned configuration. Give app SSO its own provisioning condition and retain the Teams condition for worker access to the shared credential. [Key Vault construction](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/secrets/main.tf#L39) · [App environment](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/app.tf#L123) · [SSO configuration check](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/auth/sso/azure/route.ts#L124) · [Shared credential purpose](https://github.com/TKlerx/webapp-template/blob/64304a5/docs/runtime-credentials.md#L28)

### R44 · P3 · The CLI can announce an older release as an update

The update checker treats any nonempty, unequal version as newer. A focused Go check passed installed version `2.0.0` and remote version `1.9.0` to the formatter and received an update notice for `1.9.0`. The tag normalizer also strips `cli-v` while the release workflow is triggered by `starterctl-v*` tags. Normalize the supported tag formats and compare parsed semantic versions before displaying the notice. [Update comparison and tag parsing](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/update/check.go#L114) · [CLI release workflow](https://github.com/TKlerx/webapp-template/blob/64304a5/.github/workflows/cli-release.yml#L3)

### Eighth-pass verification

All 14 focused Vitest tests, all 35 Python worker tests, and the Go suite passed. Targeted checks captured the generated Teams callback, both unread-mail requests, duplicate ingestion in isolated PostgreSQL, and the CLI update notice. The SSO provisioning finding came from tracing the OpenTofu configuration to the app's sign-in guard. Provider behavior was checked against Microsoft documentation and mocks.

## Ninth pass

This pass reviewed background-job maintenance, the Compose deployment environment, infrastructure plan cleanup, and CLI installation and output at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            2 |

### R45 · P2 · Background-job cleanup can overwrite a newly completed job's result

The cleanup reads each job's payload, result, and error, then writes all three back by ID whenever any of them needs redaction. It scans active jobs as well as historical jobs. In isolated PostgreSQL, a job completed after the cleanup read and recorded a result. Cleanup redacted the payload and restored the stale null result, leaving the job marked completed with no result. Restrict maintenance to eligible terminal rows and update changed fields with a condition that detects concurrent writes. [Cleanup read and write](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/background-jobs.ts#L158) · [Worker completion write](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L46)

### R46 · P2 · The deploy script skips the documented `.env.docker` layer

The README directs operators to put Docker-only values in `.env.docker`. The usual `pnpm docker` wrapper loads it after `.env`, but `scripts/deploy.sh` and its backup subprocess invoke Compose without those file arguments. A command capture confirmed that the wrapper passes both files and the deploy script passes neither. With only the documented Docker-only variables configured, the deploy can fail at its first Compose call because `POSTGRES_PASSWORD` is missing from interpolation. If both files specify a value, the deploy can use different database settings from the wrapper. Centralize Compose invocation for startup, deploy, and backup so they agree on the target and environment. [Docker setup instructions](https://github.com/TKlerx/webapp-template/blob/64304a5/README.md#L251) · [Wrapper layering](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/docker-compose.mjs#L15) · [Deploy and backup calls](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/deploy.sh#L27) · [Backup Compose invocation](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L26) · [Required database setting](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L89) · [Compose interpolation rules](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

### R47 · P2 · CLI installers can replace a working release with a manifest alone

Both installers count `checksums.txt` as an artifact and publish the staged directory when the count is greater than zero. In scratch directories, both the shell and PowerShell installers accepted a source containing only a checksum file, removed the previously available archive, and reported success. Validate the staged archive set and its checksums before replacing the installed release, and preserve the current release if publication fails. [Shell installer](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/install-cli-releases.sh#L19) · [PowerShell installer](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/install-cli-releases.ps1#L32)

### R48 · P3 · An OpenTofu subprocess failure leaves temporary plan files behind

The plan helper copies the infrastructure directory and writes a plan into a temporary directory. Its error handlers call `process.exit()` before the enclosing `finally` can remove that directory. A stubbed successful `plan` followed by a failed `show` left the synthetic plan and copied inputs on disk. Real saved plans can contain sensitive values, including inputs used for Key Vault secrets. Propagate subprocess failures as exceptions and let the command entry point exit after cleanup. [Plan staging and cleanup](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/infra-plan-lib.mjs#L6) · [Subprocess error handlers](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/infra-plan-lib.mjs#L57) · [Key Vault secret resources](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/secrets/main.tf#L89) · [OpenTofu saved plan behavior](https://opentofu.org/docs/cli/commands/plan/)

### R49 · P3 · CLI job creation ignores the requested JSON output format

The CLI exposes `--format` as a global option and the user guide recommends JSON for scripts. The job creation command writes a plain-text confirmation on every successful response. Against a loopback server returning HTTP 201 and a job record, the compiled CLI exited successfully with `--format json` but printed `Created job job-fixture (PENDING)`. Scripts that parse stdout can report failure after the job has already been queued. Render the creation response through the shared formatter and test the JSON output. [Global format flag](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/root.go#L43) · [Job creation response](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/jobs.go#L111) · [Scripting guidance](https://github.com/TKlerx/webapp-template/blob/64304a5/docs/cli-user-guide.md#L357)

### Ninth-pass verification

All 23 focused Vitest tests and the Go suite passed. Targeted checks confirmed the maintenance race in isolated PostgreSQL, exercised both CLI installers in scratch directories, and ran the compiled CLI against a loopback server. The Compose and OpenTofu checks used command stubs and synthetic inputs. No real containers or cloud resources were changed.

## Tenth pass

This pass reviewed audit pagination, the browser login timeline, user administration guards, and Ops Health deployment identity at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               2 |            3 |

### R50 · P2 · The audit viewer stops at the first 25 matching records

The audit list endpoint returns the page number, limit, and total. The viewer reads only the returned rows and offers no way to request the next page. With 26 matching entries in isolated PostgreSQL, the default query returned 25 rows and a total of 26. An administrator investigating older entries in a busy audit history can miss records that match the current filters. Add pagination controls driven by the returned total and reset the current page when filters change. Keep ordering deterministic across pages. [Viewer query and response handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/audit/AuditTrailViewer.tsx#L30) · [Default page size](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/audit-filters.ts#L17) · [API pagination metadata](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/audit/route.ts#L17)

### R51 · P2 · CLI browser approval can expire while the CLI is still waiting

The authorize endpoint creates the 60-second code and gives the approval cookie the same expiry before redirecting the browser to sign in. The approval page rejects the expired request, although the CLI waits up to 120 seconds for a callback. In a database-backed check, the pending request was available immediately and unavailable after 61 simulated seconds. A user who takes longer than a minute to finish signing in or approving the request must restart. Give the pending browser request its own lifetime and start the short, single-use exchange window when approval succeeds. [Request and cookie creation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/cli-auth/authorize/route.ts#L81) · [Code expiration](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-auth.ts#L14) · [Approval page](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/cli-login/page.tsx#L39) · [CLI wait](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/auth/browser.go#L22) · [Short-lived exchange requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/012-openapi-and-pat/spec.md#L166)

### R52 · P3 · The last-admin guard blocks demotion of an inactive administrator

The guard checks whether the target has the platform admin role, then counts active admins without first checking whether the target is in that count. With one active admin in isolated PostgreSQL, the guard rejected demotion of an inactive administrator with HTTP 400 even though the change would leave the active admin in place. Apply the count check only when the target currently holds an active platform admin role and the proposed update would remove them from the active set. [Last-admin guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L193) · [Transactional role update](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L336)

### R53 · P3 · Concurrent creation of the same user bypasses the duplicate-email response

The user service returns HTTP 409 when its initial email lookup finds an account. A competing request can insert the account between that lookup and the create operation. With both lookups completed before either write in isolated PostgreSQL, one request created the account and the other threw an unhandled Prisma unique-constraint error. A later duplicate attempt returned the expected 409. Map a unique-email violation from the insert to the same conflict response. [Lookup and insert](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L96) · [Route response handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/users/route.ts#L49) · [Unique email field](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L105)

### R54 · P3 · Ops Health substitutes local and package labels for missing deployment metadata

The Ops Health identity uses the shared version helper, which substitutes `local` when the deployment environment is unset and the package version when the deployed app version is unset. With deployment metadata removed from the process environment, the identity showed `local` and `v1.0.0` while revision and build fields showed `unknown`. The dashboard specification calls for missing deployment values to be labeled unknown. Preserve the fallback labels where they are useful and carry the source of those values into Ops Health so its identity and copied diagnostics distinguish recorded deployment data from defaults. [Shared version fallbacks](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/app-version.ts#L18) · [Ops identity mapping](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/ops-health.ts#L61) · [Metadata requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/021-ops-health-dashboard/spec.md#L83)

### Tenth-pass verification

All 46 focused Vitest tests passed. Targeted checks used isolated PostgreSQL for the audit page size, duplicate creation, last-admin guard, and simulated browser approval expiry. The audit viewer controls and CLI wait duration were verified from source. The Ops Health metadata check used a local process with deployment variables unset.

## Eleventh pass

This pass reviewed password change and token creation, the assistant voice interruption flow, and CLI configuration writes at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            1 |

### R55 · P2 · A password change can commit while other sessions remain active

The service commits the new hash and clears the forced-change flag before revoking other sessions. If revocation throws, the request fails after the password has changed and before the audit entry is written. In isolated PostgreSQL with a simulated revocation failure, the new password verified successfully, the existing session row remained, and no password-change audit entry was recorded. A retry with the original password can no longer complete revocation. Commit password changes and session invalidation together where supported, with durable completion tracking if they must use separate operations. [Password transaction and session revocation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/auth.ts#L61) · [Session revocation requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/base/auth-and-rbac.md#L37)

### R56 · P2 · Interrupting a voice tool can leave the composer stuck in its busy state

After an interruption, a response completion event can report the session as busy because the tool request is still pending. When that request settles, the queue decrements its counter and tries to resume. An interrupted turn has no response to resume, so the busy state is never refreshed. A mocked realtime session reproduced a stale busy flag after the tool finished, even though the voice transport could already accept another typed turn. The composer uses that flag to block submission and show the stop control. Recompute the exposed state when the tool request settles, including when its turn was interrupted. [Interruption and busy-state calculation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/realtime-voice.ts#L76) · [Response completion](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/realtime-voice.ts#L252) · [Tool queue completion](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/realtime-voice.ts#L283) · [Composer submission guard](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L320)

### R57 · P2 · A failed CLI config write can destroy the existing configuration

The CLI truncates the existing config before writing its replacement. A compiled `starterctl logout` run against a scratch config under a file-size limit exited with an error and left a zero-byte config file. Subsequent commands cannot decode that file, so the write failure also removes access to the saved server settings. Write the replacement to a private temporary file in the same directory, check the write and close, and replace the original only after the replacement is complete. [Config loading and saving](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/config/config.go#L40) · [Logout save](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/logout.go#L16)

### R58 · P3 · Concurrent token creation bypasses the duplicate-name response

The duplicate-name check runs before the serializable transaction. In isolated PostgreSQL, two requests with the same name both passed that check. One created the token and the other threw an unhandled Prisma unique-constraint error. A subsequent duplicate attempt returned the expected HTTP 409. Map the insert's name constraint violation to the same conflict response as the initial check. [Duplicate-name check](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L127) · [Token insert and error handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L153) · [Name uniqueness constraint](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L248) · [API response handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/tokens/route.ts#L59)

### Eleventh-pass verification

All 24 focused Vitest tests and the Go suite passed. Targeted checks used isolated PostgreSQL for password and token writes, a simulated session revocation failure, mocked browser and provider events for voice, and a scratch CLI config with an imposed file-size limit.

## Twelfth pass

This pass reviewed notification locale handling, the Azure smoke command's HTTP and CLI checks, and worker interval validation at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            1 |

### R59 · P2 · Changing the interface language leaves notification emails in the previous language

The language menu calls the locale endpoint, which writes a browser cookie. Notification rendering uses the recipient's stored user locale, which defaults to English. In an isolated PostgreSQL check, setting German returned the German cookie, while the user row and the next queued email both remained English. This breaks the notification requirement to use the recipient's preferred language. Persist authenticated users' language selections to their profiles and retain cookie-based selection for anonymous browsing. [Language menu](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/ui/UserMenu.tsx#L69) · [Locale endpoint](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/locale/route.ts#L22) · [Recipient locale](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/notifications/service.ts#L284) · [Notification language requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/014-shared-mailbox-notifications/spec.md#L84)

### R60 · P2 · The deployment smoke check can pass a redirected health URL

The smoke command follows redirects and checks the final response while reporting the original target URL. A loopback server returned HTTP 302 for the configured base path and a healthy HTTP 200 under a different path. The command reported that the configured URL passed. This can hide a routing or base-path error even when the expected deployment revision is active. Require the target URL itself to return the contracted health response, or explicitly validate an approved redirect and report where the check landed. [Health response rule](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/020-deploy-smoke-verification/contracts/smoke-cli.md#L25) · [Pass criteria and reported target](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L249) · [HTTP runner](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L422)

### R61 · P2 · Azure CLI smoke checks ignore the configured per-check timeout

The documented timeout is applied to the health request only. The migration and revision checks call the Azure CLI runner without a process timeout. With `--timeout-seconds 1` and a stubbed migration command that took about 1.3 seconds, smoke verification still reported success. A stuck Azure CLI call can hold up the deployment until something outside the smoke command terminates it. Enforce the configured deadline across each check's subprocess calls and report timeout as a check failure. [Per-check timeout contract](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/020-deploy-smoke-verification/contracts/smoke-cli.md#L22) · [Health timeout](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L249) · [Azure CLI runner](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L440)

### R62 · P3 · The worker accepts an infinite poll interval and crashes when it becomes idle

The poll interval validator enforces positivity but accepts `WORKER_POLL_INTERVAL_SECONDS=inf`. The worker passes the accepted value to `time.sleep` when no job is ready. A check using the worker's locked Python environment confirmed that configuration loads successfully and sleeping with the resulting value raises `OverflowError`. Reject non-finite durations during startup validation so operators get a configuration error before jobs are claimed. [Worker interval validation](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/config.py#L13) · [Idle sleep](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L482)

### Twelfth-pass verification

All 19 focused Vitest tests and all 35 Python worker tests passed. Targeted checks used isolated PostgreSQL for notification locale, a loopback HTTP server and stubbed Azure CLI for the smoke command, and the locked Python runtime for interval validation. The notification check inspected a queued message and the smoke check used synthetic Azure responses.

## Thirteenth pass

This pass reviewed the published OpenAPI contract, local browser-test database provisioning, proxy request logging, and the staged text check at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               2 |            3 |

### R63 · P2 · The OpenAPI document omits required IDs for five token operations

Five token revoke, renew, and delete operations use `{id}` in the URL without declaring a required `id` path parameter at either the path or operation level. A parsed-YAML check confirmed the omission on all five operations. This violates the OpenAPI path-templating contract and can prevent client generation or leave generated operations without the argument they need. Add the path parameters and validate the served document with a semantic OpenAPI check. [Token operation definitions](https://github.com/TKlerx/webapp-template/blob/64304a5/public/openapi.yaml#L191) · [Admin token operation definitions](https://github.com/TKlerx/webapp-template/blob/64304a5/public/openapi.yaml#L222) · [OpenAPI path-templating rules](https://spec.openapis.org/oas/v3.1.0.html#path-templating)

### R64 · P2 · The published OpenAPI server URL can disagree with the deployed base path

Next.js configuration trims whitespace, inserts a leading slash, and removes trailing slashes from `BASE_PATH`. The OpenAPI route substitutes the raw environment value. In a focused check with `BASE_PATH` set to `starter/`, the routing configuration was `/starter` while the served YAML contained the relative URL `starter/`. An OpenAPI client can resolve that URL relative to the document and send requests to the wrong path. Publish the same normalized value that controls routing and cover both root deployments and accepted noncanonical inputs. [Routing normalization](https://github.com/TKlerx/webapp-template/blob/64304a5/next.config.ts#L4) · [Server URL substitution](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/openapi/route.ts#L11) · [OpenAPI server URL rules](https://spec.openapis.org/oas/v3.1.0.html#server-object)

### R65 · P3 · Default local Playwright runs leave individual test databases behind

Without `TEST_DATABASE_URL`, each Playwright invocation selects a fresh timestamped database in the named PostgreSQL container. Global setup calls the provisioner, which creates missing databases and applies migrations. There is no teardown for the databases owned by these runs. Two independent config loads selected different database names and showed no teardown configured. Repeated local runs therefore accumulate databases and test records. Track ownership of generated databases and add a teardown or a bounded retention policy that preserves explicitly supplied test databases. [Per-run database name and setup registration](https://github.com/TKlerx/webapp-template/blob/64304a5/playwright.config.ts#L7) · [Global setup](https://github.com/TKlerx/webapp-template/blob/64304a5/tests/e2e/global.setup.ts#L6) · [Database creation](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/ensure-e2e-db.mjs#L122)

### R66 · P3 · Proxy-generated redirects skip completion logging and request IDs

The proxy emits completion logs and sets the response request ID only from the pass-through response builder. Early redirects return directly, including redirects for missing sessions, inactive users, and pending approval. With logging enabled, a direct proxy check returned HTTP 307 for an unauthenticated dashboard request with neither a completion log nor an `x-request-id` response header. The public login request emitted the expected log and header. Finalize all proxy responses through a shared path that records the actual proxy status and elapsed handling time. [Pass-through logging and request ID](https://github.com/TKlerx/webapp-template/blob/64304a5/src/proxy.ts#L45) · [Authentication redirects](https://github.com/TKlerx/webapp-template/blob/64304a5/src/proxy.ts#L138) · [Logging requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/019-logging-standardization/spec.md#L96)

### R67 · P3 · The staged text check skips UTF-16 text files

The pre-commit text checker classifies any staged blob containing a zero byte as binary and skips it before decoding. A staged UTF-16 Markdown fixture with a BOM and CRLF line ending passed the check in a scratch Git repository. Apply strict text validation to known text file types or Git-classified text before using a binary-content heuristic. [Binary heuristic](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/check-text-conventions.mjs#L27) · [Staged validation loop](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/check-text-conventions.mjs#L61) · [Pre-commit hook](https://github.com/TKlerx/webapp-template/blob/64304a5/.githooks/pre-commit#L7) · [Repository text convention](https://github.com/TKlerx/webapp-template/blob/64304a5/AGENTS.md#L43)

### Thirteenth-pass verification

All nine existing focused Vitest tests and one temporary OpenAPI diagnostic test passed. Targeted checks parsed the YAML against the OpenAPI path-parameter rule, invoked the proxy directly, loaded the Playwright configuration twice, and ran the staged text checker in a scratch repository. The browser-test database lifecycle finding was verified from configuration and provisioning code. No browser suite or database provisioning ran during this pass.

## Fourteenth pass

This pass reviewed restore retention, assistant autosave across page reloads, container admin seeding, and CLI output handling at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            2 |

### R68 · P2 · The pre-restore safety backup can prune the archive selected for restoration

The restore script validates its input, runs the ordinary backup script, stops the app and worker, then opens the selected archive again. The safety backup runs normal retention against the same directory. With a retention count of one in a scratch directory, the safety dump pruned the valid selected archive. Restore then reached the service-stop step and failed because the input file was gone. Protect the selected archive from retention for the duration of the restore and verify that it can still be opened before stopping services. [Restore sequencing](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/restore-postgres.sh#L62) · [Backup retention](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L49)

### R69 · P2 · Reloading before assistant autosave can discard a submitted turn

Conversation autosave waits 500 milliseconds after a change. The assistant flushes pending history on panel close and before switching conversations, but has no flush or recovery path for a full page reload. In Chromium against the existing production build and isolated PostgreSQL, a submitted turn was visible before reload, no save request had been sent, and reopening the same conversation after reload returned its previous empty history. Give submitted turns a persistence path before the debounce window can discard them, or recover pending changes after a reload while respecting revision checks. [Debounced save](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/use-conversations.ts#L134) · [Panel-close flush](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L128) · [Existing reload coverage waits for the save](https://github.com/TKlerx/webapp-template/blob/64304a5/tests/e2e/assistant-history.spec.ts#L62)

### R70 · P2 · The container seeder can create an initial administrator who cannot sign in

The container seed script lowercases `INITIAL_ADMIN_EMAIL` and stores it without trimming. Login trims the submitted email before looking up the account. In isolated PostgreSQL, the container seed succeeded with surrounding spaces on the configured email and stored those spaces on the initial account. The login lookup cannot address the stored value. Apply the same normalization in both seed entry points and reject an empty value after normalization. [Container seed input](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/seed-initial-admin.mjs#L18) · [Prisma seed normalization](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/seed.ts#L31) · [Login request schema](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/auth/login/route.ts#L25)

### R71 · P3 · CLI health drops the structured report when the server is degraded

The health endpoint sends HTTP 503 with structured process and database checks when PostgreSQL is unavailable. The shared CLI client returns an error before the health command can render that payload. A loopback check with `starterctl health --format json` exited nonzero, emitted the body on stderr, and left stdout empty. The healthy-response decoder also omits the process check. Decode and render the health payload for both healthy and degraded responses, retain both checks, and keep a failure exit status for degradation. [Server health response](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/health/route.ts#L10) · [CLI transport status handling](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/client/client.go#L134) · [CLI health formatter](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/health.go#L12) · [CLI health requirements](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/013-cli-client/spec.md#L131)

### R72 · P3 · An explicit CLI table format becomes JSON when stdout is redirected

The shared formatter treats explicit `table` and an unspecified format the same, resolving both to JSON for non-interactive output. The compiled CLI emitted JSON for `users list --format table` with captured stdout. Callers cannot request a plain table in a redirected file or pipe. Apply terminal detection only to the automatic format selection and disable interactive styling independently of the selected format. [Global format flag](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/root.go#L43) · [Shared format resolution](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/output/format.go#L67) · [CLI output requirements](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/013-cli-client/spec.md#L158)

### Fourteenth-pass verification

All 19 focused Vitest tests and the Go suite passed. Targeted checks used Chromium with a mocked assistant response against the existing production build, isolated PostgreSQL for conversation and seed data, synthetic archives and stubbed Docker for restore, and a loopback HTTP server for the CLI.

## Fifteenth pass

This pass reviewed Compose migration commands, backup archive publication, theme preference state, and failure handling in user management at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             1 |               1 |            2 |

### R73 · P1 · Compose deploy and restore invoke a package manager removed from the migration image

The Compose migration service uses the `migrate-runner` image, which removes `pnpm` and the Corepack cache. Both the deploy and restore scripts override the service command and invoke `pnpm exec prisma migrate deploy`. With Docker stubbed to execute the extracted command without `pnpm`, both scripts exited with status 127 at that step. Restore reaches this failure after stopping the app and worker and running `pg_restore`, so the runtime restart is skipped. Use the installed Prisma executable, as the regular Compose migration command already does, and verify both script entry points against the migration image. [Compose migration-image target](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L14) · [Image contents](https://github.com/TKlerx/webapp-template/blob/64304a5/Dockerfile.app#L57) · [Deploy command](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/deploy.sh#L80) · [Restore command and restart](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/restore-postgres.sh#L69) · [Regular Compose migration command](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L124)

### R74 · P2 · A second backup in the same second can destroy an existing archive

The backup filename is based on a timestamp with one-second precision, and shell redirection opens the final path before `pg_dump` runs. Two invocations in the same directory with the same prefix can therefore target the same file. With a fixed clock and synthetic dump output, the first invocation published a nonempty archive. A second invocation at the same timestamp failed before producing data and left that archive empty. Write each dump to a uniquely named temporary file, verify it, and publish it under a collision-safe final name. [Timestamp and archive path](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L10) · [Dump and verification](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/backup-postgres.sh#L26)

### R75 · P3 · Reopening the user menu can revert a successfully saved theme

The theme toggle resets the shared theme from its server-provided user prop each time the dropdown mounts it. The save updates the database and a local ref, leaving that prop stale until the server view refreshes. In Chromium against the existing production build and isolated PostgreSQL, selecting dark mode returned HTTP 200 and applied it. Closing and reopening the menu switched the page back to light mode, and reloading the page restored the saved dark preference. Keep the committed selection in state shared across menu mounts or refresh the user snapshot after saving. [Theme synchronization and save](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/ui/ThemeToggle.tsx#L17) · [Theme toggle inside the dropdown](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/ui/UserMenu.tsx#L165) · [Existing persistence test](https://github.com/TKlerx/webapp-template/blob/64304a5/tests/e2e/auth/theme-persistence.spec.ts#L22)

### R76 · P3 · User management gives no feedback when a request fails before receiving a response

The shared user action handler displays an error toast for unsuccessful HTTP responses. If `fetch` rejects, the handler clears its busy state in `finally` and lets the rejection escape. In Chromium, aborting a deactivate request yielded an unhandled fetch error and re-enabled the button without showing the administrator an error message. Handle request failures through the same feedback path while retaining the ability to retry. [Action request and response handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/auth/UserManagementTable.tsx#L48) · [Deactivate action](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/auth/UserManagementTable.tsx#L167)

### Fifteenth-pass verification

All 10 focused Vitest tests passed. The migration finding was verified from the Dockerfile and by running both shell scripts against stubbed Docker with an unavailable `pnpm` command. The backup check used synthetic archives and a fixed clock. Chromium reproduced both UI findings against the existing production build and isolated PostgreSQL, with the failed user update simulated in the browser.

## Sixteenth pass

This pass reviewed personal access token lifetimes and identifiers, admin token filtering, and shared PostgreSQL connection settings at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            1 |

### R77 · P2 · Token creation and renewal ignore the configured default lifetime

The service reads `PAT_DEFAULT_EXPIRY_DAYS`, but both HTTP routes supply a hardcoded 90-day fallback. The creation dialog also starts at 90 days, and its renewal action submits 90 days without offering the duration choice required by the token specification. Against the existing production build configured with a seven-day default, an API creation request without an expiry issued a token for approximately 90 days. Chromium also captured the renewal action submitting 90 days directly. Use the validated configured default when clients omit a duration, and let users choose a duration before renewal. [Documented runtime setting](https://github.com/TKlerx/webapp-template/blob/64304a5/docs/runtime-credentials.md#L45) · [Default reader](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L31) · [Creation route](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/tokens/route.ts#L50) · [Renewal route](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/tokens/%5Bid%5D/renew/route.ts#L25) · [Renewal request](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-list.tsx#L170) · [Renewal duration requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/012-openapi-and-pat/spec.md#L152)

### R78 · P2 · A late admin token response can show another user's tokens under the current filter

Every refresh replaces the displayed tokens when its response arrives. The selected user and show-all controls remain independently editable, and the refresh does not check whether its response still corresponds to the current selection. In Chromium, selecting one user and then another while the first request was held showed the second user's results first. Releasing the earlier response replaced the rows with the first user's tokens while the second user remained selected. This matters because the same rows provide revoke and delete actions. Cancel superseded requests or apply results only from the latest selection, and keep rows associated with the filter that fetched them. [Refresh response handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-list.tsx#L114) · [Filter controls](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-list.tsx#L225) · [Row actions](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-list.tsx#L329)

### R79 · P2 · A shared PostgreSQL URL with a Prisma schema fails in the worker

The app reads the `schema` parameter and selects that PostgreSQL schema through the adapter. Both runtimes can fall back to the same `DATABASE_URL`, but the worker only removes `connection_limit` before passing the URL to psycopg. The app ran against a schema-qualified URL in isolated PostgreSQL. The worker's locked psycopg parser rejected the equivalent connection string with an invalid URI query-parameter error before connecting. Translate the schema selection into supported PostgreSQL connection settings or document and validate the separate worker URL needed to target the same schema. [App schema selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/db.ts#L5) · [Worker URL selection](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/config.py#L45) · [Worker URL normalization](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L14)

### R80 · P3 · A token's displayed prefix can come from the wrong part of its random segment

The prefix helper splits on the last underscore, but underscores also occur in the base64url-encoded random segment. A synthetic token with a valid 32-byte encoding produced a four-character segment from near the end instead of the expected first eight random characters. This makes the displayed label unreliable for identifying a token during rotation or revocation. Derive the display value from the random segment at generation time or use the known token format boundary. [Token generation and display prefix](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/tokens.ts#L50) · [Display prefix contract](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/012-openapi-and-pat/research.md#L57)

### Sixteenth-pass verification

All 17 focused Vitest tests and all 35 Python worker tests passed. A Chromium check used the existing production build and isolated PostgreSQL to verify expiry and filtering behavior. The filter responses were reordered with browser mocks. The worker URL check exercised psycopg's parser, and the token display check used a synthetic encoded value.

## Seventeenth pass

This pass reviewed downstream template provenance, Teams delivery retries and locking, CLI browser-login feedback, and the local Next.js launcher at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            2 |

### R81 · P2 · The template stamp records downstream HEAD as the upstream baseline

The stamp looks up the `starter` remote and its default branch but takes the recorded commit from the current checkout's `HEAD`. In a scratch downstream clone with one product-only commit, both provenance files recorded that product commit as the upstream template baseline. Consumers of the stamp can therefore attribute fixes to the wrong template revision. Require an explicit upstream commit or resolve the applied baseline from trusted upstream history, and verify that the stamped revision belongs to the template. [Remote and commit selection](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/stamp-template-origin.mjs#L31) · [Provenance fields](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/stamp-template-origin.mjs#L51) · [Downstream workflow](https://github.com/TKlerx/webapp-template/blob/64304a5/README.md#L110)

### R82 · P2 · Teams delivery can send twice when the provider accepts a message and the receipt write fails

The app sends to Graph inside a PostgreSQL transaction, then records the returned message ID and marks the delivery sent. A provider acceptance survives a database rollback. In an isolated schema, the first mocked Graph call returned HTTP 201 and the receipt update failed, leaving the outbound row queued with no message ID. Retrying the claimed job made a second provider call and persisted its receipt. Treat delivery with an uncertain outcome as a distinct state and reconcile before resending, or use provider-side idempotency where available. [Delivery transaction and receipt write](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/teams/service.ts#L95) · [Delivery error response](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/internal/teams/deliver/route.ts#L23) · [Worker retry path](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L506)

### R83 · P2 · Teams delivery can skip its row lock when the app uses a custom PostgreSQL schema

The Prisma adapter qualifies model queries using the URL's `schema` parameter. The raw lock query uses an unqualified table name, so PostgreSQL resolves it through the connection's search path. With `?schema=` pointing at an isolated schema, the model query found the outbound row while the lock searched `public` and matched zero rows. Delivery can proceed without the lock that should serialize sends for that outbound message. Resolve the lock against the same schema as Prisma and verify that the expected row was locked before sending. [App schema selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/db.ts#L5) · [Raw lock and outbound lookup](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/teams/service.ts#L95)

### R84 · P3 · CLI browser login reports success before the token exchange finishes

The loopback callback writes “Login complete” as soon as it receives an authorization code. The CLI exchanges the code afterward. In a loopback test, the exchange returned HTTP 429 and the CLI reported an error while the browser displayed the success text. Let the browser confirm only that the callback was received, or display the final exchange outcome once it is known. [Browser callback response](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/auth/browser.go#L61) · [Token exchange order](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/auth/browser.go#L93) · [Token limit response](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-auth.ts#L140)

### R85 · P3 · The Next.js launcher exits successfully when its child is terminated by a signal

The launcher handles the numeric exit code and defaults to zero when it is null. Node supplies a null code when the child is terminated by a signal. A stand-in Next.js process that terminated with `SIGTERM` caused the real launcher to return exit status zero. Supervisors and scripts can interpret an interrupted server process as a clean exit. Propagate the signal or return the corresponding nonzero exit status. [Child process and exit handler](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/run-next.mjs#L19) · [Launcher entry points](https://github.com/TKlerx/webapp-template/blob/64304a5/package.json#L7)

### Seventeenth-pass verification

All 15 focused Vitest tests and the Go suite passed. Targeted checks used scratch Git repositories for provenance, isolated PostgreSQL and synthetic Graph responses for delivery, a loopback server for browser login, and a stand-in Next.js child for signal handling. An initial receipt fixture reached the public schema of the disposable test database. Its temporary constraint was removed before rerunning the check in the intended schema. No Teams messages were sent.

## Eighteenth pass

This pass reviewed continuity-file updates, HTTP Bearer interoperability, clipboard failure handling in the one-time token dialog, and CLI output errors at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               1 |            3 |

### R86 · P2 · The continuity updater replaces handwritten handoff notes

The repository uses `CONTINUE.md` for recent changes, open issues, and next actions. The updater reads the previous file for its fingerprint and timestamp, rebuilds the entire document from Git and spec metadata, then writes it over the original. The continuity validation path can invoke that writer when the continuity files are staged. In a scratch repository, an update removed a handwritten handoff note and kept the existing log entry. Replace only a delimited generated section or write the generated snapshot to a separate file so running validation preserves authored notes. [Continuity workflow](https://github.com/TKlerx/webapp-template/blob/64304a5/AGENTS.md#L5) · [Snapshot generation](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/update-continuity.mjs#L274) · [File replacement](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/update-continuity.mjs#L324) · [Validation caller](https://github.com/TKlerx/webapp-template/blob/64304a5/validate.ps1#L508)

### R87 · P3 · PAT authentication rejects valid Bearer scheme casings

The token resolver recognizes the literal prefix `Bearer `. HTTP authentication scheme names are case-insensitive. In a focused API check using the same valid synthetic token, `Bearer` returned HTTP 200 while `bearer` and `BEARER` returned 401. Match the scheme case-insensitively and preserve the token value's exact casing. [Token extraction](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/token-auth.ts#L5) · [API entry point](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/auth/me/route.ts#L4) · [HTTP authentication scheme rules](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1)

### R88 · P3 · The one-time token dialog gives no feedback when copying fails

The copy action awaits the browser clipboard API and only handles success. In Chromium with a simulated clipboard denial, clicking **Copy token** emitted an unhandled rejection. The dialog stayed open without telling the user that the copy failed. This is important because the token value is shown only once. Surface the copy failure and make it clear that the visible value can still be copied manually before closing. [Token copy handler and one-time dialog](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/token-value-display.tsx#L35) · [Existing clipboard test grants permission](https://github.com/TKlerx/webapp-template/blob/64304a5/tests/e2e/token-management.spec.ts#L15)

### R89 · P3 · CLI table output reports success when the writer fails

The table renderer delegates writing to its output mirror and always returns nil. A targeted Go check supplied a writer that rejected every write. The renderer attempted two writes and returned success. Callers that depend on a successfully written table can therefore receive a successful status despite losing the output. Render the table to a string and write through an operation that propagates the writer's error. [Table renderer](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/output/table.go#L14) · [CLI caller](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/users.go#L78)

### Eighteenth-pass verification

Seven existing token API tests and one temporary Bearer diagnostic passed, along with the Go suite and the temporary writer diagnostic. Targeted checks used a scratch Git repository for continuity, a mocked valid token for HTTP scheme handling, and Chromium against the existing production build and isolated PostgreSQL for clipboard handling. The clipboard denial was simulated in the browser.

## Nineteenth pass

This pass reviewed CLI browser-login continuation, credential exception validation, and the effects of retrying an administrative status change at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               2 |            1 |

### R90 · P2 · CLI browser login loses its approval step during a required password change

The authorize endpoint puts the pending approval URL in the login return path. When the user must change their password, the login handler redirects to `/change-password` without preserving that return path. The password form then sends the browser to the dashboard. In Chromium, a first-time user completed the password change and landed on the dashboard while the original CLI approval page was still available when opened directly. The ordinary flow leaves the CLI waiting for a callback. Carry the validated return path through the password change and resume approval after it succeeds. [CLI authorize redirect](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/cli-auth/authorize/route.ts#L81) · [Login redirect selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/auth/login/route.ts#L152) · [Post-change navigation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/auth/ChangePasswordForm.tsx#L28) · [CLI callback requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/012-openapi-and-pat/spec.md#L82)

### R91 · P2 · The credential validator accepts an exception documented for a different setting

The validator reads the settings listed on each exception but stores only the exception ID. Inventory and runtime exposure rows are then accepted when they reference an existing ID, even if the exception covers a different setting. A synthetic fixture still passed after its exception was changed to name a different credential while its original references were left in place. Associate each exception ID with its documented settings and reject references outside that scope. [Exception parsing](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/validate-runtime-credentials.ps1#L62) · [Inventory references](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/validate-runtime-credentials.ps1#L104) · [Runtime exposure references](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/validate-runtime-credentials.ps1#L125) · [Credential contract](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/016-runtime-credential-separation/contracts/runtime-credential-contract.md#L51)

### R92 · P3 · Retrying user deactivation creates another status-change event

The deactivation route supplies no precondition for the current status. The service updates the row and runs the audit and notification hooks even if the requested status is already set. Two requests for the same user each returned HTTP 200 and created two audit entries and two queued notification events in isolated PostgreSQL. The second audit entry described a transition from `INACTIVE` to `INACTIVE`. Treat a repeated request as a no-op, or return a documented invalid-transition response before writing audit and notification records. [Deactivation route](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/users/%5Bid%5D/deactivate/route.ts#L8) · [Status update and hooks](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/user-admin.ts#L256)

### Nineteenth-pass verification

All 16 focused Vitest tests and the existing credential validator self-tests passed. Targeted checks used Chromium against the existing production build and isolated PostgreSQL for the login and deactivation flows, and a synthetic Markdown fixture for exception matching. The notification check inspected queued events. No emails were sent.

## Twentieth pass

This pass reviewed mutation-test reporting and source isolation, background-job dashboard redaction, and deadlines in the TypeScript mail client at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               3 |            1 |

### R93 · P2 · The background-job dashboard applies weaker redaction than the API

The dashboard reads job records directly and uses its own shorter, case-sensitive list of sensitive fields. It also renders stored error text without redaction. The API uses a shared policy that normalizes field names and sanitizes credential-like fragments in stored text. Consequently, historical payloads, results, and errors can be visible on the administrator dashboard even when their API representation is redacted. Route both displays through the same sanitizer and test parity across all three fields. [Dashboard field rendering](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/%28dashboard%29/background-jobs/page.tsx#L148) · [Dashboard redaction](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/%28dashboard%29/background-jobs/page.tsx#L272) · [API sanitization and serialization](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/background-jobs.ts#L49)

### R94 · P2 · The critical mutation runner counts test-runner failures as killed mutants

Once the baseline passes, the runner treats every nonzero child exit as a mutation kill. It does not verify that the suite loaded and that a test detected the change. In a scratch copy, a stub runner passed the baseline and then exited before assertions for all three mutations. The command reported three kills and returned success. Distinguish assertion failures from test-runner and collection failures, and fail validation when a mutation could not be evaluated. [Child result handling](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/run-critical-mutation-tests.mjs#L33) · [Mutation outcome check](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/run-critical-mutation-tests.mjs#L66) · [CI entry point](https://github.com/TKlerx/webapp-template/blob/64304a5/.github/workflows/validate.yml#L92)

### R95 · P2 · Interrupting the critical mutation runner can leave mutated source in the checkout

The runner writes each mutation directly into the tracked source path and restores the original only from a `finally` block. In a scratch copy, terminating the runner while its test child was active left the mutated source in place. A canceled local run can therefore leave a developer testing or committing an unintended code change. Run the mutations in a disposable checkout or staging directory so the original working tree stays intact even if the runner stops abruptly. [In-place mutation and restoration](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/run-critical-mutation-tests.mjs#L66) · [Documented local command](https://github.com/TKlerx/webapp-template/blob/64304a5/AI_TESTING.md#L37)

### R96 · P3 · The TypeScript Graph mail client supplies no application-level request deadline

Neither token acquisition nor the subsequent Graph request sets an abort signal or exposes a caller-provided deadline through the public mail API. A mocked fetch capture confirmed that the client supplies no signal to either request. A slow upstream call can therefore hold operations open until a transport or platform timeout intervenes. Apply bounded deadlines to token acquisition and Graph requests and surface deadline expiry as a distinct error. [Token acquisition](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/mail/graph.ts#L107) · [Graph request options](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/mail/graph.ts#L147)

### Twentieth-pass verification

All 22 focused Vitest tests passed. The mutation-runner checks used two separate scratch copies and stubbed test processes. The job redaction finding came from comparing the dashboard and API code paths without using credential data. The mail check captured requests with a mock fetch implementation.

## Twenty-first pass

This pass reviewed worker bounce correlation, the Teams intake failure metric, and API documentation recovery after a browser asset failure at the same commit.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               1 |            2 |

### R97 · P2 · The worker ignores a bounce with a matching provider reference when the body marker is absent

The worker requires its application-specific notification marker before it attempts provider-message correlation. The TypeScript inbound processor instead permits correlation from the stored provider message ID and checks the marker for agreement when one is present. In isolated PostgreSQL, a mocked nondelivery report without the marker carried a reference that matched a seeded notification. The worker marked the inbound report ignored and left the notification in `SENT`. Align the two processors so the worker can use the existing provider-correlation check when the marker is absent, while continuing to reject conflicting evidence. [Worker bounce dispatch](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L264) · [Worker provider lookup](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L287) · [TypeScript correlation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/notifications/inbound.ts#L125) · [Bounce processing requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/014-shared-mailbox-notifications/spec.md#L86)

### R98 · P3 · A successful Teams intake retry removes the previous failure from recent health history

The Teams status view counts and lists recent poll failures by selecting jobs with a current error. Worker completion clears the error on the same row. In isolated PostgreSQL, the Teams recent intake failure count was one after a poll failed and immediately became zero after its retry succeeded. Operators lose visibility into transient intake failures within the advertised reporting window. Keep recent attempt outcomes separately from current job state, or label the existing metric as unresolved poll errors. [Teams failure count and recent activity](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/teams/admin.ts#L235) · [Worker completion](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L46) · [Integration health requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/015-teams-messaging-skeleton/spec.md#L78)

### R99 · P3 · The API docs stay blank after a failed Swagger bundle load

The docs loader leaves a failed script element in the document and has no error state. Returning to the page through in-app navigation finds the existing element and waits for a load event that will never fire. In Chromium, aborting the first bundle request left the viewer blank. Navigating away and returning issued no second bundle request, while a full reload restored the docs. Remove failed script elements and provide a retry action so the page can recover in the same browser session. [Script lookup and load listener](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/docs/swagger-ui.tsx#L32) · [API docs page](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/%28dashboard%29/docs/api/page.tsx#L21)

### Twenty-first-pass verification

All 14 focused Vitest tests and all 35 Python worker tests passed. Targeted checks used isolated PostgreSQL and a mocked mailbox response for the two worker-related findings. Chromium reproduced the Swagger failure and recovery against the existing production build. No live mail or Teams provider calls were made.

## Twenty-second pass

This pass reviewed browser audit export failures and the CLI health output contract at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               0 |            2 |

### R100 · P3 · The audit export button misreports server failures as empty results

On an unsuccessful HTTP response, both export buttons show the same message as a successful search with no matching audit entries. When the request fails before a response, the rejected promise goes unhandled and the button resets without showing a message. In Chromium, a simulated HTTP 500 produced the empty-results toast while a matching audit entry was visible. Aborting the next request produced an unhandled fetch error and no toast. A subsequent request downloaded the CSV successfully. Report export failures explicitly and catch network and download errors so administrators know when to retry. [Export handler](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/audit/AuditExportButton.tsx#L19) · [English empty-results message](https://github.com/TKlerx/webapp-template/blob/64304a5/src/i18n/messages/en.json#L149)

### R101 · P3 · CLI health returns a human-readable status line when CSV is requested

The CLI advertises CSV and resolves the flag to CSV, but `health` only distinguishes JSON from its human-readable output. Against a loopback server returning a healthy application response, `starterctl health --format csv` exited successfully and printed `status=ok database=ok`. A CSV reader received one status string with no separate fields, leaving automation without the requested tabular result. Route CSV through the existing renderer with named health columns and keep the command's health exit codes. [Health output branch](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/health.go#L46) · [Existing CSV renderer dispatch](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/output/format.go#L47) · [Health output requirement](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/013-cli-client/tasks.md#L156)

### Twenty-second-pass verification

The full Go test suite and all 13 focused Vitest audit tests passed. Chromium exercised the existing production build against an isolated PostgreSQL schema and injected HTTP and network errors at the export endpoint. A freshly built CLI reproduced the CSV issue with a loopback HTTP fixture and confirmed the JSON control case.

## Twenty-third pass

This pass reviewed how the Python worker handles Teams poll failures and large messages, and how the E2E setup handles an existing PostgreSQL connection at `64304a5`. R-numbers identify findings in the order they were recorded. P-numbers indicate priority.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               1 |            2 |

### R102 · P2 · One failed Teams page prevents earlier successful pages from being saved

The Python Graph client collects an entire channel's history before returning messages to the worker. The worker starts saving only after the last page returns. With an active subscription in isolated PostgreSQL, the mocked first page returned a new message and the second page failed with a simulated HTTP 503. The poll saved zero messages. When both pages succeeded, the same poll saved the first-page message. A recurring failure on a later page can delay collection of new messages from the affected channel. Save each successful page before requesting the next and retain the existing deduplication and poll-failure reporting. [Graph page accumulation](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/graph_teams.py#L59) · [Worker fetch and persistence order](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L83) · [Intake acceptance criteria](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/015-teams-messaging-skeleton/spec.md#L35)

### R103 · P3 · The E2E setup requires Docker even with an existing PostgreSQL database

The documented `TEST_DATABASE_URL` override selects the connection for migrations and seeding. The provisioner still unconditionally tries to create or start a local Docker container before opening that connection. On a host without Docker, a direct query to the configured `_test` database succeeded. The provisioner printed “Create PostgreSQL E2E container” and exited with status 1. An existing native or externally managed test database should be usable by checking that connection directly and applying the migrations there. [Database override documentation](https://github.com/TKlerx/webapp-template/blob/64304a5/README.md#L135) · [Playwright global setup](https://github.com/TKlerx/webapp-template/blob/64304a5/tests/e2e/global.setup.ts#L15) · [Unconditional Docker provisioning](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/ensure-e2e-db.mjs#L32)

### R104 · P3 · Truncating a large Teams message repeatedly encodes its entire remaining body

To enforce the 64 KiB storage limit, the worker removes one character at a time and re-encodes the entire remaining string on each iteration. With synthetic four-byte Unicode characters, the production helper took a median of about 0.22 seconds for an 80 KiB body and 0.54 seconds for a 96 KiB body across three runs per size. These timings cover truncation alone. Several oversized messages in a poll add CPU time before the worker can claim another job. Encode once and cut the byte prefix on a valid UTF-8 boundary, reserving room for the truncation marker. [Truncation call](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L102) · [Truncation loop](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L400) · [Storage limit](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/015-teams-messaging-skeleton/spec.md#L64)

### Twenty-third-pass verification

All 35 Python worker tests and 9 subtests passed. The Teams paging check used the worker's real PostgreSQL persistence with mocked Graph responses. The E2E provisioner check used the same reachable native PostgreSQL server. The truncation check used synthetic message bodies and verified the resulting preview stayed within the byte limit.

## Twenty-fourth pass

This pass reviewed the Azure smoke check's revision selection and the notification log's status filters at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               1 |            2 |

### R105 · P2 · Azure smoke verification can pass using the previous worker revision

The deployment workflow captures the new app and worker revision names, but passes only the Container App names to smoke verification. The script lists active revisions and passes if the list contains healthy entries and no unhealthy ones. The worker uses single revision mode, where Azure can keep the previous revision active while the new one becomes ready. A mocked Azure response containing only the old healthy worker revision made the full smoke command exit successfully, with the current migration and app health checks also passing. Pass the promoted revision names into smoke verification and require each named revision to reach its expected ready state. [Promotion outputs and smoke arguments](https://github.com/TKlerx/webapp-template/blob/64304a5/.github/workflows/deploy-azure.yml#L278) · [Smoke revision selection](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/azure-deploy-smoke.ts#L318) · [Worker revision mode](https://github.com/TKlerx/webapp-template/blob/64304a5/infra/azure/modules/runtime/worker.tf#L5) · [Azure revision rollout behavior](https://learn.microsoft.com/en-us/azure/container-apps/revisions#zero-downtime-deployment)

### R106 · P3 · A failed notification filter request leaves old results under the newly selected filter

The status and event controls update as soon as a filter is selected. A failed fetch leaves the previous rows and summary counts in place. In Chromium, selecting Failed during a simulated HTTP 503 left a Sent row under the Failed filter after the error toast disappeared. A subsequent network failure left that same row under Retrying, raised an uncaught fetch error, and showed no toast. Keep rows and counts aligned with the last successful filter, or replace the results with a persistent error and a retry action. [Filter selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/notifications/NotificationAdminPanel.tsx#L227) · [Request and error handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/notifications/NotificationAdminPanel.tsx#L66) · [Summary calculation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/notifications/NotificationAdminPanel.tsx#L140)

### R107 · P3 · The notification log offers no Sending filter

The worker writes `SENDING` while a delivery is in progress, and the log renders that status on individual rows. The browser status filter omits it. In Chromium, a seeded Sending record appeared in the unfiltered table and the authenticated API returned it for `status=SENDING`, but the selector offered no way to find it. The list returns at most 50 rows per query, so older records still marked Sending can fall outside the unfiltered view. Include Sending in the status selector so administrators can isolate active or stuck deliveries. [Worker status update](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/db.py#L66) · [Status options](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/notifications/NotificationAdminPanel.tsx#L237) · [Notification log query](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/notifications/admin.ts#L177)

### Twenty-fourth-pass verification

All 16 focused Vitest tests passed. The Azure smoke check ran with mocked CLI and HTTP responses, including a control where the new worker revision was active. The notification checks used Chromium, the existing production build, and an isolated PostgreSQL schema. Browser interception supplied the HTTP and network failures. A successful filter request served as the control.

## Twenty-fifth pass

This pass reviewed CLI shell completion and the documented local smoke test at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               0 |            3 |

### R108 · P3 · Dynamic user completion can hold the shell for up to 30 seconds

User ID completion makes a synchronous request using the shared HTTP client's 30-second timeout. The CLI specification sets a two-second target for dynamic completion. With a fresh build and a loopback fixture, `users approve` completed in 0.01 seconds when the server responded immediately and in 3.01 seconds when it delayed for three seconds. A slow server can keep the shell waiting on every Tab press. Give completion requests their own deadline and return without suggestions on timeout. [Completion request](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/users.go#L160) · [Shared HTTP timeout](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/internal/client/client.go#L50) · [Completion latency target](https://github.com/TKlerx/webapp-template/blob/64304a5/specs/013-cli-client/spec.md#L186)

### R109 · P3 · CLI audit action completion omits six valid filters

Both `audit list` and `audit export` complete `--action` from a hard-coded list that omits `SCOPE_ASSIGNMENT_CHANGED`, `AUDIT_EXPORT_REQUESTED`, and all four personal access token lifecycle actions. A fresh CLI build omitted the same six values for both commands. The server's filter parser accepted the four token actions when supplied explicitly. Operators can type these filters, but Tab completion does not help them discover the available token audit events. Keep completion values synchronized with the server's audit action enum. [CLI completion values](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/cmd/audit.go#L13) · [Audit action enum](https://github.com/TKlerx/webapp-template/blob/64304a5/prisma/schema.prisma#L43) · [Server filter validation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/audit-filters.ts#L38)

### R110 · P3 · The CLI smoke-test instructions still require a removed SQLite setup

The CLI README tells a fresh checkout to set `DATABASE_URL` to `file:./dev.db` and run `scripts/ensure-local-db.mjs`. The file is absent from the reviewed commit, and both the app and migration URL resolvers reject the documented value. Following these steps stops before the application can start or the CLI can be tested. Link the CLI smoke test to the repository's PostgreSQL development setup. [CLI smoke-test prerequisites](https://github.com/TKlerx/webapp-template/blob/64304a5/cli/README.md#L96) · [PostgreSQL URL validation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/lib/database-url.ts#L13) · [Current PostgreSQL setup](https://github.com/TKlerx/webapp-template/blob/64304a5/README.md#L232)

### Twenty-fifth-pass verification

The full Go test suite passed. The completion checks used a fresh build, a loopback HTTP fixture, and a temporary CLI config directory. The audit parser and database URL resolvers ran directly against the reviewed source. The documented setup script was checked against both the Git tree and working checkout.

## Twenty-sixth pass

This pass reviewed saved assistant conversation recovery and title generation at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               0 |            2 |

### R111 · P3 · Retry history clears the error without retrying a failed conversation creation

When New conversation fails while another conversation is open, the history hook retains that conversation and marks the error as recoverable. The Retry history button calls `save()` whenever a conversation remains active. If its contents are already saved, `save()` simply resets the status to Autosave on. In Chromium, after an injected HTTP 503 on creation, Retry history made no replacement request and left the same conversation selected. Clicking New conversation again succeeded. Track which history operation failed so Retry repeats that operation. [Creation and error handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/use-conversations.ts#L148) · [Early return for saved content](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/use-conversations.ts#L69) · [Retry button](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L226)

### R112 · P3 · Assistant conversation titles can replace an emoji at the truncation boundary

The save route takes the first 100 UTF-16 code units of the opening turn as its title. That cut can divide a Unicode character encoded as a surrogate pair. An authenticated save to isolated PostgreSQL with 99 ASCII characters followed by an emoji returned HTTP 200 and retained the complete message, but the stored title ended in a replacement character. A control with 98 ASCII characters preserved the emoji in the title. Truncate at a complete Unicode character or grapheme boundary. [Title derivation](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/assistant/conversations/route.ts#L94) · [Title display](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/assistant/Assistant.tsx#L186)

### Twenty-sixth-pass verification

All 51 focused Vitest tests passed across assistant storage, chat helpers, and voice helpers. The two additional checks used Chromium and the existing production build with an isolated PostgreSQL schema. Browser interception supplied the creation failure. The Unicode check used the real authenticated save and read endpoints.

## Twenty-seventh pass

This pass reviewed the hosted CLI download panel and its artifact lookup at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               0 |            3 |

### R113 · P3 · The CLI setup command causes a hydration mismatch on the token settings page

The server renders the CLI setup command with `<APP_URL>`, while the browser's first render substitutes the current URL. On a direct production-page load, Chromium received the placeholder in the HTML, reported a React hydration mismatch, and then rendered the correct CLI URL after client recovery. Use the same initial value on both renders and populate the URL after hydration, or pass a server-derived URL as a prop. [CLI URL initialization](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/cli-downloads.tsx#L20) · [Setup command rendering](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/cli-downloads.tsx#L50) · [Token settings page](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/%28dashboard%29/settings/tokens/page.tsx#L37)

### R114 · P3 · A directory with an archive name can hide a working CLI download

Release discovery matches names by prefix and suffix. Listing marks the selected entry available after `stat` without checking whether it is a file. With a valid Linux x64 archive present, adding an empty directory whose matching filename sorted later made the listing advertise the directory and made the download endpoint return HTTP 500. Filter candidates to regular files before selecting an archive, and handle a file disappearing between lookup and download. [Archive selection](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-release-service.ts#L84) · [Availability check](https://github.com/TKlerx/webapp-template/blob/64304a5/src/services/api/cli-release-service.ts#L119) · [Download handler](https://github.com/TKlerx/webapp-template/blob/64304a5/src/app/api/downloads/cli/%5Btarget%5D/route.ts#L17)

### R115 · P3 · A failed CLI list request is shown as an empty deployment

The download panel renders the same no-artifacts message while loading, when the API returns an error, and when it successfully returns an empty list. In Chromium, a simulated HTTP 503 hid the Linux download button and showed that no hosted artifacts were available, even though the authenticated download endpoint still returned HTTP 200. The button reappeared after the list request succeeded on a reload. Show a load failure with a retry action and reserve the empty message for a successful list with no available files. [List fetch and failure handling](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/cli-downloads.tsx#L27) · [Empty-state rendering](https://github.com/TKlerx/webapp-template/blob/64304a5/src/components/tokens/cli-downloads.tsx#L74)

### Twenty-seventh-pass verification

All four focused Vitest tests passed. Chromium exercised the existing production build using an isolated PostgreSQL schema and a temporary release directory. The browser check compared the original HTML with the hydrated page, injected an HTTP 503 for the listing, and exercised the actual authenticated list and download endpoints against the archive and directory fixtures.

## Twenty-eighth pass

This pass reviewed the production logging guard, worker severity filtering, and the specs overview generator at `64304a5`.

| High priority | Medium priority | Low priority |
| ------------: | --------------: | -----------: |
|             0 |               0 |            3 |

### R116 · P3 · The logging guard mistakes comments for calls and misses some multiline calls

The guard applies regular expressions to each source line without parsing TypeScript or Python. In scratch source trees, comments mentioning `console.error(...)` and `print(...)` failed the guard even though neither file logged anything. A valid TypeScript call with its opening parenthesis on the next line passed. Ordinary single-line calls failed as expected. Use syntax-aware checks so the gate recognizes executable calls and ignores comments. [Logging patterns](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/check-logging-guard.mjs#L5) · [Line-by-line scan](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/check-logging-guard.mjs#L91) · [Validation gate](https://github.com/TKlerx/webapp-template/blob/64304a5/validate.ps1#L1177)

### R117 · P3 · The Python worker ignores the configured log level

Compose passes `LOG_LEVEL` into the worker through its shared environment. The worker configures Python logging at `INFO` regardless of the setting. With `LOG_LEVEL=error`, the actual startup logging helper still emitted its `worker.started` INFO event, alongside an ERROR control event. Read the configured level during worker logging setup, preserving `INFO` as the default. [Compose log setting](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L35) · [Worker environment](https://github.com/TKlerx/webapp-template/blob/64304a5/docker-compose.yml#L65) · [Worker logging setup](https://github.com/TKlerx/webapp-template/blob/64304a5/worker/src/starter_worker/main.py#L17)

### R118 · P3 · Example checkboxes can put a feature on the wrong roadmap list

The overview generator counts checkbox-shaped lines in `tasks.md` without accounting for fenced code blocks. In a scratch specification with zero actual tasks, an unchecked example made the status `Tasked`, and a checked example made it `Fully Implemented`. The overview check accepted each generated result. Count Markdown task items outside code examples so sample snippets cannot change the reported status. [Task counting](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/update-spec-overview.mjs#L48) · [Status calculation](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/update-spec-overview.mjs#L81) · [Overview freshness check](https://github.com/TKlerx/webapp-template/blob/64304a5/scripts/update-spec-overview.mjs#L264)

### Twenty-eighth-pass verification

All seven focused Vitest tests and the existing overview test passed. The current checkout passed the logging guard and overview freshness check. Separate scratch fixtures reproduced the three findings using the real guard, worker logger and overview generator.

## Remediation pass

The fixes cover all 118 recorded findings, including 8 P1, 62 P2, and 48 P3 findings. The original findings above describe the reviewed baseline.

| Area                                            | Findings                                                                                                                                        | Changes                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication, accounts, and credentials       | R01, R09, R14, R15, R27, R28, R33, R34, R37, R40, R43, R51, R52, R53, R55, R57, R58, R59, R70, R76, R77, R78, R80, R84, R87, R88, R90, R91, R92 | Enforced first-login password changes and preserved CLI approval through recovery. Revoked credentials on deactivation, hardened concurrent user and token updates, and corrected CLI login, logout, and config persistence.                                                                    |
| Deployment, database operations, and continuity | R02, R07, R08, R19, R20, R29, R30, R31, R35, R36, R46, R48, R60, R61, R68, R73, R74, R81, R85, R86, R105                                        | Put migrations before promotion. Matched smoke results to the requested revisions and build. Restricted worker grants, made backups private, made restores transactional, and corrected Compose and standalone runtime packaging.                                                               |
| Worker, email, and Teams                        | R03, R04, R10, R11, R12, R17, R21, R22, R24, R25, R32, R38, R41, R42, R45, R62, R79, R82, R83, R96, R97, R98, R102, R104, R117                  | Renewed and fenced worker claims, reconciled historical notification status, retained completed intake work across provider failures, and enforced delivery payload contracts. Reserved Teams sends before calling the provider and recorded Graph mail references for nondelivery correlation. |
| Audit, health, and operator interfaces          | R06, R13, R23, R26, R39, R49, R50, R54, R63, R64, R66, R71, R72, R89, R93, R100, R101, R106, R107, R108, R109                                   | Paginated audit results, surfaced CSV truncation, embedded a Unicode PDF font, and corrected CLI output formats and health reporting. Hardened logging, redaction, filters, and API documentation.                                                                                              |
| Assistant, theme, and download interfaces       | R05, R16, R56, R69, R75, R99, R111, R112, R113, R115                                                                                            | Bounded assistant request size and recovered unsaved text across reloads and lost save responses. Fixed voice busy state, menu theme persistence, and retry paths for docs, conversations, and downloads.                                                                                       |
| Release and validation tooling                  | R18, R44, R47, R65, R67, R94, R95, R103, R110, R114, R116, R118                                                                                 | Restricted release lookup to published artifacts when a manifest is present, isolated mutation runs, cleaned Playwright-owned databases, and corrected the text, logging, and spec validators.                                                                                                  |

### Operational changes

- The Prisma changes include migrations for scoped Teams message IDs, durable Teams send reservations, and historical notification reconciliation.
- Graph mail creates a draft before submission. The mailbox-scoped worker identity needs `Mail.ReadWrite` and `Mail.Send`. The job result records Graph acceptance as a separate field.
- If a Teams send has an ambiguous outcome, the worker preserves its reservation and reports an error. An operator can check the channel before deciding whether to send again.
- Assistant recovery holds uncommitted conversation text in the current tab’s session storage. Autosave clears the draft when persistence succeeds.

### Verification

- 375 Vitest tests passed. The full suite used a 15-second timeout for tests that spawn subprocesses. Python passed 37 tests and 9 subtests, along with its quality gate. The Go quality gate, dependency scan, and Windows cross-build passed.
- The isolated CLI release runner killed all three mutants on Node 24 and Node 26. Its structured Vitest reporter separates assertion failures from collection and runner errors. Stryker killed 39 mutants and timed out on 5 with zero survivors. Gremlins killed all 42 configured worker mutants.
- The standalone build excluded unrelated checkout directories. OpenTofu validated using initialized providers. Compose and deployment workflow YAML parsed, and shell syntax checks passed.
- Isolated PostgreSQL checks covered private and collision-safe backups, rollback on restore failure, migration reconciliation, runtime grants, and test database ownership and cleanup. A production-server check confirmed that proxy redirects include a request ID. PDF text extraction preserved the original Japanese example, mixed-language text, and the final line of a three-page export.
- Playwright passed 26 cases in the full run against native PostgreSQL and skipped two opt-in provider cases. The last-admin case timed out during fixture setup. Batching its fixture updates removed the timeout and the focused rerun passed.
- Live Azure promotion and Microsoft Graph delivery remain unverified. Tests that required Compose orchestration used a Docker shim.
