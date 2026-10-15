# Clarifications: Logging Standardization

## Session 2026-06-10

1. Original default logging volume decision: Important operational events are enabled by default; request logs remain configurable and opt-in. Superseded on 2026-10-15 by the user's explicit choice of structured request logging on by default, with an explicit opt-out; the normative spec and contract reflect that choice.
2. Console guardrail scope: Ad hoc console logging is disallowed in production app and worker source paths only.
3. Actor identifiers: Operational logs may include stable internal IDs by default and should avoid emails and display names unless explicitly justified as safe.
4. Request logging contents: When request logging is enabled, emit request completion logs with status and duration.
5. URL/query logging: Request logs include path only; query fields must be sanitized or explicitly allowlisted.
