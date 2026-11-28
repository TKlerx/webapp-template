---
name: test-design-review
description: Design and review automated software tests around observable behavior, regression risk, and fault detection. Use when writing or reviewing regression tests, choosing test cases for changed behavior, or assessing what an existing suite actually verifies.
---

# Test Design and Review

Use Goal–Question–Metric to choose tests and evaluate them in context. Start with the behavior at risk and choose evidence that answers a concrete question about it.

## Goal

Identify the behavior the user or caller relies on and a plausible way it could break. Read the relevant requirement, bug report, change, and nearby tests. Reuse the project's test runner, fixtures, and conventions. Choose a test level that exercises the risk at the right boundary. Use a focused unit test for a local rule and an integration test when the failure depends on components working together.

## Question

Ask what would convince you that the test protects the behavior.

- Choose inputs that distinguish correct behavior from the likely failure. Use values at and around a boundary when the rule changes there. Cover invalid inputs or failure paths when the contract defines their outcomes.
- Assert the relevant output, error, or side effect. Assert an interaction when the interaction itself is part of the contract. Check whether the test would survive a behavior-preserving refactor.
- Derive expected values from the contract, a worked example, or another independent source. For a cart with line prices of 10 and 5, assert a total of 15. Calculating the expected total with the same logic as the implementation can reproduce the same mistake.
- Use the interface a real caller uses. When you need to control an external dependency such as a network service or a clock, reuse an available test double at that boundary and exercise the behavior under test directly.
- Prefer an existing test when it already catches the failure. Add a case when it provides distinct evidence. Review setup cost, determinism, and failure clarity when they affect the suite's purpose.

## Evidence

- For a bug fix, run the focused test against the buggy behavior when feasible and confirm it fails for the intended reason. Run it again with the fix and execute relevant neighboring tests as appropriate. If only the fixed behavior was exercised, report that limit.
- For changed behavior, run the relevant tests and check that assertions distinguish materially different outcomes. Use coverage to locate unexercised paths. When the project already supports mutation testing and assertion strength is uncertain, use a targeted run and inspect the surviving changes relevant to the contract.
- In a review, name the behavior at risk, point to the affected test or missing case, and describe a plausible failure the suite could miss. Report verified evidence and clearly identify inferred gaps.

Example. Free shipping starts at €50. A test that checks free shipping at exactly €50 catches a change from `>=` to `>`. Tests at €20 and €80 could execute both branches and miss that change.

## Test-first development

When the task calls for TDD, take one observable behavior at a time. Confirm the focused test fails for the intended reason, make the smallest change that passes it, and refactor with the tests green. Use what you learned to choose the next case.

Adapted from [Jovanovikj et al., *Context-specific Quality Evaluation of Test Cases* (2018)](https://doi.org/10.5220/0006724405940601). The paper applies its quality plan to industrial system test cases. This workflow applies the same reasoning to automated test design and review.
