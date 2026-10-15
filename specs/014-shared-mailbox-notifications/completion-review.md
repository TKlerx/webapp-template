# Completion review: Shared Mailbox Notifications

**Reviewed**: 2026-10-15
**Result**: Incomplete; retain the original requirements and defer archival.
**Context**: User requested checking the implementation and reconciling the contradictory completion metadata before archival.

## Implemented slices

- Graph mailbox list/get/send uses application credentials (`src/lib/mail/`, `worker/src/starter_worker/graph_mail.py`).
- User-created, role-changed and user-status-changed events persist notifications and background jobs (`src/services/notifications/service.ts`, `src/services/api/user-admin.ts`). Recipient emails are deduplicated and templates cover the five supported locales.
- The worker updates queued/retrying/sent/failed states and uses attempt-scaled linear job backoff for mail, with three attempts by default (`worker/src/starter_worker/main.py`, `db.py`, `config.py`). Teams delivery now has its separately reconciled fixed interval.
- Platform admins can review recent notifications and toggle the three supported event types (`src/services/notifications/admin.ts`, `src/app/api/notifications/`, `src/components/notifications/NotificationAdminPanel.tsx`).
- An explicitly queued `inbound_mail_poll` job retrieves and persists inbound mail, deduplicates provider IDs, correlates bounce references and links structured entity references. Processing exists; periodic scheduling does not.

## Remaining work

| Requirement                             | Observed gap                                                                                                                                                              | Evidence                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| FR-002                                  | Scope-assignment notifications are not wired. The enum alone does not deliver the event.                                                                                  | Only three queue functions and supported event types exist; task T015 explicitly deferred scope assignment. |
| FR-009; Notification Type Configuration | Recipient selection is fixed to the affected user plus active platform admins other than the acting admin. Per-event recipient rules are neither stored nor configurable. | `buildRecipients` and the enabled-only configuration model/service.                                         |
| FR-011; SC-006                          | Inbound polling can process a queued job, but no configurable mailbox polling timer schedules it.                                                                         | The main worker loop schedules Teams polling only; config has no mailbox polling interval.                  |
| FR-014                                  | Notification log access is platform-admin-only; scope admins cannot view their scope's entries.                                                                           | `GET /api/notifications` requires PLATFORM_ADMIN and its query has no scope filter.                         |
| Credential-expiry edge case             | Delivery failures are logged/retried, but no in-app platform-admin alert is created for mailbox authentication failure.                                                   | Worker failure path and Graph error handling.                                                               |
| High-volume edge case                   | Serial jobs and attempt-scaled linear retries exist, but no explicit provider send pacing or Retry-After handling is implemented.                                         | Worker loop and Graph request error handling.                                                               |

## Validation limits

The browser review exposed a log-filter response race: an older fetch could overwrite the newest filter results. The panel now applies only its latest request's result/loading state. The admin-filter browser regression now deliberately releases an older response last and passes. Login/password change and notification creation also pass in the production-build browser run (three checks total).

Existing unit/integration tests cover the implemented slices. The PostgreSQL worker regressions pass, including job and inbound-processing behavior. These tests do not establish live Microsoft 365 delivery, delivery-latency/99% targets, the missing scheduler, recipient rules or scope access. No real email was sent during this review.

## Reconciliation

The early foundation-only prose and all-checked task list were stale in different directions. Preserve the original stories and requirements. Keep the spec In Progress, reopen completion task T032, and add explicit remaining-work tasks. Archive only after those requirements are implemented and validated or the user explicitly revises the scope.
