# PR #65 audit pagination review

Reviewed commit `e43f2f8` against base `9117569`. [Pull request](https://github.com/TKlerx/webapp-template/pull/65)

## First pass

### P3 · The focused pagination control can move out of view

In Chromium at 900 × 650, activating **Previous** with Enter from a one-row final page loaded 25 rows. **Previous** retained DOM focus, but its top moved to 1,275 px on a 650 px viewport. A keyboard user can no longer see the focused control. Keep the pager above the rows or bring the still-focused control into view after the response. [Pager placement](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L237-L255)

### P3 · The pager can disappear without handing off focus

When page two returns a total of one page, the viewer correctly reloads page one and removes the pager. In Chromium, activating page two in that scenario moved focus to `document.body`. Move focus to a stable target when the focused control is removed. [Page correction](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L81-L86) · [Pager condition](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L242)

All 15 audit unit tests and three audit Playwright tests passed locally. Joern passed in CI. The required `validate` job stopped at a Go checksum service error before it ran full validation. [CI job](https://github.com/TKlerx/webapp-template/actions/runs/45476701833/job/138738701219)

## Second pass

### P3 · The selected page cannot be retried after a transient failure

The pager now stays visible after a request fails, including the enabled control for the failed page. I returned HTTP 503 once for page three. Pressing Enter again on the focused **Page 3 of 12** control sent no request and left the error visible. The click sets the existing page number, so the fetching effect does not run again. Provide an explicit retry that reloads the current page while preserving its filters and keyboard focus. [Page controls](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L266-L274) · [Fetch dependencies](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L99-L102)

The second pass covered all four changed files. In Chromium at 375 px, the 12-page pager fit without horizontal overflow and kept focus when navigating to page 12. A delayed page-two response did not replace the already displayed page three. **Previous** still recovered from a failed request.

The table set `aria-busy="true"` during a held request and cleared it when the requested rows appeared. All 375 Vitest tests, TypeScript, and targeted ESLint passed.

## Third pass

Reviewed the same head, `e43f2f8`. No separate issue emerged, but the focus-loss finding also applies when the pager stays mounted. In Chromium, activating **Page 3 of 3** and returning a total of two pages caused the viewer to load page two and keep the two-page pager visible. The focused page-three button disappeared and focus fell back to `document.body`. The focus handoff needs to cover removal of an individual numbered control as well as removal of the whole pager. [Page correction](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L81-L86) · [Numbered controls](https://github.com/TKlerx/webapp-template/blob/e43f2f8da873991bd44bda954ea4be64bcd40b09/src/components/audit/AuditTrailViewer.tsx#L262-L277)

The Chromium pass also checked native Tab order and changing a filter while a later page was loading. The filter requested page one, and the cancelled request's late HTTP 503 did not replace the current rows. All supported locales contain the four pagination labels.

## Fourth pass

Reviewed the same head, `e43f2f8`, and found no additional issues. In Chromium against a local PostgreSQL database, the audit list returned 25 of 26 matching records on page one. Pressing Enter on **Page 2 of 2** loaded the final record, updated the record range and `aria-current`, and kept focus on the button.

Exporting CSV from page two sent both active filters and downloaded all 26 matching records in order. Page two stayed selected after the download.

## Fixes

- Moved the pager above the table so a longer page cannot push the focused control out of view.
- When a focused page button disappears, moved focus to the selected page button. If the pager disappears, moved focus to the Audit Trail table.
- Added a localized **Retry** button. Activating the selected page again after an error also retries the same request with the active filters.

Verified the production build, all seven audit Playwright tests against disposable PostgreSQL, all 15 audit unit tests, TypeScript, and targeted ESLint and Prettier.
