'use client'
import { motion } from 'framer-motion'
import { Building2, UserPlus, Settings, TrendingUp } from 'lucide-react'

const steps = [
  { step: '01', icon: Building2, title: 'Create Your Club', desc: 'Sign up and set up your fight club profile in under 5 minutes. Add your location, branding, operating hours, and membership plans.' },
  { step: '02', icon: UserPlus, title: 'Import Members', desc: 'Bulk import existing members via CSV, or let them sign up through your branded fighter portal. Memberships auto-activate.' },
  { step: '03', icon: Settings, title: 'Configure & Schedule', desc: 'Set up your class schedule, bring on coaches, configure per-session pay, and customize notification triggers.' },
  { step: '04', icon: TrendingUp, title: 'Watch Your Club Grow', desc: 'Use real-time analytics to understand your business, reduce churn, fill classes, and make data-driven decisions.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-400/2 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
          <span className="text-primary-400 font-mono text-sm tracking-widest uppercase mb-4 block">Simple Setup</span>
          <h2 className="font-display text-6xl lg:text-7xl uppercase tracking-wider mb-4">
            UP AND RUNNING<br /><span className="gradient-text">IN MINUTES</span>
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-dark-600 to-transparent" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center relative">
                <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-dark-800 border border-dark-600 mb-6 group hover:border-primary-400/40 transition-colors">
                  <s.icon size={32} className="text-primary-400" />
                  <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary-400 text-dark-950 text-xs font-bold font-mono flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="font-mono text-xs text-dark-500 mb-2">{s.step}</div>
                <h3 className="font-display text-2xl tracking-wider text-white mb-3">{s.title}</h3>
                <p className="text-dark-300 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
