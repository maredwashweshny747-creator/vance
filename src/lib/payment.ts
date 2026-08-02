// Shared pricing helper for anything that creates a Payment tied to a class
// subscription: initial enrollment, renewal, and private-session packages.

export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED'

/**
 * For a PRIVATE (session-based) class, the base price is per-session and the
 * fighter buys a bundle of N sessions: base = pricePerSession * sessionCount.
 * For a GROUP class it's just the class's flat cycle price.
 */
export function baseAmountForClass(cls: { type: string; price: number }, sessionCount?: number | null) {
  if (cls.type === 'PRIVATE') {
    const n = Math.max(1, Number(sessionCount) || 1)
    return Math.round(cls.price * n * 100) / 100
  }
  return cls.price
}

/**
 * Applies a discount step (No Discount / Percentage / Fixed Amount) to a base
 * amount. Never returns a negative amount.
 */
export function applyDiscount(base: number, discountType?: string | null, discountValue?: number | null) {
  const type: DiscountType = discountType === 'PERCENTAGE' || discountType === 'FIXED' ? discountType : 'NONE'
  const value = Number(discountValue) || 0
  let discountAmount = 0
  if (type === 'PERCENTAGE') discountAmount = base * (Math.min(Math.max(value, 0), 100) / 100)
  else if (type === 'FIXED') discountAmount = Math.max(value, 0)
  const amount = Math.max(0, Math.round((base - discountAmount) * 100) / 100)
  return { type, value, originalAmount: base, amount }
}
