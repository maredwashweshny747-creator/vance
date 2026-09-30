# Vance — Full Project Briefing (for a new Claude chat session)

## How to use this document

You are a new Claude chat instance picking up a project with no prior
context. This document plus the latest project zip (currently
`vance-v7.zip`) should be uploaded together at the start of the
conversation. Read this whole document first, then treat the uploaded zip
as ground truth for the actual code — this doc explains history and intent,
the zip is what's real.

If the person just says "continue" or gives you a new feature request,
you should be able to pick up exactly where the previous session left off:
same tone, same verification discipline, same delivery conventions. Those
are all described below, not just the feature list.

**Recommended first steps in a new session:**
1. Extract the uploaded zip into your working directory (`bash_tool` /
   computer environment): `unzip vance-vN.zip -d /home/claude/vance/gymflow`
   (or wherever makes sense in your sandbox).
2. Run `npx prisma generate` then `npx tsc --noEmit` to confirm you're
   starting from a clean baseline before touching anything.
3. Read `CLAUDE.md` and `HANDOFF_LOG.md` inside the project — they're the
   living architecture/convention doc and running changelog, already
   included in the zip. This document (the one you're reading now) is the
   narrative version of the same information, written for a chat context
   instead of a coding-agent context.

---

## What Vance is

Vance is a fight-club / combat-sports gym management SaaS. It started as a
fork of a generic template called **GymFlow** (a Gym Management SaaS) that
the user uploaded as a zip on day one, and has been substantially rebuilt
and re-architected across many sessions since — the data model in
particular has changed shape multiple times as requirements got clearer.

**Tech stack:** Next.js 14 (App Router), TypeScript, Prisma ORM +
PostgreSQL (never SQLite — the schema is Postgres-only), NextAuth v4 (JWT +
Credentials, no adapter), Tailwind CSS, Framer Motion, Recharts, bcryptjs.

**The person's own setup:** local project at
`/home/demmetry/projects/Vance/vance`, downloads zips to `~/Downloads`,
extracts and runs `npm install` / `prisma generate` / `prisma db push` /
`npm run build` locally themselves. They also use a separate local coding
agent sometimes (that's why `CLAUDE.md`/`AGENTS.md`/`HANDOFF_LOG.md` exist
— so work can hand off between this chat and that agent without losing
context; see "Handoff workflow" near the end of this doc).

---

## Chronological history of requests — what was asked, in order

This is the actual sequence of asks across the whole project, so you
understand *why* things are shaped the way they are, not just *what* they
are. Paraphrased for length but faithful to intent.

### Session 1 — GymFlow → Vance, initial rebuild
Uploaded `gymflow1.zip` (the GymFlow template) plus a written project
summary of it. Asked to:
1. Trainers paid **per session**, not monthly salary; members have
   session-based membership plans (e.g. "3 sessions/week"), not flat
   Daily/Monthly/Quarterly/Annual.
2. Three roles: Admin, Receptionist, **Coach**. Coaches log in and submit
   classes/private sessions, which stay inactive until an Admin approves
   them.
3. Remove the Equipment tab entirely.
4. Color palette: yellow, black, red.
5. General UI/UX made to feel like a fight club, not a generic gym.
6. Deliver a zip.

Built: full rebrand (GymFlow→Vance), 3-role auth system, coach
per-session payroll (separate from salaried staff payroll), class
approval workflow, `MembershipPlan` model (session-based), removed
Equipment (model/route/page/nav), new yellow/red/black Tailwind theme,
rebranded landing page + dashboard + portal copy, combat-discipline class
categories. Delivered as `vance.zip` (unversioned — this was before zip
versioning was requested).

### Session 2 — continuation + fighter photos
Said "continue" (picking up mid-build from a prior response that ran out
of room) and added: **add an optional profile picture to each fighter**.

Built: finished the in-progress rebuild, added client-side image
resize-to-base64 photo upload (no object storage configured, so photos are
stored as data URIs directly on the `Member.photo` column). Found and
fixed two real bugs while finishing: a `trainer`→`coach` field mismatch on
the member portal, and a `gymName`/`clubName` field mismatch on
registration.

### Session 3 — Fighters not Members, multi-plan, branches, attribution, editable classes
Large multi-part request:
1. Rename "members" to "**fighters**" everywhere. Every fighter profile
   should show a **QR code**, a **WhatsApp link**, their data, and
   **sessions this month (attended / absent / exception)**.
2. Branches should show their name and **which sports/disciplines** they
   offer (e.g. Kickboxing Kids, Kickboxing Adults, MMA Kids, MMA Adults).
3. When a fighter is added or their plan renewed, **record who did it**.
4. A fighter can have **more than one plan at once** (e.g. trains MMA *and*
   Kickboxing) — should see total sessions/week, and QR check-in should
   resolve to "the plan of the day."
5. (mislabeled as a second "4" in the original message) Classes should be
   **clickable and editable**, not just icon-based create/delete.

Built: renamed Member-facing UI to "Fighter" throughout (kept the
underlying Prisma model named `Member` deliberately, to limit blast
radius — see Conventions section). Replaced the single
`Member.membershipPlanId` with a proper many-to-many `MemberPlan`
enrollment model so a fighter could hold multiple plans. Added
`Branch.sports` (String array). Added attribution fields (`addedById`,
`lastActionById`, `createdById`) resolved via a `withUserNames()` helper
rather than formal Prisma relations. Built a full discipline taxonomy
(`src/lib/categories.ts`) with kids/adults variants. Made classes
click-to-edit with a full form. QR/WhatsApp/monthly-summary added to the
fighter detail panel.

### Bug report — `npm run build` failed locally
The person ran a real local build and got a genuine TypeScript error: a
leftover `src/app/api/member-plans/route.ts` still referenced a Prisma
model (`membershipPlan`) that had been removed. The live working directory
in the sandbox was already clean, but **the delivered zip didn't match it**
— a real packaging drift bug. This is the origin of a rule that's been
followed ever since: **after zipping, extract the zip into a totally
separate directory, symlink `node_modules` in, and re-run
`prisma generate` + `tsc --noEmit` there** — never trust that the live
directory matches what got zipped.

### Extraction troubleshooting
Two follow-up messages: first, extraction with `unzip -o` didn't clear a
stale file from an older zip (because `-o` overwrites conflicts but never
deletes files absent from the new archive) — the fix was
`rm -rf src prisma` before extracting, since those two directories have
had structural churn across sessions. Second, an extraction attempt
apparently failed outright (Prisma schema not found, no `app`/`pages`
directory) — diagnosed as likely a wrong/stale filename or a failed
download, not a code issue.

### Zip naming convention requested
The person's browser silently dedupes/renames repeated downloads of
`vance.zip`, breaking their extract workflow. Asked for **every zip to get
a unique name going forward**. Since then, zips are named `vance-vN.zip`
with an incrementing version number (currently up to `vance-v7.zip`), and
extraction commands always include `rm -rf src prisma` first for safety.

### Session — Classes become the plan, roster attendance, two-condition expiry, confirm-to-renew
Another large request:
1. Classes **are** the plan a fighter signs into — e.g. "Kickboxing Adults"
   meets Sat/Mon/Wed, and that schedule *is* the "3 sessions/week."
2. Attendance should be managed **per class**: open a class, see everyone
   signed into it, mark each fighter **Attended / Absent / Excused** for a
   given date.
3. A subscription should end when **either** of two conditions is met:
   all allotted sessions used, **or** the cycle's days have passed —
   whichever comes first.
4. Renewal should **not** be one click — require a confirm step, and record
   **who** confirmed it.

Built: this was a full data-model replacement. Deleted the standalone
`MembershipPlan`/`MemberPlan` models. `GymClass` gained `daysOfWeek`,
`startTimeOfDay`, `price`, `durationDays` — it now **is** the subscribable
unit. New `ClassEnrollment` (replaces `MemberPlan`) and `ClassAttendance`
(replaces the old `CheckIn`/`AttendanceException`, and also serves as the
roster a coach/admin fills in) models. Built the "Manage Attendance" roster
page at `/dashboard/classes/[id]/attendance`. `checkAndExpireEnrollment()`
helper checks both exhaustion conditions. Renew became a two-step
confirm-modal flow that names the confirming user.

### Handoff-workflow request
Asked for commands to make a **local coding agent** understand the project
the same way this chat does, plus a way to keep both in sync as the person
switches between this chat and that agent when they hit usage limits here.

Built: `CLAUDE.md` (architecture, decisions-and-why, known traps,
conventions — read automatically by most coding agents that support the
convention), `AGENTS.md` (identical copy, for tools that look for that
filename instead), and `HANDOFF_LOG.md` (a running changelog, newest entry
on top, with a template — each session, whichever agent worked last adds
an entry: what changed, why, what to watch out for, how it was verified).
Delivered as a small standalone `vance-context-v1.zip` so the person could
drop it in without waiting for a full code zip.

### Extraction-and-build troubleshooting (again)
When a delivered zip still hit the same already-fixed error, diagnosis
showed extraction itself hadn't actually happened (or wrote somewhere
unexpected) — not a code regression. Reinforced the `rm -rf src prisma`
pattern and asking for `ls -la`/`ls -lh` diagnostics when extraction is in
doubt.

### Session — remove fields, one-time classes, InstaPay/Vodafone Cash proof, WhatsApp template, first coach-attendance pass
1. Remove Goals, Emergency Contact, Emergency Phone, Health Conditions from
   fighters entirely.
2. Payment methods should be optional to set.
3. Email optional — replace it with an **auto-generated 8-digit Fighter
   ID starting at 2000**, which also becomes how a fighter logs into the
   self-service portal.
4. Starting class optional at fighter creation.
5. Ability to **switch** a fighter from one class to another mid-cycle
   (e.g. Kickboxing → MMA), without losing remaining paid time.
6. Currency: **Egyptian Pounds (EGP)**, not USD, as the default everywhere.

(Some of this list — birth year, payment method, fighter ID/optional
email, optional starting class, switch-class, EGP — was actually
requested across two back-to-back messages; treated as one continuous
build.) Then, in a follow-up in the same session:
1. Remove Goals/Emergency Contact/Emergency Phone/Health Conditions (the
   removal itself, confirmed above).
2. Add a **one-session** class type/tab that skips the days-of-week picker
   (a single one-off session instead of a recurring weekly class).
3. Payments by **InstaPay** or **Vodafone Cash** should prompt for an
   attached photo (screenshot proof of transfer — both are common Egyptian
   mobile payment methods).
4. A default **WhatsApp message** configurable in Settings, pre-filled
   whenever the WhatsApp button is tapped on a fighter's profile.
5. Add **coach attendance** tracking (first version: a simple daily
   check-in, separate from fighter class attendance).

Built all of the above. Also found and fixed a real latent bug while in
the area: the coach's own dashboard was silently always showing zero for
"sessions this week/month" because it referenced a class field
(`startTime`) that had stopped existing when classes became recurring —
nothing crashed, the numbers were just always wrong. Fixed to use the real
schedule fields and a proper server-computed session count.

### Session — coach attendance reworked to be class-tied + QR, fighter edit restored, WhatsApp placeholders expanded, remaining-sessions stat
1. Coach attendance should live **in the classes**: coach has their own
   **QR code**, and has an "assigned sessions" count per class they teach,
   so a receptionist can see how many they attended vs. missed.
2. The fighter-data **edit button had gone missing** — restore it.
3. WhatsApp default message should support `{fightername}`, `{fighterid}`,
   `{fighter qrcode}` as placeholders.
4. Each fighter's class card should also show **remaining sessions**
   alongside attended/absent/excused.

Built: replaced the simple daily coach check-in with a `CoachAttendance`
model tied to `(coachId, classId, date)`. Coach gets a personal QR
(`vance:coach:{coachId}`), shown on their own dashboard; the scanner page
now detects fighter vs. coach QR prefixes and branches, prompting which
class if the coach teaches more than one scheduled that day. "Assigned"
sessions computed live from the class's actual schedule
(`scheduledOccurrencesThisMonth()`). Visible on the coach's dashboard, the
main Attendance page (Coaches panel with monthly attended/missed), and
each class's own roster page. Restored fighter-data editing (an Edit
button toggling an inline form). Extended the WhatsApp placeholder
substitution to all four tokens (a link to the QR image for
`{fighter qrcode}`, since WhatsApp's text-prefill can't embed an actual
image). Added a 4th "Remaining" stat to each enrollment card, computed
with the same math the auto-expiry check already uses.

This document is being written in the session right after that one —
i.e., **`vance-v7.zip` is the current, fully up-to-date state** of
everything described above.

---

## Current architecture (condensed — full detail lives in `CLAUDE.md`)

**Classes ARE the subscription plan.** There's no separate "membership
plan" concept. A `GymClass` (e.g. "Kickboxing Adults") has its own weekly
schedule (`daysOfWeek`, `startTimeOfDay`) or, if `isOneTime` is set, a
single `sessionDate` instead. It carries its own `price` and
`durationDays` billing cycle. Fighters enroll directly via
`ClassEnrollment`, and can hold more than one at once.

- `ClassEnrollment` = one fighter's subscription to one class. Tracks
  `status` (ACTIVE/FROZEN/EXPIRED/CANCELED), dates, and full attribution
  (`addedById`, `lastAction`, `lastActionById`, `lastActionAt`).
- `ClassAttendance` = one fighter's mark (ATTENDED/ABSENT/EXCUSED) for one
  class on one date. Both the QR/manual check-in record and the roster a
  coach/admin fills in on `/dashboard/classes/[id]/attendance`.
- A subscription auto-expires when **either** all allotted sessions are
  used **or** `endDate` has passed — checked via
  `checkAndExpireEnrollment()` in `src/lib/enrollment.ts` whenever
  enrollments are read.
- "Switch class" preserves the remaining `endDate` rather than charging
  again or resetting the clock.
- Renewing requires a confirm step naming the current user before it
  fires.

**Roles**: ADMIN / RECEPTIONIST / COACH (plain string on `User`). Coaches
submit classes that sit `PENDING` until an admin approves them; editing an
already-approved class as a coach reverts it to `PENDING`.

**Fighters**: email optional; every fighter has an auto-generated 8-digit
`fighterId` (from 2000, zero-padded) which is also their portal login. No
Goals/Emergency Contact/Emergency Phone/Health Conditions fields (removed
by request). Optional client-resized base64 photo. Editable via a Fighter
Data card with an Edit toggle in the detail panel.

**Coach attendance**: tied to `(coachId, classId, date)`, not a generic
daily check-in. Coach's own QR (`vance:coach:{coachId}`, distinct prefix
from a fighter's `vance:checkin:{memberId}`). "Assigned" sessions computed
live from the class schedule, not stored.

**Payments**: methods include CASH/CARD/BANK_TRANSFER/INSTAPAY/
VODAFONE_CASH; the last two prompt for an optional proof-of-payment
screenshot (`Payment.proofPhoto`, same base64 pattern as fighter photos).

**WhatsApp**: `Gym.whatsappMessageTemplate`, editable in Settings, supports
`{firstName}`, `{fightername}`, `{fighterid}`, `{fighter qrcode}`
placeholders substituted client-side before building the `wa.me` link.

**Currency**: EGP by default everywhere (schema defaults, `formatCurrency`,
seed data), still configurable per gym.

**Discipline taxonomy**: `src/lib/categories.ts`, kids/adults variants per
sport, shared by `Branch.sports`, `GymClass.category`.

**Coach payroll**: per-session (`Coach.sessionRate` × `ClassAttendance`
rows with `status: ATTENDED` that month), separate from salaried
`Staff`/`PayrollRun` (front-desk/management).

---

## Known traps — read before editing anything

1. **Frontend and backend are not type-shared.** Page components declare
   their own loose local interfaces for API response shapes. `tsc --noEmit`
   will NOT catch a route changing shape while a page still reads the old
   field name — this has caused multiple real shipped bugs already (a
   `plans`→`enrollments` rename, a `startTime` field that silently stopped
   existing on classes and broke a dashboard stat for an entire session
   before being noticed). **After changing any API route's response shape,
   grep every page that calls it for the old field names before considering
   the change done.**
2. Always `npx prisma generate` after touching `schema.prisma`, before
   `tsc --noEmit`.
3. `next build`'s type-checking has, at least once, caught something a bare
   `tsc --noEmit` didn't. This chat's sandbox cannot get `next build` past
   font-fetching (no network access there) — it always dies at "Compiled
   successfully" / before "Checking validity of types" finishes. That means
   **this chat has never actually seen the stronger check pass** — it's
   been relying on `tsc --noEmit` plus an isolated re-extraction check as
   the practical ceiling. If you get network access, prefer `next build`
   as the final gate.
4. When deleting/renaming a route or model, grep the whole `src/` tree for
   the old name — a partial rewrite has left stale files behind before
   (the `member-plans` bug).

---

## Conventions this chat has followed — replicate these

**Verification workflow, every session, without exception:**
1. Schema change → `npx prisma validate` → `npx prisma generate`.
2. Work outward: lib helpers → API routes → pages, running
   `npx tsc --noEmit` after each layer, not just at the very end.
3. After all edits: full `npx tsc --noEmit` across the whole project,
   `grep` sweeps for stale field/model names from anything renamed or
   removed.
4. Attempt `npm run build` for the strongest available check (accept that
   it'll die at font-fetching in a sandbox with no network — that's
   expected and not a real failure, but the type-check step it reaches
   first is still useful signal if it gets that far).
5. Clean build artifacts (`rm -rf .next tsconfig.tsbuildinfo`) before
   zipping.
6. Zip the project, **excluding** `node_modules/`, `.next/`, `.git/`,
   `*.tsbuildinfo`.
7. **Extract the zip into a completely separate directory**, symlink
   `node_modules` in from the real working directory, run
   `npx prisma generate` + `npx tsc --noEmit` there too. Only deliver if
   that comes back clean. This step exists specifically because the zip
   has drifted from the working directory before — don't skip it.
8. Copy to `/mnt/user-data/outputs/`, call `present_files`.

**Zip naming:** every zip gets a new, unique filename —
`vance-vN.zip`, incrementing. Never reuse `vance.zip` — the person's
browser silently mangles repeat downloads of the same filename.

**Delivery message format:** lead with the version-numbered filename and
one line confirming how it was verified, then the extraction commands
(always `rm -rf src prisma` first, then `unzip -o`), then a concise
feature-by-feature summary of what changed, in the person's own framing
where possible. Flag any judgment calls made on ambiguous requests
explicitly rather than silently picking one interpretation.

**Handoff docs:** update `CLAUDE.md` (architecture/conventions/traps),
keep `AGENTS.md` as an exact copy, and prepend a new dated entry to
`HANDOFF_LOG.md` (newest on top) — what changed, why, what to watch out
for, how it was verified — every session, whether the work was done here
or by the local coding agent.

**Design/product judgment calls already made — stay consistent with
these unless told otherwise:**
- Kept the Prisma model named `Member` even though the UI says "Fighter"
  everywhere — renaming the model would have touched every field/relation
  for no functional benefit.
- Status-semantic colors (green=good, red=bad, blue=frozen, yellow=pending)
  are kept separate from the brand accent colors (`primary` yellow/gold,
  `crimson` red) — don't conflate them when styling something new.
- Attribution fields (`addedById`, `lastActionById`, `createdById`, etc.)
  are plain `String?` columns resolved manually via a `withUserNames()`
  batch-fetch helper, not formal Prisma relations to `User` — keep using
  this pattern rather than adding more reverse relations.
- PATCH endpoints use a `_action` string in the body to discriminate
  behavior (freeze/unfreeze/renew/cancel/switch/approve/reject) rather than
  separate routes per action — follow this for new lifecycle actions.
- No object/file storage is configured — any "photo" field (fighter
  profile picture, payment proof) is a client-side-resized base64 data URI
  stored directly in a text column. If real storage gets added later,
  these are the fields to redirect.

---

## Where things are (quick file map)

- `prisma/schema.prisma` — the whole data model, read this first for any
  schema question.
- `src/lib/enrollment.ts` — `checkAndExpireEnrollment`,
  `generateFighterId`, `scheduledOccurrencesThisMonth`.
- `src/lib/utils.ts` — `formatCurrency` (EGP default), `whatsappLink`,
  `sessionsAllowedForCycle`, `cn`, date/day helpers.
- `src/lib/categories.ts` — discipline taxonomy.
- `src/app/api/` — one folder per resource; `classes`, `class-enrollments`,
  `class-attendance`, `coach-attendance`, `members`, `coaches`, `payroll`,
  `branches`, `settings`, `staff-accounts`, `portal`, `attendance` (the
  general quick-checkin one, separate from `class-attendance`),
  `import-export`, `analytics`, `leads`, `payments`, `inventory`.
- `src/app/dashboard/fighters/page.tsx` — the big one: fighter list, detail
  panel, add/edit, class enrollment lifecycle actions, QR, WhatsApp.
- `src/app/dashboard/classes/page.tsx` +
  `src/app/dashboard/classes/[id]/attendance/page.tsx` — class
  create/edit + the roster attendance page.
- `src/app/dashboard/page.tsx` — dashboard home; contains both the
  admin/receptionist view and a separate `CoachDashboard` component in the
  same file.
- `src/app/portal/page.tsx` — fighter-facing self-service portal (logs in
  with Fighter ID, not email).
- `src/app/dashboard/attendance/scan/page.tsx` — QR scanner, handles both
  fighter (`vance:checkin:`) and coach (`vance:coach:`) QR prefixes.
- `CLAUDE.md` / `AGENTS.md` / `HANDOFF_LOG.md` — living docs, keep updated.

---

## What "being the same as this chat" means in practice

- Don't just implement the literal ask — read between the lines the way
  this session has (e.g. "attach a photo when payment is InstaPay/Vodafone
  Cash" became a reusable component wired into all three places a payment
  gets created, not just one).
- When a request is genuinely ambiguous, pick the most sensible
  interpretation, implement it, and **say explicitly** what you assumed
  (e.g. the "switch class preserves remaining time, no new charge" call) —
  don't silently guess and don't stall on asking when a reasonable default
  exists.
- Fix real bugs you notice along the way even if not asked, and say so
  plainly when you do (this has happened twice — the `startTime` dashboard
  bug and the `member-plans` stale-route bug).
- Never skip the isolated-extraction verification step, even under time
  pressure — it's the reason the last several deliveries have actually
  worked instead of repeating the original packaging bug.