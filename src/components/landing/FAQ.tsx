'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  { q: 'How long does setup take?', a: 'Most fight clubs are fully set up within 20–30 minutes. You can import existing fighters via CSV, configure your membership plans, and go live the same day.' },
  { q: 'Can I import my existing fighter data?', a: 'Yes. Vance supports CSV imports for fighters, payments history, and class schedules. We also offer free migration assistance for Professional and Enterprise plans.' },
  { q: 'Does Vance handle payment processing?', a: 'Yes, we integrate with Stripe for secure payment processing. You can accept credit/debit cards, set up automatic recurring billing, send invoices, and manage refunds all within Vance.' },
  { q: 'Can fighters book classes and private sessions online?', a: 'Absolutely. Each club gets a branded fighter portal where fighters can view the schedule, book classes or private sessions, manage their membership, and pay invoices.' },
  { q: 'How does coach pay work?', a: 'Coaches are paid per session taught, not a flat salary. Set each coach\'s rate once, and Vance tracks sessions automatically so payroll is a one-click generate.' },
  { q: 'Is there a contract or commitment?', a: 'No contracts. You can cancel anytime. Annual plans are billed upfront but we offer a pro-rated refund within the first 30 days if you\'re not satisfied.' },
  { q: 'What happens when I exceed my fighter limit?', a: 'You\'ll receive a notification to upgrade your plan. We won\'t cut off access abruptly — there\'s a 30-day grace period to review and upgrade.' },
  { q: 'Do you support multiple club locations?', a: 'Yes. The Enterprise plan supports unlimited locations with centralized management, consolidated reporting, and the ability to share fighters across locations.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted at rest and in transit. We use SOC 2 compliant infrastructure, daily backups, and are fully GDPR compliant. Your data is never shared or sold.' },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary-400 font-mono text-sm tracking-widest uppercase mb-4 block">Questions</span>
          <h2 className="font-display text-6xl lg:text-7xl uppercase tracking-wider">
            GOT<br /><span className="gradient-text">QUESTIONS?</span>
          </h2>
        </motion.div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left">
                <span className="text-white font-medium text-sm">{faq.q}</span>
                {open === i ? <Minus size={16} className="text-primary-400 flex-shrink-0" /> : <Plus size={16} className="text-dark-400 flex-shrink-0" />}
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="px-6 pb-4 text-dark-300 text-sm leading-relaxed border-t border-dark-700 pt-4">{faq.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
