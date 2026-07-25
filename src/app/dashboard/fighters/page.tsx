'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, X, Trash2, Snowflake, RefreshCw, Ban, Camera,
  MessageCircle, QrCode, AlertTriangle, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, User as UserIcon,
} from 'lucide-react'
import { cn, formatDate, formatCurrency, membershipColors, getInitials, whatsappLink, DAY_LABELS } from '@/lib/utils'
import { disciplineLabel } from '@/lib/categories'
import toast from 'react-hot-toast'

interface ClassInfo { id: string; name: string; category?: string | null; daysOfWeek: string[]; price: number; durationDays: number; status: string }
interface MonthSummary { attended: number; excused: number; absent: number }
interface Enrollment {
  id: string; classId: string; class: ClassInfo; status: string
  startDate: string; endDate?: string
  totalFreezeDaysLeft?: number
  addedByIdName?: string | null
  lastAction?: string; lastActionByIdName?: string | null; lastActionAt?: string
  monthSummary?: MonthSummary
}
interface Member {
  id: string; firstName: string; lastName: string; email: string; phone?: string; photo?: string | null
  branchId?: string
  goals?: string; notes?: string; healthConditions?: string
  emergencyContact?: string; emergencyPhone?: string
  createdByIdName?: string | null; createdAt: string
  enrollments: Enrollment[]
  overallStatus?: string
  recentAttendance?: { id: string; date: string; status: string; class: { name: string } }[]
  payments?: { id: string; amount: number; type: string; status: string; createdAt: string }[]
}

const STATUS_OPTS = ['ALL', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELED', 'NO_PLAN']

function resizeImage(file: File, maxSize = 400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height) { if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize } }
        else { if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize } }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas unavailable'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('image load failed'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

function Avatar({ photo, name, size = 40 }: { photo?: string | null; name: string; size?: number }) {
  if (photo) return <img src={photo} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <div className="rounded-full bg-primary-400/20 border border-primary-400/30 flex items-center justify-center text-primary-400 font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {getInitials(name)}
    </div>
  )
}

function PhotoPicker({ photo, name, onChange }: { photo?: string | null; name: string; onChange: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { onChange(await resizeImage(file)) } catch { toast.error('Could not process that image') } finally { setUploading(false) }
  }
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar photo={photo} name={name || '?'} size={64} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary-400 text-dark-950 flex items-center justify-center border-2 border-dark-800">
          <Camera size={12} />
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <div className="text-xs text-dark-400">
        {uploading ? 'Processing…' : <>Photo <span className="text-dark-500">(optional)</span><br/>Click the camera to upload</>}
      </div>
    </div>
  )
}

function DaySchedule({ days }: { days: string[] }) {
  return <span className="text-dark-500">{days.map(d => DAY_LABELS[d] || d).join('/')}</span>
}

export default function FightersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddClass, setShowAddClass] = useState(false)
  const [renewTarget, setRenewTarget] = useState<Enrollment | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [qrOpenFor, setQrOpenFor] = useState<string | null>(null)
  const { data: session } = useSession()

  const [addForm, setAddForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', photo: '',
    classId: '', startDate: new Date().toISOString().split('T')[0],
    goals: '', notes: '', healthConditions: '', emergencyContact: '', emergencyPhone: '', branchId: '',
  })
  const [addClassForm, setAddClassForm] = useState({ classId: '', startDate: new Date().toISOString().split('T')[0] })

  function loadList() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (search) params.set('search', search)
    fetch(`/api/members?${params}`).then(r => r.ok ? r.json() : []).then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t) }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/branches').then(r => r.json()).then(d => { if (Array.isArray(d.branches)) setBranches(d.branches) }).catch(() => {})
    fetch('/api/classes').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        const approved = d.filter((c: any) => c.status === 'APPROVED')
        setClasses(approved)
        if (approved[0]) { setAddForm(f => ({ ...f, classId: approved[0].id })); setAddClassForm(f => ({ ...f, classId: approved[0].id })) }
      }
    }).catch(() => {})
  }, [])

  async function openMember(id: string) {
    const res = await fetch(`/api/members?id=${id}`)
    if (res.ok) setSelected(await res.json())
  }
  function refreshSelected() { if (selected) openMember(selected.id) }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.classId) { toast.error('Choose a starting class'); return }
    const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) })
    if (res.ok) {
      toast.success('Fighter added!')
      setShowAdd(false)
      setAddForm(f => ({ ...f, firstName: '', lastName: '', email: '', phone: '', photo: '', goals: '', notes: '', healthConditions: '', emergencyContact: '', emergencyPhone: '', branchId: '' }))
      loadList()
    } else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to add fighter') }
  }

  async function addClassToMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const res = await fetch('/api/class-enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: selected.id, ...addClassForm }) })
    if (res.ok) { toast.success('Signed into class!'); setShowAddClass(false); refreshSelected(); loadList() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to sign into class') }
  }

  async function enrollmentAction(enrollmentId: string, action: string, label: string) {
    const res = await fetch(`/api/class-enrollments?id=${enrollmentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _action: action }) })
    const data = await res.json().catch(() => ({}))
    if (res.ok) { toast.success(data.message || label); refreshSelected(); loadList() }
    else toast.error(data.error || `Failed to ${action}`)
  }

  async function confirmRenew() {
    if (!renewTarget) return
    setRenewing(true)
    const res = await fetch(`/api/class-enrollments?id=${renewTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _action: 'renew' }) })
    const data = await res.json().catch(() => ({}))
    setRenewing(false)
    if (res.ok) { toast.success(data.message || 'Renewed'); setRenewTarget(null); refreshSelected(); loadList() }
    else toast.error(data.error || 'Failed to renew')
  }

  async function removeEnrollment(enrollmentId: string) {
    if (!window.confirm('Remove this enrollment? This cannot be undone.')) return
    const res = await fetch(`/api/class-enrollments?id=${enrollmentId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Enrollment removed'); refreshSelected(); loadList() } else toast.error('Failed to remove')
  }

  async function deleteMember() {
    if (!deleteTarget) return
    const res = await fetch(`/api/members?id=${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(`${deleteTarget.firstName} removed`); setDeleteTarget(null); setSelected(null); loadList() }
    else toast.error('Failed to delete')
  }

  const combinedSessionsPerWeek = (m: Member) => m.enrollments?.filter(e => e.status === 'ACTIVE').reduce((s, e) => s + (e.class?.daysOfWeek?.length || 0), 0) ?? 0
  const currentUserName = session?.user?.name || 'you'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">FIGHTERS</h1>
          <p className="text-dark-300 text-sm mt-1">{members.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16}/> Add Fighter</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fighters..." className="input pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s === 'NO_PLAN' ? 'No Class' : s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-dark-700">
              <tr>
                {['Fighter', 'Classes', 'Status', 'Sessions/wk', ''].map(h => (
                  <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading ? [...Array(6)].map((_, i) => <tr key={i}><td colSpan={5}><div className="h-14 skeleton m-3 rounded-lg" /></td></tr>)
              : members.length === 0 ? <tr><td colSpan={5} className="px-5 py-16 text-center text-dark-400">No fighters found</td></tr>
              : members.map(m => (
                <tr key={m.id} onClick={() => openMember(m.id)} className="hover:bg-dark-750 cursor-pointer transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar photo={m.photo} name={`${m.firstName} ${m.lastName}`} size={36} />
                      <div>
                        <div className="text-white text-sm font-medium">{m.firstName} {m.lastName}</div>
                        <div className="text-dark-500 text-xs">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {m.enrollments?.length ? m.enrollments.map(e => (
                        <span key={e.id} className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-dark-300 border border-dark-600">{e.class?.name}</span>
                      )) : <span className="text-dark-500 text-xs">No class</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><span className={cn('badge text-xs', membershipColors[m.overallStatus || 'NO_PLAN'])}>{m.overallStatus === 'NO_PLAN' ? 'No Class' : m.overallStatus}</span></td>
                  <td className="px-5 py-3.5 text-dark-300 text-sm">{combinedSessionsPerWeek(m)}</td>
                  <td className="px-5 py-3.5"><ChevronRight size={16} className="text-dark-600 group-hover:text-primary-400 transition-colors" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Fighter Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD FIGHTER</h2>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"><X size={18}/></button>
              </div>
              <form onSubmit={addMember} className="space-y-4">
                <PhotoPicker photo={addForm.photo} name={`${addForm.firstName} ${addForm.lastName}`} onChange={dataUrl => setAddForm(f => ({ ...f, photo: dataUrl }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">First Name</label><input value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} required className="input" /></div>
                  <div><label className="label">Last Name</label><input value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} required className="input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Email</label><input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required className="input" /></div>
                  <div><label className="label">Phone (for WhatsApp)</label><input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="+1 555 000 0000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Starting Class</label>
                    <select value={addForm.classId} onChange={e => setAddForm(f => ({ ...f, classId: e.target.value }))} required className="input">
                      <option value="">Select a class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.daysOfWeek.length}x/week ({formatCurrency(c.price)})</option>)}
                    </select>
                  </div>
                  <div><label className="label">Start Date</label>
                    <input type="date" value={addForm.startDate} onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
                  </div>
                </div>
                {classes.length === 0 && <p className="text-xs text-yellow-400/80">No approved classes yet — create one first in Classes.</p>}
                <p className="text-xs text-dark-500">Training more than one discipline? Add this fighter first, then use &quot;+ Sign into another class&quot; from their profile.</p>
                <div><label className="label">Branch (optional)</label>
                  <select value={addForm.branchId} onChange={e => setAddForm(f => ({ ...f, branchId: e.target.value }))} className="input">
                    <option value="">Unassigned</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Goals</label><input value={addForm.goals} onChange={e => setAddForm(f => ({ ...f, goals: e.target.value }))} className="input" placeholder="e.g. Compete in amateur bouts" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Emergency Contact</label><input value={addForm.emergencyContact} onChange={e => setAddForm(f => ({ ...f, emergencyContact: e.target.value }))} className="input" /></div>
                  <div><label className="label">Emergency Phone</label><input value={addForm.emergencyPhone} onChange={e => setAddForm(f => ({ ...f, emergencyPhone: e.target.value }))} className="input" /></div>
                </div>
                <div><label className="label">Health Conditions</label><input value={addForm.healthConditions} onChange={e => setAddForm(f => ({ ...f, healthConditions: e.target.value }))} className="input" placeholder="Allergies, injuries, etc." /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Fighter</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Detail Panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-xl bg-dark-900 border-l border-dark-700 h-full overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar photo={selected.photo} name={`${selected.firstName} ${selected.lastName}`} size={56} />
                    <div>
                      <h2 className="font-display text-2xl text-white tracking-wide">{selected.firstName.toUpperCase()} {selected.lastName.toUpperCase()}</h2>
                      <p className="text-dark-400 text-xs">{selected.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><X size={18}/></button>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2 flex-wrap">
                  {whatsappLink(selected.phone) && (
                    <a href={whatsappLink(selected.phone)!} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 text-xs font-semibold hover:bg-primary-400/20 transition-colors">
                      <MessageCircle size={13}/> WhatsApp
                    </a>
                  )}
                  <button onClick={() => setQrOpenFor(qrOpenFor === selected.id ? null : selected.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-200 text-xs font-semibold hover:bg-dark-600 transition-colors">
                    <QrCode size={13}/> {qrOpenFor === selected.id ? 'Hide QR' : 'Show QR'}
                  </button>
                  <button onClick={() => setDeleteTarget(selected)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-xs font-semibold hover:bg-crimson-500/20 transition-colors ml-auto">
                    <Trash2 size={13}/> Delete
                  </button>
                </div>

                {qrOpenFor === selected.id && (
                  <div className="card flex flex-col items-center gap-2 py-6">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('vance:checkin:' + selected.id)}&bgcolor=ffffff&color=000000`} alt="Check-in QR code" className="rounded-lg" />
                    <p className="text-dark-400 text-xs">Scan at check-in — {selected.firstName} {selected.lastName}</p>
                  </div>
                )}

                {/* Fighter data */}
                <div className="card space-y-2">
                  <h3 className="text-white font-semibold text-sm mb-1">Fighter Data</h3>
                  {[
                    ['Phone', selected.phone || '—'],
                    ['Branch', branches.find(b => b.id === selected.branchId)?.name || 'Unassigned'],
                    ['Goals', selected.goals || '—'],
                    ['Health Conditions', selected.healthConditions || '—'],
                    ['Emergency Contact', selected.emergencyContact ? `${selected.emergencyContact} (${selected.emergencyPhone || 'no phone'})` : '—'],
                    ['Added by', `${selected.createdByIdName || 'Unknown'} on ${formatDate(selected.createdAt)}`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm py-1 border-b border-dark-700 last:border-0">
                      <span className="text-dark-400">{label}</span><span className="text-white text-right max-w-[60%]">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Classes / enrollments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-sm">
                      Classes {selected.enrollments?.some(e => e.status === 'ACTIVE') && (
                        <span className="text-primary-400 font-normal"> · {combinedSessionsPerWeek(selected)} sessions/week combined</span>
                      )}
                    </h3>
                    <button onClick={() => setShowAddClass(true)} className="text-xs flex items-center gap-1 text-primary-400 hover:text-primary-300"><Plus size={12}/> Sign into another class</button>
                  </div>
                  <div className="space-y-3">
                    {(selected.enrollments || []).length === 0 && <p className="text-dark-500 text-sm">No classes yet.</p>}
                    {(selected.enrollments || []).map(e => (
                      <div key={e.id} className="card">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-white font-semibold text-sm">{e.class.name}</div>
                            <div className="text-dark-400 text-xs">{disciplineLabel(e.class.category)} · <DaySchedule days={e.class.daysOfWeek} /></div>
                          </div>
                          <span className={cn('badge text-xs', membershipColors[e.status])}>{e.status}</span>
                        </div>

                        {/* Monthly session summary: attended / excused / absent */}
                        {e.monthSummary && (
                          <div className="grid grid-cols-3 gap-2 my-3">
                            <div className="bg-primary-400/5 border border-primary-400/20 rounded-lg py-2 text-center">
                              <div className="flex items-center justify-center gap-1 text-primary-400"><CheckCircle2 size={12}/><span className="text-lg font-bold">{e.monthSummary.attended}</span></div>
                              <div className="text-dark-400 text-[10px] uppercase tracking-wide mt-0.5">Attended</div>
                            </div>
                            <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg py-2 text-center">
                              <div className="flex items-center justify-center gap-1 text-blue-400"><MinusCircle size={12}/><span className="text-lg font-bold">{e.monthSummary.excused}</span></div>
                              <div className="text-dark-400 text-[10px] uppercase tracking-wide mt-0.5">Exception</div>
                            </div>
                            <div className="bg-crimson-400/5 border border-crimson-400/20 rounded-lg py-2 text-center">
                              <div className="flex items-center justify-center gap-1 text-crimson-400"><XCircle size={12}/><span className="text-lg font-bold">{e.monthSummary.absent}</span></div>
                              <div className="text-dark-400 text-[10px] uppercase tracking-wide mt-0.5">Absent</div>
                            </div>
                          </div>
                        )}

                        <div className="text-dark-500 text-xs mb-2">
                          {formatDate(e.startDate)} → {e.endDate ? formatDate(e.endDate) : '—'}
                          {e.addedByIdName && <> · Added by {e.addedByIdName}</>}
                          {e.lastAction && e.lastActionByIdName && <> · Last: {e.lastAction.toLowerCase()} by {e.lastActionByIdName}{e.lastActionAt ? ` (${formatDate(e.lastActionAt)})` : ''}</>}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {e.status === 'ACTIVE' && (
                            <button onClick={() => enrollmentAction(e.id, 'freeze', 'Frozen')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-400/10 border border-blue-400/20 text-blue-400 text-xs hover:bg-blue-400/20"><Snowflake size={11}/> Freeze</button>
                          )}
                          {e.status === 'FROZEN' && (
                            <button onClick={() => enrollmentAction(e.id, 'unfreeze', 'Unfrozen')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary-400/10 border border-primary-400/20 text-primary-400 text-xs hover:bg-primary-400/20"><Snowflake size={11}/> Unfreeze</button>
                          )}
                          <button onClick={() => setRenewTarget(e)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary-400/10 border border-primary-400/20 text-primary-400 text-xs hover:bg-primary-400/20"><RefreshCw size={11}/> Renew</button>
                          {(e.status === 'ACTIVE' || e.status === 'FROZEN') && (
                            <button onClick={() => enrollmentAction(e.id, 'cancel', 'Canceled')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-xs hover:bg-crimson-500/20"><Ban size={11}/> Cancel</button>
                          )}
                          <button onClick={() => removeEnrollment(e.id)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-dark-700 border border-dark-600 text-dark-400 text-xs hover:bg-crimson-500/10 hover:text-crimson-400 ml-auto"><Trash2 size={11}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent attendance */}
                <div className="card">
                  <h3 className="text-white font-semibold text-sm mb-2">Recent Attendance</h3>
                  {(selected.recentAttendance || []).length === 0 ? <p className="text-dark-500 text-sm">No attendance recorded yet.</p> : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {(selected.recentAttendance || []).slice(0, 10).map(a => (
                        <div key={a.id} className="flex justify-between text-xs py-1 items-center">
                          <span className="text-dark-300">{a.class?.name}</span>
                          <span className={cn('px-1.5 py-0.5 rounded-full', a.status === 'ATTENDED' ? 'text-primary-400' : a.status === 'EXCUSED' ? 'text-blue-400' : 'text-crimson-400')}>{a.status}</span>
                          <span className="text-dark-500">{formatDate(a.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className="card">
                  <h3 className="text-white font-semibold text-sm mb-2">Payment History</h3>
                  {(selected.payments || []).length === 0 ? <p className="text-dark-500 text-sm">No payments yet.</p> : (
                    <div className="space-y-1.5">
                      {(selected.payments || []).map(p => (
                        <div key={p.id} className="flex justify-between text-xs py-1">
                          <span className="text-dark-300">{p.type}</span>
                          <span className="text-white">${p.amount.toFixed(2)}</span>
                          <span className="text-dark-500">{formatDate(p.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Sign into another class Modal ────────────────────────── */}
      <AnimatePresence>
        {showAddClass && selected && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl tracking-wider text-white">SIGN INTO CLASS</h2>
                <button onClick={() => setShowAddClass(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <p className="text-dark-400 text-xs mb-4">Enrolling {selected.firstName} in an additional discipline — e.g. they already train MMA and are picking up Kickboxing too.</p>
              <form onSubmit={addClassToMember} className="space-y-4">
                <div><label className="label">Class</label>
                  <select value={addClassForm.classId} onChange={e => setAddClassForm(f => ({ ...f, classId: e.target.value }))} required className="input">
                    <option value="">Select a class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.daysOfWeek.length}x/week ({formatCurrency(c.price)})</option>)}
                  </select>
                </div>
                <div><label className="label">Start Date</label><input type="date" value={addClassForm.startDate} onChange={e => setAddClassForm(f => ({ ...f, startDate: e.target.value }))} className="input" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddClass(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Sign Up</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Confirm Renewal Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {renewTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-primary-400/30 rounded-2xl p-8 w-full max-w-sm">
              <div className="w-12 h-12 rounded-full bg-primary-400/10 border border-primary-400/30 flex items-center justify-center mb-4">
                <RefreshCw size={20} className="text-primary-400"/>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">CONFIRM RENEWAL</h3>
              <p className="text-dark-300 text-sm mb-1">Renew <span className="text-white font-semibold">{renewTarget.class.name}</span> for {selected?.firstName}?</p>
              <p className="text-dark-400 text-xs mb-4">Starts a new {renewTarget.class.durationDays}-day cycle for {formatCurrency(renewTarget.class.price)}.</p>
              <div className="bg-dark-700 rounded-xl p-3 text-xs text-dark-300 mb-6 flex items-center gap-2">
                <UserIcon size={13} className="text-primary-400 flex-shrink-0"/>
                This renewal will be recorded as confirmed by <span className="text-white font-semibold">{currentUserName}</span>.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRenewTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={confirmRenew} disabled={renewing} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {renewing ? 'Renewing…' : 'Confirm Renewal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm ────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-crimson-500/30 rounded-2xl p-8 w-full max-w-sm text-center">
              <div className="w-14 h-14 rounded-full bg-crimson-500/10 border border-crimson-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-crimson-400"/>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">DELETE FIGHTER</h3>
              <p className="text-white font-semibold mb-1">{deleteTarget.firstName} {deleteTarget.lastName}</p>
              <p className="text-dark-400 text-sm mb-6">This removes all their classes, attendance, and payment history. Cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={deleteMember} className="flex-1 bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm">Yes, Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
