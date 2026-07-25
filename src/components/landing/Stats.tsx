'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

const stats = [
  { value: '99.9%', label: 'Uptime SLA', desc: 'Enterprise-grade reliability' },
  { value: '<2s', label: 'Load Time', desc: 'Lightning fast performance' },
  { value: '256-bit', label: 'Encryption', desc: 'Bank-level security' },
  { value: '24/7', label: 'Support', desc: 'Always here when you need us' },
]

export function Stats() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="text-center p-6 bg-dark-800/40 border border-dark-700 rounded-2xl"
          >
            <div className="font-display text-4xl text-primary-400 mb-1">{stat.value}</div>
            <div className="font-body font-semibold text-white text-sm mb-1">{stat.label}</div>
            <div className="text-xs text-dark-400 font-body">{stat.desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
