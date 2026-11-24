# Theme Design

This template uses a deliberately quiet, token-based light/dark theme. The goal is a simple operational UI: readable panels, restrained contrast, and no decorative gradients or heavy visual effects.

## Core Approach

Theme colors live in `src/app/globals.css` as CSS custom properties:

- `:root` defines the light theme.
- `[data-theme="dark"]` overrides only the same tokens for dark mode.
- Components should use the tokens instead of hardcoded theme colors.

Important tokens:

- `--background`: full page background
- `--foreground`: primary text
- `--panel`: main surface/card/panel background
- `--panel-foreground`: text on panel surfaces
- `--accent`: primary action/accent color
- `--accent-foreground`: text on accent surfaces
- `--muted`: quiet borders and disabled surfaces
- `--muted-foreground`: secondary text
- `--accent-soft`: subtle selected/active backgrounds
- `--border`, `--input`, `--ring`: form and focus infrastructure

The current palette uses a muted blue accent.

```css
:root {
  --background: #f5f7fa;
  --foreground: #15233b;
  --panel: #ffffff;
  --accent: #2f6fae;
}

[data-theme="dark"] {
  --background: #0c1320;
  --foreground: #e7eef7;
  --panel: #161f2e;
  --accent: #5b9bd5;
}
```

## Theme Activation

The root layout sets both `data-theme` and `data-mantine-color-scheme` on the
document element using the saved preference. On the client, `ThemeProvider`
updates `data-theme` and sets the same scheme on `MantineProvider`.

Token-based styles follow the saved theme. The production Tailwind build
currently applies `dark:` utilities according to the OS preference. The
[migration plan](mantine-migration-plan.md) tracks aligning those utilities
with the saved theme and adding a regression test.

## User Preference

`src/components/ui/ThemeToggle.tsx`:

- reads the current theme from `ThemeProvider`
- optimistically switches the UI
- persists the preference through `PATCH /api/users/:id/theme`
- rolls back and shows a toast if persistence fails

The stored enum is `LIGHT | DARK`.

## Component Guidelines

Use Mantine for standard interactive components and Tailwind for layout.
Import layered Mantine styles at the feature boundary for route-specific
components, and keep shared styles in `src/app/globals.css`.

Use these token patterns:

- page background: `bg-[var(--background)]`
- panel/card background: `bg-[var(--panel)]`
- main text: inherited `var(--foreground)`
- secondary text: `text-[var(--muted-foreground)]`
- borders: `border-black/10 dark:border-white/10` or `border-[var(--border)]`
- primary action: `bg-[var(--accent)] text-[var(--accent-foreground)]`
- subtle selected state: `bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]`

Avoid:

- one-off dark colors inside components
- decorative gradient backgrounds
- large shadows as the main depth mechanism
- theme-specific component forks

## Design Intent

The dark mode should feel calm rather than flashy:

- near-black blue-gray page background
- slightly lifted panel surfaces
- muted secondary text
- blue accent used sparingly for action and focus
- clear contrast without neon colors

This makes dashboards and admin tools comfortable for long sessions while staying visually minimal.
