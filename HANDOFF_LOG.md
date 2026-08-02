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

## 2026-07-27 — Claude (chat) — Fighter IDs, optional email/class, EGP currency, switch-class

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

