const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// UTC, not local time — every "day" boundary in this file (and every place that reads a
// ClassAttendance.date back) has to agree on the same midnight convention, or a session
// generated here as e.g. Sept 30 can silently round-trip through the browser and back as
// Sept 29 the moment the server's local timezone isn't UTC, making a mark for "today"
// land on a different row than the one the fighter's session list is actually showing —
// this was the root cause of "excuse doesn't seem to do anything, but a new session
// appears at the end of the cycle." UTC is arbitrary but fixed, so every part of the app
// agrees on it regardless of what timezone the machine running Node happens to be in.
// Every cursor built from this must keep walking in UTC too — getUTCDay()/setUTCDate(),
// never the local getDay()/setDate() — or a UTC-midnight instant gets re-interpreted in
// local time for "which weekday is this" and can roll onto the wrong day for any server
// running west of UTC (negative offset).
function startOfDay(d: Date) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x }

/**
 * Every actual calendar date a class's sessions fall on within [rangeStart, rangeEnd]
 * (inclusive), based on its weekly schedule (or its single sessionDate for one-time
 * classes). This is what turns "2 sessions/week" into concrete dates like Sun 8/4 and
 * Tue 8/6 — used both for the fighter-facing "remaining sessions" breakdown and the
 * Classes -> Manage Attendance month view.
 */
/**
 * The next date, strictly after `afterDate`, that matches the class's weekly schedule.
 * Used to push an enrollment's cycle out by exactly one session when a fighter is
 * excused — they keep their full session count, they just get an extra date at the end.
 */
export function nextScheduledDate(cls: { daysOfWeek: string[]; isOneTime?: boolean; type?: string }, afterDate: Date): Date | null {
  if (cls.isOneTime || cls.type === 'PRIVATE' || !cls.daysOfWeek || cls.daysOfWeek.length === 0) return null
  const cursor = startOfDay(afterDate)
  cursor.setUTCDate(cursor.getUTCDate() + 1)
  for (let i = 0; i < 14; i++) { // a week+ is always enough to hit the next scheduled day
    if (cls.daysOfWeek.includes(DOW[cursor.getUTCDay()])) return new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return null
}

/**
 * The date, strictly before `beforeDate`, that matches the class's weekly schedule — the
 * mirror image of nextScheduledDate. Used to pull an enrollment's cycle back in by exactly
 * one occurrence when a session that was EXCUSED (which had pushed the cycle out by one)
 * gets corrected to something else — undoing exactly the extension excusing it granted.
 */
export function previousScheduledDate(cls: { daysOfWeek: string[]; isOneTime?: boolean; type?: string }, beforeDate: Date): Date | null {
  if (cls.isOneTime || cls.type === 'PRIVATE' || !cls.daysOfWeek || cls.daysOfWeek.length === 0) return null
  const cursor = startOfDay(beforeDate)
  cursor.setUTCDate(cursor.getUTCDate() - 1)
  for (let i = 0; i < 14; i++) { // mirrors nextScheduledDate's safety window
    if (cls.daysOfWeek.includes(DOW[cursor.getUTCDay()])) return new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return null
}

/**
 * The date of the Nth actual scheduled occurrence starting from (and including)
 * `startDate` — this is what an enrollment's `endDate` should be set to, instead of a
 * flat `startDate + durationDays`. A flat day-count window doesn't reliably contain
 * exactly N occurrences of a given weekday: e.g. a 30-day window starting on a
 * Wednesday for a Sun/Tue/Thu class can catch 13 real occurrences instead of the
 * nominal 12 (2/week × 4 weeks × ... whatever), depending on which day the cycle
 * happens to start on. Counting occurrences directly guarantees the enrollment's
 * calendar window contains exactly `count` sessions — no more, no less.
 */
export function nthOccurrenceDate(
  cls: { daysOfWeek: string[]; isOneTime?: boolean; sessionDate?: Date | string | null; type?: string },
  startDate: Date,
  count: number
): Date {
  if (cls.isOneTime || cls.type === 'PRIVATE' || !cls.daysOfWeek || cls.daysOfWeek.length === 0 || count <= 0) {
    return startOfDay(startDate)
  }
  const cursor = startOfDay(startDate)
  let found = 0
  // Safety cap: at least 1 occurrence/week guaranteed within 7 days, so `count` weeks
  // is always more than enough room even for a 1x/week schedule.
  for (let i = 0; i < count * 7 + 14; i++) {
    if (cls.daysOfWeek.includes(DOW[cursor.getUTCDay()])) {
      found++
      if (found === count) return new Date(cursor)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return new Date(cursor) // shouldn't happen given the cap above, but never leave it unset
}

export function generateSessionDates(
  cls: { daysOfWeek: string[]; isOneTime?: boolean; sessionDate?: Date | string | null; type?: string },
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const start = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  if (cls.isOneTime) {
    if (!cls.sessionDate) return []
    const d = startOfDay(new Date(cls.sessionDate))
    return (d >= start && d <= end) ? [d] : []
  }
  if (cls.type === 'PRIVATE' || !cls.daysOfWeek || cls.daysOfWeek.length === 0) return []

  const dates: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    if (cls.daysOfWeek.includes(DOW[cursor.getUTCDay()])) dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}
