# PR #66 user-management review

Reviewed commit `8fa8720` against base `fc22392`. [Pull request](https://github.com/TKlerx/webapp-template/pull/66)

## First pass

### P2 · A stalled create-user request can trap the administrator

While the POST is pending, the dialog disables Cancel, Close, Escape, and outside-click dismissal. In Chromium, holding the response kept all four dismissal paths unavailable. The fetch has no application timeout. Provide a bounded recovery path and account for the possibility that the server created the account before the response was lost. [Dismissal controls](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L98-L109) · [Request](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L44-L55)

### P3 · Pending submissions accept edits that are never sent

In Chromium, I changed the email while the create request was pending. The visible field showed the correction, but the request contained the original address. A successful response then closed the dialog and cleared the correction. Make the fields read-only while submitting and restore editing when the request fails. [Request payload](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L50-L69) · [Editable field](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L120-L131)

## Second pass

### P2 · Keyboard focus can escape the dialog during submission

In Chromium, I pressed Enter on **Create user** and held the POST response. The button's loading state disabled the focused control, and focus fell to the document body. Tab reached the **Dashboard** link behind the still-visible dialog, and Enter navigated away with the request unresolved. Keep focus on a stable element inside the modal throughout submission and verify that Tab stays inside it until dismissal. [Submit button](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L186-L192)

The second pass covered all 13 changed files at the same head. A keyboard selection of **Scoped Admin** produced `SCOPE_ADMIN` in the submitted payload. A simulated HTTP 503 remained visible inline in the dialog. Joern passed, and the `validate` job was still running at the end of the pass. [Validate job](https://github.com/TKlerx/webapp-template/actions/runs/45485935594/job/138771190407)

## Third pass

### P2 · Mantine fields lose their visible keyboard focus indicator

In Chromium, I used Tab to focus the create-user **Name** and **Role** fields and a **Role** selector in the Users table. Each matched `:focus-visible`, but its border, outline, and shadow were identical before and after focus. Mantine changes the input border to show focus and suppresses the browser outline. The `border-border` utility overrides that border in the utilities layer. The previous inputs and selects drew a focus ring. Restore Mantine's focused border or add a visible `focus-visible` outline to both components. [Create-user input styles](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L24-L26) · [Table role selector styles](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/UserManagementTable.tsx#L111-L120)

Reviewed all 13 changed files again at `8fa8720` against `fc22392`. Joern passed, and `validate` was still running when checked. [Validate job](https://github.com/TKlerx/webapp-template/actions/runs/45485935594/job/138771190407)

## Fourth pass

### P3 · A hidden Role dropdown still accepts keyboard selections

At 320 px in Chromium, I opened a table row's **Role** selector and scrolled the table horizontally with the wheel until the selector was fully clipped. Mantine hid the dropdown, but the input retained focus and reported `aria-expanded="true"`. Arrow keys and Enter still selected an invisible option and sent a role-change PATCH. I intercepted the request and returned HTTP 503, so no account was changed. Close the dropdown or suppress option selection when the trigger is fully clipped. [Table scroll container](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/UserManagementTable.tsx#L77-L85) · [Role selector](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/UserManagementTable.tsx#L111-L135)

Reviewed all 13 changed files at the same head. The document stayed within the 320 px viewport, and a rejected role change kept the original value and displayed the error. Both GitHub checks passed for `8fa8720`. [Joern](https://github.com/TKlerx/webapp-template/actions/runs/45485935594/job/138771189746) · [Validate](https://github.com/TKlerx/webapp-template/actions/runs/45485935594/job/138771190407)

## Fifth pass

### P3 · Role dropdowns lose typeahead and first/last keyboard navigation

The previous Radix selects let users type an option's first letters or use Home and End to move to the first or last option. In Chromium on this PR, typing **P** with the create-user dropdown open left **Scoped User** active instead of moving to **Platform Admin**. Home and End also left the active option unchanged. The table's Role dropdown likewise ignored typing **S** while **Platform Admin** was active. Restore the keyboard shortcuts in both selectors. [Create-user Role selector](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/CreateUserDialog.tsx#L143-L159) · [Table Role selector](https://github.com/TKlerx/webapp-template/blob/8fa8720f12466cc29406a706928c47476da325ca/src/components/auth/UserManagementTable.tsx#L111-L137)

Reviewed all 13 changed files at `8fa8720`. Arrow keys and Enter still selected a different role, and Escape closed the dialog and returned focus to its launcher. Both GitHub checks remain green.

## Sixth pass

Reviewed all 13 changed files again at `8fa8720` against `fc22392`. No additional finding. In Chromium at 360 px, I used the table's **Approve**, **Deactivate**, and **Reactivate** controls on a disposable PostgreSQL fixture. Each request returned HTTP 200 and updated the row to the expected status. The final **Active** status persisted after a full reload.

## Fixes

- Create-user requests time out after 15 seconds. If the outcome is uncertain, the form keeps its values and the Users table refreshes so the administrator can check for the account before retrying.
- During submission, the fields are read-only and focus moves to the email field before the submit button becomes disabled.
- Create-user fields and both Role selectors show a visible keyboard focus outline. The Role selectors support typeahead, Home, and End. The table selector closes when fully clipped and prevents a hidden selection from sending a role change.

Verified the production build, all 375 Vitest tests, and 12 focused Playwright tests against disposable PostgreSQL. The timeout regression confirms that an account created by the server still appears in the refreshed table when the browser never receives the response.
