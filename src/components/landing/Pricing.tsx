'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Building2, Crown, ArrowRight, X } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    icon: Zap,
    price: { monthly: 29, annual: 19 },
    desc: 'Everything a new or small fight club needs to get fully operational from day one.',
    color: 'dark',
    fighters: 'Up to 500 fighters',
    highlight: null,
    features: [
      'Up to 500 fighters',
      'Unlimited class & private session scheduling',
      'Fighter check-in (manual + QR)',
      'Online payments & invoicing',
      'Fighter portal & profiles',
      'Email notifications',
      '3 staff/coach accounts',
      'Session-based membership plans',
      'Basic analytics dashboard',
      'Standard support (email)',
    ],
    notIncluded: ['SMS automations', 'Multi-location', 'White-labeling', 'API access'],
    cta: 'Start Free 14-Day Trial',
    popular: false,
  },
  {
    name: 'Professional',
    icon: Building2,
    price: { monthly: 69, annual: 49 },
    desc: 'The complete toolkit for growing fight clubs that want automation and deeper insights.',
    color: 'primary',
    fighters: 'Up to 2,000 fighters',
    highlight: 'BEST VALUE',
    features: [
      'Up to 2,000 fighters',
      'Everything in Starter',
      'SMS + Email automations',
      'Automated payment reminders',
      'Churn risk alerts',
      'Advanced analytics & reports',
      'Coach per-session payroll',
      'Class approval workflow',
      'Class attendance reports',
      '10 staff/coach accounts',
      'Priority support (chat + email)',
      'Daily data backups',
    ],
    notIncluded: ['Multi-location', 'White-labeling', 'API access'],
    cta: 'Start Free 14-Day Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    icon: Crown,
    price: { monthly: 149, annual: 109 },
    desc: 'For chains, franchises, and serious fight organizations with multiple locations.',
    color: 'dark',
    fighters: 'Unlimited fighters',
    highlight: null,
    features: [
      'Unlimited fighters',
      'Everything in Professional',
      'Multi-location management',
      'White-label branding',
      'Full API access',
      'Fighter mobile app (PWA)',
      'Custom integrations',
      'Dedicated account manager',
      'Unlimited staff/coach accounts',
      'SLA uptime guarantee',
      '24/7 phone + priority support',
      'Custom onboarding session',
    ],
    notIncluded: [],
    cta: 'Contact Sales',
    popular: false,
  },
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)
  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary-400 font-mono text-sm tracking-widest uppercase mb-4 block">Simple Pricing</span>
          <h2 className="font-display text-6xl lg:text-7xl uppercase tracking-wider mb-4">
            PRICING THAT<br /><span className="gradient-text">SCALES WITH YOU</span>
          </h2>
          <p className="text-dark-200 text-lg max-w-xl mx-auto mb-8">All plans include a 14-day free trial. No credit card required to start.</p>
          <div className="inline-flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-xl p-1">
            <button onClick={() => setAnnual(false)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-dark-600 text-white' : 'text-dark-400'}`}>Monthly</button>
            <button onClick={() => setAnnual(true)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-primary-400 text-dark-950' : 'text-dark-400'}`}>
              Annual <span className="text-xs bg-primary-400/20 text-primary-400 px-2 py-0.5 rounded-full font-mono">Save 30%</span>
            </button>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 flex flex-col ${plan.popular ? 'bg-primary-400 border-2 border-primary-400 glow-strong scale-105' : 'bg-dark-800 border border-dark-600 hover:border-dark-500'} transition-all`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-dark-950 border border-primary-400 text-primary-400 text-xs font-mono px-3 py-1 rounded-full whitespace-nowrap">{plan.highlight}</div>
              )}
              <div className="mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.popular ? 'bg-dark-950/20' : 'bg-primary-400/10'}`}>
                  <plan.icon size={20} className={plan.popular ? 'text-dark-950' : 'text-primary-400'} />
                </div>
                <h3 className={`font-display text-3xl tracking-wider mb-1 ${plan.popular ? 'text-dark-950' : 'text-white'}`}>{plan.name}</h3>
                <p className={`text-sm leading-relaxed ${plan.popular ? 'text-dark-800' : 'text-dark-300'}`}>{plan.desc}</p>
              </div>

              <div className="mb-2">
                <div className="flex items-end gap-1">
                  <span className={`font-display text-5xl ${plan.popular ? 'text-dark-950' : 'text-white'}`}>${annual ? plan.price.annual : plan.price.monthly}</span>
                  <span className={`text-sm mb-2 ${plan.popular ? 'text-dark-800' : 'text-dark-400'}`}>/mo</span>
                </div>
                {annual && <p className={`text-xs ${plan.popular ? 'text-dark-800' : 'text-dark-400'}`}>billed annually — saves ${(plan.price.monthly - plan.price.annual) * 12}/yr</p>}
              </div>

              <div className={`text-xs font-bold mb-6 px-3 py-1.5 rounded-lg inline-block w-fit ${plan.popular ? 'bg-dark-950/20 text-dark-900' : 'bg-primary-400/10 text-primary-400'}`}>
                {plan.fighters}
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.popular ? 'text-dark-900' : 'text-dark-200'}`}>
                    <Check size={14} className={`flex-shrink-0 mt-0.5 ${plan.popular ? 'text-dark-950' : 'text-primary-400'}`} />{f}
                  </li>
                ))}
                {plan.notIncluded.map(f => (
                  <li key={f} className={`flex items-start gap-2.5 text-sm ${plan.popular ? 'text-dark-700' : 'text-dark-600'}`}>
                    <X size={14} className="flex-shrink-0 mt-0.5 opacity-50" />{f}
                  </li>
                ))}
              </ul>

              <Link href={plan.name === 'Enterprise' ? '/contact' : '/auth/register'}
                className={`inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all ${plan.popular ? 'bg-dark-950 text-white hover:bg-dark-800' : 'bg-primary-400 text-dark-950 hover:bg-primary-300'}`}>
                {plan.cta} <ArrowRight size={16} />
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-12 grid sm:grid-cols-3 gap-4 text-center">
          {[
            { label: '14-day free trial', sub: 'No credit card needed' },
            { label: 'Cancel anytime', sub: 'No lock-in contracts' },
            { label: 'Free migration help', sub: 'We import your data for free' },
          ].map(item => (
            <div key={item.label} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
              <div className="text-white font-semibold text-sm mb-0.5">{item.label}</div>
              <div className="text-dark-400 text-xs">{item.sub}</div>
            </div>
          ))}
        </motion.div>

        <p className="text-center text-dark-400 text-sm mt-6">
          All plans include SSL encryption, daily backups, and GDPR compliance. Need a custom plan?{' '}
          <a href="mailto:sales@vance.app" className="text-primary-400 hover:underline">Talk to sales</a>
        </p>
      </div>
    </section>
  )
}
