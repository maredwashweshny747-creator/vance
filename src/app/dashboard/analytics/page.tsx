'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts'
import { TrendingUp, TrendingDown, Users, DollarSign, UserCheck, Target, BarChart3, Activity } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

const COLORS = ['#ffc700', '#60a5fa', '#f97316', '#a78bfa', '#f43f5e', '#34d399']

function KpiCard({ label, value, sub, icon: Icon, trend, color = 'primary' }: any) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    red: 'text-red-400 bg-red-400/10 border-red-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  }
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
      <div className={`inline-flex p-2 rounded-xl border mb-3 ${colorMap[color]}`}>
        <Icon size={16} />
      </div>
      <div className="text-white font-display text-3xl mb-0.5">{value}</div>
      <div className="text-dark-400 text-xs">{label}</div>
      {sub && <div className="text-dark-500 text-xs mt-1">{sub}</div>}
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs mt-2', trend >= 0 ? 'text-primary-400' : 'text-red-400')}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-dark-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="h-10 w-48 skeleton rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-72 skeleton rounded-2xl" />)}
      </div>
    </div>
  )

  if (!data) return <div className="p-6 text-dark-400">Failed to load analytics</div>

  const { kpi, revenueMonths, memberGrowth, membershipTypes, statusBreakdown, checkInTrend, topClasses } = data

  const revTrend = kpi.revenueLastMonth > 0
    ? Math.round(((kpi.revenueThisMonth - kpi.revenueLastMonth) / kpi.revenueLastMonth) * 100)
    : 0

  const statusData = statusBreakdown.map((s: any) => ({
    name: s.membershipStatus, value: s._count.membershipStatus,
  }))

  const typeData = membershipTypes.map((t: any) => ({
    name: t.membershipType, value: t._count.membershipType,
  }))

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wider text-white">ANALYTICS</h1>
        <p className="text-dark-300 text-sm mt-1">Full business intelligence for your gym</p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Revenue This Month" value={formatCurrency(kpi.revenueThisMonth)} icon={DollarSign} trend={revTrend} color="primary"
          sub={`Last month: ${formatCurrency(kpi.revenueLastMonth)}`} />
        <KpiCard label="Total Revenue" value={formatCurrency(kpi.totalRevenue)} icon={TrendingUp} color="primary"
          sub="All time" />
        <KpiCard label="Active Fighters" value={kpi.activeMembers} icon={Users} color="blue"
          sub={`${kpi.newThisMonth} joined this month`} />
        <KpiCard label="Total Fighters" value={kpi.totalMembers} icon={UserCheck} color="blue"
          sub={`${kpi.frozenMembers} frozen · ${kpi.expiredMembers} expired`} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Lead Conversion" value={`${kpi.conversionRate}%`} icon={Target} color="orange"
          sub={`${kpi.convertedLeads} of ${kpi.totalLeads} leads converted`} />
        <KpiCard label="Check-ins This Month" value={kpi.checkInsThisMonth} icon={Activity} color="purple"
          sub={`~${kpi.avgCheckInsPerDay} visits/day avg`} />
        <KpiCard label="Expired Fighters" value={kpi.expiredMembers} icon={TrendingDown} color="red"
          sub="Need renewal follow-up" />
        <KpiCard label="Frozen Fighters" value={kpi.frozenMembers} icon={Users} color="blue"
          sub="Subscription paused" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Monthly Revenue</h3>
          <p className="text-dark-400 text-xs mb-5">Last 6 months</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueMonths}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffc700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ffc700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#ffc700" fill="url(#revGrad)" strokeWidth={2} dot={{ fill: '#ffc700', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Fighter growth */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Fighter Growth</h3>
          <p className="text-dark-400 text-xs mb-5">New members per month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={memberGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="new" name="New Fighters" fill="#ffc700" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total" name="Total Fighters" fill="#27272a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily check-ins */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Daily Attendance</h3>
          <p className="text-dark-400 text-xs mb-5">Check-ins last 14 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={checkInTrend}>
              <defs>
                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="visits" name="Visits" stroke="#60a5fa" fill="url(#attGrad)" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Membership Status</h3>
          <p className="text-dark-400 text-xs mb-5">Current distribution</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {statusData.map((s: any, i: number) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-dark-300 text-xs">{s.name}</span>
                  </div>
                  <span className="text-white text-sm font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Membership types */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Membership Plans</h3>
          <p className="text-dark-400 text-xs mb-5">Fighter breakdown by plan</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Fighters" fill="#ffc700" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top classes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Top Classes</h3>
          <p className="text-dark-400 text-xs mb-5">Most booked classes</p>
          {topClasses.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-dark-500 text-sm">No class data yet</div>
          ) : (
            <div className="space-y-3">
              {topClasses.map((c: any, i: number) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm">{c.name}</span>
                      <span className="text-dark-400 text-xs">{c.bookings} enrolled</span>
                    </div>
                    <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${topClasses[0].bookings > 0 ? (c.bookings / topClasses[0].bookings) * 100 : 0}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
