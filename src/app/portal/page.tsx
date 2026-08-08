'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, Hash, ArrowRight, UserCheck, Calendar, TrendingUp, Dumbbell, QrCode, CheckCircle2, Clock, Target, Plus, Weight, X, MessageSquare, Send } from 'lucide-react'
import { cn, formatDate, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PortalData {
  member: any; gym: { name:string; slug:string }; recentAttendance: any[]
}

export default function MemberPortal() {
  const [step, setStep] = useState<'login'|'portal'>('login')
  const [fighterId, setFighterId] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PortalData | null>(null)
  const [tab, setTab] = useState<'home'|'classes'|'workout'|'progress'|'qr'>('home')
  const [progressForm, setProgressForm] = useState({ weight:'', bodyFat:'', waist:'', notes:'' })
  const [photoZoom, setPhotoZoom] = useState(false)
  const [openCalendarFor, setOpenCalendarFor] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/portal?fighterId=${encodeURIComponent(fighterId)}`)
      if(!res.ok){ const d=await res.json(); toast.error(d.error||'Not found'); setLoading(false); return }
      const d = await res.json()
      setData(d); setStep('portal')
    } catch { toast.error('Connection error') }
    setLoading(false)
  }

  async function addProgress(e:React.FormEvent) {
    e.preventDefault()
    if(!data) return
    const res = await fetch('/api/portal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ _type:'add_progress', memberId:data.member.id, weight:+progressForm.weight||null, bodyFat:+progressForm.bodyFat||null, waist:+progressForm.waist||null, notes:progressForm.notes }) })
    if(res.ok){ toast.success('Progress logged!'); setProgressForm({weight:'',bodyFat:'',waist:'',notes:''}) } else { toast.error('Failed') }
  }

  async function submitFeedback() {
    if (!data || !feedbackMsg.trim()) return
    setSendingFeedback(true)
    const res = await fetch('/api/portal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ _type:'submit_feedback', memberId:data.member.id, message:feedbackMsg.trim() }) })
    setSendingFeedback(false)
    if (res.ok) { toast.success('Message sent to administration'); setFeedbackMsg('') } else toast.error('Failed to send — try again')
  }

  const statusColors: Record<string,string> = {
    ACTIVE:'text-primary-400 bg-primary-400/10 border-primary-400/20',
    EXPIRED:'text-red-400 bg-red-400/10 border-red-400/20',
  }

  if(step === 'login') return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ backgroundImage:`linear-gradient(rgba(255,199,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,199,0,0.03) 1px, transparent 1px)`, backgroundSize:'60px 60px' }}/>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl"/>
      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Swords size={28} className="text-dark-950"/>
          </div>
          <h1 className="font-display text-4xl tracking-wider text-white">FIGHTER PORTAL</h1>
          <p className="text-dark-400 text-sm mt-2">Access your classes, sessions & progress</p>
        </div>
        <form onSubmit={login} className="card space-y-4">
          <div>
            <label className="label">Fighter ID</label>
            <div className="relative"><Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"/><input value={fighterId} onChange={e=>setFighterId(e.target.value)} required autoFocus className="input pl-9 font-mono tracking-widest" placeholder="200060001" maxLength={20}/></div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Finding your account...' : <><span>Access Portal</span><ArrowRight size={16}/></>}
          </button>
        </form>
        <p className="text-center text-dark-600 text-xs mt-4">Your Fighter ID is on your membership card — ask staff if you don&apos;t have it</p>
      </motion.div>
    </div>
  )

  if(!data) return null
  const { member, gym, recentAttendance } = data

  const activeEnrollments = member.enrollments?.filter((e: any) => e.status === 'ACTIVE') || []
  const overallStatus = activeEnrollments.length > 0 ? 'ACTIVE'
    : member.enrollments?.some((e: any) => e.status === 'EXPIRED') ? 'EXPIRED'
    : member.enrollments?.length > 0 ? 'CANCELED' : 'NO_PLAN'
  const soonestExpiry = activeEnrollments
    .filter((e: any) => e.endDate)
    .sort((a: any, b: any) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0]
  const daysLeft = soonestExpiry ? Math.ceil((new Date(soonestExpiry.endDate).getTime()-Date.now())/(1000*60*60*24)) : null

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-dark-900 border-b border-dark-700 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center"><Swords size={14} className="text-dark-950"/></div>
            <span className="font-display text-lg tracking-wider text-white">{gym.name}</span>
          </div>
          <span className={cn('badge text-xs', statusColors[overallStatus]||'text-dark-400')}>{overallStatus === 'NO_PLAN' ? 'No Plan' : overallStatus}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Welcome */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="mb-6 flex items-center gap-3">
          <button onClick={() => member.photo && setPhotoZoom(true)} className={cn('w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-dark-600', member.photo ? 'cursor-zoom-in' : 'bg-dark-800')}>
            {member.photo ? <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} className="w-full h-full object-cover" />
              : <span className="text-primary-400 font-bold">{getInitials(`${member.firstName} ${member.lastName}`)}</span>}
          </button>
          <div>
            <h2 className="font-display text-3xl text-white">HEY, {member.firstName.toUpperCase()} 👋</h2>
            <p className="text-dark-400 text-sm mt-1">
              {daysLeft !== null ? (daysLeft > 0 ? `Next renewal in ${daysLeft} days` : 'A plan has expired') : 'Welcome back'}
            </p>
          </div>
        </motion.div>

        {/* Tab nav */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {([
            {id:'home',label:'Home',icon:UserCheck},
            {id:'classes',label:'Classes',icon:Calendar},
            {id:'workout',label:'Workout',icon:Dumbbell},
            {id:'progress',label:'Progress',icon:TrendingUp},
            {id:'qr',label:'My QR',icon:QrCode},
          ] as const).map(t=>{
            const Icon = t.icon
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all', tab===t.id?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>
                <Icon size={14}/>{t.label}
              </button>
            )
          })}
        </div>

        {/* HOME */}
        {tab === 'home' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {(member.enrollments || []).length === 0 ? (
                <div className="card"><p className="text-dark-400 text-sm">No classes yet — ask front desk to get you started.</p></div>
              ) : (member.enrollments || []).map((e: any) => (
                <div key={e.id} className="card flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold text-sm">{e.class?.name}</div>
                    <div className="text-dark-500 text-xs">{e.class?.daysOfWeek?.length || 0}x/week{e.endDate ? ` · until ${new Date(e.endDate).toLocaleDateString()}` : ''}</div>
                  </div>
                  <span className={cn('badge text-xs', statusColors[e.status]||'')}>{e.status}</span>
                </div>
              ))}
            </div>
            <div className="card"><div className="text-dark-400 text-xs mb-1">Sessions</div><div className="font-display text-3xl text-primary-400">{recentAttendance?.filter((a:any)=>a.status==='ATTENDED').length || 0}</div><div className="text-dark-500 text-xs">recent attended</div></div>
            {daysLeft !== null && daysLeft <= 14 && daysLeft > 0 && (
              <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-4">
                <p className="text-orange-300 text-sm font-semibold">⚠️ A plan is expiring in {daysLeft} days</p>
                <p className="text-dark-400 text-xs mt-1">Contact the gym to renew</p>
              </div>
            )}
            <div className="card">
              <h3 className="text-white font-semibold mb-3 text-sm">Recent Attendance</h3>
              {!recentAttendance || recentAttendance.length === 0 ? <p className="text-dark-500 text-sm">No sessions recorded yet</p>
              : recentAttendance.slice(0,5).map((a:any) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-dark-700 last:border-0">
                  <CheckCircle2 size={14} className={cn('flex-shrink-0', a.status === 'ATTENDED' ? 'text-primary-400' : a.status === 'EXCUSED' ? 'text-blue-400' : 'text-crimson-400')}/>
                  <span className="text-dark-300 text-sm flex-1">{a.class?.name}</span>
                  <span className="text-dark-500 text-xs">{new Date(a.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 className="text-white font-semibold mb-1 text-sm flex items-center gap-2"><MessageSquare size={15} className="text-primary-400"/> Contact Administration</h3>
              <p className="text-dark-500 text-xs mb-3">Send a message to the front desk — they'll follow up with you.</p>
              <textarea value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)} rows={3}
                placeholder="Write your message…" className="input resize-none w-full" />
              <button onClick={submitFeedback} disabled={sendingFeedback || !feedbackMsg.trim()}
                className="btn-primary mt-2 w-full justify-center disabled:opacity-50">
                <Send size={14}/> {sendingFeedback ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* CLASSES */}
        {tab === 'classes' && (
          <div className="space-y-3">
            <h3 className="text-white font-semibold">Your Class Schedule</h3>
            {(member.enrollments || []).length === 0 ? <div className="card text-center py-10 text-dark-400">Not signed into any classes yet</div>
            : member.enrollments.map((e:any)=>(
              <div key={e.id} className="card" style={{borderLeftColor:e.class?.color||'#ffc700',borderLeftWidth:3}}>
                <button className="w-full flex items-center gap-4 text-left" onClick={() => setOpenCalendarFor(openCalendarFor === e.id ? null : e.id)}>
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm">{e.class?.name}</div>
                    <div className="text-dark-400 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                      <Clock size={10}/>{e.class?.startTimeOfDay} · {e.class?.duration}min
                      <span>·</span><span>{(e.class?.daysOfWeek || []).join('/')}</span>
                      {e.class?.coach && <><span>·</span><span>Coach {e.class.coach.firstName} {e.class.coach.lastName}</span></>}
                    </div>
                  </div>
                  <span className={cn('badge text-xs flex-shrink-0', statusColors[e.status]||'')}>{e.status}</span>
                </button>
                {e.sessions && (
                  <button onClick={() => setOpenCalendarFor(openCalendarFor === e.id ? null : e.id)} className="text-primary-400 text-xs mt-2 flex items-center gap-1">
                    {e.sessions.attended} attended · {e.sessions.remaining} remaining — {openCalendarFor === e.id ? 'hide' : 'view'} sessions calendar
                  </button>
                )}
                {openCalendarFor === e.id && e.sessions && (
                  <div className="mt-3 pt-3 border-t border-dark-700 space-y-1.5 max-h-64 overflow-y-auto">
                    {e.sessions.sessions.length === 0 ? <p className="text-dark-500 text-xs">No sessions scheduled yet.</p> :
                      e.sessions.sessions.map((s: any, i: number) => {
                        const badge = s.status === 'ATTENDED' ? 'text-primary-400 bg-primary-400/10 border-primary-400/20'
                          : s.status === 'EXCUSED' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                          : s.status === 'UPCOMING' ? 'text-dark-400 bg-dark-700 border-dark-600'
                          : 'text-crimson-400 bg-crimson-400/10 border-crimson-400/20'
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-dark-750 border border-dark-700">
                            <span className="text-white text-xs">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span className={cn('badge text-xs', badge)}>{s.status === 'MISSED' ? 'Absent' : s.status.charAt(0) + s.status.slice(1).toLowerCase()}</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WORKOUT */}
        {tab === 'workout' && (
          <div className="space-y-4">
            {!member.workoutPlans?.length ? (
              <div className="card text-center py-12">
                <Dumbbell size={40} className="mx-auto text-dark-600 mb-3"/>
                <p className="text-white font-semibold mb-1">No workout plan assigned yet</p>
                <p className="text-dark-400 text-sm">Ask your coach to create a plan for you</p>
              </div>
            ) : member.workoutPlans.map((plan:any)=>(
              <div key={plan.id} className="space-y-3">
                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-primary-400/10 rounded-xl flex items-center justify-center"><Target size={16} className="text-primary-400"/></div>
                    <div><div className="text-white font-semibold">{plan.title}</div><div className="text-dark-400 text-xs">{plan.goal} · {plan.weeks} weeks</div></div>
                  </div>
                  {plan.description && <p className="text-dark-400 text-sm">{plan.description}</p>}
                </div>
                {[1,2,3,4,5,6,7].map(day=>{
                  const dayExercises = plan.exercises.filter((ex:any)=>ex.day===day)
                  if(!dayExercises.length) return null
                  const dayNames = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
                  return (
                    <div key={day} className="card">
                      <h4 className="text-primary-400 text-sm font-semibold mb-3">{dayNames[day]}</h4>
                      <div className="space-y-2">
                        {dayExercises.map((ex:any)=>(
                          <div key={ex.id} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                            <span className="text-white text-sm">{ex.name}</span>
                            <span className="text-dark-400 text-xs">{ex.sets} × {ex.reps} · {ex.rest}s rest</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* PROGRESS */}
        {tab === 'progress' && (
          <div className="space-y-4">
            <form onSubmit={addProgress} className="card space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2"><Plus size={16} className="text-primary-400"/>Log Today&apos;s Measurements</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label text-xs">Weight (kg)</label><input type="number" value={progressForm.weight} onChange={e=>setProgressForm(f=>({...f,weight:e.target.value}))} step={0.1} className="input text-sm py-2" placeholder="75.5"/></div>
                <div><label className="label text-xs">Body Fat %</label><input type="number" value={progressForm.bodyFat} onChange={e=>setProgressForm(f=>({...f,bodyFat:e.target.value}))} step={0.1} className="input text-sm py-2" placeholder="18.5"/></div>
                <div><label className="label text-xs">Waist (cm)</label><input type="number" value={progressForm.waist} onChange={e=>setProgressForm(f=>({...f,waist:e.target.value}))} step={0.5} className="input text-sm py-2" placeholder="80"/></div>
              </div>
              <input value={progressForm.notes} onChange={e=>setProgressForm(f=>({...f,notes:e.target.value}))} className="input text-sm" placeholder="Notes (e.g. felt strong today)"/>
              <button type="submit" className="btn-primary w-full justify-center text-sm">Save Measurements</button>
            </form>

            {member.progress?.length > 0 && (
              <div className="card">
                <h3 className="text-white font-semibold mb-3">Progress History</h3>
                <div className="space-y-3">
                  {member.progress.map((p:any, i:number)=>(
                    <div key={p.id} className="flex items-start gap-3 pb-3 border-b border-dark-700 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-primary-400/10 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">{member.progress.length-i}</div>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-3 text-sm">
                          {p.weight && <span className="text-white">{p.weight}kg</span>}
                          {p.bodyFat && <span className="text-dark-300">{p.bodyFat}% BF</span>}
                          {p.waist && <span className="text-dark-300">{p.waist}cm waist</span>}
                        </div>
                        {p.notes && <p className="text-dark-500 text-xs mt-0.5">{p.notes}</p>}
                        <p className="text-dark-600 text-xs mt-0.5">{formatDate(p.recordedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR CODE */}
        {tab === 'qr' && (
          <div className="space-y-4">
            <div className="card text-center py-8">
              <h3 className="text-white font-semibold mb-2">Your Check-in QR Code</h3>
              <p className="text-dark-400 text-sm mb-6">Show this at the gym entrance</p>
              <div className="inline-block p-4 bg-white rounded-2xl mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* eslint-disable-next-line @next/next/no-img-element */}

                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('vance:checkin:'+member.id)+'&bgcolor=ffffff&color=000000'}`}
                  alt="QR Code" width={180} height={180}
                  className="rounded-xl"
                />
              </div>
              <div className="bg-dark-700 rounded-xl px-4 py-2 inline-block">
                <p className="text-primary-400 font-mono text-sm">{member.firstName} {member.lastName}</p>
                <p className="text-dark-500 text-xs font-mono">ID: {member.fighterId}</p>
              </div>
            </div>
            <div className="border border-dark-600 rounded-xl p-4 text-sm text-dark-400">
              <p className="font-semibold text-white mb-1">How to use</p>
              <p>Show this QR code to gym staff or scan it at the self-check-in kiosk at the entrance. Each scan logs your visit automatically.</p>
            </div>
          </div>
        )}
      </div>

      {/* Profile photo lightbox */}
      <AnimatePresence>
        {photoZoom && member.photo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => setPhotoZoom(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-lg w-full">
              <button onClick={() => setPhotoZoom(false)} className="absolute -top-10 right-0 text-white/80 hover:text-white"><X size={24}/></button>
              <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} className="w-full h-auto rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
