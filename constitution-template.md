# Project Constitution Template

> Reusable constitution for Next.js + Docker + Azure OpenAI web applications.
> Copy this file, rename project-specific values, and adjust to your needs.

## Core Principles

### I. Simplicity First

Every feature MUST start with the simplest viable implementation.
YAGNI (You Aren't Gonna Need It) applies to all decisions.
No abstractions, patterns, or indirections unless justified by
a concrete, current requirement. Three similar lines of code are
preferred over a premature helper. Complexity MUST be justified
in writing (e.g., in a plan or PR description) before introduction.

### II. Test Coverage

All features MUST have meaningful test coverage before merging.
Unit tests cover individual functions and services. Integration
tests cover API endpoints and user-facing workflows. Tests MUST
be automated and runnable via a single command. Mocking of external
services (Azure OpenAI) is required in unit tests; integration
tests MAY use live services when explicitly configured. Code
coverage tooling MUST be configured and coverage MUST NOT decrease
on any PR. Task generation MUST include test tasks for every user
story -- tests are not optional.

### III. Duplication Control

Avoidable duplication MUST be treated as a quality issue, not a
cleanup task for later. New changes MUST not introduce repeated
logic, markup, or configuration when a small shared abstraction
would clearly reduce maintenance cost. Duplication checks MUST be
part of the validation workflow, with documented thresholds and
explicitly justified exceptions. If duplication is retained
intentionally, the reason MUST be stated in the plan, task, or
review context.

### IV. Incremental Delivery

Development follows iterative, incremental steps. Each increment
MUST deliver independently testable and demonstrable value. User
stories are prioritized (P1, P2, P3...) and implemented in order.
A working MVP (User Story 1) MUST be validated before proceeding
to subsequent stories. Feature branches MUST be small and focused;
large changes MUST be broken into reviewable increments.

### V. Azure OpenAI Integration

All LLM functionality MUST use Azure OpenAI as the provider.
API keys and endpoint configuration MUST be managed via environment
variables or a secure configuration mechanism -- never hardcoded.
The application MUST handle Azure OpenAI rate limits, transient
errors, and quota exhaustion gracefully with appropriate retries
and user feedback. The integration layer MUST be encapsulated so
that switching models or adjusting parameters does not require
changes across the codebase.

### VI. Web Application Standards

The application MUST be a web application served under a
configurable base path (e.g., `/app-name`). The base path
MUST be configurable via environment variable or configuration
file. All routes, static assets, and API endpoints MUST respect
the configured base path. The UI MUST be usable by non-technical
users without developer assistance -- prioritize clarity and ease
of use over technical sophistication. User actions MUST provide
feedback via toast notifications displayed for approximately
3 seconds.

## Technology Constraints

- **Runtime**: TypeScript with Next.js 16 (App Router) for frontend
  and API routes. Python 3.12+ with uv for package management for
  the background worker service (long-running tasks: AI generation,
  document conversion, background jobs).
- **Styling**: Tailwind CSS 4 with dark/light theme toggle
  (user-selectable, persisted per user).
- **ORM**: Prisma 7 for database access and schema management
  (frontend/API). Worker accesses the same SQLite database directly
  or via a shared library.
- **Authentication**: Dual auth support -- Azure SSO and local
  username/password. Email is the unique user identifier across
  both methods. Azure SSO via BetterAuth (with Admin + SSO plugins).
  New SSO users require Admin approval on first login. Local users
  are created by Admins directly.
- **AI Provider**: Azure OpenAI exclusively. No direct OpenAI,
  Anthropic, or other LLM provider calls in production code.
- **Scale**: Small team (~10 users). Single instance of each
  service (no horizontal scaling needed).
- **Deployment**: Docker with Docker Compose. Two Docker images:
  (1) Node.js image for Next.js frontend + Prisma migrations,
  (2) Python image for the worker service. Three Compose services:
  (a) migration init container runs Prisma migrations before other
  services start, (b) Next.js frontend for UI and quick API routes,
  (c) Python worker for long-running tasks (AI generation, document
  conversion, background jobs). Named volume for database file.
  Web application served under a configurable base path.
- **Database**: SQLite for initial development (named Docker
  volume for the database file). Prisma abstracts the database
  layer, allowing migration to PostgreSQL later.
- **Configuration**: `.env` file for all environment variables
  (secrets, deployment settings, initial admin email). No secrets
  in source control. A `.env.example` MUST be provided.
- **Dependencies**: Minimize external dependencies. Each added
  dependency MUST be justified. Prefer well-maintained, actively
  supported libraries.

## Development Workflow

- **Branching**: Feature branches from `main`. Short-lived
  branches preferred.
- **Code Review**: All changes require review before merge.
- **Testing Gate**: All tests MUST pass before merge. No
  exceptions.
- **Commit Discipline**: Small, focused commits with descriptive
  messages. Each commit SHOULD leave the project in a working
  state.
- **Documentation**: User-facing features MUST include usage
  documentation. API endpoints MUST be documented with request
  and response examples.

## Governance

This constitution is the authoritative reference for all project
decisions. When a conflict arises between this document and any
other guidance, this constitution takes precedence.

**Amendments**: Any change to this constitution MUST be documented
with a version bump, rationale, and date. Amendments follow
semantic versioning:
- MAJOR: Principle removal or incompatible redefinition.
- MINOR: New principle or materially expanded guidance.
- PATCH: Clarifications, wording, or non-semantic refinements.

**Compliance**: All PRs and code reviews MUST verify adherence to
these principles. Deviations MUST be justified in writing and
approved before merge.
