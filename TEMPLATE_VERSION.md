# Template Version

- Template repo: `https://github.com/TKlerx/webapp-template.git`
- Default branch: `main`
- Recorded upstream template commit: `0a0c1dfaa7c31378d3ed4c2f0ac136857e393826`
- Short commit: `0a0c1df`
- Recorded at: `2026-04-01`
- Version label: `main@0a0c1df`

## Purpose

This file gives humans a quick way to see which upstream template revision this repository is recorded against.

For machine-readable tooling and downstream propagation, also see `.template-origin.json`.

Because commit hashes are self-referential, a repository cannot permanently store its own exact current commit hash inside the same commit without changing that hash. The practical pattern is to record the latest known upstream baseline and refresh it after pulling template updates.

This file is intentionally shipped with the template so a copied repository still carries a usable upstream baseline even if Git history is removed.

## Downstream Usage

When a product app is created from this template, keep both `TEMPLATE_VERSION.md` and `.template-origin.json`.

Then run:

```powershell
npm run template:stamp
```

When the app later pulls in upstream template fixes:

1. Apply the upstream template change.
2. Run `npm run template:stamp`.
3. Commit the updated `.template-origin.json` and `TEMPLATE_VERSION.md`.

That gives each downstream app a visible and scriptable record of the template version it is based on.
