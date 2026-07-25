'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Plus, Clock, Users, Swords, Trash2, X, AlertTriangle, Check, Ban, Hourglass, User as UserIcon } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// Restricted to the brand palette (yellow / red / neutral shades) so class colors stay on-theme
const COLORS = ['#ffc700', '#e0161c', '#ffda47', '#8f0e12', '#71717a', '#ffffff']
const CATEGORIES = ['BOXING', 'MUAY_THAI', 'BJJ', 'WRESTLING', 'MMA', 'KICKBOXING', 'CONDITIONING', 'SPARRING']
const CATEGORY_LABELS: Record<string, string> = {
  BOXING: 'Boxing', MUAY_THAI: 'Muay Thai', BJJ: 'BJJ', WRESTLING: 'Wrestling',
  MMA: 'MMA', KICKBOXING: 'Kickboxing', CONDITIONING: 'Conditioning', SPARRING: 'Sparring',
}
const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
  PENDING:  'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  REJECTED: 'text-crimson-400 bg-crimson-400/10 border-crimson-400/20',
}

interface Coach { id: string; firstName: string; lastName: string; specialties?: string | null }

export default function ClassesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'ADMIN'
  const isAdmin = role === 'ADMIN'
  const isCoach = role === 'COACH'

  const [classes, setClasses] = useState<any[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', category: 'BOXING', type: 'GROUP', duration: 45,
    capacity: 20, color: '#ffc700', startTime: '', endTime: '', coachId: '',
  })

  function load() {
    setLoading(true)
    fetch('/api/classes').then(r => r.ok ? r.json() : []).then(d => { setClasses(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }
  function loadCoaches() {
    fetch('/api/coaches').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setCoaches(d) }).catch(() => {})
  }

  useEffect(() => { load(); loadCoaches() }, [])

  async function addClass(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) {
      toast.success(isCoach ? 'Submitted — waiting on admin approval' : 'Class added!')
      setShowForm(false)
      setForm({ name:'',description:'',category:'BOXING',type:'GROUP',duration:45,capacity:20,color:'#ffc700',startTime:'',endTime:'',coachId:'' })
      load()
    } else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to add class') }
  }

  async function deleteClass() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/classes?id=${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { toast.success(`"${deleteTarget.name}" deleted`); setDeleteTarget(null); load() }
    else toast.error('Failed to delete class')
  }

  async function approveClass(id: string) {
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
          <h1 className="font-display text-4xl tracking-wider text-white">CLASSES & SESSIONS</h1>
          <p className="text-dark-300 text-sm mt-1">
            {isCoach ? 'Your group classes and private sessions' : `${classes.length} scheduled`}
            {isAdmin && pendingCount > 0 && <span className="text-yellow-400"> · {pendingCount} awaiting approval</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> {isCoach ? 'Submit Class' : 'Add Class'}</button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_,i) => <div key={i} className="h-48 skeleton rounded-2xl"/>)}</div>
      ) : classes.length === 0 ? (
        <div className="card text-center py-16"><Calendar size={48} className="mx-auto text-dark-600 mb-4"/><p className="text-dark-400">No classes yet — add your first one</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls: any, i: number) => (
            <motion.div key={cls.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card-hover group relative" style={{ borderLeftColor: cls.color || '#ffc700', borderLeftWidth: 3 }}>
              {/* Delete button */}
              <button
                onClick={() => setDeleteTarget(cls)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-crimson-500/10 hover:text-crimson-400 text-dark-600 transition-all"
              >
                <Trash2 size={14}/>
              </button>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cls.color}20` }}>
                  <Swords size={16} style={{ color: cls.color }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-dark-400 bg-dark-700 px-2 py-1 rounded-full">{CATEGORY_LABELS[cls.category] || cls.category || 'General'}</span>
                  <span className="text-xs bg-dark-700 px-2 py-1 rounded-full text-dark-300">{cls.type === 'PRIVATE' ? 'Private' : 'Group'}</span>
                </div>
              </div>
              <h3 className="font-semibold text-white mb-1">{cls.name}</h3>
              <p className="text-dark-400 text-xs mb-3 line-clamp-2">{cls.description || 'No description'}</p>
              {cls.coach && <p className="text-xs text-primary-400/80 mb-2 flex items-center gap-1"><UserIcon size={11}/> Coach {cls.coach.firstName} {cls.coach.lastName}</p>}
              <div className="flex items-center gap-4 text-xs text-dark-300">
                <span className="flex items-center gap-1"><Clock size={12}/> {cls.duration}min</span>
                <span className="flex items-center gap-1"><Users size={12}/> {cls.capacity} max</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-dark-500">{formatDateTime(cls.startTime)}</span>
                <span className={cn('badge text-xs', STATUS_COLORS[cls.status] || '')}>{cls.status}</span>
              </div>
              {cls.status === 'REJECTED' && cls.rejectionNote && (
                <p className="mt-2 text-xs text-crimson-300 bg-crimson-500/5 border border-crimson-500/20 rounded-lg px-2 py-1.5">{cls.rejectionNote}</p>
              )}
              {/* Admin approval actions */}
              {isAdmin && cls.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => approveClass(cls.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 text-xs font-semibold transition-colors">
                    <Check size={13}/> Approve
                  </button>
                  <button onClick={() => setRejectTarget(cls)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 hover:bg-crimson-500/20 text-xs font-semibold transition-colors">
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

      {/* Add Class Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">{isCoach ? 'SUBMIT CLASS' : 'ADD CLASS'}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"><X size={18}/></button>
              </div>
              {isCoach && (
                <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3 text-xs text-yellow-300 mb-4 flex items-start gap-2">
                  <Hourglass size={13} className="flex-shrink-0 mt-0.5"/>
                  <div>Classes and private sessions you submit go live once an admin approves them.</div>
                </div>
              )}
              <form onSubmit={addClass} className="space-y-4">
                <div><label className="label">Class Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="e.g. Morning Boxing Fundamentals"/></div>
                <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="input h-20 resize-none" placeholder="What members can expect..."/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Discipline</label>
                    <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="input">
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Format</label>
                    <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="input">
                      <option value="GROUP">Group Class</option>
                      <option value="PRIVATE">Private Session</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Duration (min)</label><input type="number" value={form.duration} onChange={e => setForm(f=>({...f,duration:+e.target.value}))} min={15} max={180} className="input"/></div>
                  <div><label className="label">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm(f=>({...f,capacity:+e.target.value}))} min={1} className="input"/></div>
                </div>
                {!isCoach && (
                  <div><label className="label">Coach (optional)</label>
                    <select value={form.coachId} onChange={e => setForm(f=>({...f,coachId:e.target.value}))} className="input">
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
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Start Time</label><input type="datetime-local" value={form.startTime} onChange={e => setForm(f=>({...f,startTime:e.target.value}))} required className="input"/></div>
                  <div><label className="label">End Time</label><input type="datetime-local" value={form.endTime} onChange={e => setForm(f=>({...f,endTime:e.target.value}))} required className="input"/></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">{isCoach ? 'Submit for Approval' : 'Add Class'}</button>
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
              <p className="text-dark-400 text-sm mb-6">This will remove the class and all bookings. Cannot be undone.</p>
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
