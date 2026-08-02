'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { UserCheck, Search, Users, TrendingUp, AlertCircle, Clock, CheckCircle2, Zap, QrCode, X } from 'lucide-react'
import Link from 'next/link'
import { getInitials, formatDateTime, cn } from '@/lib/utils'
import { disciplineLabel } from '@/lib/categories'
import toast from 'react-hot-toast'

interface PlanEnrollment { id: string; class: { id: string; name: string; category?: string | null } }
interface Member { id: string; firstName: string; lastName: string; email: string; enrollments: PlanEnrollment[] }
interface CheckIn { id: string; checkedIn: string; method: string; member: Member; memberPlan?: { plan: { name: string; category?: string | null } } }
interface Stats { checkIns: CheckIn[]; todayCount: number; weeklyCheckIns: number; inactiveCount: number }

interface CoachRow {
  coachId: string; firstName: string; lastName: string
  todaysClasses: { id: string; name: string; checkedIn: boolean }[]
  assignedThisMonth: number; attendedThisMonth: number; missedThisMonth: number
}

export default function AttendancePage() {
  const { data: session } = useSession()
  const canCheckInCoaches = ['ADMIN', 'RECEPTIONIST'].includes((session?.user as any)?.role)
  const [stats, setStats] = useState<Stats | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [coaches, setCoaches] = useState<CoachRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [planPicker, setPlanPicker] = useState<Member | null>(null)

  function loadStats() {
    fetch('/api/attendance?view=today')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  function loadCoaches() {
    fetch('/api/coach-attendance').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCoaches(d) }).catch(() => {})
  }

  useEffect(() => {
    loadStats()
    loadCoaches()
    fetch('/api/attendance?view=members')
      .then(r => r.json())
      .then(d => setMembers(Array.isArray(d) ? d : []))
  }, [])

  async function checkInCoach(coachId: string, classId: string) {
    const res = await fetch('/api/coach-attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coachId, classId, status: 'ATTENDED' }) })
    if (res.ok) { toast.success('Coach checked in'); loadCoaches() } else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed') }
  }

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const checkedInIds = new Set(stats?.checkIns.map(c => c.member.id) || [])

  async function submitCheckIn(memberId: string, memberPlanId?: string) {
    setCheckingIn(memberId)
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, memberPlanId, method: 'MANUAL' }),
    })
    setCheckingIn(null)
    const data = await res.json().catch(() => ({}))
    if (res.ok) { toast.success('Checked in!'); loadStats(); setPlanPicker(null) }
    else if (data.error === 'MULTIPLE_PLANS') { /* handled by caller opening the picker */ }
    else toast.error(data.error || 'Failed')
  }

  async function checkIn(member: Member) {
    if (checkedInIds.has(member.id)) { toast('Already checked in today', { icon: '✓' }); return }
    if (member.enrollments.length > 1) { setPlanPicker(member); return }
    await submitCheckIn(member.id)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">ATTENDANCE</h1>
          <p className="text-dark-300 text-sm mt-1">Manual check-in — click a fighter to log their visit</p>
        </div>
        <Link href="/dashboard/attendance/scan"
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-300 text-dark-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95">
          <QrCode size={16} />
          Open QR Scanner
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: UserCheck, label: 'Today', value: loading ? '—' : String(stats?.todayCount ?? 0), color: 'primary' },
          { icon: TrendingUp, label: 'This Week', value: loading ? '—' : String(stats?.weeklyCheckIns ?? 0), color: 'blue' },
          { icon: Users, label: 'Active Fighters', value: loading ? '—' : String(members.length), color: 'purple' },
          { icon: AlertCircle, label: 'Inactive 30d', value: loading ? '—' : String(stats?.inactiveCount ?? 0), color: 'orange' },
        ].map(s => {
          const Icon = s.icon
          const colorMap: Record<string, string> = {
            primary: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
            blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
            purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
            orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
          }
          return (
            <div key={s.label} className="card">
              <div className={`inline-flex p-2 rounded-lg border mb-3 ${colorMap[s.color]}`}><Icon size={16}/></div>
              <div className="font-display text-3xl text-white mb-0.5">{s.value}</div>
              <div className="text-xs text-dark-400">{s.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Check-in panel */}
        <div className="card space-y-4">
          <h2 className="font-display text-xl tracking-wider text-white">CHECK IN A FIGHTER</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fighter name or email..." className="input pl-9"/>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-dark-500 text-sm">No fighters found</div>
            ) : filtered.map(m => {
              const alreadyIn = checkedInIds.has(m.id)
              const isLoading = checkingIn === m.id
              return (
                <motion.button
                  key={m.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => checkIn(m)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    alreadyIn
                      ? 'bg-primary-400/5 border-primary-400/20 cursor-default'
                      : 'bg-dark-700 border-dark-600 hover:border-primary-400/40 hover:bg-dark-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                    {getInitials(`${m.firstName} ${m.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{m.firstName} {m.lastName}</div>
                    <div className="text-dark-400 text-xs truncate">{m.enrollments.map(p => p.class.name).join(' + ') || m.email}</div>
                  </div>
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin flex-shrink-0"/>
                  ) : alreadyIn ? (
                    <CheckCircle2 size={18} className="text-primary-400 flex-shrink-0"/>
                  ) : (
                    <Zap size={16} className="text-dark-500 flex-shrink-0"/>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Today's log */}
        <div className="card space-y-4">
          <h2 className="font-display text-xl tracking-wider text-white">TODAY&apos;S LOG</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              [...Array(4)].map((_,i) => <div key={i} className="h-14 skeleton rounded-xl"/>)
            ) : !stats?.checkIns.length ? (
              <div className="text-center py-8 text-dark-500 text-sm">No check-ins yet today</div>
            ) : stats.checkIns.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 bg-dark-700 rounded-xl border border-dark-600">
                <div className="w-8 h-8 rounded-full bg-primary-400/10 border border-primary-400/20 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                  {getInitials(`${c.member.firstName} ${c.member.lastName}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{c.member.firstName} {c.member.lastName}</div>
                  <div className="flex items-center gap-1 text-dark-400 text-xs truncate">
                    <Clock size={10}/>
                    {new Date(c.checkedIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className="ml-1 text-dark-600">·</span>
                    <span className="text-dark-500 truncate">{c.memberPlan?.plan?.name || c.method}</span>
                  </div>
                </div>
                <CheckCircle2 size={16} className="text-primary-400 flex-shrink-0"/>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Coach attendance */}
      {coaches.length > 0 && (
        <div className="card">
          <h2 className="font-display text-xl tracking-wider text-white mb-4">COACHES</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {coaches.map(c => (
              <div key={c.coachId} className="p-3 rounded-xl border bg-dark-700 border-dark-600">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                    {getInitials(`${c.firstName} ${c.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{c.firstName} {c.lastName}</div>
                    <div className="text-dark-500 text-xs">{c.attendedThisMonth} attended · {c.missedThisMonth} missed this month</div>
                  </div>
                </div>
                {c.todaysClasses.length === 0 ? (
                  <p className="text-dark-500 text-xs">No classes scheduled today</p>
                ) : (
                  <div className="space-y-1.5">
                    {c.todaysClasses.map(cls => (
                      <div key={cls.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-dark-300 truncate flex-1">{cls.name}</span>
                        {cls.checkedIn ? (
                          <CheckCircle2 size={14} className="text-primary-400 flex-shrink-0"/>
                        ) : canCheckInCoaches ? (
                          <button onClick={() => checkInCoach(c.coachId, cls.id)} className="flex-shrink-0 px-2 py-1 bg-primary-400/10 border border-primary-400/20 text-primary-400 rounded-md hover:bg-primary-400/20 transition-colors">Check In</button>
                        ) : (
                          <span className="text-dark-500 flex-shrink-0">Not checked in</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive warning */}
      {stats && stats.inactiveCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="border border-orange-500/20 bg-orange-500/5 rounded-2xl p-5 flex items-start gap-4">
          <AlertCircle size={20} className="text-orange-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-white font-semibold text-sm">{stats.inactiveCount} active fighter{stats.inactiveCount > 1 ? 's have' : ' has'} not visited in 30+ days</p>
            <p className="text-dark-400 text-xs mt-1">Consider sending a win-back message to re-engage them before their membership lapses.</p>
          </div>
        </motion.div>
      )}

      {/* Plan picker — shown when a fighter trains more than one discipline */}
      <AnimatePresence>
        {planPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPlanPicker(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl text-white">WHICH SESSION?</h3>
                <button onClick={() => setPlanPicker(null)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400"><X size={16}/></button>
              </div>
              <p className="text-dark-400 text-xs mb-4">{planPicker.firstName} trains more than one discipline — which one is today&apos;s session for?</p>
              <div className="space-y-2">
                {planPicker.enrollments.map(p => (
                  <button key={p.id} onClick={() => submitCheckIn(planPicker.id, p.id)}
                    disabled={checkingIn === planPicker.id}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-dark-600 hover:border-primary-400/40 hover:bg-dark-700 transition-all text-left">
                    <div>
                      <div className="text-white text-sm font-medium">{p.class.name}</div>
                      <div className="text-dark-500 text-xs">{disciplineLabel(p.class.category)}</div>
                    </div>
                    <Zap size={14} className="text-dark-500"/>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
