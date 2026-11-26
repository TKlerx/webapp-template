# Clarifications: Mantine UI Migration

These decisions capture the existing roadmap and specification as reviewed on
2026-11-25.

- The saved application theme drives Tailwind utilities, Mantine, and native
  browser controls, including when it differs from the OS preference (US1).
- The migration covers the controls and workflows listed in the spec. Keep
  native forms and semantic structures, and retain specialized components such
  as the existing account menu and assistant (FR-004, FR-005).
- Independent notification settings, user rows, and Teams targets can save in
  parallel. Duplicate actions on the same pending item are blocked, and
  failures retain confirmed values and support retry (FR-002).
- Existing access rules, API payloads, and persistent state remain the
  contracts. Spec 014 retains the outstanding delivery and scope work (FR-004,
  FR-006, FR-007).
- Browser acceptance uses the production build under a non-root base path and
  disposable PostgreSQL. Teams scenarios use provider-free fixtures (FR-006).
