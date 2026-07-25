'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Play, Users, TrendingUp, Swords, Star } from 'lucide-react'
import Link from 'next/link'

function CountUp({ end, duration = 2 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, end, duration])

  return <span ref={ref}>{count.toLocaleString()}</span>
}

export function Hero() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-100" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-400/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-primary-400/5 rounded-full blur-[80px] pointer-events-none" />
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-primary-400/10 border border-primary-400/20 rounded-full px-4 py-1.5 mb-8"
        >
          <Star size={12} className="text-primary-400" fill="currentColor" />
          <span className="text-primary-400 text-sm font-body font-medium">The all-in-one fight club management platform</span>
          <Star size={12} className="text-primary-400" fill="currentColor" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-[110px] leading-none tracking-wider uppercase mb-6"
        >
          <span className="block text-white">Run Your</span>
          <span className="block gradient-text">Fight Club</span>
          <span className="block text-white">Like A Champion</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-body text-dark-200 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Vance is the all-in-one platform that handles members, coaches, classes, payments, and analytics — so you can focus on building the best fight club in town.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/auth/register" className="btn-primary text-base px-8 py-4 group">
            Start 14-Day Free Trial
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#dashboard-preview" className="btn-ghost text-base px-8 py-4 group">
            <Play size={16} className="text-primary-400" />
            See It In Action
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
        >
          {[
            { icon: Users, label: 'Fighters Managed', value: 500000, suffix: '+' },
            { icon: TrendingUp, label: 'Revenue Processed', value: 50, suffix: 'M+', prefix: '$' },
            { icon: Swords, label: 'Sessions Booked', value: 2000000, suffix: '+' },
          ].map(({ icon: Icon, label, value, suffix, prefix }) => (
            <div key={label} className="bg-dark-800/50 border border-dark-600 rounded-2xl p-4 backdrop-blur-sm">
              <Icon size={20} className="text-primary-400 mx-auto mb-2" />
              <div className="font-display text-2xl md:text-3xl text-white">
                {prefix}<CountUp end={value} />{suffix}
              </div>
              <div className="text-xs text-dark-300 font-body mt-1">{label}</div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 flex-col gap-3"
        >
          {['Fighter Check-In', 'Session Booked', 'Payment Received'].map((text, i) => (
            <motion.div
              key={text}
              animate={{ x: [0, 8, 0] }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
              className="flex items-center gap-2 bg-dark-800/80 border border-dark-600 rounded-xl px-3 py-2 backdrop-blur-sm"
            >
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
              <span className="text-xs text-dark-200 font-body whitespace-nowrap">{text}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col gap-3"
        >
          {['No Credit Card', '14-Day Free Trial', 'Cancel Anytime'].map((text, i) => (
            <motion.div
              key={text}
              animate={{ x: [0, -8, 0] }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
              className="flex items-center gap-2 bg-dark-800/80 border border-dark-600 rounded-xl px-3 py-2 backdrop-blur-sm"
            >
              <div className="w-2 h-2 bg-primary-400 rounded-full" />
              <span className="text-xs text-dark-200 font-body whitespace-nowrap">{text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-dark-400 font-body tracking-widest uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-8 bg-gradient-to-b from-dark-400 to-transparent"
        />
      </motion.div>
    </section>
  )
}
