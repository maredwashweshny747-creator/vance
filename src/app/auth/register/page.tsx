'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Swords, Mail, Lock, User, Building2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', clubName: '' })

  function set(k: string) { return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      toast.success('Account created! Redirecting...')
      router.push('/auth/login?registered=true')
    } catch (err: any) {
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary-400/5 blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary-400 rounded-xl flex items-center justify-center"><Swords size={22} className="text-dark-950"/></div>
            <span className="font-display text-2xl tracking-wider">VANCE</span>
          </Link>
          <h1 className="font-display text-4xl tracking-wider mb-2">START FOR FREE</h1>
          <p className="text-dark-300 text-sm">14-day trial, no credit card required</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Your Name</label>
                <div className="relative"><User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input type="text" value={form.name} onChange={set('name')} placeholder="Alex Johnson" required className="input pl-10" /></div>
              </div>
              <div>
                <label className="label">Club Name</label>
                <div className="relative"><Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input type="text" value={form.clubName} onChange={set('clubName')} placeholder="Blackout Fight Club" required className="input pl-10" /></div>
              </div>
              <div>
                <label className="label">Email Address</label>
                <div className="relative"><Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input type="email" value={form.email} onChange={set('email')} placeholder="you@yourclub.com" required className="input pl-10" /></div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative"><Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" required className="input pl-10" /></div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 mt-2 disabled:opacity-50">
              {loading ? 'Creating account...' : <><span>Create Free Account</span><ArrowRight size={16}/></>}
            </button>
          </form>
          <p className="text-xs text-dark-400 text-center mt-4">By signing up you agree to our <Link href="/terms" className="text-primary-400 hover:underline">Terms</Link> and <Link href="/privacy" className="text-primary-400 hover:underline">Privacy Policy</Link></p>
        </div>
        <p className="text-center text-sm text-dark-400 mt-6">Already have an account? <Link href="/auth/login" className="text-primary-400 hover:underline">Sign in</Link></p>
      </motion.div>
    </div>
  )
}
