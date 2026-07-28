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

## 2026-07-27 — Claude (chat) — Removed profile fields, one-time classes, InstaPay/Vodafone Cash proof photos, WhatsApp template, coach attendance

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

