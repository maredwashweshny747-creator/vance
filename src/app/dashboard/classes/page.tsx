'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Plus, Clock, Users, Swords, Trash2, X, AlertTriangle, Check, Ban, Hourglass, User as UserIcon, Pencil, ClipboardList, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, cn, DAYS_OF_WEEK, DAY_LABELS } from '@/lib/utils'
import { DISCIPLINE_CATEGORIES, DISCIPLINE_SHORT } from '@/lib/categories'
import toast from 'react-hot-toast'

const COLORS = ['#ffc700', '#e0161c', '#ffda47', '#8f0e12', '#71717a', '#ffffff']
const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
  PENDING:  'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  REJECTED: 'text-crimson-400 bg-crimson-400/10 border-crimson-400/20',
}

interface Coach { id: string; firstName: string; lastName: string; specialties?: string | null }

const BLANK_FORM = {
  name: '', description: '', category: 'MMA_ADULTS', type: 'GROUP', daysOfWeek: [] as string[],
  isOneTime: false, sessionDate: new Date().toISOString().split('T')[0],
  startTimeOfDay: '18:00', duration: 60, capacity: 20, price: 59, durationDays: 30, color: '#ffc700', coachId: '',
  offers: [] as { months: number; sessions: number; price: number; label: string }[],
}

export default function ClassesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'ADMIN'
  const isAdmin = role === 'ADMIN'
  const isCoach = role === 'COACH'

  const [classes, setClasses] = useState<any[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [form, setForm] = useState(BLANK_FORM)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')       // ALL | ACTIVE | INACTIVE
  const [typeFilter, setTypeFilter] = useState('ALL')           // ALL | GROUP | PRIVATE
  const [coachFilter, setCoachFilter] = useState('ALL')
  const [dayFilter, setDayFilter] = useState('ALL')

  const filteredClasses = classes.filter((cls: any) => {
    if (search) {
      const q = search.toLowerCase()
      const matches = cls.name?.toLowerCase().includes(q)
        || (cls.coach && `${cls.coach.firstName} ${cls.coach.lastName}`.toLowerCase().includes(q))
        || cls.type?.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (statusFilter === 'ACTIVE' && cls.status !== 'APPROVED') return false
    if (statusFilter === 'INACTIVE' && cls.status === 'APPROVED') return false
    if (typeFilter !== 'ALL' && cls.type !== typeFilter) return false
    if (coachFilter !== 'ALL' && cls.coachId !== coachFilter) return false
    if (dayFilter !== 'ALL' && !(cls.daysOfWeek || []).includes(dayFilter)) return false
    return true
  })

  function load() {
    setLoading(true)
    fetch('/api/classes').then(r => r.ok ? r.json() : []).then(d => { setClasses(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }
  function loadCoaches() {
    fetch('/api/coaches').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCoaches(d) }).catch(() => {})
  }

  useEffect(() => { load(); loadCoaches() }, [])

  function openAdd() { setEditTarget(null); setForm(BLANK_FORM); setShowForm(true) }

  function openEdit(cls: any) {
    setEditTarget(cls)
    setForm({
      name: cls.name, description: cls.description || '', category: cls.category || 'MMA_ADULTS',
      type: cls.type, daysOfWeek: cls.daysOfWeek || [],
      isOneTime: !!cls.isOneTime, sessionDate: cls.sessionDate ? cls.sessionDate.split('T')[0] : new Date().toISOString().split('T')[0],
      startTimeOfDay: cls.startTimeOfDay || '18:00',
      duration: cls.duration, capacity: cls.capacity, price: cls.price, durationDays: cls.durationDays,
      color: cls.color || '#ffc700', coachId: cls.coachId || '',
      offers: (cls.offers || []).map((o: any) => ({ months: o.months || 0, sessions: o.sessions || 0, price: o.price, label: o.label || '' })),
    })
    setShowForm(true)
  }

  function toggleDay(day: string) {
    setForm(f => ({ ...f, daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter(d => d !== day) : [...f.daysOfWeek, day] }))
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault()
    if (form.type === 'PRIVATE') {
      if (!form.coachId) { toast.error('Pick a coach for the private session'); return }
    } else if (!form.isOneTime && form.daysOfWeek.length === 0) { toast.error('Pick at least one day of the week'); return }
    else if (form.isOneTime && !form.sessionDate) { toast.error('Pick a date for the session'); return }
    if (editTarget) {
      const res = await fetch(`/api/classes?id=${editTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(data.revertedToPending ? 'Saved — sent back for admin re-approval since it was already live' : 'Class updated')
        setShowForm(false); load()
      } else toast.error(data.error || 'Failed to save changes')
    } else {
      const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) {
        toast.success(isCoach ? 'Submitted — waiting on admin approval' : 'Class added!')
        setShowForm(false); load()
      } else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to add class') }
    }
  }

  async function deleteClass() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/classes?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { toast.success(`"${deleteTarget.name}" deleted`); setDeleteTarget(null); setShowForm(false); load() }
    else toast.error('Failed to delete class')
  }

  async function approveClass(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const res = await fetch(`/api/classes?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _action: 'approve' }) })
    if (res.ok) { toast.success('Class approved — now live'); load() } else toast.error('Failed to approve')
  }

  async function rejectClass() {
    if (!rejectTarget) return
    const res = await fetch(`/api/classes?id=${rejectTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _action: 'reject', rejectionNote }) })
    if (res.ok) { toast.success('Class rejected'); setRejectTarget(null); setRejectionNote(''); load() } else toast.error('Failed to reject')
  }

  const pendingCount = classes.filter(c => c.status === 'PENDING').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">CLASSES</h1>
          <p className="text-dark-300 text-sm mt-1">
            {isCoach ? 'Your classes and private sessions' : `${classes.length} classes`}
            {isAdmin && pendingCount > 0 && <span className="text-yellow-400"> · {pendingCount} awaiting approval</span>}
            <span className="text-dark-500"> · click a class to edit</span>
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16}/> {isCoach ? 'Submit Class' : 'Add Class'}</button>
      </div>

      {/* Search & filters — all client-side against the already-loaded list, no extra requests */}
      <div className="card flex flex-col md:flex-row gap-3 md:items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="label text-xs">Search — class name, coach, or type</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kickboxing, Ahmed, Private…" className="input" />
        </div>
        <div>
          <label className="label text-xs">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto">
            <option value="ALL">All</option>
            <option value="GROUP">Public Class</option>
            <option value="PRIVATE">Private Session</option>
          </select>
        </div>
        {!isCoach && (
          <div>
            <label className="label text-xs">Coach</label>
            <select value={coachFilter} onChange={e => setCoachFilter(e.target.value)} className="input w-auto">
              <option value="ALL">All coaches</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label text-xs">Day</label>
          <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} className="input w-auto">
            <option value="ALL">Any day</option>
            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_,i) => <div key={i} className="h-56 skeleton rounded-2xl"/>)}</div>
      ) : filteredClasses.length === 0 ? (
        <div className="card text-center py-16"><Calendar size={48} className="mx-auto text-dark-600 mb-4"/><p className="text-dark-400">{classes.length === 0 ? 'No classes yet — add your first one' : 'No classes match your search/filters'}</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls: any, i: number) => (
            <motion.div key={cls.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card-hover group relative" style={{ borderLeftColor: cls.color || '#ffc700', borderLeftWidth: 3 }}>
              <div onClick={() => openEdit(cls)} className="cursor-pointer">
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <span className="p-1.5 rounded-lg text-dark-500"><Pencil size={13}/></span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(cls) }}
                    className="p-1.5 rounded-lg hover:bg-crimson-500/10 hover:text-crimson-400 text-dark-600 transition-all"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cls.color}20` }}>
                    <Swords size={16} style={{ color: cls.color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-dark-400 bg-dark-700 px-2 py-1 rounded-full">{DISCIPLINE_SHORT[cls.category] || cls.category || 'General'}</span>
                    <span className="text-xs bg-dark-700 px-2 py-1 rounded-full text-dark-300">{cls.type === 'PRIVATE' ? 'Private' : 'Group'}</span>
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-1">{cls.name}</h3>
                <p className="text-dark-400 text-xs mb-3 line-clamp-2">{cls.description || 'No description'}</p>
                {cls.coach && <p className="text-xs text-primary-400/80 mb-2 flex items-center gap-1"><UserIcon size={11}/> Coach {cls.coach.firstName} {cls.coach.lastName}</p>}
                <div className="flex flex-wrap gap-1 mb-2">
                  {cls.isOneTime ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-300 border border-blue-400/20 font-mono">
                      ONE SESSION · {cls.sessionDate ? new Date(cls.sessionDate).toLocaleDateString() : '—'}
                    </span>
                  ) : (cls.daysOfWeek || []).map((d: string) => (
                    <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-dark-300 font-mono">{DAY_LABELS[d] || d}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-dark-300 flex-wrap">
                  <span className="flex items-center gap-1"><Clock size={12}/> {cls.startTimeOfDay} · {cls.duration}min</span>
                  <span className="flex items-center gap-1"><Users size={12}/> {cls._count?.enrollments ?? 0}/{cls.capacity}</span>
                  <span className="flex items-center gap-1 text-primary-400"><DollarSign size={12}/> {cls.type === 'PRIVATE' ? `${formatCurrency(cls.price)}/session` : `${formatCurrency(cls.price)}/${cls.durationDays}d`}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-dark-400 flex items-center gap-1"><TrendingUp size={12} className="text-primary-400"/> Total Revenue: <span className="text-primary-400 font-semibold">{formatCurrency(cls.totalRevenue || 0)}</span></span>
                  <span className={cn('badge text-xs', STATUS_COLORS[cls.status] || '')}>{cls.status}</span>
                </div>
                {cls.offers?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cls.offers.map((o: any) => (
                      <span key={o.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary-400/10 text-primary-400 border border-primary-400/20 font-mono">{o.months ? `${o.months}mo` : `${o.sessions} sessions`} · {formatCurrency(o.price)}</span>
                    ))}
                  </div>
                )}
                {cls.status === 'REJECTED' && cls.rejectionNote && (
                  <p className="mt-2 text-xs text-crimson-300 bg-crimson-500/5 border border-crimson-500/20 rounded-lg px-2 py-1.5">{cls.rejectionNote}</p>
                )}
              </div>

              {cls.status === 'APPROVED' && (
                <Link href={`/dashboard/classes/${cls.id}/attendance`} onClick={e => e.stopPropagation()}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-200 hover:bg-dark-600 hover:border-primary-400/30 text-xs font-semibold transition-colors">
                  <ClipboardList size={13}/> Manage Attendance
                </Link>
              )}
              {isAdmin && cls.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={(e) => approveClass(cls.id, e)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 text-xs font-semibold transition-colors">
                    <Check size={13}/> Approve
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setRejectTarget(cls) }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 hover:bg-crimson-500/20 text-xs font-semibold transition-colors">
                    <Ban size={13}/> Reject
                  </button>
                </div>
              )}
              {isCoach && cls.status === 'PENDING' && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-400/80">
                  <Hourglass size={12}/> Waiting on admin approval
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">{editTarget ? 'EDIT CLASS' : (isCoach ? 'SUBMIT CLASS' : 'ADD CLASS')}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"><X size={18}/></button>
              </div>
              {isCoach && !editTarget && (
                <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 text-xs text-yellow-300 mb-4 flex items-start gap-2">
                  <Hourglass size={13} className="flex-shrink-0 mt-0.5"/>
                  <div>Classes and private sessions you submit go live once an admin approves them.</div>
                </div>
              )}
              {isCoach && editTarget && editTarget.status === 'APPROVED' && (
                <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 text-xs text-yellow-300 mb-4 flex items-start gap-2">
                  <Hourglass size={13} className="flex-shrink-0 mt-0.5"/>
                  <div>This class is already live — saving changes will send it back for admin re-approval.</div>
                </div>
              )}
              <form onSubmit={saveClass} className="space-y-4">
                <div><label className="label">Class Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="e.g. Kickboxing Adults"/></div>
                <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="input h-20 resize-none" placeholder="What fighters can expect..."/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Discipline</label>
                    <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="input">
                      {DISCIPLINE_CATEGORIES.map(c => <option key={c} value={c}>{DISCIPLINE_SHORT[c]}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Format</label>
                    <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="input">
                      <option value="GROUP">Group Class</option>
                      <option value="PRIVATE">Private Session</option>
                    </select>
                  </div>
                </div>

                {form.type === 'PRIVATE' ? (
                  <p className="text-dark-500 text-xs -mt-2">Private sessions are sold as a bundle of sessions (Coach + Price Per Session) instead of a weekly schedule — the fighter picks how many sessions to buy when they enroll.</p>
                ) : (
                <div>
                  <label className="label">Schedule</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button type="button" onClick={() => setForm(f => ({ ...f, isOneTime: false }))}
                      className={cn('py-2 rounded-lg text-sm font-medium border transition-all', !form.isOneTime ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-400')}>
                      Recurring Weekly
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, isOneTime: true }))}
                      className={cn('py-2 rounded-lg text-sm font-medium border transition-all', form.isOneTime ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-400')}>
                      One Session
                    </button>
                  </div>

                  {form.isOneTime ? (
                    <div>
                      <label className="label">Session Date</label>
                      <input type="date" value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} required className="input" />
                      <p className="text-dark-500 text-xs mt-1.5">A single one-off session — no weekly day selection needed.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="label text-xs">Days of the Week — this defines the weekly session count</label>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {DAYS_OF_WEEK.map(d => (
                          <button key={d} type="button" onClick={() => toggleDay(d)}
                            className={cn('w-11 h-9 rounded-lg text-xs font-semibold border transition-all',
                              form.daysOfWeek.includes(d) ? 'bg-primary-400 border-primary-400 text-dark-950' : 'border-dark-600 text-dark-300 hover:border-dark-500')}>
                            {DAY_LABELS[d]}
                          </button>
                        ))}
                      </div>
                      {form.daysOfWeek.length > 0 && <p className="text-primary-400 text-xs mt-1.5">{form.daysOfWeek.length} sessions / week</p>}
                    </div>
                  )}
                </div>
                )}

                {form.type !== 'PRIVATE' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Start Time</label><input type="time" value={form.startTimeOfDay} onChange={e => setForm(f=>({...f,startTimeOfDay:e.target.value}))} className="input"/></div>
                    <div><label className="label">Duration (min)</label><input type="number" value={form.duration} onChange={e => setForm(f=>({...f,duration:+e.target.value}))} min={15} max={180} className="input"/></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {form.type !== 'PRIVATE' && (
                    <div><label className="label">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm(f=>({...f,capacity:+e.target.value}))} min={1} className="input"/></div>
                  )}
                  <div className={form.type === 'PRIVATE' ? 'col-span-2' : ''}>
                    <label className="label">{form.type === 'PRIVATE' ? 'Price Per Session' : 'Price / cycle'}</label>
                    <input type="number" value={form.price} onChange={e => setForm(f=>({...f,price:+e.target.value}))} min={0} step={0.01} className="input"/>
                  </div>
                </div>
                {!form.isOneTime && form.type !== 'PRIVATE' && (
                  <div><label className="label">Billing cycle length (days)</label><input type="number" value={form.durationDays} onChange={e => setForm(f=>({...f,durationDays:+e.target.value}))} min={1} className="input"/></div>
                )}

                {isAdmin && (form.type === 'PRIVATE' || !form.isOneTime) && (
                  <div>
                    <label className="label">Promotional Offers ({form.type === 'PRIVATE' ? 'session packages' : 'multi-month packages'})</label>
                    <div className="space-y-2">
                      {form.offers.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {form.type === 'PRIVATE' ? (
                            <>
                              <input type="number" min={1} value={o.sessions} placeholder="Sessions"
                                onChange={e => setForm(f => ({ ...f, offers: f.offers.map((x,j) => j===i ? {...x, sessions:+e.target.value} : x) }))}
                                className="input w-24" />
                              <span className="text-dark-500 text-xs">sessions</span>
                            </>
                          ) : (
                            <>
                              <input type="number" min={1} value={o.months} placeholder="Months"
                                onChange={e => setForm(f => ({ ...f, offers: f.offers.map((x,j) => j===i ? {...x, months:+e.target.value} : x) }))}
                                className="input w-20" />
                              <span className="text-dark-500 text-xs">mo</span>
                            </>
                          )}
                          <input type="number" min={0} step={0.01} value={o.price} placeholder="Price"
                            onChange={e => setForm(f => ({ ...f, offers: f.offers.map((x,j) => j===i ? {...x, price:+e.target.value} : x) }))}
                            className="input flex-1" />
                          <input value={o.label} placeholder="Label (optional)"
                            onChange={e => setForm(f => ({ ...f, offers: f.offers.map((x,j) => j===i ? {...x, label:e.target.value} : x) }))}
                            className="input flex-1" />
                          <button type="button" onClick={() => setForm(f => ({ ...f, offers: f.offers.filter((_,j) => j!==i) }))}
                            className="p-2 rounded-lg text-dark-500 hover:text-crimson-400"><Trash2 size={14}/></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setForm(f => ({ ...f, offers: [...f.offers, form.type === 'PRIVATE' ? { months: 0, sessions: 10, price: form.price*10, label: '' } : { months: 3, sessions: 0, price: form.price*3, label: '' }] }))}
                        className="text-primary-400 text-xs font-semibold hover:text-primary-300">+ Add offer</button>
                    </div>
                  </div>
                )}

                {!isCoach && (
                  <div><label className="label">{form.type === 'PRIVATE' ? 'Coach Name' : 'Coach (optional)'}</label>
                    <select value={form.coachId} onChange={e => setForm(f=>({...f,coachId:e.target.value}))} required={form.type === 'PRIVATE'} className="input">
                      <option value="">Unassigned</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                    </select>
                  </div>
                )}
                <div><label className="label">Color</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setForm(f=>({...f,color:c}))}
                        className="w-7 h-7 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: form.color === c ? 'white' : 'transparent' }}/>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  {editTarget && (
                    <button type="button" onClick={() => { setShowForm(false); setDeleteTarget(editTarget) }}
                      className="px-4 py-3 rounded-lg border border-crimson-500/30 text-crimson-400 hover:bg-crimson-500/10 text-sm transition-colors">
                      <Trash2 size={15}/>
                    </button>
                  )}
                  <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">{editTarget ? 'Save Changes' : (isCoach ? 'Submit for Approval' : 'Add Class')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-crimson-500/30 rounded-2xl p-8 w-full max-w-sm">
              <h3 className="font-display text-2xl text-white mb-2">REJECT CLASS</h3>
              <p className="text-dark-400 text-sm mb-4">&quot;{rejectTarget.name}&quot; — let the coach know why (optional).</p>
              <textarea value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} className="input h-20 resize-none mb-4" placeholder="e.g. Time slot conflicts with an existing class"/>
              <div className="flex gap-3">
                <button onClick={() => { setRejectTarget(null); setRejectionNote('') }} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={rejectClass} className="flex-1 bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm">Reject</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-crimson-500/30 rounded-2xl p-8 w-full max-w-sm text-center">
              <div className="w-14 h-14 rounded-full bg-crimson-500/10 border border-crimson-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-crimson-400"/>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">DELETE CLASS</h3>
              <p className="text-white font-semibold mb-1">&quot;{deleteTarget.name}&quot;</p>
              <p className="text-dark-400 text-sm mb-6">This removes the class, all enrollments, and attendance history. Cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={deleteClass} disabled={deleting}
                  className="flex-1 bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 text-sm">
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
