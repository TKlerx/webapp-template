# [BUG] Teams config creation is non-atomic

**File:** [`src/services/teams/admin.ts`](https://github.com/TKlerx/webapp-template/blob/main/src/services/teams/admin.ts#L11-L18) (lines 11, 18)
**Project:** webapp-template
**Severity:** BUG  •  **Confidence:** high  •  **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `tklerx@paiqo.com` _(via last-committer)_

## Finding

getOrCreateTeamsConfig first calls findFirst and then creates a fixed id of "default" when no record exists. Two concurrent first-time callers can both observe no config, then one create succeeds and the other hits a unique constraint, causing an avoidable 500 on startup or first admin/worker access.

## Recommendation

Use prisma.teamsIntegrationConfig.upsert with the default id, or catch the unique-constraint error and re-read the existing config.

## Recent committers (`git log`)

- Timo Klerx <tklerx@paiqo.com> (2026-05-11)
