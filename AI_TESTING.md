# AI-Assisted Testing Defaults

Source note: Adapted from Jovanovikj et al., "Context-specific Quality Evaluation of Test Cases" (MODELSWARD 2018). Do not fetch or read the paper during normal coding work; use the rules below as the operational policy.

When writing or modifying tests, use a lightweight context-specific test quality process inspired by Goal-Question-Metric / Test Case Quality Plan thinking.

Use `$test-design-review` when choosing or reviewing regression checks. For a
feature with a Spec Kit spec, use SpecTest to identify candidate gaps, then
assess the observable behavior and the assertions that protect it.

Before writing tests:

- Identify the test context: unit, integration, regression, UI, contract, migration, security, etc.
- Identify the risk the tests should reduce.
- State the quality goal in one sentence.

When proposing tests:

- Prefer behavior-focused tests over implementation-detail tests.
- Each important test should protect a real behavior, invariant, contract, or known risk.
- Include boundary, failure, and regression cases when relevant.
- Avoid tests that only assert that code runs without checking meaningful outcomes.
- Avoid excessive mocking, especially mocking the behavior under test.
- Use clear test names that describe the expected behavior.

After writing tests:

- Review tests for fault-revealing capability, readability, maintainability, brittleness, redundancy, and missing assertions.
- For bug fixes, ensure at least one test would fail on the old behavior when feasible.
- Run the relevant test command.
- If tests are weak, revise them instead of merely adding more coverage.

When using AI to generate tests:

- First draft a short test plan listing scenarios, risks covered, and expected outcomes.
- Then implement the tests.
- Then critique the generated tests against the quality goals above.

## Mutation testing

The Validate workflow runs the focused TypeScript and Python mutation suites on pull requests and pushes to main. Both require a 95% score. Validate also runs the existing CLI release checks with `pnpm run test:mutation:critical` and fails on any survivor. Run them locally with `pnpm run test:mutation:next` (request validation, HTTP errors and API response schemas) and `pnpm run test:mutation:python` (Teams Graph delivery).

## SpecTest

In Codex, use `$speckit-spectest-gaps specs/<feature>` to look for acceptance criteria that may lack tests. `$speckit-spectest-coverage` maps criteria to candidate tests. Both commands are read-only. Review their matches against actual assertions with `$test-design-review` before treating a criterion as covered. SpecTest reports are advisory. The existing mutation jobs continue to measure how well tests detect code changes.

`$speckit-spectest-plan` writes a test plan, and `$speckit-spectest-generate` creates scaffolds. Use these only when their output is needed, and complete the assertions before adding generated tests to the suite.
