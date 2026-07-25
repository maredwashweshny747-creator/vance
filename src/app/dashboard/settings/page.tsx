'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, User, Users, Plus, Trash2, Eye, EyeOff, X, ShieldCheck, Shield, DollarSign, Swords, Pencil } from 'lucide-react'
import { cn, getInitials, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface GymSettings { name: string; address: string; phone: string; email: string; currency: string; timezone: string }
interface TeamAccount { id: string; name: string; email: string; role: string; createdAt: string; coach?: { sessionRate: number; specialties?: string } | null }
interface Plan { id: string; name: string; sessionsPerWeek: number; price: number; durationDays: number; description?: string; isActive: boolean }

export default function SettingsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'ADMIN'
  const isAdmin = role === 'ADMIN'

  const [tab, setTab] = useState<'gym'|'plans'|'team'>('gym')
  const [gymData, setGymData] = useState<GymSettings>({ name:'', address:'', phone:'', email:'', currency:'USD', timezone:'UTC' })
  const [team, setTeam] = useState<TeamAccount[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [saving, setSaving] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [teamForm, setTeamForm] = useState({ name:'', email:'', password:'', role:'RECEPTIONIST', sessionRate:20, specialties:'' })
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan|null>(null)
  const [planForm, setPlanForm] = useState({ name:'', sessionsPerWeek:3, price:59, durationDays:30, description:'', isActive:true, unlimited:false })

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d && !d.error) setGymData({ name: d.name||'', address: d.address||'', phone: d.phone||'', email: d.email||'', currency: d.currency||'USD', timezone: d.timezone||'UTC' })
    }).catch(() => {})
    loadPlans()
    if (isAdmin) {
      fetch('/api/staff-accounts').then(r => r.json()).then(d => { if (Array.isArray(d)) setTeam(d) }).catch(() => {})
    }
  }, [isAdmin])

  function loadPlans() {
    fetch('/api/membership-plans').then(r => r.json()).then(d => { if (Array.isArray(d)) setPlans(d) }).catch(() => {})
  }

  async function saveGym(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/settings', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(gymData) })
    setSaving(false)
    if (res.ok) { toast.success('Settings saved!') } else { toast.error('Failed to save') }
  }

  async function addTeamMember(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/staff-accounts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(teamForm) })
    const data = await res.json()
    if (res.ok) {
      toast.success(`${teamForm.role === 'COACH' ? 'Coach' : 'Receptionist'} account created for ${teamForm.name}`)
      setTeam(prev => [data, ...prev])
      setShowAddTeam(false)
      setTeamForm({ name:'', email:'', password:'', role:'RECEPTIONIST', sessionRate:20, specialties:'' })
    } else toast.error(data.error || 'Failed')
  }

  async function removeTeamMember(id: string, name: string) {
    if (!window.confirm(`Remove ${name}'s access? They will no longer be able to log in.`)) return
    const res = await fetch(`/api/staff-accounts?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Account removed'); setTeam(s => s.filter(x => x.id !== id)) }
    else toast.error('Failed')
  }

  function openPlanForm(plan?: Plan) {
    if (plan) {
      setEditingPlan(plan)
      setPlanForm({ name: plan.name, sessionsPerWeek: plan.sessionsPerWeek || 3, price: plan.price, durationDays: plan.durationDays, description: plan.description || '', isActive: plan.isActive, unlimited: plan.sessionsPerWeek === 0 })
    } else {
      setEditingPlan(null)
      setPlanForm({ name:'', sessionsPerWeek:3, price:59, durationDays:30, description:'', isActive:true, unlimited:false })
    }
    setShowPlanForm(true)
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...planForm, sessionsPerWeek: planForm.unlimited ? 0 : planForm.sessionsPerWeek }
    const res = editingPlan
      ? await fetch(`/api/membership-plans?id=${editingPlan.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      : await fetch('/api/membership-plans', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    if (res.ok) { toast.success(editingPlan ? 'Plan updated' : 'Plan created'); setShowPlanForm(false); loadPlans() }
    else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to save plan') }
  }

  async function deletePlan(plan: Plan) {
    if (!window.confirm(`Delete "${plan.name}"? Members can't be assigned to a deleted plan.`)) return
    const res = await fetch(`/api/membership-plans?id=${plan.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Plan deleted'); loadPlans() }
    else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to delete') }
  }

  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-dark-600 mb-4"/>
          <h2 className="font-display text-2xl text-white mb-2">Admin Only</h2>
          <p className="text-dark-400 text-sm">Settings can only be accessed by the club administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-4xl tracking-wider text-white">SETTINGS</h1>
        <p className="text-dark-300 text-sm mt-1">Manage your club profile, membership plans, and team access</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('gym')} className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all', tab==='gym'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>
          <Settings size={14}/> Club Profile
        </button>
        <button onClick={() => setTab('plans')} className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all', tab==='plans'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>
          <DollarSign size={14}/> Membership Plans <span className="ml-1 bg-dark-700 text-dark-300 text-xs px-1.5 py-0.5 rounded-full">{plans.length}</span>
        </button>
        <button onClick={() => setTab('team')} className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all', tab==='team'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>
          <Users size={14}/> Team Access <span className="ml-1 bg-dark-700 text-dark-300 text-xs px-1.5 py-0.5 rounded-full">{team.length}</span>
        </button>
      </div>

      {/* Club Profile */}
      {tab === 'gym' && (
        <form onSubmit={saveGym} className="card space-y-5">
          <h2 className="font-semibold text-white flex items-center gap-2"><User size={16} className="text-primary-400"/> Club Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Club Name</label><input value={gymData.name} onChange={e=>setGymData(d=>({...d,name:e.target.value}))} className="input" placeholder="Blackout Fight Club"/></div>
            <div className="col-span-2"><label className="label">Address</label><input value={gymData.address} onChange={e=>setGymData(d=>({...d,address:e.target.value}))} className="input" placeholder="123 Fight St, New York"/></div>
            <div><label className="label">Phone</label><input value={gymData.phone} onChange={e=>setGymData(d=>({...d,phone:e.target.value}))} className="input" placeholder="+1 555-0000"/></div>
            <div><label className="label">Email</label><input type="email" value={gymData.email} onChange={e=>setGymData(d=>({...d,email:e.target.value}))} className="input" placeholder="club@example.com"/></div>
            <div><label className="label">Currency</label>
              <select value={gymData.currency} onChange={e=>setGymData(d=>({...d,currency:e.target.value}))} className="input">
                <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option><option value="EGP">EGP (E£)</option>
                <option value="AED">AED (د.إ)</option><option value="SAR">SAR (﷼)</option>
              </select>
            </div>
            <div><label className="label">Timezone</label>
              <select value={gymData.timezone} onChange={e=>setGymData(d=>({...d,timezone:e.target.value}))} className="input">
                <option value="UTC">UTC</option><option value="America/New_York">New York (ET)</option>
                <option value="America/Chicago">Chicago (CT)</option><option value="America/Los_Angeles">Los Angeles (PT)</option>
                <option value="Europe/London">London (GMT)</option><option value="Europe/Paris">Paris (CET)</option>
                <option value="Africa/Cairo">Cairo (EET)</option><option value="Asia/Dubai">Dubai (GST)</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Membership Plans */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Membership Plans</h2>
              <p className="text-dark-400 text-xs mt-0.5">Session-based plans, e.g. 3x/week. Charged automatically when a member is added or renews.</p>
            </div>
            <button onClick={() => openPlanForm()} className="btn-primary text-sm flex-shrink-0"><Plus size={14}/> Add Plan</button>
          </div>

          {plans.length === 0 ? (
            <div className="card text-center py-10">
              <DollarSign size={36} className="mx-auto text-dark-600 mb-3"/>
              <p className="text-white font-semibold mb-1">No plans yet</p>
              <p className="text-dark-400 text-sm">Create your first membership plan, e.g. &quot;Contender — 3x/week&quot;</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {plans.map(p => (
                <div key={p.id} className="card-hover group">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-display text-xl text-white tracking-wide">{p.name.toUpperCase()}</h3>
                      <p className="text-primary-400 text-xs font-semibold">{p.sessionsPerWeek === 0 ? 'Unlimited sessions' : `${p.sessionsPerWeek} sessions / week`}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => openPlanForm(p)} className="p-1.5 rounded-lg hover:bg-dark-600 text-dark-400 hover:text-white"><Pencil size={13}/></button>
                      <button onClick={() => deletePlan(p)} className="p-1.5 rounded-lg hover:bg-crimson-500/10 text-dark-500 hover:text-crimson-400"><Trash2 size={13}/></button>
                    </div>
                  </div>
                  {p.description && <p className="text-dark-400 text-xs mb-3">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-display text-white">{formatCurrency(p.price)}</span>
                    <span className={cn('badge text-xs', p.isActive ? 'text-primary-400 bg-primary-400/10 border-primary-400/20' : 'text-dark-400 bg-dark-700 border-dark-600')}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-dark-500 text-xs mt-2">{p.durationDays}-day cycle</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Access */}
      {tab === 'team' && (
        <div className="space-y-4">
          <div className="card bg-primary-400/5 border-primary-400/20">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-primary-400 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-white font-semibold text-sm">Role Permissions</p>
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-primary-400 font-semibold mb-1">Admin (you)</p>
                    <p className="text-dark-300">Full access — every tab, payroll, branches, analytics, settings, class approvals</p>
                  </div>
                  <div>
                    <p className="text-blue-400 font-semibold mb-1">Receptionist</p>
                    <p className="text-dark-300">Members, Leads, Classes, Attendance, Payments, Store &amp; Inventory</p>
                  </div>
                  <div>
                    <p className="text-crimson-400 font-semibold mb-1">Coach</p>
                    <p className="text-dark-300">Dashboard, Attendance, and their own Classes &amp; private sessions — pending admin approval</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Receptionist &amp; Coach Accounts</h2>
            <button onClick={() => setShowAddTeam(true)} className="btn-primary text-sm"><Plus size={14}/> Add Team Member</button>
          </div>

          {team.length === 0 ? (
            <div className="card text-center py-10">
              <Users size={36} className="mx-auto text-dark-600 mb-3"/>
              <p className="text-white font-semibold mb-1">No team accounts yet</p>
              <p className="text-dark-400 text-sm">Add receptionists for your front desk, or coaches to run classes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {team.map(s => {
                const isCoachAcct = s.role === 'COACH'
                return (
                  <div key={s.id} className="card-hover flex items-center gap-4 group">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 border',
                      isCoachAcct ? 'bg-crimson-400/10 border-crimson-400/20 text-crimson-400' : 'bg-blue-400/10 border-blue-400/20 text-blue-400')}>
                      {isCoachAcct ? <Swords size={16}/> : getInitials(s.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{s.name}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border', isCoachAcct ? 'bg-crimson-400/10 text-crimson-400 border-crimson-400/20' : 'bg-blue-400/10 text-blue-400 border-blue-400/20')}>
                          {isCoachAcct ? 'Coach' : 'Receptionist'}
                        </span>
                        {isCoachAcct && s.coach && <span className="text-xs text-dark-400">{formatCurrency(s.coach.sessionRate)}/session</span>}
                      </div>
                      <div className="text-dark-400 text-xs">{s.email}</div>
                    </div>
                    <div className="text-dark-600 text-xs flex-shrink-0">
                      Added {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                    <button onClick={() => removeTeamMember(s.id, s.name)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-crimson-500/10 hover:text-crimson-400 text-dark-600 transition-all flex-shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Plan Modal */}
      <AnimatePresence>
        {showPlanForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl tracking-wider text-white">{editingPlan ? 'EDIT PLAN' : 'ADD PLAN'}</h2>
                <button onClick={()=>setShowPlanForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <form onSubmit={savePlan} className="space-y-4">
                <div><label className="label">Plan Name</label><input value={planForm.name} onChange={e=>setPlanForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="e.g. Contender"/></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="unlimited" checked={planForm.unlimited} onChange={e=>setPlanForm(f=>({...f,unlimited:e.target.checked}))} className="accent-primary-400"/>
                  <label htmlFor="unlimited" className="text-sm text-dark-300">Unlimited sessions</label>
                </div>
                {!planForm.unlimited && (
                  <div><label className="label">Sessions Per Week</label><input type="number" min={1} value={planForm.sessionsPerWeek} onChange={e=>setPlanForm(f=>({...f,sessionsPerWeek:+e.target.value}))} className="input"/></div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Price ({gymData.currency})</label><input type="number" min={0} step={0.01} value={planForm.price} onChange={e=>setPlanForm(f=>({...f,price:+e.target.value}))} className="input"/></div>
                  <div><label className="label">Cycle Length (days)</label><input type="number" min={1} value={planForm.durationDays} onChange={e=>setPlanForm(f=>({...f,durationDays:+e.target.value}))} className="input"/></div>
                </div>
                <div><label className="label">Description (optional)</label><input value={planForm.description} onChange={e=>setPlanForm(f=>({...f,description:e.target.value}))} className="input" placeholder="e.g. Great for beginners easing in"/></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="planActive" checked={planForm.isActive} onChange={e=>setPlanForm(f=>({...f,isActive:e.target.checked}))} className="accent-primary-400"/>
                  <label htmlFor="planActive" className="text-sm text-dark-300">Active (visible when adding members)</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowPlanForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">{editingPlan ? 'Save Changes' : 'Create Plan'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Team Member Modal */}
      <AnimatePresence>
        {showAddTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl tracking-wider text-white">ADD TEAM MEMBER</h2>
                <button onClick={()=>setShowAddTeam(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <form onSubmit={addTeamMember} className="space-y-4">
                <div><label className="label">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setTeamForm(f=>({...f,role:'RECEPTIONIST'}))}
                      className={cn('py-2.5 rounded-lg text-sm font-medium border transition-all', teamForm.role==='RECEPTIONIST' ? 'bg-blue-400/10 border-blue-400/30 text-blue-400' : 'border-dark-600 text-dark-400')}>
                      Receptionist
                    </button>
                    <button type="button" onClick={()=>setTeamForm(f=>({...f,role:'COACH'}))}
                      className={cn('py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5', teamForm.role==='COACH' ? 'bg-crimson-400/10 border-crimson-400/30 text-crimson-400' : 'border-dark-600 text-dark-400')}>
                      <Swords size={13}/> Coach
                    </button>
                  </div>
                </div>
                <div><label className="label">Full Name</label><input value={teamForm.name} onChange={e=>setTeamForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="Dana Reyes"/></div>
                <div><label className="label">Email</label><input type="email" value={teamForm.email} onChange={e=>setTeamForm(f=>({...f,email:e.target.value}))} required className="input" placeholder="dana@yourclub.com"/></div>
                {teamForm.role === 'COACH' && (
                  <>
                    <div><label className="label">Rate Per Session ({gymData.currency})</label><input type="number" min={0} step={0.01} value={teamForm.sessionRate} onChange={e=>setTeamForm(f=>({...f,sessionRate:+e.target.value}))} className="input"/></div>
                    <div><label className="label">Specialties (optional)</label><input value={teamForm.specialties} onChange={e=>setTeamForm(f=>({...f,specialties:e.target.value}))} className="input" placeholder="Boxing, Muay Thai"/></div>
                  </>
                )}
                <div><label className="label">Password</label>
                  <div className="relative">
                    <input type={showPw?'text':'password'} value={teamForm.password} onChange={e=>setTeamForm(f=>({...f,password:e.target.value}))} required minLength={8} className="input pr-10" placeholder="Min. 8 characters"/>
                    <button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white">
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <div className={cn('rounded-xl p-3 text-xs border', teamForm.role==='COACH' ? 'bg-crimson-400/5 border-crimson-400/20 text-crimson-300' : 'bg-blue-400/5 border-blue-400/20 text-blue-300')}>
                  {teamForm.role === 'COACH'
                    ? 'This account can log in to submit classes & private sessions (pending your approval) and mark attendance. Payroll, Members, Leads, Branches, Analytics and Settings stay hidden.'
                    : 'This account will have receptionist access: Members, Leads, Classes, Attendance, Payments, Store & Inventory. Payroll, Branches, Analytics and Settings stay hidden.'}
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={()=>setShowAddTeam(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Create Account</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
