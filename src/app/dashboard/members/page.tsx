'use client'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Plus, Trash2, X, AlertTriangle,
  Snowflake, Flame, RefreshCw, Edit3, Save, CheckCircle2,
  Calendar, Activity, CreditCard, ChevronRight, Minus, XCircle
} from 'lucide-react'
import { formatDate, formatCurrency, membershipColors, getInitials, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface MembershipPlan {
  id: string; name: string; sessionsPerWeek: number; price: number; durationDays: number; isActive: boolean
}

interface Member {
  id: string
  firstName: string; lastName: string; email: string; phone?: string
  membershipPlanId?: string; membershipPlan?: MembershipPlan | null; membershipStatus: string
  startDate: string; endDate?: string
  attendancePct?: number
  checkIns?: { id: string; checkedIn: string; method: string }[]
  payments?: { id: string; amount: number; type: string; status: string; createdAt: string }[]
  freezeWeeks?: number; freezeStartedAt?: string; totalFreezeWeeks?: number
  goals?: string; notes?: string; healthConditions?: string
  emergencyContact?: string; emergencyPhone?: string
}

const STATUS_OPTS = ['ALL', 'ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELED']

function planLabel(plan?: MembershipPlan | null): string {
  if (!plan) return '—'
  const sessions = plan.sessionsPerWeek === 0 ? 'Unlimited' : `${plan.sessionsPerWeek}x/week`
  return `${plan.name} (${sessions})`
}

function calcPreviewEnd(startDate: string, plan?: MembershipPlan | null): string {
  const d = new Date(startDate)
  d.setDate(d.getDate() + (plan?.durationDays || 30))
  return d.toDateString()
}

function DaysLeft({ endDate, status }: { endDate?: string; status: string }) {
  if (!endDate) return <span className="text-dark-500 text-sm">—</span>
  if (status === 'FROZEN') return <span className="text-blue-400 text-sm">Frozen ❄</span>
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
  if (days < 0)   return <span className="text-red-400 text-sm font-semibold">{Math.abs(days)}d overdue</span>
  if (days <= 7)  return <span className="text-orange-400 text-sm font-semibold">{days}d left ⚠</span>
  if (days <= 30) return <span className="text-yellow-400 text-sm">{days}d left</span>
  return <span className="text-dark-300 text-sm">{days}d left</span>
}

function AttendanceBar({ pct }: { pct: number }) {
  const good = pct >= 50
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-bold', good ? 'text-primary-400' : 'text-orange-400')}>{pct}% attendance</span>
        <span className={cn('badge text-xs', good
          ? 'text-primary-400 bg-primary-400/10 border-primary-400/20'
          : 'text-orange-400 bg-orange-400/10 border-orange-400/20')}>
          {good ? '✓ Active attender' : '⚠ Low attendance'}
        </span>
      </div>
      <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', good ? 'bg-primary-400' : 'bg-orange-400')} />
      </div>
      <p className="text-dark-500 text-xs">Expected: 3 visits/week · &gt;50% = active attender</p>
    </div>
  )
}

export default function MembersPage() {
  const [members, setMembers]       = useState<Member[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('ALL')
  const [showAdd, setShowAdd]       = useState(false)
  const [selected, setSelected]     = useState<Member | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [editing, setEditing]       = useState(false)
  const [freezeWeeks, setFreezeWeeks]   = useState(2)
  const [showFreezeModal, setShowFreezeModal] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [editForm, setEditForm]     = useState<Partial<Member>>({})
  const [branches, setBranches]     = useState<{id:string;name:string}[]>([])
  const [plans, setPlans]           = useState<MembershipPlan[]>([])

  useEffect(() => {
    fetch('/api/branches').then(r=>r.json()).then(d=>{
      if(Array.isArray(d.branches)) setBranches(d.branches)
    }).catch(()=>{})
    fetch('/api/membership-plans').then(r=>r.json()).then(d=>{
      if(Array.isArray(d)) {
        setPlans(d)
        const firstActive = d.find((p: MembershipPlan) => p.isActive)
        if (firstActive) setAddForm(f => ({ ...f, membershipPlanId: firstActive.id }))
      }
    }).catch(()=>{})
  }, [])

  const [addForm, setAddForm]       = useState({
    firstName: '', lastName: '', email: '', phone: '',
    membershipPlanId: '',
    startDate: new Date().toISOString().split('T')[0],
    goals: '', notes: '', healthConditions: '',
    emergencyContact: '', emergencyPhone: '', branchId: '',
  })

  // ── load list ──────────────────────────────────────────────────────────
  function loadList() {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (statusFilter !== 'ALL') p.set('status', statusFilter)
    fetch(`/api/members?${p}`)
      .then(r => r.json())
      .then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { loadList() }, [search, statusFilter]) // eslint-disable-line

  // ── open member detail ─────────────────────────────────────────────────
  async function openMember(memberId: string) {
    setPanelLoading(true)
    setEditing(false)
    setEditForm({})
    const res = await fetch(`/api/members?id=${memberId}`)
    if (res.ok) {
      const full: Member = await res.json()
      setSelected(full)
      setEditForm({
        firstName: full.firstName, lastName: full.lastName,
        email: full.email, phone: full.phone || '',
        membershipPlanId: full.membershipPlanId,
        goals: full.goals || '', notes: full.notes || '',
        healthConditions: full.healthConditions || '',
        emergencyContact: full.emergencyContact || '',
        emergencyPhone: full.emergencyPhone || '',
      })
    }
    setPanelLoading(false)
  }

  // ── save edits ─────────────────────────────────────────────────────────
  async function saveEdits() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/members?id=${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Member updated!')
      setEditing(false)
      loadList()
      openMember(selected.id)
    } else {
      const d = await res.json()
      toast.error(d.error || 'Failed to save')
    }
  }

  // ── membership actions (freeze / unfreeze / renew) ─────────────────────
  async function doAction(action: string, extra: Record<string, any> = {}) {
    if (!selected) return
    setActionLoading(true)
    const res = await fetch(`/api/members?id=${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: action, ...extra }),
    })
    const data = await res.json()
    setActionLoading(false)
    if (res.ok) {
      toast.success(data.message || 'Done!')
      setShowFreezeModal(false)
      loadList()
      openMember(selected.id)   // re-fetch fresh data
    } else {
      toast.error(data.error || 'Action failed')
    }
  }

  // ── add member ─────────────────────────────────────────────────────────
  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Member added! Expires: ${formatDate(data.endDate)}`)
      setShowAdd(false)
      setAddForm({ firstName:'', lastName:'', email:'', phone:'', membershipPlanId: plans.find(p=>p.isActive)?.id || '', startDate: new Date().toISOString().split('T')[0], goals:'', notes:'', healthConditions:'', emergencyContact:'', emergencyPhone:'', branchId:'' })
      loadList()
    } else {
      toast.error(data.error || 'Failed to add member')
    }
  }

  // ── delete member ──────────────────────────────────────────────────────
  async function deleteMember() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/members?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('Member deleted')
      setDeleteTarget(null)
      setSelected(null)
      loadList()
    } else {
      toast.error('Failed to delete')
    }
  }

  // ── freeze end-date preview ─────────────────────────────────────────────
  function freezePreviewDate() {
    if (!selected?.endDate) return '—'
    const d = new Date(selected.endDate)
    d.setDate(d.getDate() + freezeWeeks * 7)
    return d.toDateString()
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">MEMBERS</h1>
          <p className="text-dark-300 text-sm mt-1">{members.length} total members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…" className="input pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn('px-4 py-2 rounded-lg text-sm transition-all',
                statusFilter === s
                  ? 'bg-primary-400 text-dark-950 font-bold'
                  : 'bg-dark-800 border border-dark-600 text-dark-300 hover:text-white')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-dark-700">
              <tr>
                {['Member', 'Plan', 'Status', 'Expires', 'Attendance', ''].map(h => (
                  <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-4">
                      <div className="h-6 skeleton rounded-lg" />
                    </td></tr>
                  ))
                : members.length === 0
                ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-dark-400">
                    <Users size={36} className="mx-auto mb-3 opacity-30" />
                    <p>No members found</p>
                  </td></tr>
                )
                : members.map(m => {
                    const pct = m.attendancePct ?? 0
                    const goodAtt = pct >= 50
                    return (
                      <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={() => openMember(m.id)}
                        className="hover:bg-dark-750 transition-colors group cursor-pointer">
                        {/* Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                              {getInitials(`${m.firstName} ${m.lastName}`)}
                            </div>
                            <div>
                              <div className="text-white text-sm font-medium">{m.firstName} {m.lastName}</div>
                              <div className="text-dark-500 text-xs">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* Plan */}
                        <td className="px-5 py-4 text-dark-300 text-sm">{m.membershipPlan?.name || '—'}</td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={cn('badge', membershipColors[m.membershipStatus])}>
                            {m.membershipStatus}
                          </span>
                        </td>
                        {/* Expires */}
                        <td className="px-5 py-4">
                          <DaysLeft endDate={m.endDate} status={m.membershipStatus} />
                        </td>
                        {/* Attendance */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', goodAtt ? 'bg-primary-400' : 'bg-orange-400')}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={cn('text-xs font-mono font-bold', goodAtt ? 'text-primary-400' : 'text-orange-400')}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={e => { e.stopPropagation(); openMember(m.id) }}
                              className="p-1.5 rounded hover:bg-dark-600 text-dark-500 hover:text-white transition-all">
                              <ChevronRight size={15} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(m) }}
                              className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-dark-600 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MEMBER DETAIL SIDE PANEL ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => { setSelected(null); setEditing(false) }} />

            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 300 }}
              className="w-full max-w-lg bg-dark-900 border-l border-dark-700 flex flex-col h-full overflow-hidden">

              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 flex-shrink-0 bg-dark-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-400/10 border border-primary-400/20 flex items-center justify-center font-bold text-primary-400">
                    {getInitials(`${selected.firstName} ${selected.lastName}`)}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{selected.firstName} {selected.lastName}</div>
                    <span className={cn('badge text-xs', membershipColors[selected.membershipStatus])}>
                      {selected.membershipStatus}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!editing ? (
                    <button onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-dark-300 hover:text-white text-xs transition-colors">
                      <Edit3 size={12} /> Edit
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setEditing(false)}
                        className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-dark-300 hover:text-white text-xs transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveEdits} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-400 text-dark-950 font-bold text-xs disabled:opacity-50">
                        <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                  <button onClick={() => { setSelected(null); setEditing(false) }}
                    className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto">
                {panelLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}
                  </div>
                ) : (
                  <div className="p-6 space-y-5">

                    {/* ── Attendance Rate ── */}
                    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity size={15} className="text-primary-400" />
                        <span className="text-white font-semibold text-sm">Attendance Rate</span>
                      </div>
                      <AttendanceBar pct={selected.attendancePct ?? 0} />
                      <div className="mt-3 flex gap-4 text-xs text-dark-400">
                        <span><CheckCircle2 size={11} className="inline text-primary-400 mr-1" />
                          {selected.checkIns?.length ?? 0} total visits
                        </span>
                        {(selected.totalFreezeWeeks ?? 0) > 0 && (
                          <span><Snowflake size={11} className="inline text-blue-400 mr-1" />
                            {selected.totalFreezeWeeks}wk frozen (lifetime)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Membership Info / Edit ── */}
                    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={15} className="text-primary-400" />
                        <span className="text-white font-semibold text-sm">Membership Details</span>
                      </div>

                      {editing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="label text-xs">First Name</label>
                              <input value={editForm.firstName || ''} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className="input py-2 text-sm" />
                            </div>
                            <div><label className="label text-xs">Last Name</label>
                              <input value={editForm.lastName || ''} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className="input py-2 text-sm" />
                            </div>
                          </div>
                          <div><label className="label text-xs">Email</label>
                            <input type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input py-2 text-sm" />
                          </div>
                          <div><label className="label text-xs">Phone</label>
                            <input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input py-2 text-sm" />
                          </div>
                          <div><label className="label text-xs">Membership Plan</label>
                            <select value={editForm.membershipPlanId || ''}
                              onChange={e => setEditForm(f => ({ ...f, membershipPlanId: e.target.value }))} className="input py-2 text-sm">
                              {plans.map(p => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}
                            </select>
                          </div>
                          <div><label className="label text-xs">Goals</label>
                            <textarea value={editForm.goals || ''} onChange={e => setEditForm(f => ({ ...f, goals: e.target.value }))} className="input py-2 text-sm h-14 resize-none" />
                          </div>
                          <div><label className="label text-xs">Health Conditions</label>
                            <input value={editForm.healthConditions || ''} onChange={e => setEditForm(f => ({ ...f, healthConditions: e.target.value }))} className="input py-2 text-sm" />
                          </div>
                          <div><label className="label text-xs">Notes</label>
                            <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="input py-2 text-sm h-14 resize-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="label text-xs">Emergency Contact</label>
                              <input value={editForm.emergencyContact || ''} onChange={e => setEditForm(f => ({ ...f, emergencyContact: e.target.value }))} className="input py-2 text-sm" />
                            </div>
                            <div><label className="label text-xs">Emergency Phone</label>
                              <input value={editForm.emergencyPhone || ''} onChange={e => setEditForm(f => ({ ...f, emergencyPhone: e.target.value }))} className="input py-2 text-sm" />
                            </div>
                          </div>
                          {branches.length > 0 && (
                            <div><label className="label text-xs">Branch</label>
                              <select value={(editForm as any).branchId || ''} onChange={e=>setEditForm(f=>({...f, branchId:e.target.value}))} className="input py-2 text-sm">
                                <option value="">No branch</option>
                                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-sm">
                          {[
                            ['Plan',     planLabel(selected.membershipPlan)],
                            ['Start',    formatDate(selected.startDate)],
                            ['Expires',  selected.endDate ? formatDate(selected.endDate) : '—'],
                            ['Time left', <DaysLeft key="dl" endDate={selected.endDate} status={selected.membershipStatus} />],
                            ['Email',    selected.email],
                            ['Phone',    selected.phone || '—'],
                            ...(selected.goals            ? [['Goals',     selected.goals]] : []),
                            ...(selected.healthConditions ? [['Health',    selected.healthConditions]] : []),
                            ...(selected.notes            ? [['Notes',     selected.notes]] : []),
                            ...(selected.emergencyContact ? [['Emergency', `${selected.emergencyContact}  ${selected.emergencyPhone || ''}`]] : []),
                          ].map(([label, value]) => (
                            <div key={String(label)} className="flex items-start gap-2">
                              <span className="text-dark-500 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
                              <span className="text-dark-200 flex-1">{value as any}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Membership Actions ── */}
                    {!editing && (
                      <div className="space-y-3">
                        <p className="text-dark-500 text-xs uppercase tracking-widest font-mono">Membership Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Freeze / Unfreeze */}
                          {selected.membershipStatus === 'FROZEN' ? (
                            <button
                              onClick={() => doAction('unfreeze')}
                              disabled={actionLoading}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 transition-colors disabled:opacity-50 text-sm font-semibold">
                              <Flame size={16} /> Unfreeze
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowFreezeModal(true)}
                              disabled={actionLoading || ['CANCELED','EXPIRED'].includes(selected.membershipStatus)}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-400/10 border border-blue-400/20 text-blue-400 hover:bg-blue-400/20 transition-colors disabled:opacity-50 text-sm font-semibold">
                              <Snowflake size={16} /> Freeze
                            </button>
                          )}
                          {/* Renew */}
                          <button onClick={() => doAction('renew')} disabled={actionLoading}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 transition-colors disabled:opacity-50 text-sm font-semibold">
                            <RefreshCw size={16} /> Renew
                          </button>
                          {/* Cancel subscription */}
                          {selected.membershipStatus !== 'CANCELED' && (
                            <button onClick={() => { if(window.confirm('Cancel subscription? Member will lose access immediately.')) doAction('cancel') }}
                              disabled={actionLoading}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 transition-colors text-sm font-semibold">
                              <XCircle size={16} /> Cancel Sub
                            </button>
                          )}
                          {/* Delete */}
                          <button onClick={() => setDeleteTarget(selected)}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-semibold">
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>

                        {/* Active freeze info */}
                        {selected.membershipStatus === 'FROZEN' && selected.freezeStartedAt && (
                          <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-3 text-xs text-blue-300 flex items-start gap-2">
                            <Snowflake size={13} className="flex-shrink-0 mt-0.5" />
                            <div>Frozen since <strong>{formatDate(selected.freezeStartedAt)}</strong>. Time is paused — <strong>{selected.totalFreezeWeeks || 0} days</strong> will be restored from today on unfreeze.</div>
                          </div>
                        )}
                        {selected.membershipStatus === 'CANCELED' && (
                          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-300 flex items-start gap-2">
                            <XCircle size={13} className="flex-shrink-0 mt-0.5" />
                            <div>Subscription canceled. Click <strong>Renew</strong> to reactivate.</div>
                          </div>
                        )}
                        {selected.membershipStatus === 'EXPIRED' && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2">
                            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                            <div>Subscription expired{selected.endDate ? ` on ${formatDate(selected.endDate)}` : ''}. Click <strong>Renew</strong> to extend.</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Recent Check-ins ── */}
                    {!editing && (selected.checkIns?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-dark-500 text-xs uppercase tracking-widest mb-2 font-mono">Recent Visits</p>
                        <div className="space-y-1.5">
                          {selected.checkIns!.slice(0, 8).map(c => (
                            <div key={c.id} className="flex items-center gap-2 text-xs bg-dark-800 rounded-lg px-3 py-2">
                              <CheckCircle2 size={11} className="text-primary-400 flex-shrink-0" />
                              <span className="text-dark-300">
                                {new Date(c.checkedIn).toLocaleString([], {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                              <span className="ml-auto text-dark-600">{c.method}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Payment History ── */}
                    {!editing && (selected.payments?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-dark-500 text-xs uppercase tracking-widest mb-2 font-mono">Payments</p>
                        <div className="space-y-1.5">
                          {selected.payments!.slice(0, 5).map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-dark-800 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-white font-semibold">{formatCurrency(p.amount)}</span>
                                <span className="text-dark-500 ml-2">{p.type}</span>
                              </div>
                              <span className={cn('badge text-xs',
                                p.status === 'COMPLETED'
                                  ? 'text-primary-400 bg-primary-400/10 border-primary-400/20'
                                  : 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20')}>
                                {p.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ FREEZE MODAL ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFreezeModal && selected && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-dark-800 border border-blue-400/30 rounded-2xl p-8 w-full max-w-sm">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-400/10 border border-blue-400/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Snowflake size={26} className="text-blue-400" />
                </div>
                <h3 className="font-display text-2xl text-white">FREEZE MEMBERSHIP</h3>
                <p className="text-dark-400 text-sm mt-1">{selected.firstName} {selected.lastName}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="label text-center block">Number of weeks to freeze</label>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <button onClick={() => setFreezeWeeks(w => Math.max(1, w - 1))}
                      className="w-11 h-11 rounded-xl bg-dark-700 border border-dark-600 flex items-center justify-center text-white hover:bg-dark-600 transition-colors">
                      <Minus size={18} />
                    </button>
                    <div className="text-center w-16">
                      <div className="font-display text-5xl text-blue-400">{freezeWeeks}</div>
                      <div className="text-dark-500 text-xs">week{freezeWeeks !== 1 ? 's' : ''}</div>
                    </div>
                    <button onClick={() => setFreezeWeeks(w => Math.min(52, w + 1))}
                      className="w-11 h-11 rounded-xl bg-dark-700 border border-dark-600 flex items-center justify-center text-white hover:bg-dark-600 transition-colors">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Before / after */}
                <div className="bg-dark-700 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark-400">Current expiry</span>
                    <span className="text-white">{selected.endDate ? formatDate(selected.endDate) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-400">New expiry after unfreeze</span>
                    <span className="text-blue-300 font-semibold">{freezePreviewDate()}</span>
                  </div>
                  <div className="flex justify-between border-t border-dark-600 pt-2">
                    <span className="text-dark-400">Extension added</span>
                    <span className="text-blue-400 font-semibold">+{freezeWeeks * 7} days</span>
                  </div>
                </div>

                <p className="text-dark-500 text-xs text-center">
                  The end date will be extended automatically when you unfreeze.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setShowFreezeModal(false)}
                    className="btn-ghost flex-1 justify-center">
                    Cancel
                  </button>
                  <button
                    onClick={() => doAction('freeze', { weeks: freezeWeeks })}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm">
                    <Snowflake size={15} />
                    {actionLoading ? 'Freezing…' : `Freeze ${freezeWeeks} wk`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ ADD MEMBER MODAL ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD MEMBER</h2>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={addMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">First Name</label>
                    <input value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} required className="input" />
                  </div>
                  <div><label className="label">Last Name</label>
                    <input value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} required className="input" />
                  </div>
                </div>
                <div><label className="label">Email</label>
                  <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required className="input" />
                </div>
                <div><label className="label">Phone (optional)</label>
                  <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Membership Plan</label>
                    <select value={addForm.membershipPlanId} onChange={e => setAddForm(f => ({ ...f, membershipPlanId: e.target.value }))} required className="input">
                      <option value="">Select a plan...</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Start Date</label>
                    <input type="date" value={addForm.startDate} onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
                  </div>
                </div>
                {plans.length === 0 && (
                  <p className="text-xs text-yellow-400/80">No membership plans yet — create one first in Settings → Membership Plans.</p>
                )}

                {/* Auto end date preview */}
                {addForm.membershipPlanId && (
                  <div className="bg-primary-400/5 border border-primary-400/20 rounded-xl p-3 flex items-center gap-3">
                    <Calendar size={15} className="text-primary-400 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="text-dark-400">Expires </span>
                      <span className="text-primary-400 font-bold">
                        {calcPreviewEnd(addForm.startDate, plans.find(p => p.id === addForm.membershipPlanId))}
                      </span>
                    </div>
                  </div>
                )}

                <div><label className="label">Goals (optional)</label>
                  <input value={addForm.goals} onChange={e => setAddForm(f => ({ ...f, goals: e.target.value }))} className="input" placeholder="e.g. Lose weight, build muscle" />
                </div>
                <div><label className="label">Health Conditions (optional)</label>
                  <input value={addForm.healthConditions} onChange={e => setAddForm(f => ({ ...f, healthConditions: e.target.value }))} className="input" placeholder="e.g. Knee injury, hypertension" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Emergency Contact</label>
                    <input value={addForm.emergencyContact} onChange={e => setAddForm(f => ({ ...f, emergencyContact: e.target.value }))} className="input" />
                  </div>
                  <div><label className="label">Emergency Phone</label>
                    <input value={addForm.emergencyPhone} onChange={e => setAddForm(f => ({ ...f, emergencyPhone: e.target.value }))} className="input" />
                  </div>
                </div>
                {branches.length > 0 && (
                  <div><label className="label">Assign to Branch (optional)</label>
                    <select value={addForm.branchId} onChange={e=>setAddForm(f=>({...f,branchId:e.target.value}))} className="input">
                      <option value="">No branch assigned</option>
                      {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Member</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ DELETE CONFIRM ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-dark-800 border border-red-500/30 rounded-2xl p-8 w-full max-w-sm text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <h3 className="font-display text-2xl text-white mb-2">DELETE MEMBER</h3>
              <p className="text-white font-semibold mb-1">{deleteTarget.firstName} {deleteTarget.lastName}</p>
              <p className="text-red-400/80 text-xs mb-6">
                All check-ins, class bookings, and payment records will be permanently deleted. Cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={deleteMember} disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm">
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
