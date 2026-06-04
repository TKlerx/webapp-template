# [BUG] Deleting intake subscriptions with history returns an unhandled database error

**File:** [`src/services/teams/admin.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/teams/admin.ts#L174-L175) (lines 174, 175)
**Project:** webapp-template
**Severity:** BUG  •  **Confidence:** high  •  **Slug:** `other-unhandled-constraint`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

deleteIntakeSubscription directly deletes by id, but TeamsInboundMessage has a restrictive foreign key to TeamsIntakeSubscription. Once a subscription has ingested messages, the DELETE route will surface a Prisma/foreign-key failure instead of a controlled response, leaving admins unable to delete it cleanly and producing a 500-style failure path.

## Recommendation

Mirror deleteDeliveryTarget: count related inbound messages first and return a 409 advising deactivation, or change the data model/delete semantics intentionally.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
