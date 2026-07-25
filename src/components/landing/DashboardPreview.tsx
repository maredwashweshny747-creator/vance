'use client'
import { motion } from 'framer-motion'
import { Users, TrendingUp, Calendar, DollarSign, Activity, BarChart2, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react'

const members = [
  { name: 'Emma Davis', plan: 'Champion', status: 'Active', avatar: 'ED' },
  { name: 'James Wilson', plan: 'Contender', status: 'Active', avatar: 'JW' },
  { name: 'Olivia Brown', plan: 'Fighter', status: 'Frozen', avatar: 'OB' },
  { name: 'Noah Taylor', plan: 'Contender', status: 'Expired', avatar: 'NT' },
]
const statusColor: Record<string, string> = {
  Active: 'text-primary-400 bg-primary-400/10',
  Frozen: 'text-blue-400 bg-blue-400/10',
  Expired: 'text-red-400 bg-red-400/10',
}

export function DashboardPreview() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dark-900/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-primary-400 font-mono text-sm tracking-widest uppercase mb-4 block">The Dashboard</span>
          <h2 className="font-display text-6xl lg:text-7xl uppercase tracking-wider mb-4">
            YOUR CLUB AT A<br /><span className="gradient-text">GLANCE</span>
          </h2>
          <p className="text-dark-200 text-lg max-w-xl mx-auto">Everything you need to manage your fight club, visible the moment you log in.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-dark-600 bg-dark-900 overflow-hidden shadow-2xl glow">
          {/* Browser bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-dark-800 border-b border-dark-700">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/70"/><div className="w-3 h-3 rounded-full bg-yellow-500/70"/><div className="w-3 h-3 rounded-full bg-primary-500/70"/></div>
            <div className="flex-1 mx-4 bg-dark-700 rounded-md px-3 py-1 text-xs text-dark-400 font-mono">app.vance.io/dashboard</div>
            <div className="w-4 h-4 rounded-full bg-primary-400/20 border border-primary-400/30" />
          </div>

          {/* Dashboard content */}
          <div className="flex h-[580px]">
            {/* Sidebar */}
            <div className="w-16 lg:w-56 bg-dark-950 border-r border-dark-700 flex flex-col p-3 gap-1 flex-shrink-0">
              <div className="flex items-center gap-2 px-2 py-2 mb-3">
                <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center flex-shrink-0"><Activity size={14} className="text-dark-950" /></div>
                <span className="font-display text-sm tracking-wider hidden lg:block">VANCE</span>
              </div>
              {[{ icon: BarChart2, label: 'Dashboard', active: true }, { icon: Users, label: 'Members' }, { icon: Calendar, label: 'Classes' }, { icon: DollarSign, label: 'Payments' }, { icon: TrendingUp, label: 'Analytics' }].map(item => (
                <div key={item.label} className={`flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-all ${item.active ? 'bg-primary-400/10 text-primary-400' : 'text-dark-400 hover:text-white hover:bg-dark-800'}`}>
                  <item.icon size={16} className="flex-shrink-0" />
                  <span className="text-xs font-medium hidden lg:block">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div><h3 className="font-semibold text-white text-sm">Good morning, Alex 👋</h3><p className="text-dark-400 text-xs">Here&apos;s what&apos;s happening today</p></div>
                <div className="flex gap-2">
                  <button className="bg-dark-700 border border-dark-600 text-xs text-white px-3 py-1.5 rounded-lg">This Month</button>
                  <button className="bg-primary-400 text-dark-950 text-xs font-bold px-3 py-1.5 rounded-lg">+ Add Member</button>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Members', value: '847', change: '+12', up: true, icon: Users },
                  { label: 'Monthly Revenue', value: '$18,420', change: '+8.2%', up: true, icon: DollarSign },
                  { label: "Today's Classes", value: '14', change: '3 full', up: true, icon: Calendar },
                  { label: 'Churn Rate', value: '2.1%', change: '-0.4%', up: false, icon: TrendingUp },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-dark-800 border border-dark-700 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-dark-400 text-xs">{kpi.label}</span>
                      <kpi.icon size={13} className="text-dark-500" />
                    </div>
                    <div className="font-display text-lg text-white mb-1">{kpi.value}</div>
                    <div className={`flex items-center gap-1 text-xs ${kpi.up ? 'text-primary-400' : 'text-red-400'}`}>
                      {kpi.up ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} {kpi.change}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom panels */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                {/* Revenue chart placeholder */}
                <div className="lg:col-span-3 bg-dark-800 border border-dark-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Revenue Overview</span>
                    <MoreHorizontal size={14} className="text-dark-500" />
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {[40,65,45,80,55,90,70,85,60,95,75,100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 11 ? '#ffc700' : `rgba(255,199,0,${0.1 + i * 0.03})` }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-dark-500 mt-2">
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => <span key={m}>{m}</span>)}
                  </div>
                </div>

                {/* Recent members */}
                <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Recent Members</span>
                    <span className="text-xs text-primary-400 cursor-pointer">View all</span>
                  </div>
                  <div className="space-y-2.5">
                    {members.map(m => (
                      <div key={m.name} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">{m.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{m.name}</div>
                          <div className="text-xs text-dark-400">{m.plan}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor[m.status]}`}>{m.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
