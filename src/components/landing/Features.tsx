'use client'
import { motion } from 'framer-motion'
import { Users, Calendar, CreditCard, BarChart3, UserCheck, Swords, Target, DollarSign, Building2, Package, Smartphone, Zap } from 'lucide-react'

const features = [
  {
    icon: Target,
    title: 'Lead & Sales CRM',
    desc: 'Capture leads from Instagram, WhatsApp, and walk-ins. Pipeline view, follow-up reminders, trial tracking, and conversion analytics — so no lead falls through the cracks.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 border-orange-400/20',
    tag: 'Revenue Growth',
  },
  {
    icon: Users,
    title: 'Fighter Management',
    desc: 'Full fighter profiles, session-based membership plans, renewal tracking, freeze/cancel controls, emergency contacts, health notes, and smart status alerts all in one place.',
    color: 'text-primary-400',
    bg: 'bg-primary-400/10 border-primary-400/20',
    tag: 'Core',
  },
  {
    icon: UserCheck,
    title: 'Attendance & Check-in',
    desc: 'Manual check-in, QR code scanning, and real-time today\'s log. Automatically flags fighters who haven\'t visited in 30 days so you can win them back before they leave.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    tag: 'Retention',
  },
  {
    icon: Calendar,
    title: 'Class & Private Session Scheduling',
    desc: 'Coaches submit group classes and private sessions with categories, capacity, and color coding — nothing goes live until an admin approves it. Fighters book from the portal.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/20',
    tag: 'Core',
  },
  {
    icon: CreditCard,
    title: 'Payments & Billing',
    desc: 'Track all payments, memberships, and fees. Stripe integration for card payments. Automatic overdue alerts, payment history per fighter, and revenue breakdowns.',
    color: 'text-primary-400',
    bg: 'bg-primary-400/10 border-primary-400/20',
    tag: 'Finance',
  },
  {
    icon: DollarSign,
    title: 'Staff Payroll',
    desc: 'Add front-desk and management staff with base salaries. Run monthly payroll with commission, bonus, and deduction tracking. One-click printable PDF payslips.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    tag: 'Operations',
  },
  {
    icon: Package,
    title: 'Store & Inventory',
    desc: 'Built-in POS system for supplements, drinks, and gear. Track stock, profit margins, and daily sales. Low-stock alerts. Cash and card payment recording.',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10 border-pink-400/20',
    tag: 'Revenue Growth',
  },
  {
    icon: Building2,
    title: 'Multi-Branch Management',
    desc: 'Manage your entire fight club network from one login. Add branches, assign managers, and get a unified overview of fighters and revenue across all locations.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10 border-cyan-400/20',
    tag: 'Enterprise',
  },
  {
    icon: Swords,
    title: 'Coach Management & Per-Session Pay',
    desc: 'Coaches get their own login to submit classes and private sessions for approval. Pay per session taught instead of a flat salary — payroll auto-tallies sessions each month.',
    color: 'text-crimson-400',
    bg: 'bg-crimson-400/10 border-crimson-400/20',
    tag: 'Operations',
  },
  {
    icon: Smartphone,
    title: 'Fighter Portal & Mobile App',
    desc: 'Every fighter gets their own portal with QR check-in, class & private session booking, workout plan, and progress tracking (weight, body fat, measurements).',
    color: 'text-primary-400',
    bg: 'bg-primary-400/10 border-primary-400/20',
    tag: 'Retention',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    desc: 'Revenue trends, fighter growth, class popularity, churn risk scores, and daily stats — all visualized in real time so you always know exactly how your club is performing.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    tag: 'Insights',
  },
  {
    icon: Zap,
    title: 'Smart Automations',
    desc: 'Renewal reminders, expiry warnings, follow-up nudges, and inactivity alerts run automatically in the background. Less admin work, more time on the mats.',
    color: 'text-primary-400',
    bg: 'bg-primary-400/10 border-primary-400/20',
    tag: 'Productivity',
  },
]

const tagColors: Record<string,string> = {
  'Revenue Growth': 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  'Core': 'bg-primary-400/10 text-primary-400 border-primary-400/20',
  'Retention': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  'Finance': 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  'Operations': 'bg-crimson-400/10 text-crimson-400 border-crimson-400/20',
  'Enterprise': 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  'Insights': 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  'Productivity': 'bg-primary-400/10 text-primary-400 border-primary-400/20',
}

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary-400 font-mono text-sm tracking-widest uppercase mb-4 block">Everything You Need</span>
          <h2 className="font-display text-6xl lg:text-7xl uppercase tracking-wider mb-4">
            12 POWERFUL<br /><span className="gradient-text">FEATURES</span>
          </h2>
          <p className="text-dark-200 text-lg max-w-2xl mx-auto">
            Every tool a fight club owner needs — from the first lead to the last payslip — built into one platform.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-dark-800 border border-dark-600 hover:border-dark-500 rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${f.bg}`}>
                  <f.icon size={20} className={f.color} />
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${tagColors[f.tag]}`}>{f.tag}</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-dark-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
