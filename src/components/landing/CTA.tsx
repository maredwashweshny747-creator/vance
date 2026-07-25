'use client'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export function CTA() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="relative rounded-3xl bg-primary-400 p-12 md:p-20 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-300 to-primary-500" />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-dark-950/10 translate-y-24 -translate-x-24" />
          <div className="relative z-10">
            <h2 className="font-display text-6xl md:text-7xl uppercase tracking-wider text-dark-950 mb-4">
              ENTER THE RING<br />TODAY
            </h2>
            <p className="text-dark-700 text-lg mb-8 max-w-xl mx-auto">Join 2,400+ fight club owners who transformed their business with Vance. Setup takes under 30 minutes.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auth/register" className="inline-flex items-center justify-center gap-2 bg-dark-950 text-white px-8 py-4 rounded-xl font-semibold hover:bg-dark-800 transition-all active:scale-95">
                Start Free Trial <ArrowRight size={18} />
              </Link>
              <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 border-2 border-dark-950/20 text-dark-900 px-8 py-4 rounded-xl font-semibold hover:bg-dark-950/10 transition-all">
                Sign In
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm text-dark-700">
              {['14-day free trial', 'No credit card required', 'Cancel anytime', 'Free migration help'].map(t => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle size={14} /> {t}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
