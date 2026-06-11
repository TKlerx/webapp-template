# Feature Specification: Ops Health Dashboard

**Feature Branch**: `021-ops-health-dashboard`  
**Created**: 2026-06-11  
**Status**: Draft  
**Input**: User description: "Create an Ops / Health dashboard for administrators and developers to quickly understand a running environment. It should show app version/build metadata, environment, revision, build id, build time, core runtime health, database connectivity, auth/config sanity, worker/deploy smoke status where available, and clear degraded/unknown states without exposing secrets. Include the existing CONTINUE.md and CONTINUE_LOG.md housekeeping changes in the same PR."

> Before drafting or implementing this feature, review `/CONTINUE.md` for the latest handoff context and current recommended next steps.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Identify Running Environment (Priority: P1)

An administrator or developer opens the ops dashboard in a dev, staging, or production-like environment and immediately sees which environment and build they are inspecting.

**Why this priority**: Fast fault triage requires knowing the exact deployed version before looking at logs or reproducing a bug.

**Independent Test**: Can be tested by opening the dashboard with known build metadata and confirming the visible environment, version, revision, build id, and build time match the running deployment.

**Acceptance Scenarios**:

1. **Given** a running deployment with complete build metadata, **When** an authorized operator opens the dashboard, **Then** the dashboard shows environment, version, revision, build id, and build time in a copyable or easily transcribed form.
2. **Given** a local or manually started environment with partial metadata, **When** an authorized operator opens the dashboard, **Then** the dashboard shows available metadata and clearly labels missing values as unknown instead of inventing values.

---

### User Story 2 - Assess Operational Health (Priority: P2)

An administrator checks whether the core runtime, database connectivity, authentication/configuration readiness, worker readiness, and deployment smoke status are healthy, degraded, or unknown.

**Why this priority**: Operators need a single first-stop view before deciding whether to inspect logs, infrastructure, database state, or deployment history.

**Independent Test**: Can be tested by viewing the dashboard under healthy and intentionally degraded conditions and confirming each health area reports the correct state with concise supporting detail.

**Acceptance Scenarios**:

1. **Given** all required runtime checks pass, **When** the dashboard loads, **Then** each health area is marked healthy and the overall state is healthy.
2. **Given** one required runtime check fails, **When** the dashboard loads, **Then** that health area is marked degraded, the overall state is degraded, and the dashboard indicates the next area to investigate without exposing secret values.
3. **Given** optional smoke or worker status is not available in the current environment, **When** the dashboard loads, **Then** that area is marked unknown or unavailable without causing the whole dashboard to appear failed.

---

### User Story 3 - Share Safe Diagnostic Context (Priority: P3)

An administrator copies or shares the dashboard's non-secret diagnostic summary in an issue, support thread, or incident note.

**Why this priority**: Reproducible fault reports improve when operators can share environment and health context without manually redacting credentials.

**Independent Test**: Can be tested by using the dashboard's visible summary in a report and verifying it contains useful metadata and health state but no secret values or sensitive configuration contents.

**Acceptance Scenarios**:

1. **Given** a deployment with configured secrets and service URLs, **When** an operator views or copies diagnostic context, **Then** the shared content includes status labels and safe identifiers but excludes raw secrets, tokens, passwords, connection strings, and private keys.
2. **Given** a dashboard health area has degraded status, **When** an operator reads the diagnostic detail, **Then** the detail explains the failing area in plain language without revealing sensitive values.

### Edge Cases

- Build metadata is missing, partial, malformed, or still using a legacy revision variable.
- Database connectivity is slow or unavailable when the dashboard is opened.
- Authentication/configuration readiness is degraded because required settings are absent, but their values must remain hidden.
- Worker or deployment smoke status has not been recorded for the current environment.
- The viewer is not authorized to access operational diagnostics.
- Multiple checks have mixed states; the overall status must communicate the most severe state without hiding individual details.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide an ops dashboard intended for authorized administrators and developers.
- **FR-002**: System MUST show current environment identity, version, revision, build id, and build time when available.
- **FR-003**: System MUST label missing or unavailable metadata as unknown or unavailable without blocking access to other dashboard information.
- **FR-004**: System MUST show an overall health state derived from individual health areas.
- **FR-005**: System MUST show individual health states for core runtime availability, database connectivity, authentication/configuration readiness, worker readiness where available, and deployment smoke status where available.
- **FR-006**: System MUST distinguish healthy, degraded, and unknown or unavailable states.
- **FR-007**: System MUST include concise operator-facing detail for degraded and unknown states so the next investigation area is clear.
- **FR-008**: System MUST avoid exposing raw secrets, tokens, passwords, private keys, full connection strings, or other sensitive configuration values.
- **FR-009**: System MUST allow operators to copy or transcribe a non-secret diagnostic summary containing environment/build identifiers and health states.
- **FR-010**: System MUST remain usable when one health check is slow, fails, or cannot be determined.
- **FR-011**: System MUST be clear enough to use in local development, staging, and production-like deployments.
- **FR-012**: System MUST make access to operational diagnostics available only to authorized users.

### Key Entities

- **Environment Identity**: The environment and build metadata that identify the running deployment, including environment name, version, revision, build id, and build time.
- **Health Check Result**: A named operational check with a status, short explanation, optional timestamp, and safe diagnostic detail.
- **Diagnostic Summary**: A non-secret collection of environment identity and health check states suitable for sharing in issue reports or incident notes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An authorized operator can identify the running environment and build in under 15 seconds after opening the dashboard.
- **SC-002**: At least 95% of routine triage sessions can determine whether the app, database, configuration, worker, or deployment smoke area is the first investigation target from the dashboard alone.
- **SC-003**: The dashboard remains usable and shows available results when at least one optional or degraded check cannot report status.
- **SC-004**: Diagnostic summaries generated from the dashboard contain zero raw secret values during security review.
- **SC-005**: A healthy environment reports healthy overall status within 5 seconds for a typical operator view.

## Assumptions

- The initial audience is administrators and developers with existing access to operational or admin areas.
- The first version should prioritize safe, high-signal status over deep remediation workflows.
- Worker and deployment smoke details may be unavailable in some local environments; this should be represented as unknown or unavailable rather than failure.
- The dashboard should reuse existing build metadata and operational validation concepts already present in the project.
