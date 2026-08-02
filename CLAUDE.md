# Vance — Project Context for Coding Agents

Read this before making changes. It exists so any agent (Claude Code, Cursor,
Copilot, etc.) picking up this project understands the *why*, not just the
*what* — this codebase has been through several architectural rewrites and
some decisions aren't obvious from the code alone.

## What this is

Vance is a fight-club / combat-sports gym management SaaS, forked from a
generic gym-management template called GymFlow and substantially rebuilt.
Next.js 14 (App Router), TypeScript, Prisma + PostgreSQL, NextAuth (JWT +
credentials, no adapter), Tailwind, Framer Motion, Recharts.

**Database is PostgreSQL only — never SQLite.** `prisma/schema.prisma` has
`provider = "postgresql"`.

## Core architecture — read this part carefully

**Classes ARE the subscription plan.** There is no separate "membership
plan" model. A `GymClass` (e.g. "Kickboxing Adults") has its own weekly
schedule (`daysOfWeek: String[]`, `startTimeOfDay`), a `price`, and a
`durationDays` billing cycle. Fighters sign into a class directly via
`ClassEnrollment` (not a generic plan) and can be enrolled in more than one
class at once (e.g. MMA + Kickboxing simultaneously).

- `ClassEnrollment` = one fighter's subscription to one class. Tracks
  `status` (ACTIVE/FROZEN/EXPIRED/CANCELED), `startDate`/`endDate`, and full
  attribution: `addedById`, `lastAction`, `lastActionById`, `lastActionAt`.
- `ClassAttendance` = one fighter's mark (ATTENDED/ABSENT/EXCUSED) for one
  class on one calendar date. This is both the QR/manual check-in record
  *and* the roster a coach/admin fills in on the "Manage Attendance" page
  (`/dashboard/classes/[id]/attendance`). One row per `(enrollmentId, date)`.
- A subscription auto-expires when **either** condition is met (checked via
  `checkAndExpireEnrollment` in `src/lib/enrollment.ts`, called whenever
  enrollments are read): sessions allotted for the cycle are used up
  (`daysOfWeek.length * durationDays/7`, rounded), **or** today is past
  `endDate`. Whichever comes first.
- "Switch Class" (e.g. Kickboxing → MMA mid-cycle) cancels the old
  enrollment and creates a new one, but **preserves the remaining
  `endDate`** rather than charging again or resetting the clock — no new
  payment. This was a deliberate design call; revisit if the business wants
  proration instead.
- Renewing is a two-step confirm (not one click) — the frontend shows a
  confirmation dialog naming the current logged-in user before the PATCH
  fires, since the request was "record who confirmed each renewal."

**Roles**: ADMIN / RECEPTIONIST / COACH, stored as a plain string on `User`.
Coaches log in and can submit classes/private sessions, which sit as
`PENDING` until an admin approves them (`GymClass.status`). Admin/
receptionist-submitted classes auto-approve. If a coach edits an
already-approved class, it reverts to `PENDING` for re-review — this
prevents a coach bypassing approval by editing after the fact.

**Fighters (the `Member` model)**: email is optional. Every fighter gets an
auto-generated 8-digit `fighterId` (starts at `00002000`,
`generateFighterId()` in `src/lib/enrollment.ts`), which is also how they
log into the self-service portal (`/portal`) — no email needed. Optional
profile photo is a client-side-resized base64 data URI stored directly in
the `photo` column (no object storage configured — if you add real file
storage later, this is the field to redirect).

**Currency defaults to EGP** (Egyptian Pounds) everywhere — `Gym.currency`,
`formatCurrency()` in `src/lib/utils.ts`, seed data. Still configurable per
gym in Settings.

**Coach payroll** is per-session, not salary — `Coach.sessionRate` ×
sessions actually attended (counted from `ClassAttendance` where
`status: 'ATTENDED'`) that month. Separate from salaried `Staff`/
`PayrollRun` (front-desk/management).

**Discipline taxonomy** lives in `src/lib/categories.ts`
(`DISCIPLINE_CATEGORIES`) — kids/adults variants per sport (e.g.
`KICKBOXING_ADULTS`, `MMA_KIDS`). Used consistently by `Branch.sports`
(which disciplines a branch offers), `GymClass.category`, matching them up.

**One-time (single-session) classes**: `GymClass.isOneTime` + `sessionDate`
is an alternative to the recurring `daysOfWeek` schedule — used for a class
that only happens once rather than weekly. When `isOneTime` is true,
`daysOfWeek` is empty and `durationDays` is forced to `1` server-side.
`checkAndExpireEnrollment()` treats a one-time enrollment as having exactly
1 session allowed, so it expires right after being marked attended once.

**Payments**: `method` now includes `INSTAPAY` and `VODAFONE_CASH` (Egyptian
mobile payment methods) alongside CARD/CASH/BANK_TRANSFER. Those two
specifically prompt for a `proofPhoto` (screenshot of the transfer, same
base64-resize-on-client pattern as fighter profile photos) — see
`PaymentMethodFields` component in `src/app/dashboard/fighters/page.tsx`,
reused across the Add Fighter, Sign-into-Class, and Renew flows.

**WhatsApp default message**: `Gym.whatsappMessageTemplate`, editable in
Settings, supports placeholders substituted client-side by
`buildWhatsappMessage()` in `src/app/dashboard/fighters/page.tsx`:
`{firstName}`, `{fightername}` (full name), `{fighterid}`, and
`{fighter qrcode}` (a link to their check-in QR image — WhatsApp can't
embed an image via the `wa.me` text param, so this resolves to a clickable
URL, not an inline image). Built on top of `whatsappLink()` in
`src/lib/utils.ts`, which takes an optional pre-filled message argument.

**Session math on a fighter's enrollment card** (Attended / Exception /
Absent / Remaining) all come from `attachMonthSummaries()` in
`src/app/api/members/route.ts`. "Remaining" = `sessionsAllowed - attended`
(floored at 0), using the same `sessionsAllowedForCycle()` /
one-time-is-always-1 logic as `checkAndExpireEnrollment` — keep these two
in sync if the exhaustion rule ever changes, they'll silently drift apart
otherwise.

**Coach attendance** (`CoachAttendance` model) is tied to a specific class
and date — "did this coach show up to teach class X on date Y" — not a
generic daily check-in (this was reworked from an earlier, simpler
same-session design; if you see references to a bare `date`-only coach
check-in anywhere, it's stale). One row per `(coachId, classId, date)`. A
coach has their own personal QR code (`vance:coach:{coachId}`, distinct
prefix from a fighter's `vance:checkin:{memberId}`) shown on their own
dashboard; the scanner page (`/dashboard/attendance/scan`) detects which
prefix it's looking at and branches accordingly. If a coach teaches more
than one class scheduled for today, scanning prompts which one (same
pattern as a fighter with multiple active enrollments). "Assigned" sessions
for a coach/class this month is computed from the class's actual schedule
(`scheduledOccurrencesThisMonth()` in `src/lib/enrollment.ts`), not stored —
attended/missed are then derived against that. Visible on: the coach's own
dashboard (today's classes + check-in), the main Attendance page ("Coaches"
panel, monthly attended/missed per coach), and each class's own roster page
(that class's assigned coach + mark button for the selected date).

## Known traps for whoever edits this next

1. **Frontend/backend types are not shared.** Page components declare their
   own local TypeScript interfaces for API response shapes (loosely typed,
   lots of `any`). `tsc --noEmit` will NOT catch a mismatch where an API
   route changes its response shape but a page still reads the old field
   name — this has caused real shipped bugs multiple times already (renamed
   `plans`→`enrollments`, `plan`→`class` and missed a few call sites each
   time; the `CoachDashboard` component in `src/app/dashboard/page.tsx`
   silently referenced `c.startTime` — a field that hasn't existed on
   `GymClass` since classes became recurring — for a whole session because
   nothing ever threw, it just silently always returned zero results).
   **After changing any API route's response shape, grep every page that
   calls it for the old field names before considering the change done.**
2. **Always run `npx prisma generate` after touching `schema.prisma`**
   before `tsc --noEmit` — otherwise you'll get stale-type false negatives
   or false positives.
3. **`next build`'s type-checking is stricter/different from a bare
   `npx tsc --noEmit`** in practice — a route file was once missed by one
   but not the other. Prefer `next build` as the final gate when you have
   network access (fonts load fine locally; this only breaks in network-
   sandboxed environments). If you don't have network, `tsc --noEmit`
   across the whole project is the fallback, but re-check with `next build`
   when you can.
4. When deleting/renaming a route or model, **grep the whole `src/` tree**
   for the old name (routes, Prisma model names, field names) — don't trust
   that a partial rewrite caught every consumer.
5. Zip hygiene, if generating a downloadable archive: exclude
   `node_modules/`, `.next/`, `.git/`, `*.tsbuildinfo`. After zipping,
   extract it to a **separate directory**, symlink `node_modules` in, and
   re-run `prisma generate` + `tsc --noEmit` there — don't just trust the
   live working directory matches what got zipped (this has silently
   drifted before).

## Conventions already established

- PATCH endpoints use a `_action` string field in the body to discriminate
  behavior (`freeze` / `unfreeze` / `renew` / `cancel` / `switch` / etc.)
  rather than separate REST verbs/routes — follow this pattern for new
  lifecycle actions rather than inventing a new convention.
- Attribution fields (`addedById`, `lastActionById`, `createdById`, etc.)
  are plain `String?` columns, **not** formal Prisma relations to `User` —
  resolved manually via a `withUserNames()` helper (in
  `src/app/api/members/route.ts`) that batch-fetches names and appends
  `${field}Name` keys to response objects. Keep using this pattern rather
  than adding more reverse relations to `User`.
- Brand palette: Tailwind `primary` (yellow/gold, `#ffc700`) and `crimson`
  (red, `#e0161c`) custom color scales in `tailwind.config.js`, plus the
  existing `dark` neutral scale. Status-semantic colors (green=good,
  red=bad, blue=frozen, yellow=pending) are separate from the brand accent
  colors — don't conflate them.
- "Fighter" is the user-facing term for members everywhere in the UI copy;
  the underlying Prisma model is still named `Member` (deliberately not
  renamed, to limit blast radius — every field/relation still says
  `member`/`memberId`).

## Workflow expectations

- Schema changes first, `prisma validate` + `prisma generate`, *then* work
  outward: lib helpers → API routes → pages, checking `tsc --noEmit` after
  each layer rather than only at the very end.
- Don't leave orphaned dead code (unused functions/imports) after a
  refactor — this project's own prior notes flagged that as a real problem
  once already (see `sanitizeDates` history if it comes up).
