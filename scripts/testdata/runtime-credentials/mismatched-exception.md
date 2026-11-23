# Runtime Credential Fixture

## Credential Inventory

| Setting               | Owner  | Purpose       | Required In    | Exception |
| --------------------- | ------ | ------------- | -------------- | --------- |
| `GRAPH_CLIENT_SECRET` | worker | Mail delivery | Worker runtime |           |

## Runtime Exposures

| Runtime | Setting               | Exception |
| ------- | --------------------- | --------- |
| app     | `GRAPH_CLIENT_SECRET` | EX-001    |

## Exceptions

| ID     | Settings        | Owner               | Rationale            | Compensating Control | Review Date | Status   |
| ------ | --------------- | ------------------- | -------------------- | -------------------- | ----------- | -------- |
| EX-001 | `TEAMS_ENABLED` | Template maintainer | Shared feature state | Non-secret flag      | 2099-12-31  | accepted |
