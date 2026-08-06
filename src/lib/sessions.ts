const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

/**
 * Every actual calendar date a class's sessions fall on within [rangeStart, rangeEnd]
 * (inclusive), based on its weekly schedule (or its single sessionDate for one-time
 * classes). This is what turns "2 sessions/week" into concrete dates like Sun 8/4 and
 * Tue 8/6 — used both for the fighter-facing "remaining sessions" breakdown and the
 * Classes -> Manage Attendance month view.
 */
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
    if (cls.daysOfWeek.includes(DOW[cursor.getDay()])) dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
