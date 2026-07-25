// Shared discipline taxonomy — used by Branch (sports offered), MembershipPlan
// (which discipline a plan covers), and GymClass (which discipline a class/session is).
// Keeping this in one place means a branch's sports list, a plan's category, and a
// class's category all speak the same language, so attendance can be auto-matched
// to the right plan.

export const DISCIPLINE_CATEGORIES = [
  'BOXING_KIDS', 'BOXING_ADULTS',
  'KICKBOXING_KIDS', 'KICKBOXING_ADULTS',
  'MMA_KIDS', 'MMA_ADULTS',
  'MUAY_THAI_KIDS', 'MUAY_THAI_ADULTS',
  'BJJ_KIDS', 'BJJ_ADULTS',
  'WRESTLING_KIDS', 'WRESTLING_ADULTS',
  'CONDITIONING', 'SPARRING', 'OTHER',
] as const

export type DisciplineCategory = typeof DISCIPLINE_CATEGORIES[number]

export const DISCIPLINE_LABELS: Record<string, string> = {
  BOXING_KIDS: 'Boxing — Kids', BOXING_ADULTS: 'Boxing — Adults',
  KICKBOXING_KIDS: 'Kickboxing — Kids', KICKBOXING_ADULTS: 'Kickboxing — Adults',
  MMA_KIDS: 'MMA — Kids', MMA_ADULTS: 'MMA — Adults',
  MUAY_THAI_KIDS: 'Muay Thai — Kids', MUAY_THAI_ADULTS: 'Muay Thai — Adults',
  BJJ_KIDS: 'BJJ — Kids', BJJ_ADULTS: 'BJJ — Adults',
  WRESTLING_KIDS: 'Wrestling — Kids', WRESTLING_ADULTS: 'Wrestling — Adults',
  CONDITIONING: 'Conditioning', SPARRING: 'Sparring', OTHER: 'Other',
}

export function disciplineLabel(cat?: string | null): string {
  if (!cat) return 'General'
  return DISCIPLINE_LABELS[cat] || cat
}

// Short label for tight spaces (badges, chips)
export const DISCIPLINE_SHORT: Record<string, string> = {
  BOXING_KIDS: 'Boxing (Kids)', BOXING_ADULTS: 'Boxing',
  KICKBOXING_KIDS: 'Kickboxing (Kids)', KICKBOXING_ADULTS: 'Kickboxing',
  MMA_KIDS: 'MMA (Kids)', MMA_ADULTS: 'MMA',
  MUAY_THAI_KIDS: 'Muay Thai (Kids)', MUAY_THAI_ADULTS: 'Muay Thai',
  BJJ_KIDS: 'BJJ (Kids)', BJJ_ADULTS: 'BJJ',
  WRESTLING_KIDS: 'Wrestling (Kids)', WRESTLING_ADULTS: 'Wrestling',
  CONDITIONING: 'Conditioning', SPARRING: 'Sparring', OTHER: 'Other',
}
