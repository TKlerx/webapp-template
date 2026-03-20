# Research: Dashboard & Home Screen

**Date**: 2026-03-20
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## R1: Dashboard Data Fetching Strategy

**Decision**: Use Next.js server components with parallel data fetching via `Promise.all`. Each dashboard section fetches its own data independently. The dashboard page component determines the user's role from the session and renders the appropriate dashboard variant.

**Rationale**: Server components avoid shipping aggregation logic to the client and keep the bundle small. `Promise.all` ensures sections fetch concurrently rather than sequentially, meeting the 3-second performance target (SC-001). Each section is wrapped in a React `Suspense` boundary so a slow or failed section does not block others (FR-011).

**Alternatives considered**:
- Single aggregation API call (`GET /api/dashboard`) returning all data at once -> accepted as a secondary approach for the API contract, but the page itself can also fetch directly from Prisma in server components, avoiding the HTTP hop. The API route exists for potential future use by mobile clients.
- Client-side fetching with `useEffect` for all sections -> rejected: unnecessarily ships data fetching to the client, slower initial paint, requires loading spinners for everything.
- React Server Components with streaming (PPR) -> considered but not needed at this scale. Standard Suspense boundaries suffice for ~10 users.

**Implementation**:
- Dashboard page (`src/app/(dashboard)/page.tsx`) reads session, determines role, renders `AdminDashboard`, `CountryFinanceDashboard`, or `CountryAdminDashboard`.
- Each dashboard variant uses `Promise.all` to fetch its sections' data in parallel from Prisma.
- Each section is wrapped in `<Suspense fallback={<SectionSkeleton />}>` for independent loading.
- If a section's data fetch throws, an error boundary renders a retry button instead of crashing the whole page.

## R2: Notification Polling Strategy

**Decision**: Client-side polling via `setInterval` at a configurable interval (default 30 seconds). The `NotificationBell` component is a client component that polls `GET /api/notifications/unread-count` and updates the badge count.

**Rationale**: For ~10 concurrent users, polling at 30-second intervals generates negligible server load (~20 requests/minute total). This is far simpler than WebSockets or Server-Sent Events, which would require persistent connection management and add infrastructure complexity.

**Alternatives considered**:
- WebSocket connection for real-time updates -> rejected: over-engineering for 10 users. Adds connection management, reconnection logic, and server-side WebSocket support.
- Server-Sent Events (SSE) -> rejected: simpler than WebSocket but still requires persistent connections and has browser connection limits. Not justified at this scale.
- No polling (update only on page navigation) -> rejected: does not meet FR-010 ("update without full page reload") or SC-004 (30-second freshness).

**Implementation**:
- `NotificationBell` is a `"use client"` component.
- On mount, it fetches `GET /api/notifications/unread-count` immediately, then sets up `setInterval` at 30s.
- Interval is cleared on unmount.
- Polling interval is defined as a constant (easy to adjust, no env var needed for 10 users).
- On click, the dropdown fetches `GET /api/notifications?limit=5` to show recent notifications.
- Clicking a notification calls `PATCH /api/notifications/[id]/read` and navigates to the linked entity.

## R3: Activity Feed Data Source

**Decision**: Query the existing `AuditEntry` model (from Feature 1, R5) filtered by recent timestamps and relevant action types. No separate event or activity model is needed.

**Rationale**: The audit trail already records all the actions that should appear in the activity feed: receipt uploads, review decisions, proposal updates, budget changes. Creating a separate "activity" or "event" model would duplicate this data. The spec's assumptions section explicitly states: "Recent Activity feed entries are derived from the existing audit trail."

**Alternatives considered**:
- Separate `ActivityEvent` model optimized for feed display -> rejected: duplicates data already in `AuditEntry`, adds write overhead to every mutation endpoint.
- Denormalized "feed" table populated by triggers -> rejected: SQLite trigger support is limited, and Prisma does not manage triggers. Also duplicates data.

**Implementation**:
- Query `AuditEntry` with `orderBy: { createdAt: 'desc' }`, `take: 10`.
- Filter by relevant `action` types: `RECEIPT_UPLOADED`, `RECEIPT_REVIEWED`, `RECEIPT_FLAGGED`, `BUDGET_PROPOSAL_CREATED`, `BUDGET_PROPOSAL_APPROVED`, `BUDGET_PROPOSAL_REJECTED`, `BUDGET_ITEM_CREATED`, `BUDGET_ITEM_UPDATED`.
- For Admin dashboard: no country filter (sees all countries).
- For Country Admin dashboard: filter by `countryId` matching the user's assigned countries.
- Include related `User` (actor) data for display names.
- The `details` JSON field on `AuditEntry` contains enough context (entity type, entity ID, description) to render a human-readable activity entry with a link to the relevant page.
