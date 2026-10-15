# Research: Logging Standardization

## Decision 1: Extend existing structured logger

**Decision**: Keep `src/lib/logger.ts` as the application logging entry point and extend it with explicit event/context conventions.

**Rationale**: The app already emits JSON logs, supports log levels, child metadata, request ID creation, and recursive redaction. Replacing it would add migration cost without solving the clarified requirements.

**Alternatives considered**:

- Add a third-party logger: rejected because the constitution requires minimal dependencies and the existing logger already covers the core behavior.
- Use raw `console.*` consistently: rejected because it does not enforce structure, redaction, or contract compliance.

## Decision 2: Structured request-completion logging is enabled by default

**Decision (user-approved 2026-10-15)**: Emit structured request-completion logs by default, including with an unset ENABLE_REQUEST_LOGGING variable. Allow an explicit false setting to disable them. This supersedes the earlier opt-in decision. Record proxy-visible status and proxy handling duration.

**Rationale**: The user prefers useful operational visibility immediately. Structured, redacted completion events support that default while an off switch controls volume.

**Alternatives considered**:

- Keep request-start logging: rejected because completion events provide status and duration.
- Log both start and completion by default: rejected because it doubles volume for limited value in this app scale.

## Decision 3: Privacy-first metadata policy

**Decision**: Operational logs may include stable internal IDs, event names, components, request/job IDs, status, duration, sanitized paths, and allowlisted query fields. They must not include raw emails, display names, bearer tokens, cookies, full URLs, arbitrary query strings, message bodies, or secret-like fields.

**Rationale**: The project already stores audit data separately. Operational logs should support diagnosis without becoming a secondary sensitive data store.

**Alternatives considered**:

- Allow emails/display names for debugging: rejected because the clarified requirement says stable internal IDs by default.
- Log full URLs and redact known keys afterward: rejected because allowlisting is safer than denylisting arbitrary query parameters.

## Decision 4: Python worker parity via stdlib JSON formatting

**Decision**: Add or refactor a small worker logging helper using Python stdlib logging/json to match the shared contract.

**Rationale**: The worker currently logs formatted strings. A lightweight helper provides structured job lifecycle events without adding dependencies.

**Alternatives considered**:

- Add a Python structured logging package: rejected as unnecessary for the current scope.
- Leave worker logs as strings: rejected because User Story 2 requires parity and safe metadata.

## Decision 5: Guardrails through validation

**Decision**: Add validation that scans production app and worker source paths for ad hoc `console.*`/unsafe output, while allowing scripts, tests, and the logger implementation itself.

**Rationale**: The clarified scope is production app/worker paths only. A focused guard avoids false positives in CLI tooling while blocking regressions where they matter.

**Alternatives considered**:

- Ban `console.*` globally: rejected because scripts and validation tooling legitimately use console output.
- Rely on review only: rejected because the spec requires automated validation.
