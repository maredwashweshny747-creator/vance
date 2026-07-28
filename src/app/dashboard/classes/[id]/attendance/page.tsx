'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, MinusCircle, Circle, X } from 'lucide-react'
import { getInitials, cn } from '@/lib/utils'
import { disciplineLabel } from '@/lib/categories'
import toast from 'react-hot-toast'

interface RosterEntry {
  enrollmentId: string
  member: { id: string; firstName: string; lastName: string; photo?: string | null }
  status: string
  mark: { status: string; reason?: string | null } | null
}

const STATUS_META: Record<string, { icon: any; color: string; label: string }> = {
  ATTENDED: { icon: CheckCircle2, color: 'text-primary-400 bg-primary-400/10 border-primary-400/30', label: 'Attended' },
  ABSENT:   { icon: XCircle,      color: 'text-crimson-400 bg-crimson-400/10 border-crimson-400/30', label: 'Absent' },
  EXCUSED:  { icon: MinusCircle,  color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', label: 'Excused' },
}

function toDateInput(d: Date) { return d.toISOString().split('T')[0] }

export default function ClassAttendancePage() {
  const params = useParams()
  const classId = params?.id as string

  const [date, setDate] = useState(toDateInput(new Date()))
  const [cls, setCls] = useState<any>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [excuseTarget, setExcuseTarget] = useState<RosterEntry | null>(null)
  const [excuseReason, setExcuseReason] = useState('')

  function load() {
    setLoading(true)
    fetch(`/api/class-attendance?classId=${classId}&date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setCls(d.class); setRoster(d.roster) } setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { if (classId) load() }, [classId, date]) // eslint-disable-line react-hooks/exhaustive-deps

  // One-time classes only have a single valid date — jump straight to it
  useEffect(() => {
    if (cls?.isOneTime && cls.sessionDate) {
      const sessionDay = toDateInput(new Date(cls.sessionDate))
      if (sessionDay !== date) setDate(sessionDay)
    }
  }, [cls]) // eslint-disable-line react-hooks/exhaustive-deps

  async function mark(entry: RosterEntry, status: string, reason?: string) {
    const res = await fetch('/api/class-attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId: entry.enrollmentId, date, status, reason, method: 'ROSTER' }),
    })
    if (res.ok) { toast.success(`${entry.member.firstName} marked ${status.toLowerCase()}`); load() }
    else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to save') }
  }

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days); setDate(toDateInput(d))
  }

  const counts = {
    attended: roster.filter(r => r.mark?.status === 'ATTENDED').length,
    absent: roster.filter(r => r.mark?.status === 'ABSENT').length,
    excused: roster.filter(r => r.mark?.status === 'EXCUSED').length,
    unmarked: roster.filter(r => !r.mark).length,
  }

  const dayCode = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(date + 'T12:00:00').getDay()]
  const isScheduledDay = cls?.daysOfWeek?.includes(dayCode)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/dashboard/classes" className="flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors w-fit">
        <ArrowLeft size={14}/> Back to Classes
      </Link>

      <div>
        <h1 className="font-display text-4xl tracking-wider text-white">{cls?.name?.toUpperCase() || 'ATTENDANCE'}</h1>
        <p className="text-dark-300 text-sm mt-1">{cls ? disciplineLabel(cls.category) : ''} · {roster.length} fighter{roster.length !== 1 ? 's' : ''} signed in</p>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-2xl p-4">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-dark-700 transition-colors"><ChevronLeft size={18}/></button>
        <div className="text-center">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-white font-display text-xl tracking-wide text-center outline-none"/>
          {cls && !cls.isOneTime && !isScheduledDay && (
            <div className="text-yellow-400 text-xs mt-1">This class doesn&apos;t normally meet on this day</div>
          )}
        </div>
        <button onClick={() => shiftDate(1)} className="p-2 rounded-lg hover:bg-dark-700 transition-colors"><ChevronRight size={18}/></button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center py-3"><div className="font-display text-2xl text-primary-400">{counts.attended}</div><div className="text-dark-400 text-[10px] uppercase tracking-wide">Attended</div></div>
        <div className="card text-center py-3"><div className="font-display text-2xl text-crimson-400">{counts.absent}</div><div className="text-dark-400 text-[10px] uppercase tracking-wide">Absent</div></div>
        <div className="card text-center py-3"><div className="font-display text-2xl text-blue-400">{counts.excused}</div><div className="text-dark-400 text-[10px] uppercase tracking-wide">Excused</div></div>
        <div className="card text-center py-3"><div className="font-display text-2xl text-dark-400">{counts.unmarked}</div><div className="text-dark-400 text-[10px] uppercase tracking-wide">Unmarked</div></div>
      </div>

      {/* Roster */}
      <div className="space-y-2">
        {loading ? [...Array(5)].map((_,i) => <div key={i} className="h-16 skeleton rounded-xl"/>)
        : roster.length === 0 ? (
          <div className="card text-center py-12 text-dark-400">No fighters signed into this class yet</div>
        ) : roster.map((entry, i) => {
          const meta = entry.mark ? STATUS_META[entry.mark.status] : null
          return (
            <motion.div key={entry.enrollmentId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={cn('flex items-center gap-3 p-3 rounded-xl border', meta ? meta.color : 'bg-dark-800 border-dark-600')}>
              {entry.member.photo ? (
                <img src={entry.member.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
              ) : (
                <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                  {getInitials(`${entry.member.firstName} ${entry.member.lastName}`)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{entry.member.firstName} {entry.member.lastName}</div>
                {entry.mark?.reason && <div className="text-dark-400 text-xs truncate">{entry.mark.reason}</div>}
                {entry.status === 'FROZEN' && <div className="text-blue-400 text-xs">Frozen</div>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => mark(entry, 'ATTENDED')} title="Attended"
                  className={cn('p-2 rounded-lg border transition-all', entry.mark?.status === 'ATTENDED' ? 'bg-primary-400 border-primary-400 text-dark-950' : 'border-dark-600 text-dark-400 hover:border-primary-400/50 hover:text-primary-400')}>
                  <CheckCircle2 size={16}/>
                </button>
                <button onClick={() => mark(entry, 'ABSENT')} title="Absent"
                  className={cn('p-2 rounded-lg border transition-all', entry.mark?.status === 'ABSENT' ? 'bg-crimson-500 border-crimson-500 text-white' : 'border-dark-600 text-dark-400 hover:border-crimson-400/50 hover:text-crimson-400')}>
                  <XCircle size={16}/>
                </button>
                <button onClick={() => { setExcuseTarget(entry); setExcuseReason(entry.mark?.reason || '') }} title="Excused"
                  className={cn('p-2 rounded-lg border transition-all', entry.mark?.status === 'EXCUSED' ? 'bg-blue-500 border-blue-500 text-white' : 'border-dark-600 text-dark-400 hover:border-blue-400/50 hover:text-blue-400')}>
                  <MinusCircle size={16}/>
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Excuse reason modal */}
      {excuseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setExcuseTarget(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
            className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl text-white">MARK EXCUSED</h3>
              <button onClick={() => setExcuseTarget(null)} className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400"><X size={16}/></button>
            </div>
            <p className="text-dark-400 text-xs mb-4">{excuseTarget.member.firstName} {excuseTarget.member.lastName} — this won&apos;t count against their attendance.</p>
            <input value={excuseReason} onChange={e => setExcuseReason(e.target.value)} className="input mb-4" placeholder="Reason (optional) — e.g. Sick"/>
            <div className="flex gap-3">
              <button onClick={() => setExcuseTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={() => { mark(excuseTarget, 'EXCUSED', excuseReason); setExcuseTarget(null); setExcuseReason('') }} className="btn-primary flex-1 justify-center">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
