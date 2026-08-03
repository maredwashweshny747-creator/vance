# Handoff Log

Running log of changes made to Vance, newest entry on top. Whoever works on
this project next — Claude here in chat, a local coding agent, or a future
session of either — reads the last 2-3 entries before starting, and adds a
new entry before finishing a session.

Keep entries short: what changed, why (if not obvious), and anything the
next agent needs to watch out for. Not a full diff — the git history (if
you have one) or the zip is the source of truth for *what* changed
line-by-line; this log is for *context* a diff won't give you.

---

## Template for a new entry

```
## YYYY-MM-DD — <agent name/tool> — <one-line summary>

**Changed:**
- ...

**Why:**
- ...

**Watch out for:**
- ...

**Verified with:** (e.g. "tsc --noEmit clean", "next build reached type-check
  and passed", "manually tested X in dev")
```

---

## 2026-08-03 (2) — Claude (chat) — Unique phone + parent phone, atomic renew, pagination, payments filters, perf & responsive pass

**Changed:**
- Schema: `Member.phone` now globally `@unique`; added `Member.parentPhone`.
  New indexes: `Member.gymId`; `Payment` (gymId+paidAt, gymId+status,
  memberId, classId, enrollmentId); `ClassAttendance` (classId+date,
  memberId); `Lead` (gymId+status, gymId+createdAt). **Migration required.**
- `/api/members` POST/PATCH validate phone uniqueness server-side (clear
  "already assigned to another fighter" message + P2002 catch as a
  safety net); PATCH lets a fighter keep their own existing number.
  Parent Phone added to create form, edit form, and the fighter detail
  panel.
- **Renew rewritten to be literal + atomic** (`class-enrollments` PATCH
  `renew`): inside one `prisma.$transaction`, deletes the old payment(s),
  deletes the old enrollment, creates a brand-new enrollment, creates a
  brand-new payment linked to it. All four steps commit together or none
  do. **Known consequence, flagged as an assumption:** since
  `ClassAttendance.enrollmentId` is `onDelete: Cascade`, deleting the old
  enrollment also deletes that cycle's attendance history — a direct
  result of "remove the previous subscription record" being literal in
  the spec. Worth confirming this is the intended trade-off before
  relying on historical attendance counts across renewals.
- **Server-side pagination** added to `/api/members` (list), `/api/leads`,
  `/api/attendance` (today's log), and `/api/payments` — all return
  `{ data/leads/checkIns, page, pageSize, total, totalPages }`. New shared
  `src/components/dashboard/Pagination.tsx` (page-size selector,
  prev/next, "showing X–Y of Z") wired into Fighters, Leads (list view
  only — pipeline/kanban view intentionally stays unpaginated since it
  needs the whole status-grouped set; backend only paginates leads when a
  `page` param is actually sent), Attendance, and Payments pages. Filters
  and search reset back to page 1 automatically.
- **Payments page rewritten**: date filters (specific date OR from/to
  range) and search (fighter name, phone, parent phone, class name,
  payment ID) — combine freely. "Total Collected"/"Total Transactions"
  now reflect the *filtered* set (server-computed aggregate/count over
  the full matching set, not just the current page), labeled "(filtered)"
  when any filter is active.
- **Perf**: fixed a real N+1 in the fighters list endpoint — it was doing
  a second `findMany` per member after the expiry check to "refresh"
  statuses that `checkAndExpireEnrollment` had already returned; now uses
  the returned status directly. `/api/payments` uses `select` instead of
  `include` to avoid over-fetching full row data on every page load.
  Attendance page's data-loading `useEffect` split in two so paging
  through today's log doesn't needlessly re-fetch coaches/members every
  time.
- **Responsive**: audited every page with a `<table>` — found and fixed
  the Inventory page's two tables missing an `overflow-x-auto` wrapper
  (Fighters/Leads/Payments/Payroll already had it). Converted three
  fixed-column grids that would cramp on a narrow phone to responsive
  breakpoints (Payroll summary cards, fighter detail's monthly session
  mini-stats, Settings' Role Permissions blocks). The sidebar/nav
  (`DashboardLayout.tsx`) already had a working mobile hamburger +
  overlay + collapse — nothing to do there.

**Why:** client spec — unique fighter phone with a clear duplicate error,
optional parent phone; renew must be delete-old/create-new and atomic
with no orphans/duplicates; Fighters/Attendance/Leads need real
pagination with page-size choice; Payments needs date + multi-field
search; general performance + mobile-usability pass.

**Watch out for:**
- `/api/members`, `/api/leads`, `/api/payments`, `/api/attendance` all
  changed response shape (now wrapped in a pagination envelope instead of
  a bare array for the list endpoints) — grep before adding a new
  consumer of any of these.
- Leads pagination is opt-in via the presence of a `page` query param —
  don't add `page=1` by default to the pipeline/kanban fetch or it'll
  silently truncate the board to one page's worth of leads.
- This was a scoped pass, not an exhaustive responsive-design QA sweep —
  no manual testing was done at each of 320/375/768/1024px, just a code
  audit for missing scroll wrappers and non-responsive fixed-column
  grids. Worth a visual pass on a real device/emulator before calling
  responsive design "done."
- Could not run `prisma generate` in this sandbox (same
  `binaries.prisma.sh` limitation as every prior session) — schema
  changes were hand-reviewed only. Run the migration + `tsc --noEmit`
  locally before trusting this build.

**Verified with:** `tsc --noEmit` in the working directory, AND an
isolated re-extraction of the zip into a separate dir with `node_modules`
symlinked in — identical result both places: same pre-existing single
unrelated `TS2322` (missing generated Prisma client types), zero new
errors.

---

**Changed:**
- Schema: `ClassEnrollment.sessionCount` (private-session package size);
  `Payment.classId`, `Payment.enrollmentId` (onDelete: Cascade from
  enrollment), `Payment.discountType`, `Payment.discountValue`,
  `Payment.originalAmount`. **Migration required.**
- New `src/lib/payment.ts`: `baseAmountForClass()` +
  `applyDiscount()` — shared by initial enroll, add-class, and renew.
- `/api/coach-attendance` POST: only ADMIN/RECEPTIONIST may create a
  record now (coach self-check-in removed, incl. from own QR); refuses if
  the coach is already marked ATTENDED for that session/class/date.
  Coach dashboard's self check-in button removed; `/dashboard/attendance`
  hides the manual check-in button from anyone but Admin/Receptionist.
- `/api/class-enrollments` DELETE: explicitly deletes the linked
  payment(s) before removing the enrollment (no orphan payments).
- `/api/class-enrollments` PATCH renew: deletes prior payment(s) for the
  enrollment before creating the new one (Payments page only ever shows
  the current payment per subscription).
- `GymClass.type === 'PRIVATE'` is now a first-class "session package"
  path: classes API skips the days-of-week requirement, requires a coach;
  price is treated as **price per session**; `durationDays` defaults to
  3650 (expiry is by session count, not calendar days) —
  `checkAndExpireEnrollment` / month-summary logic use
  `enrollment.sessionCount` for PRIVATE classes instead of the weekly
  cycle calc.
- Discount step (No Discount / Percentage / Fixed) added to initial
  fighter enrollment, "sign into another class", and renew — all three
  now accept `discountType`/`discountValue` and compute
  `originalAmount`/`amount` via the shared helper. Private classes also
  accept `sessionCount` on all three endpoints.
- `/api/classes` GET now returns `totalRevenue` per class (sum of
  COMPLETED payments via `groupBy`); shown on class cards, along with a
  "Price Per Session" label + revenue line for PRIVATE classes.
- `/api/payroll` coachPayroll rows now include `totalPlayersAttended`
  (lifetime count of `ClassAttendance` rows for classes that coach
  teaches); new column on the Payroll page's Coach Payroll tab (this is
  the closest thing to a "Coaches page" in this app — there's no
  standalone one).
- Removed the Delete Fighter button + confirm modal from the fighters
  page UI. The `DELETE /api/members` route itself was left untouched.

**Why:**
- Client spec: captains/coaches must never self-check-in; at most one
  attendance record per session; payments must track 1:1 with the
  subscription that created them (no orphans on remove, no duplicates on
  renew); private/1:1 sessions needed session-count pricing instead of a
  weekly schedule; discount had to be a distinct step before the payment
  is saved, not a silent field.

**Watch out for:**
- Any other place that creates a `Payment` tied to a class subscription
  going forward must set `classId` + `enrollmentId`, or it won't show up
  in per-class revenue and won't get cleaned up on remove/renew.
- `GymClass.type === 'PRIVATE'` classes have `daysOfWeek: []` and a huge
  `durationDays` — don't assume every class has a real weekly schedule
  when writing new features that touch `GymClass`.
- Coach payroll `sessionCount`/pay calc still keys off *fighter*
  `ClassAttendance`, unchanged — `totalPlayersAttended` is a separate,
  purely informational stat, not wired into pay.
- Could not run `prisma generate` in this sandbox (no route to
  `binaries.prisma.sh`, same known limitation as prior sessions) — schema
  was only hand-reviewed + `prisma validate`-attempted, not fully
  type-checked against a real generated client. Run the migration +
  `tsc --noEmit` locally before trusting this build.

**Verified with:** isolated re-extraction of the zip into a separate dir
with `node_modules` symlinked in, `tsc --noEmit` — 44 pre-existing
implicit-any errors (from missing generated Prisma client, same as every
prior session here) plus 1 pre-existing unrelated `TS2322` in
`withUserNames`; identical error set in both the working dir and the
re-extracted zip, so the zip is confirmed to match. No `prisma generate`
or real build was possible in this sandbox.

---

**Changed:**
- Added `Member.fighterId` (8-digit, auto-generated from 2000) and
  `Member.birthYear`. Email is now optional.
- Fighter portal (`/portal`) now logs in with Fighter ID + gym slug instead
  of email.
- Add Fighter form: starting class is now optional; payment method
  (Cash/Card/Bank Transfer) is an optional selector instead of hardcoded
  'CASH'.
- New "Switch Class" action on `ClassEnrollment` — preserves remaining
  `endDate`, no new charge, requires picking a target class in a confirm
  modal.
- Currency defaults changed from USD to EGP across schema defaults,
  `formatCurrency()`, settings dropdown ordering, and seed data pricing.

**Why:** Direct user request — see conversation history for exact wording.

**Watch out for:** Email being optional means `@@unique([gymId, email])`
relies on Postgres treating multiple NULLs as distinct — this is correct
Postgres behavior, don't "fix" it into a non-null constraint without
re-checking the uniqueness intent.

**Verified with:** `tsc --noEmit` clean, extracted zip into an isolated dir
with a fresh `node_modules` symlink and re-ran `prisma generate` + `tsc
--noEmit` there too (came back clean). Did not verify past
"Compiled successfully" with `next build` in this sandbox (no network
access here).

---

## 2026-07-28 — Claude (chat) — Reworked coach attendance to be class-tied + QR, fighter edit restored, WhatsApp placeholders expanded, remaining-sessions stat

**Changed:**
- **Coach attendance redesigned** — replaced the previous simple daily
  check-in with per-class attendance (`CoachAttendance` now has `classId`,
  `status: ATTENDED|ABSENT`, unique on `(coachId, classId, date)`). Coaches
  get a personal QR (`vance:coach:{coachId}`) shown on their own dashboard;
  the scanner page now detects fighter vs. coach QR prefixes and branches.
  "Assigned" sessions per coach/class this month computed live from the
  class's schedule (`scheduledOccurrencesThisMonth()`, new in
  `src/lib/enrollment.ts`). Shown on: coach's own dashboard, main Attendance
  page's Coaches panel (now with monthly attended/missed, not just a daily
  yes/no), and each class's roster page (assigned coach + mark button).
- Restored fighter data editing — there was no edit affordance at all
  before this (a past session apparently dropped it without the user
  asking). Added an Edit button on the Fighter Data card in the detail
  panel; toggles into an inline form (name/email/phone/birth year/branch/
  notes), Save hits the existing `PATCH /api/members`.
- WhatsApp template placeholders expanded from just `{firstName}` to also
  support `{fightername}`, `{fighterid}`, `{fighter qrcode}` (a link, not
  an embedded image — `wa.me`'s text param is plain text only).
- Fighter enrollment cards now show a 4th stat, "Remaining" (sessions left
  in the cycle), alongside Attended/Exception/Absent.

**Why:** Direct user request — see conversation history for exact wording.
Item 2 (restoring the edit button) wasn't something I broke this session —
worth noting for whoever reads this that a missing obviously-expected
affordance is a thing to watch for even without an explicit bug report.

**Watch out for:** If you see `CoachAttendance` referenced anywhere with a
bare `date` and no `classId`, that's from the old design — the model
signature changed shape entirely, not just gained a field.

**Verified with:** `tsc --noEmit` clean across the whole project (checked
after every one of the 4 changes individually, not just at the end).
`next build` reached the same font-fetch network wall as every prior
session in this sandbox — never got to see the real type-check gate this
time either; still worth running `next build` locally as the stronger
check.

---



**Changed:**
- Removed `goals`, `emergencyContact`, `emergencyPhone`, `healthConditions`
  from `Member` entirely (schema + every API route + fighters page +
  import/export).
- `GymClass` can now be a one-time single session (`isOneTime` +
  `sessionDate`) instead of a recurring weekly class — a tab toggle in the
  class form, skips the days-of-week picker. `checkAndExpireEnrollment`
  treats it as exactly 1 allowed session.
- Payment methods now include `INSTAPAY` and `VODAFONE_CASH`; picking
  either shows an optional proof-of-payment screenshot upload
  (`Payment.proofPhoto`, same client-side resize-to-base64 pattern as
  fighter photos). Wired into Add Fighter, Sign-into-Class, and Renew.
- `Gym.whatsappMessageTemplate` — editable in Settings, pre-fills the
  WhatsApp button on a fighter's profile, supports a `{firstName}`
  placeholder.
- New `CoachAttendance` model + `/api/coach-attendance` route — coaches can
  self-check-in from their own dashboard; admins/receptionists see a
  "Coaches Today" panel on the main Attendance page and can check a coach
  in manually.

**Why:** Direct user request — see conversation history for exact wording.

**Bug fixed along the way:** `CoachDashboard` (in
`src/app/dashboard/page.tsx`) was silently broken — it referenced
`c.startTime` on classes, a field that stopped existing when classes
became recurring (`daysOfWeek`/`sessionDate`) two sessions ago. Every
"upcoming"/"taught this month" stat was silently always empty. Rewrote it
to use the real fields, and to pull `sessionsThisMonth` from a new field
on `/api/coaches?mine=true` (computed server-side from `ClassAttendance`)
rather than trying to derive it client-side from the classes list.

**Watch out for:** none new beyond what's already in CLAUDE.md's trap list
— this session is itself an example of trap #1 (stale field reference
surviving a prior rewrite undetected).

**Verified with:** `tsc --noEmit` clean across the whole project. `next
build` reached the same font-fetch network wall as every prior session in
this sandbox (no network access here) — did not get to see it past
"Checking validity of types" this time; run `next build` locally to get
that stronger check.

