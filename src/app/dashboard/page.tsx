'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Users, DollarSign, Calendar, UserCheck, ArrowUpRight, ArrowDownRight, TrendingUp, AlertCircle, Activity, Swords, Hourglass, Clock, CheckCircle2, QrCode, X } from 'lucide-react'
import { formatCurrency, cn, DAY_LABELS } from '@/lib/utils'
import Link from 'next/link'
import toast from 'react-hot-toast'

function CoachDashboard({ name }: { name: string }) {
  const [classes, setClasses] = useState<any[]>([])
  const [coachId, setCoachId] = useState('')
  const [sessionRate, setSessionRate] = useState(0)
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [todaysClasses, setTodaysClasses] = useState<{ id: string; name: string; checkedIn: boolean }[]>([])
  const [showQr, setShowQr] = useState(false)
  const [loading, setLoading] = useState(true)

  function loadAttendance(myCoachId: string) {
    fetch('/api/coach-attendance').then(r => r.ok ? r.json() : []).then((rows: any[]) => {
      const mine = rows.find(r => r.coachId === myCoachId)
      if (mine) setTodaysClasses(mine.todaysClasses || [])
    }).catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/classes').then(r => r.ok ? r.json() : []),
      fetch('/api/coaches?mine=true').then(r => r.ok ? r.json() : null),
    ]).then(([cls, mine]) => {
      setClasses(Array.isArray(cls) ? cls : [])
      setSessionRate(mine?.sessionRate || 0)
      setSessionsThisMonth(mine?.sessionsThisMonth || 0)
      if (mine?.id) { setCoachId(mine.id); loadAttendance(mine.id) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const pending = classes.filter(c => c.status === 'PENDING')
  // A class is "on this week" if it's a one-time session in the next 7 days, or a
  // recurring class (which by definition happens again within any given week).
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 86400000)
  const upcoming = classes.filter(c => c.status === 'APPROVED' && (
    c.isOneTime ? (c.sessionDate && new Date(c.sessionDate) >= now && new Date(c.sessionDate) <= weekAhead) : c.daysOfWeek?.length > 0
  ))
  const nextUp = classes
    .filter(c => c.status === 'APPROVED')
    .slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">WELCOME, {name.split(' ')[0]?.toUpperCase()}</h1>
          <p className="text-dark-300 text-sm mt-1">Your classes, private sessions, and earnings at a glance</p>
        </div>
        <button onClick={() => setShowQr(s => !s)}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-300 text-dark-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95">
          <QrCode size={16}/> {showQr ? 'Hide My QR' : 'Show My QR'}
        </button>
      </div>

      {showQr && coachId && (
        <div className="card flex flex-col items-center gap-2 py-6">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('vance:coach:' + coachId)}&bgcolor=ffffff&color=000000`} alt="Coach check-in QR code" className="rounded-lg" />
          <p className="text-dark-400 text-xs">Show this at the front desk to check in for today&apos;s class</p>
        </div>
      )}

      {todaysClasses.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white text-sm mb-3">Today&apos;s Classes</h2>
          <p className="text-dark-500 text-xs mb-3">Show your QR to reception or admin to be checked in — coaches can&apos;t check themselves in.</p>
          <div className="space-y-2">
            {todaysClasses.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-dark-700 last:border-0">
                <span className="text-white text-sm flex-1">{c.name}</span>
                {c.checkedIn ? (
                  <span className="flex items-center gap-1 text-primary-400 text-xs"><CheckCircle2 size={14}/> Checked in</span>
                ) : (
                  <span className="text-dark-500 text-xs">Awaiting check-in</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_,i) => <div key={i} className="h-28 rounded-2xl skeleton"/>)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/classes" className="block card-hover">
            <div className="flex items-start justify-between mb-3"><span className="text-dark-400 text-xs">On This Week</span><Clock size={15} className="text-primary-400"/></div>
            <div className="font-display text-3xl text-white mb-1">{upcoming.length}</div>
            <div className="text-dark-500 text-xs">classes running</div>
          </Link>
          <Link href="/dashboard/classes" className="block card-hover">
            <div className="flex items-start justify-between mb-3"><span className="text-dark-400 text-xs">Awaiting Approval</span><Hourglass size={15} className="text-yellow-400"/></div>
            <div className="font-display text-3xl text-white mb-1">{pending.length}</div>
            <div className="text-dark-500 text-xs">pending admin review</div>
          </Link>
          <div className="card-hover">
            <div className="flex items-start justify-between mb-3"><span className="text-dark-400 text-xs">Sessions This Month</span><Swords size={15} className="text-crimson-400"/></div>
            <div className="font-display text-3xl text-white mb-1">{sessionsThisMonth}</div>
            <div className="text-dark-500 text-xs">taught so far</div>
          </div>
          <div className="card-hover">
            <div className="flex items-start justify-between mb-3"><span className="text-dark-400 text-xs">Est. Earnings</span><DollarSign size={15} className="text-primary-400"/></div>
            <div className="font-display text-3xl text-white mb-1">{formatCurrency(sessionsThisMonth * sessionRate)}</div>
            <div className="text-dark-500 text-xs">{formatCurrency(sessionRate)}/session</div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-white text-sm mb-3">Your Classes</h2>
        {nextUp.length === 0 ? (
          <p className="text-dark-500 text-sm">Nothing scheduled yet — submit a class or private session to get started.</p>
        ) : (
          <div className="space-y-2">
            {nextUp.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-dark-700 last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color || '#ffc700' }}/>
                <span className="text-white text-sm flex-1 truncate">{c.name}</span>
                <span className="text-xs text-dark-400 bg-dark-700 px-2 py-0.5 rounded-full">{c.type === 'PRIVATE' ? 'Private' : 'Group'}</span>
                <span className="text-dark-400 text-xs">
                  {c.isOneTime ? (c.sessionDate ? new Date(c.sessionDate).toLocaleDateString() : 'One session') : (c.daysOfWeek || []).map((d: string) => DAY_LABELS[d] || d).join('/')}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/dashboard/classes" className="text-xs text-primary-400/70 hover:text-primary-400 transition-colors mt-3 block">Manage your classes →</Link>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'ADMIN'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (role === 'COACH') { setLoading(false); return }
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(true); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [role])

  if (role === 'COACH') return <CoachDashboard name={session?.user?.name || 'Coach'} />

  const kpi = data?.kpi

  const cards = kpi ? [
    {
      label: 'Total Fighters',
      value: String(kpi.totalMembers ?? 0),
      sub: `${kpi.newThisMonth ?? 0} joined this month`,
      up: true,
      icon: Users,
      link: '/dashboard/fighters',
      color: 'text-primary-400',
    },
    {
      label: 'Active Fighters',
      value: String(kpi.activeMembers ?? 0),
      sub: `${kpi.frozenMembers ?? 0} frozen · ${kpi.expiredMembers ?? 0} expired`,
      up: true,
      icon: UserCheck,
      link: '/dashboard/fighters',
      color: 'text-blue-400',
    },
    {
      label: 'Revenue This Month',
      value: formatCurrency(kpi.revenueThisMonth ?? 0),
      sub: `Last month: ${formatCurrency(kpi.revenueLastMonth ?? 0)}`,
      up: (kpi.revenueThisMonth ?? 0) >= (kpi.revenueLastMonth ?? 0),
      icon: DollarSign,
      link: '/dashboard/payments',
      color: 'text-primary-400',
    },
    {
      label: 'Check-ins This Month',
      value: String(kpi.checkInsThisMonth ?? 0),
      sub: `~${kpi.avgCheckInsPerDay ?? 0} visits/day`,
      up: true,
      icon: Activity,
      link: '/dashboard/attendance',
      color: 'text-purple-400',
    },
  ] : []

  const statusBreakdown = data?.statusBreakdown ?? []
  const recentRevenue   = data?.revenueMonths ?? []
  const topClasses      = data?.topClasses ?? []
  const checkInTrend    = data?.checkInTrend ?? []
  const totalMembers    = kpi?.totalMembers ?? 1

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wider text-white">DASHBOARD</h1>
        <p className="text-dark-300 text-sm mt-1">Welcome back — here&apos;s your club at a glance</p>
      </div>

      {/* ── KPI cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
        </div>
      ) : error ? (
        <div className="card flex items-center gap-3 text-red-400">
          <AlertCircle size={18} /> Failed to load data — make sure the database is set up and seeded.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Link href={c.link} className="block card-hover group">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-dark-400 text-xs leading-tight">{c.label}</span>
                  <c.icon size={15} className={cn('flex-shrink-0 transition-colors', c.color)} />
                </div>
                <div className="font-display text-3xl text-white mb-1">{c.value}</div>
                <div className="text-dark-500 text-xs">{c.sub}</div>
                <div className={cn('flex items-center gap-1 text-xs mt-2', c.up ? 'text-primary-400' : 'text-red-400')}>
                  {c.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {c.up ? 'On track' : 'Down'}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Second row ── */}
      {!loading && !error && kpi && (
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Member status breakdown */}
          <div className="lg:col-span-2 card space-y-4">
            <h2 className="font-semibold text-white text-sm">Fighters by Status</h2>
            {statusBreakdown.length === 0 ? (
              <p className="text-dark-500 text-sm">No member data yet</p>
            ) : statusBreakdown.map((s: any) => {
              const colorMap: Record<string, string> = {
                ACTIVE: 'bg-primary-400', EXPIRED: 'bg-red-400',
                CANCELED: 'bg-gray-500',
              }
              const count = s._count?.membershipStatus ?? s.count ?? 0
              const status = s.membershipStatus ?? s.status ?? ''
              const pct = Math.round((count / Math.max(totalMembers, 1)) * 100)
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-dark-300 capitalize">{status.toLowerCase()}</span>
                    <span className="text-white font-medium">{count} <span className="text-dark-500 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className={cn('h-full rounded-full', colorMap[status] || 'bg-dark-500')}
                    />
                  </div>
                </div>
              )
            })}

            {/* Alerts */}
            <div className="pt-2 space-y-2">
              {(kpi.expiredMembers ?? 0) > 0 && (
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertCircle size={13} />
                  {kpi.expiredMembers} expired fighter{kpi.expiredMembers > 1 ? 's' : ''} — follow up for renewal
                </div>
              )}
              {(kpi.frozenMembers ?? 0) > 0 && (
                <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
                  <AlertCircle size={13} />
                  {kpi.frozenMembers} frozen membership{kpi.frozenMembers > 1 ? 's' : ''} active
                </div>
              )}
            </div>
          </div>

          {/* Quick stats column */}
          <div className="space-y-4">

            {/* Revenue last 6 months mini */}
            <div className="card">
              <h2 className="font-semibold text-white text-sm mb-3">Revenue (6 months)</h2>
              <div className="space-y-1.5">
                {recentRevenue.slice(-4).map((m: any) => {
                  const max = Math.max(...recentRevenue.map((x: any) => x.revenue), 1)
                  const pct = Math.round((m.revenue / max) * 100)
                  return (
                    <div key={m.month} className="flex items-center gap-2">
                      <span className="text-dark-500 text-xs w-8">{m.month}</span>
                      <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-white text-xs font-mono w-16 text-right">{formatCurrency(m.revenue)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top classes */}
            <div className="card">
              <h2 className="font-semibold text-white text-sm mb-3">Top Classes</h2>
              {topClasses.length === 0 ? (
                <p className="text-dark-500 text-sm">No classes yet</p>
              ) : (
                <div className="space-y-2">
                  {topClasses.slice(0, 4).map((c: any, i: number) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-dark-600 text-xs w-4">{i + 1}</span>
                      <span className="text-dark-300 text-xs flex-1 truncate">{c.name}</span>
                      <span className="text-primary-400 text-xs font-mono">{c.bookings}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lead conversion */}
            <div className="card">
              <h2 className="font-semibold text-white text-sm mb-3">Lead Conversion</h2>
              <div className="flex items-end gap-3">
                <div className="font-display text-4xl text-primary-400">{kpi.conversionRate ?? 0}%</div>
                <div className="text-dark-500 text-xs pb-1">{kpi.convertedLeads ?? 0} of {kpi.totalLeads ?? 0} leads</div>
              </div>
              <Link href="/dashboard/leads" className="text-xs text-primary-400/70 hover:text-primary-400 transition-colors mt-2 block">
                View leads →
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* ── Check-in trend ── */}
      {!loading && !error && checkInTrend.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white text-sm mb-4">Daily Check-ins (last 14 days)</h2>
          <div className="flex items-end gap-1.5 h-20">
            {checkInTrend.map((d: any) => {
              const max = Math.max(...checkInTrend.map((x: any) => x.visits), 1)
              const pct = Math.round((d.visits / max) * 100)
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-dark-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">{d.visits}</span>
                  <div className="w-full bg-dark-700 rounded-sm overflow-hidden" style={{ height: '56px' }}>
                    <div className="w-full bg-primary-400/60 group-hover:bg-primary-400 rounded-sm transition-colors"
                      style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-dark-600 text-xs mt-1">
            <span>{checkInTrend[0]?.day?.split(',')[0]}</span>
            <span>Today</span>
          </div>
        </div>
      )}

    </div>
  )
}
