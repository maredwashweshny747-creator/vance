'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, X, Trash2, RefreshCw, Ban, Camera,
  MessageCircle, QrCode, ChevronRight, ArrowLeftRight, Pencil, Hourglass,
  CheckCircle2, XCircle, MinusCircle, User as UserIcon,
} from 'lucide-react'
import { cn, formatDate, formatCurrency, membershipColors, getInitials, whatsappLink, DAY_LABELS, phoneValidationError } from '@/lib/utils'
import { disciplineLabel } from '@/lib/categories'
import Pagination from '@/components/dashboard/Pagination'
import toast from 'react-hot-toast'

interface ClassInfo { id: string; name: string; category?: string | null; daysOfWeek: string[]; price: number; durationDays: number; status: string; type?: string; offers?: { id: string; months?: number | null; sessions?: number | null; price: number; label?: string | null }[] }
interface MonthSummary { attended: number; excused: number; absent: number; remaining: number; sessionsAllowed: number }
interface Enrollment {
  id: string; classId: string; class: ClassInfo; status: string
  startDate: string; endDate?: string
  addedByIdName?: string | null
  lastAction?: string; lastActionByIdName?: string | null; lastActionAt?: string
  monthSummary?: MonthSummary
}
interface Member {
  id: string; fighterId: string; firstName: string; lastName: string; email?: string; phone?: string; parentPhone?: string; photo?: string | null
  birthYear?: number | null
  branchId?: string
  notes?: string
  createdByIdName?: string | null; createdAt: string
  enrollments: Enrollment[]
  overallStatus?: string
  recentAttendance?: { id: string; date: string; status: string; class: { name: string } }[]
  payments?: { id: string; amount: number; type: string; status: string; createdAt: string; method?: string | null; proofPhoto?: string | null }[]
}

const STATUS_OPTS = ['ALL', 'ACTIVE', 'EXPIRED', 'CANCELED', 'NO_PLAN']
const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'INSTAPAY', 'VODAFONE_CASH']
const PROOF_REQUIRED_METHODS = ['INSTAPAY', 'VODAFONE_CASH']

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

function Avatar({ photo, name, size = 40, onClick }: { photo?: string | null; name: string; size?: number; onClick?: () => void }) {
  if (photo) return (
    <img src={photo} alt={name} onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
      className={cn('rounded-full object-cover flex-shrink-0', onClick && 'cursor-zoom-in')}
      style={{ width: size, height: size }} />
  )
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

function PaymentMethodFields({ method, onMethod, proof, onProof }: { method: string; onMethod: (v: string) => void; proof: string; onProof: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const needsProof = PROOF_REQUIRED_METHODS.includes(method)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { onProof(await resizeImage(file, 800, 0.85)) } catch { toast.error('Could not process that image') } finally { setUploading(false) }
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="label">Payment Method <span className="text-dark-500">(optional)</span></label>
        <select value={method} onChange={e => onMethod(e.target.value)} className="input">
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
        </select>
      </div>
      {needsProof && (
        <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-3">
          <label className="label text-xs">Attach payment screenshot</label>
          {proof ? (
            <div className="flex items-center gap-3 mt-1">
              <img src={proof} alt="Payment proof" className="w-16 h-16 object-cover rounded-lg border border-dark-600" />
              <button type="button" onClick={() => inputRef.current?.click()} className="text-xs text-primary-400 hover:text-primary-300">Replace</button>
              <button type="button" onClick={() => onProof('')} className="text-xs text-crimson-400 hover:text-crimson-300">Remove</button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 flex items-center gap-2 text-xs text-dark-300 border border-dashed border-dark-500 rounded-lg px-3 py-2 hover:border-primary-400/50 hover:text-primary-400 transition-colors">
              <Camera size={13}/> {uploading ? 'Processing…' : `Upload ${method === 'INSTAPAY' ? 'InstaPay' : 'Vodafone Cash'} screenshot`}
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  )
}

// Discount step shown before a payment is created — for assigning a fighter to a
// class or renewing a subscription. For PRIVATE (session-based) classes it also
// collects how many sessions are being purchased, since price = perSession * sessions.
function DiscountAndPricingStep({
  cls, sessionCount, onSessionCount, discountType, onDiscountType, discountValue, onDiscountValue, offerId, onOfferId,
}: {
  cls: ClassInfo | null | undefined
  sessionCount: number
  onSessionCount: (n: number) => void
  discountType: string
  onDiscountType: (v: string) => void
  discountValue: string
  onDiscountValue: (v: string) => void
  offerId?: string
  onOfferId?: (v: string) => void
}) {
  if (!cls) return null
  const isPrivate = cls.type === 'PRIVATE'
  const offers = cls.offers || []
  const selectedOffer = offers.find(o => o.id === offerId)
  const base = selectedOffer ? selectedOffer.price : isPrivate ? cls.price * Math.max(1, sessionCount || 1) : cls.price
  const value = Number(discountValue) || 0
  const discountAmount = discountType === 'PERCENTAGE' ? base * (Math.min(Math.max(value, 0), 100) / 100)
    : discountType === 'FIXED' ? Math.max(value, 0) : 0
  const total = Math.max(0, base - discountAmount)

  return (
    <div className="space-y-3 bg-dark-750 border border-dark-600 rounded-xl p-3">
      {offers.length > 0 && onOfferId && (
        <div>
          <label className="label">Subscription Type</label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button type="button" onClick={() => onOfferId('')}
              className={cn('py-1.5 rounded-lg text-xs font-medium border transition-all', !offerId ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-400')}>
              {isPrivate ? 'Custom Sessions' : 'Regular Monthly'}
            </button>
            <button type="button" onClick={() => onOfferId(offers[0].id)}
              className={cn('py-1.5 rounded-lg text-xs font-medium border transition-all', offerId ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-400')}>
              Existing Offer
            </button>
          </div>
          {offerId && (
            <select value={offerId} onChange={e => onOfferId(e.target.value)} className="input">
              {offers.map(o => <option key={o.id} value={o.id}>{o.label ? `${o.label} — ` : ''}{o.months ? `${o.months} months` : `${o.sessions} sessions`} for {formatCurrency(o.price)}</option>)}
            </select>
          )}
        </div>
      )}
      {isPrivate && !offerId && (
        <div>
          <label className="label">Number of Sessions</label>
          <input type="number" min={1} value={sessionCount || 1} onChange={e => onSessionCount(Math.max(1, +e.target.value))} className="input" />
          <p className="text-dark-500 text-xs mt-1">{formatCurrency(cls.price)}/session × {Math.max(1, sessionCount || 1)} = {formatCurrency(base)}</p>
        </div>
      )}
      <div>
        <label className="label">Discount</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[['NONE','No Discount'],['PERCENTAGE','Percentage'],['FIXED','Fixed Amount']].map(([v,l]) => (
            <button key={v} type="button" onClick={() => onDiscountType(v)}
              className={cn('py-1.5 rounded-lg text-xs font-medium border transition-all', discountType === v ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-400')}>
              {l}
            </button>
          ))}
        </div>
        {discountType !== 'NONE' && (
          <input type="number" min={0} value={discountValue} onChange={e => onDiscountValue(e.target.value)} className="input mt-2"
            placeholder={discountType === 'PERCENTAGE' ? 'Percentage %' : 'Discount amount'} />
        )}
      </div>
      <div className="flex items-center justify-between text-sm pt-1 border-t border-dark-600">
        <span className="text-dark-400">Total to charge</span>
        <span className="text-primary-400 font-bold">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function fighterQrUrl(memberId: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('vance:checkin:' + memberId)}&bgcolor=ffffff&color=000000`
}

function buildWhatsappMessage(template: string, m: { id: string; firstName: string; lastName: string; fighterId: string }) {
  return template
    .replace(/\{firstName\}/gi, m.firstName)
    .replace(/\{fightername\}/gi, `${m.firstName} ${m.lastName}`)
    .replace(/\{fighterid\}/gi, m.fighterId)
    .replace(/\{fighter qrcode\}/gi, fighterQrUrl(m.id))
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
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('')
  const [renewProof, setRenewProof] = useState('')
  const [renewSessionCount, setRenewSessionCount] = useState(1)
  const [renewDiscountType, setRenewDiscountType] = useState('NONE')
  const [renewDiscountValue, setRenewDiscountValue] = useState('')
  const [renewOfferId, setRenewOfferId] = useState('')
  const [addSessionCount, setAddSessionCount] = useState(1)
  const [addDiscountType, setAddDiscountType] = useState('NONE')
  const [addDiscountValue, setAddDiscountValue] = useState('')
  const [addOfferId, setAddOfferId] = useState('')
  const [addClassSessionCount, setAddClassSessionCount] = useState(1)
  const [addClassDiscountType, setAddClassDiscountType] = useState('NONE')
  const [addClassDiscountValue, setAddClassDiscountValue] = useState('')
  const [addClassOfferId, setAddClassOfferId] = useState('')
  const [switchTarget, setSwitchTarget] = useState<Enrollment | null>(null)
  const [switchToClassId, setSwitchToClassId] = useState('')
  const [switching, setSwitching] = useState(false)
  const [qrOpenFor, setQrOpenFor] = useState<string | null>(null)
  const [photoZoom, setPhotoZoom] = useState<{ photo: string; name: string } | null>(null)
  const [sessionsModal, setSessionsModal] = useState<any>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  async function openSessionsModal(enrollmentId: string) {
    setSessionsModal({ loading: true })
    setSessionsLoading(true)
    const res = await fetch(`/api/class-enrollments?id=${enrollmentId}`)
    setSessionsLoading(false)
    if (res.ok) setSessionsModal(await res.json())
    else { setSessionsModal(null); toast.error('Failed to load sessions') }
  }
  const [whatsappTemplate, setWhatsappTemplate] = useState('')
  const [editingFighter, setEditingFighter] = useState(false)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', parentPhone: '', photo: '', birthYear: '', branchId: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const { data: session } = useSession()

  const [addForm, setAddForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', parentPhone: '', photo: '', birthYear: '',
    classId: '', startDate: new Date().toISOString().split('T')[0], paymentMethod: '', proofPhoto: '',
    notes: '', branchId: '',
  })
  const [addClassForm, setAddClassForm] = useState({ classId: '', startDate: new Date().toISOString().split('T')[0], paymentMethod: '', proofPhoto: '' })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  function loadList() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (search) params.set('search', search)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    fetch(`/api/members?${params}`).then(r => r.ok ? r.json() : null).then(d => {
      setMembers(Array.isArray(d?.data) ? d.data : [])
      setTotal(d?.total || 0); setTotalPages(d?.totalPages || 1)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [statusFilter, page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, statusFilter]) // filters/search always jump back to page 1
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
    fetch('/api/settings').then(r => r.json()).then(d => { if (d && !d.error) setWhatsappTemplate(d.whatsappMessageTemplate || '') }).catch(() => {})
  }, [])

  async function openMember(id: string) {
    const res = await fetch(`/api/members?id=${id}`)
    if (res.ok) {
      const m = await res.json()
      setSelected(m)
      setEditingFighter(false)
      setEditForm({ firstName: m.firstName || '', lastName: m.lastName || '', email: m.email || '', phone: m.phone || '', parentPhone: m.parentPhone || '', photo: m.photo || '', birthYear: m.birthYear ? String(m.birthYear) : '', branchId: m.branchId || '', notes: m.notes || '' })
    }
  }
  function refreshSelected() { if (selected) openMember(selected.id) }

  async function saveFighterEdit() {
    if (!selected) return
    if (editForm.phone) {
      const err = phoneValidationError(editForm.phone)
      if (err) { toast.error(err); return }
    }
    setSavingEdit(true)
    const res = await fetch(`/api/members?id=${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, email: editForm.email || null, birthYear: editForm.birthYear || null, branchId: editForm.branchId || null }),
    })
    setSavingEdit(false)
    if (res.ok) { toast.success('Fighter updated'); setEditingFighter(false); refreshSelected(); loadList() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save') }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (addForm.phone) {
      const err = phoneValidationError(addForm.phone)
      if (err) { toast.error(err); return }
    }
    const selectedClass = classes.find(c => c.id === addForm.classId)
    const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      ...addForm,
      sessionCount: selectedClass?.type === 'PRIVATE' ? addSessionCount : undefined,
      discountType: addDiscountType, discountValue: addDiscountValue, offerId: addOfferId || undefined,
    }) })
    if (res.ok) {
      toast.success('Fighter added!')
      setShowAdd(false)
      setAddForm(f => ({ ...f, firstName: '', lastName: '', email: '', phone: '', parentPhone: '', photo: '', birthYear: '', paymentMethod: '', proofPhoto: '', notes: '', branchId: '' }))
      setAddSessionCount(1); setAddDiscountType('NONE'); setAddDiscountValue(''); setAddOfferId('')
      loadList()
    } else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to add fighter') }
  }

  async function addClassToMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const selectedClass = classes.find(c => c.id === addClassForm.classId)
    const res = await fetch('/api/class-enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      memberId: selected.id, ...addClassForm,
      sessionCount: selectedClass?.type === 'PRIVATE' ? addClassSessionCount : undefined,
      discountType: addClassDiscountType, discountValue: addClassDiscountValue, offerId: addClassOfferId || undefined,
    }) })
    if (res.ok) {
      toast.success('Signed into class!'); setShowAddClass(false); refreshSelected(); loadList()
      setAddClassSessionCount(1); setAddClassDiscountType('NONE'); setAddClassDiscountValue(''); setAddClassOfferId('')
    } else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to sign into class') }
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
    const res = await fetch(`/api/class-enrollments?id=${renewTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      _action: 'renew', paymentMethod: renewPaymentMethod, proofPhoto: renewProof,
      sessionCount: renewTarget.class?.type === 'PRIVATE' ? renewSessionCount : undefined,
      discountType: renewDiscountType, discountValue: renewDiscountValue, offerId: renewOfferId || undefined,
    }) })
    const data = await res.json().catch(() => ({}))
    setRenewing(false)
    if (res.ok) {
      toast.success(data.message || 'Renewed'); setRenewTarget(null); setRenewPaymentMethod(''); setRenewProof('')
      setRenewSessionCount(1); setRenewDiscountType('NONE'); setRenewDiscountValue(''); setRenewOfferId('')
      refreshSelected(); loadList()
    } else toast.error(data.error || 'Failed to renew')
  }

  async function confirmSwitch() {
    if (!switchTarget || !switchToClassId) return
    setSwitching(true)
    const res = await fetch(`/api/class-enrollments?id=${switchTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _action: 'switch', newClassId: switchToClassId }) })
    const data = await res.json().catch(() => ({}))
    setSwitching(false)
    if (res.ok) { toast.success(data.message || 'Switched'); setSwitchTarget(null); setSwitchToClassId(''); refreshSelected(); loadList() }
    else toast.error(data.error || 'Failed to switch')
  }

  async function removeEnrollment(enrollmentId: string) {
    if (!window.confirm('Remove this enrollment? This cannot be undone.')) return
    const res = await fetch(`/api/class-enrollments?id=${enrollmentId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Enrollment removed'); refreshSelected(); loadList() } else toast.error('Failed to remove')
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
                {['ID', 'Fighter', 'Classes', 'Status', 'Sessions/wk', ''].map(h => (
                  <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading ? [...Array(6)].map((_, i) => <tr key={i}><td colSpan={6}><div className="h-14 skeleton m-3 rounded-lg" /></td></tr>)
              : members.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center text-dark-400">No fighters found</td></tr>
              : members.map(m => (
                <tr key={m.id} onClick={() => openMember(m.id)} className="hover:bg-dark-750 cursor-pointer transition-colors group">
                  <td className="px-5 py-3.5 text-dark-400 text-xs font-mono">{m.fighterId}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar photo={m.photo} name={`${m.firstName} ${m.lastName}`} size={36}
                        onClick={m.photo ? (() => setPhotoZoom({ photo: m.photo!, name: `${m.firstName} ${m.lastName}` })) : undefined} />
                      <div>
                        <div className="text-white text-sm font-medium">{m.firstName} {m.lastName}</div>
                        <div className="text-dark-500 text-xs">{m.email || m.phone || '—'}</div>
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
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1) }} />
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
                  <div><label className="label">Email (optional)</label><input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className="input" /></div>
                  <div><label className="label">Phone (for WhatsApp)</label><input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="+20 100 000 0000" /></div>
                  <div><label className="label">Parent Phone (optional)</label><input value={addForm.parentPhone} onChange={e => setAddForm(f => ({ ...f, parentPhone: e.target.value }))} className="input" placeholder="+20 100 000 0000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Birth Year</label><input type="number" value={addForm.birthYear} onChange={e => setAddForm(f => ({ ...f, birthYear: e.target.value }))} className="input" placeholder="e.g. 1998" min={1930} max={new Date().getFullYear()} /></div>
                  <div><label className="label">Branch (optional)</label>
                    <select value={addForm.branchId} onChange={e => setAddForm(f => ({ ...f, branchId: e.target.value }))} className="input">
                      <option value="">Unassigned</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Starting Class (optional)</label>
                    <select value={addForm.classId} onChange={e => setAddForm(f => ({ ...f, classId: e.target.value }))} className="input">
                      <option value="">None yet</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.daysOfWeek.length}x/week ({formatCurrency(c.price)})</option>)}
                    </select>
                  </div>
                  <div><label className="label">Start Date</label>
                    <input type="date" value={addForm.startDate} onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
                  </div>
                </div>
                {addForm.classId && (
                  <>
                    <DiscountAndPricingStep
                      cls={classes.find(c => c.id === addForm.classId)}
                      sessionCount={addSessionCount} onSessionCount={setAddSessionCount}
                      discountType={addDiscountType} onDiscountType={setAddDiscountType}
                      discountValue={addDiscountValue} onDiscountValue={setAddDiscountValue}
                      offerId={addOfferId} onOfferId={setAddOfferId}
                    />
                    <PaymentMethodFields
                      method={addForm.paymentMethod} onMethod={v => setAddForm(f => ({ ...f, paymentMethod: v }))}
                      proof={addForm.proofPhoto} onProof={v => setAddForm(f => ({ ...f, proofPhoto: v }))}
                    />
                  </>
                )}
                {classes.length === 0 && <p className="text-xs text-yellow-400/80">No approved classes yet — create one first in Classes.</p>}
                <p className="text-xs text-dark-500">Training more than one discipline? Add this fighter first, then use &quot;+ Sign into another class&quot; from their profile.</p>
                <div className="grid grid-cols-2 gap-3">
                </div>
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
                    <Avatar photo={selected.photo} name={`${selected.firstName} ${selected.lastName}`} size={56}
                      onClick={selected.photo ? (() => setPhotoZoom({ photo: selected.photo!, name: `${selected.firstName} ${selected.lastName}` })) : undefined} />
                    <div>
                      <h2 className="font-display text-2xl text-white tracking-wide">{selected.firstName.toUpperCase()} {selected.lastName.toUpperCase()}</h2>
                      <p className="text-primary-400 text-xs font-mono tracking-widest">ID {selected.fighterId}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><X size={18}/></button>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2 flex-wrap">
                  {whatsappLink(selected.phone) && (
                    <a href={whatsappLink(selected.phone, whatsappTemplate ? buildWhatsappMessage(whatsappTemplate, selected) : null)!} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 text-xs font-semibold hover:bg-primary-400/20 transition-colors">
                      <MessageCircle size={13}/> WhatsApp
                    </a>
                  )}
                  <button onClick={() => setQrOpenFor(qrOpenFor === selected.id ? null : selected.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-200 text-xs font-semibold hover:bg-dark-600 transition-colors">
                    <QrCode size={13}/> {qrOpenFor === selected.id ? 'Hide QR' : 'Show QR'}
                  </button>
                </div>

                {qrOpenFor === selected.id && (
                  <div className="card flex flex-col items-center gap-2 py-6">
                    <img src={fighterQrUrl(selected.id)} alt="Check-in QR code" className="rounded-lg" />
                    <p className="text-dark-400 text-xs">Scan at check-in — {selected.firstName} {selected.lastName}</p>
                  </div>
                )}

                {/* Fighter data */}
                <div className="card space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-semibold text-sm">Fighter Data</h3>
                    {!editingFighter && (
                      <button onClick={() => setEditingFighter(true)} className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"><Pencil size={12}/> Edit</button>
                    )}
                  </div>
                  {editingFighter ? (
                    <div className="space-y-2 pt-1">
                      <PhotoPicker photo={editForm.photo} name={`${editForm.firstName} ${editForm.lastName}`} onChange={dataUrl => setEditForm(f => ({ ...f, photo: dataUrl }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label text-xs">First Name</label><input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className="input py-2 text-sm" /></div>
                        <div><label className="label text-xs">Last Name</label><input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className="input py-2 text-sm" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label text-xs">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input py-2 text-sm" /></div>
                        <div><label className="label text-xs">Phone</label><input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input py-2 text-sm" /></div>
                        <div><label className="label text-xs">Parent Phone</label><input value={editForm.parentPhone} onChange={e => setEditForm(f => ({ ...f, parentPhone: e.target.value }))} className="input py-2 text-sm" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label text-xs">Birth Year</label><input type="number" value={editForm.birthYear} onChange={e => setEditForm(f => ({ ...f, birthYear: e.target.value }))} className="input py-2 text-sm" placeholder="e.g. 1995" /></div>
                        <div><label className="label text-xs">Branch</label>
                          <select value={editForm.branchId} onChange={e => setEditForm(f => ({ ...f, branchId: e.target.value }))} className="input py-2 text-sm">
                            <option value="">Unassigned</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div><label className="label text-xs">Notes</label><textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="input py-2 text-sm h-16 resize-none" /></div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingFighter(false)} className="btn-ghost flex-1 justify-center text-sm py-2">Cancel</button>
                        <button onClick={saveFighterEdit} disabled={savingEdit} className="btn-primary flex-1 justify-center text-sm py-2 disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {[
                        ['Fighter ID (portal login)', selected.fighterId],
                        ['Email', selected.email || '—'],
                        ['Phone', selected.phone || '—'],
                        ['Parent Phone', selected.parentPhone || '—'],
                        ['Birth Year', selected.birthYear || '—'],
                        ['Branch', branches.find(b => b.id === selected.branchId)?.name || 'Unassigned'],
                        ['Notes', selected.notes || '—'],
                        ['Added by', `${selected.createdByIdName || 'Unknown'} on ${formatDate(selected.createdAt)}`],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between text-sm py-1 border-b border-dark-700 last:border-0">
                          <span className="text-dark-400">{label}</span><span className="text-white text-right max-w-[60%]">{val}</span>
                        </div>
                      ))}
                    </>
                  )}
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

                        {/* Monthly session summary: attended / excused / absent / remaining */}
                        {e.monthSummary && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
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
                            <button type="button" onClick={() => openSessionsModal(e.id)} className="bg-dark-700 border border-dark-600 rounded-lg py-2 text-center hover:border-primary-400/40 transition-colors">
                              <div className="flex items-center justify-center gap-1 text-white"><Hourglass size={12}/><span className="text-lg font-bold">{e.monthSummary.remaining}</span></div>
                              <div className="text-dark-400 text-[10px] uppercase tracking-wide mt-0.5">Remaining</div>
                            </button>
                          </div>
                        )}

                        <div className="text-dark-500 text-xs mb-2">
                          {formatDate(e.startDate)} → {e.endDate ? formatDate(e.endDate) : '—'}
                          {e.addedByIdName && <> · Added by {e.addedByIdName}</>}
                          {e.lastAction && e.lastActionByIdName && <> · Last: {e.lastAction.toLowerCase()} by {e.lastActionByIdName}{e.lastActionAt ? ` (${formatDate(e.lastActionAt)})` : ''}</>}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => setRenewTarget(e)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary-400/10 border border-primary-400/20 text-primary-400 text-xs hover:bg-primary-400/20"><RefreshCw size={11}/> Renew</button>
                          {e.status === 'ACTIVE' && (
                            <button onClick={() => { setSwitchTarget(e); setSwitchToClassId('') }} className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-400/10 border border-blue-400/20 text-blue-400 text-xs hover:bg-blue-400/20"><ArrowLeftRight size={11}/> Switch</button>
                          )}
                          {e.status === 'ACTIVE' && (
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
                        <div key={p.id} className="flex justify-between items-center text-xs py-1 gap-2">
                          <span className="text-dark-300 flex-1 truncate">{p.type}{p.method ? ` · ${p.method.replace('_',' ')}` : ''}</span>
                          <span className="text-white flex-shrink-0">{formatCurrency(p.amount)}</span>
                          {p.proofPhoto && (
                            <a href={p.proofPhoto} target="_blank" rel="noreferrer" className="flex-shrink-0">
                              <img src={p.proofPhoto} alt="proof" className="w-6 h-6 rounded object-cover border border-dark-600 hover:border-primary-400/50" />
                            </a>
                          )}
                          <span className="text-dark-500 flex-shrink-0">{formatDate(p.createdAt)}</span>
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
                {addClassForm.classId && (
                  <DiscountAndPricingStep
                    cls={classes.find(c => c.id === addClassForm.classId)}
                    sessionCount={addClassSessionCount} onSessionCount={setAddClassSessionCount}
                    discountType={addClassDiscountType} onDiscountType={setAddClassDiscountType}
                    discountValue={addClassDiscountValue} onDiscountValue={setAddClassDiscountValue}
                    offerId={addClassOfferId} onOfferId={setAddClassOfferId}
                  />
                )}
                <PaymentMethodFields
                  method={addClassForm.paymentMethod} onMethod={v => setAddClassForm(f => ({ ...f, paymentMethod: v }))}
                  proof={addClassForm.proofPhoto} onProof={v => setAddClassForm(f => ({ ...f, proofPhoto: v }))}
                />
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
              <div className="mb-4 space-y-3">
                <DiscountAndPricingStep
                  cls={renewTarget.class}
                  sessionCount={renewSessionCount} onSessionCount={setRenewSessionCount}
                  discountType={renewDiscountType} onDiscountType={setRenewDiscountType}
                  discountValue={renewDiscountValue} onDiscountValue={setRenewDiscountValue}
                  offerId={renewOfferId} onOfferId={setRenewOfferId}
                />
                <PaymentMethodFields method={renewPaymentMethod} onMethod={setRenewPaymentMethod} proof={renewProof} onProof={setRenewProof} />
              </div>
              <div className="bg-dark-700 rounded-xl p-3 text-xs text-dark-300 mb-6 flex items-center gap-2">
                <UserIcon size={13} className="text-primary-400 flex-shrink-0"/>
                This renewal will be recorded as confirmed by <span className="text-white font-semibold">{currentUserName}</span>.
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRenewTarget(null); setRenewPaymentMethod(''); setRenewProof(''); setRenewSessionCount(1); setRenewDiscountType('NONE'); setRenewDiscountValue('') }} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={confirmRenew} disabled={renewing} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {renewing ? 'Renewing…' : 'Confirm Renewal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Switch Class Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {switchTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 border border-blue-400/30 rounded-2xl p-8 w-full max-w-sm">
              <div className="w-12 h-12 rounded-full bg-blue-400/10 border border-blue-400/30 flex items-center justify-center mb-4">
                <ArrowLeftRight size={20} className="text-blue-400"/>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">SWITCH CLASS</h3>
              <p className="text-dark-300 text-sm mb-4">Move {selected?.firstName} from <span className="text-white font-semibold">{switchTarget.class.name}</span> to a different class.</p>
              <div className="mb-4">
                <label className="label">New Class</label>
                <select value={switchToClassId} onChange={e => setSwitchToClassId(e.target.value)} className="input">
                  <option value="">Select a class...</option>
                  {classes.filter(c => c.id !== switchTarget.classId).map(c => <option key={c.id} value={c.id}>{c.name} — {c.daysOfWeek.length}x/week</option>)}
                </select>
              </div>
              <div className="bg-dark-700 rounded-xl p-3 text-xs text-dark-300 mb-6 flex items-center gap-2">
                <UserIcon size={13} className="text-blue-400 flex-shrink-0"/>
                No new charge — remaining days on the current cycle carry over to the new class. Recorded as confirmed by <span className="text-white font-semibold">{currentUserName}</span>.
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setSwitchTarget(null); setSwitchToClassId('') }} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={confirmSwitch} disabled={switching || !switchToClassId} className="flex-1 justify-center bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 text-sm">
                  {switching ? 'Switching…' : 'Confirm Switch'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session-by-session breakdown */}
      <AnimatePresence>
        {sessionsModal && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSessionsModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-xl text-white">{sessionsLoading ? 'Loading…' : sessionsModal.class?.name}</h3>
                <button onClick={() => setSessionsModal(null)} className="text-dark-400 hover:text-white"><X size={18}/></button>
              </div>
              {!sessionsLoading && (
                <p className="text-dark-400 text-xs mb-4">
                  {sessionsModal.isPrivate
                    ? `${sessionsModal.attended} of ${sessionsModal.sessionCount} sessions used — ${sessionsModal.remaining} remaining (booked as you go)`
                    : `${sessionsModal.attended} attended, ${sessionsModal.remaining} upcoming of ${sessionsModal.sessionsAllowed} sessions this cycle`}
                </p>
              )}
              <div className="overflow-y-auto space-y-1.5 pr-1">
                {sessionsLoading ? [...Array(4)].map((_,i) => <div key={i} className="h-10 skeleton rounded-lg"/>) :
                  sessionsModal.sessions?.length === 0 ? <p className="text-dark-500 text-sm py-8 text-center">No sessions scheduled yet.</p> :
                  sessionsModal.sessions?.map((s: any, i: number) => {
                    const badge = s.status === 'ATTENDED' ? 'text-primary-400 bg-primary-400/10 border-primary-400/20'
                      : s.status === 'EXCUSED' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                      : s.status === 'UPCOMING' ? 'text-dark-400 bg-dark-700 border-dark-600'
                      : 'text-crimson-400 bg-crimson-400/10 border-crimson-400/20' // ABSENT or MISSED
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-dark-750 border border-dark-700">
                        <span className="text-white text-sm">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span className={cn('badge text-xs', badge)}>{s.status === 'MISSED' ? 'Absent' : s.status.charAt(0) + s.status.slice(1).toLowerCase()}</span>
                      </div>
                    )
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo zoom */}
      <AnimatePresence>
        {photoZoom && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => setPhotoZoom(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-lg w-full">
              <button onClick={() => setPhotoZoom(null)} className="absolute -top-10 right-0 text-white/80 hover:text-white"><X size={24}/></button>
              <img src={photoZoom.photo} alt={photoZoom.name} className="w-full h-auto rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
              <p className="text-center text-white/80 text-sm mt-3">{photoZoom.name}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
