'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Plus, MapPin, Phone, Mail, Users, TrendingUp,
  ToggleLeft, Trash2, X, ChevronRight, ArrowLeft, Activity,
  Calendar, DollarSign, UserCheck
} from 'lucide-react'
import { cn, formatCurrency, formatDate, membershipColors, getInitials } from '@/lib/utils'
import { DISCIPLINE_CATEGORIES, DISCIPLINE_SHORT } from '@/lib/categories'
import toast from 'react-hot-toast'

interface BranchStats { members:number; activeMembers:number; expiredMembers:number; classes:number; totalRevenue:number }
interface Branch { id:string; name:string; address?:string; phone?:string; email?:string; manager?:string; sports?:string[]; isActive:boolean; createdAt:string; stats:BranchStats }
interface Network { totalMembers:number; totalRevenue:number; unassigned:number }

export default function BranchesPage() {
  const [branches, setBranches]  = useState<Branch[]>([])
  const [network, setNetwork]    = useState<Network | null>(null)
  const [loading, setLoading]    = useState(true)
  const [showForm, setShowForm]  = useState(false)
  const [selected, setSelected]  = useState<string | null>(null)  // branch id for detail
  const [detail, setDetail]      = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form, setForm] = useState<{ name:string; address:string; phone:string; email:string; manager:string; sports:string[] }>({ name:'', address:'', phone:'', email:'', manager:'', sports:[] })

  function load() {
    setLoading(true)
    fetch('/api/branches').then(r=>r.json()).then(d=>{
      setBranches(Array.isArray(d.branches) ? d.branches : [])
      setNetwork(d.network || null)
      setLoading(false)
    }).catch(()=>setLoading(false))
  }

  useEffect(()=>{ load() },[])

  async function openBranch(id: string) {
    setSelected(id); setDetailLoading(true)
    const res = await fetch(`/api/branches?id=${id}`)
    if(res.ok) setDetail(await res.json())
    setDetailLoading(false)
  }

  async function addBranch(e:React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/branches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    if(res.ok){ toast.success('Branch added!'); setShowForm(false); setForm({name:'',address:'',phone:'',email:'',manager:'',sports:[]}); load() }
    else toast.error('Failed')
  }

  async function toggleActive(branch:Branch) {
    await fetch(`/api/branches?id=${branch.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:!branch.isActive})})
    toast.success(branch.isActive?'Branch deactivated':'Branch activated'); load()
    if(selected===branch.id) openBranch(branch.id)
  }

  async function deleteBranch(branch:Branch) {
    if(!window.confirm(`Delete "${branch.name}"? Fighters and classes will be unassigned but not deleted.`)) return
    await fetch(`/api/branches?id=${branch.id}`,{method:'DELETE'})
    toast.success('Branch deleted'); setSelected(null); setDetail(null); load()
  }

  const activeBranches = branches.filter(b=>b.isActive)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">BRANCHES</h1>
          <p className="text-dark-300 text-sm mt-1">Each branch has its own members, classes, revenue, and staff</p>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-primary"><Plus size={16}/> Add Branch</button>
      </div>

      {/* Network overview */}
      {network && (
        <div className="bg-gradient-to-r from-primary-400/10 to-primary-400/5 border border-primary-400/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-primary-400/20 rounded-xl flex items-center justify-center"><TrendingUp size={18} className="text-primary-400"/></div>
            <div><h3 className="text-white font-semibold">Network Overview</h3><p className="text-dark-400 text-xs">All branches combined</p></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div><div className="font-display text-4xl text-white">{branches.length}</div><div className="text-dark-400 text-xs mt-0.5">Total Branches</div></div>
            <div><div className="font-display text-4xl text-primary-400">{activeBranches.length}</div><div className="text-dark-400 text-xs mt-0.5">Active</div></div>
            <div><div className="font-display text-4xl text-blue-400">{network.totalMembers}</div><div className="text-dark-400 text-xs mt-0.5">Active Fighters (all branches)</div></div>
            <div><div className="font-display text-4xl text-primary-400">{formatCurrency(network.totalRevenue)}</div><div className="text-dark-400 text-xs mt-0.5">Total Revenue (all time)</div></div>
          </div>
          {network.unassigned > 0 && (
            <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-300">
              ⚠️ {network.unassigned} fighters are not assigned to any branch. Assign them from the Fighters page.
            </div>
          )}
        </div>
      )}

      {/* Branch cards */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_,i)=><div key={i} className="h-52 skeleton rounded-2xl"/>)}
        </div>
      ) : branches.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 size={48} className="mx-auto text-dark-600 mb-4"/>
          <p className="text-white font-semibold mb-1">No branches yet</p>
          <p className="text-dark-400 text-sm max-w-sm mx-auto">Add your first branch to start tracking separate locations with their own real data.</p>
          <button onClick={()=>setShowForm(true)} className="btn-primary mt-4 mx-auto">Add Branch</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch,i)=>(
            <motion.div key={branch.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
              onClick={()=>openBranch(branch.id)}
              className="card-hover group cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-primary-400/10 border border-primary-400/20 rounded-xl flex items-center justify-center">
                  <Building2 size={18} className="text-primary-400"/>
                </div>
                <span className={cn('badge text-xs',branch.isActive?'text-primary-400 bg-primary-400/10 border-primary-400/20':'text-red-400 bg-red-400/10 border-red-400/20')}>
                  {branch.isActive?'Active':'Inactive'}
                </span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">{branch.name}</h3>
              {branch.address && <p className="text-dark-400 text-xs mb-3 flex items-start gap-1"><MapPin size={11} className="mt-0.5 flex-shrink-0"/>{branch.address}</p>}
              {branch.manager && <p className="text-dark-400 text-xs mb-3">👤 {branch.manager}</p>}
              {branch.sports && branch.sports.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {branch.sports.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-crimson-400/10 text-crimson-300 border border-crimson-400/20">{DISCIPLINE_SHORT[s] || s}</span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4 pt-3 border-t border-dark-700">
                <div className="bg-dark-700 rounded-lg p-2 text-center">
                  <div className="font-display text-xl text-primary-400">{branch.stats.activeMembers}</div>
                  <div className="text-dark-500 text-xs">Active Fighters</div>
                </div>
                <div className="bg-dark-700 rounded-lg p-2 text-center">
                  <div className="font-display text-xl text-white">{formatCurrency(branch.stats.totalRevenue)}</div>
                  <div className="text-dark-500 text-xs">Total Revenue</div>
                </div>
                <div className="bg-dark-700 rounded-lg p-2 text-center">
                  <div className="font-display text-xl text-blue-400">{branch.stats.classes}</div>
                  <div className="text-dark-500 text-xs">Classes</div>
                </div>
                <div className="bg-dark-700 rounded-lg p-2 text-center">
                  <div className="font-display text-xl text-purple-400">{branch.stats.members}</div>
                  <div className="text-dark-500 text-xs">All Fighters</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-primary-400 text-xs group-hover:underline">View Details →</span>
                <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>toggleActive(branch)} className="p-1.5 rounded hover:bg-dark-600 text-dark-500 hover:text-white transition-all" title={branch.isActive?'Deactivate':'Activate'}>
                    <ToggleLeft size={14}/>
                  </button>
                  <button onClick={()=>deleteBranch(branch)} className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-dark-600 transition-all">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Branch Detail Side Panel */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={()=>{setSelected(null);setDetail(null)}}/>
            <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}
              className="w-full max-w-lg bg-dark-900 border-l border-dark-700 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-400/10 rounded-xl flex items-center justify-center"><Building2 size={16} className="text-primary-400"/></div>
                  <div>
                    <div className="text-white font-semibold">{detail?.branch?.name || '—'}</div>
                    <div className="text-dark-400 text-xs">{detail?.branch?.address || 'No address'}</div>
                  </div>
                </div>
                <button onClick={()=>{setSelected(null);setDetail(null)}} className="p-2 rounded-lg hover:bg-dark-800 text-dark-400"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {detailLoading ? (
                  [...Array(4)].map((_,i)=><div key={i} className="h-16 skeleton rounded-xl"/>)
                ) : detail ? (
                  <>
                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {icon:Users,     label:'Active Fighters', value:detail.stats.activeMembers,     color:'text-primary-400'},
                        {icon:DollarSign,label:'This Month',     value:formatCurrency(detail.stats.revenueThisMonth), color:'text-primary-400'},
                        {icon:Calendar,  label:'Classes',        value:detail.stats.classes,           color:'text-blue-400'},
                        {icon:UserCheck, label:'Expired',        value:detail.stats.expiredMembers,    color:'text-crimson-400'},
                      ].map(s=>{const Icon=s.icon; return (
                        <div key={s.label} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                          <Icon size={14} className={cn('mb-2',s.color)}/>
                          <div className={cn('font-display text-2xl mb-0.5',s.color)}>{s.value}</div>
                          <div className="text-dark-500 text-xs">{s.label}</div>
                        </div>
                      )})}
                    </div>

                    {/* Revenue sparkline */}
                    {detail.revenueMonths?.length > 0 && (
                      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                        <p className="text-dark-400 text-xs mb-3 uppercase tracking-widest font-mono">Revenue (6 months)</p>
                        <div className="flex items-end gap-1.5 h-16">
                          {detail.revenueMonths.map((m:any)=>{
                            const max = Math.max(...detail.revenueMonths.map((x:any)=>x.revenue),1)
                            const pct = Math.round((m.revenue/max)*100)
                            return (
                              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                                <div className="w-full bg-dark-700 rounded-sm overflow-hidden" style={{height:'52px'}}>
                                  <div className="w-full bg-primary-400/60 group-hover:bg-primary-400 rounded-sm transition-colors"
                                    style={{height:`${pct}%`,marginTop:`${100-pct}%`}}/>
                                </div>
                                <span className="text-dark-600 text-xs">{m.month}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2 text-right text-primary-400 font-bold text-sm">
                          Total: {formatCurrency(detail.stats.totalRevenue)}
                        </div>
                      </div>
                    )}

                    {/* Membership breakdown */}
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                      <p className="text-dark-400 text-xs mb-3 uppercase tracking-widest font-mono">Fighter Status</p>
                      <div className="space-y-2">
                        {[
                          {label:'Active',  value:detail.stats.activeMembers,  color:'bg-primary-400'},
                          {label:'Expired', value:detail.stats.expiredMembers, color:'bg-red-400'},
                          {label:'Total',   value:detail.stats.members,        color:'bg-dark-500'},
                        ].map(s=>{
                          const pct = detail.stats.members>0 ? Math.round((s.value/detail.stats.members)*100) : 0
                          return (
                            <div key={s.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-dark-400">{s.label}</span>
                                <span className="text-white font-medium">{s.value} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full',s.color)} style={{width:`${pct}%`}}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Recent fighters */}
                    {detail.recentMembers?.length > 0 && (
                      <div>
                        <p className="text-dark-400 text-xs mb-2 uppercase tracking-widest font-mono">Recent Fighters</p>
                        <div className="space-y-2">
                          {detail.recentMembers.map((m:any)=>{
                            const st = m.enrollments?.some((e:any)=>e.status==='ACTIVE') ? 'ACTIVE' : m.enrollments?.some((e:any)=>e.status==='FROZEN') ? 'FROZEN' : m.enrollments?.some((e:any)=>e.status==='EXPIRED') ? 'EXPIRED' : 'NO_PLAN'
                            return (
                            <div key={m.id} className="flex items-center gap-3 bg-dark-800 rounded-xl p-3">
                              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
                                {getInitials(`${m.firstName} ${m.lastName}`)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm">{m.firstName} {m.lastName}</div>
                                <div className="text-dark-500 text-xs">{m.enrollments?.[0]?.class?.name || 'No class'} · {formatDate(m.createdAt)}</div>
                              </div>
                              <span className={cn('badge text-xs',membershipColors[st])}>{st === 'NO_PLAN' ? 'No Plan' : st}</span>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}

                    {/* Contact info */}
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
                      {detail.branch.phone && <div className="flex items-center gap-2 text-sm text-dark-300"><Phone size={13}/>{detail.branch.phone}</div>}
                      {detail.branch.email && <div className="flex items-center gap-2 text-sm text-dark-300"><Mail size={13}/>{detail.branch.email}</div>}
                      {detail.branch.manager && <div className="flex items-center gap-2 text-sm text-dark-300"><Users size={13}/>Manager: {detail.branch.manager}</div>}
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Branch Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD BRANCH</h2>
                <button onClick={()=>setShowForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <form onSubmit={addBranch} className="space-y-4">
                <div><label className="label">Branch Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required className="input" placeholder="e.g. Downtown Branch"/></div>
                <div><label className="label">Address</label><input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="input" placeholder="123 Main St, City"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="input"/></div>
                  <div><label className="label">Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input"/></div>
                </div>
                <div><label className="label">Branch Manager</label><input value={form.manager} onChange={e=>setForm(f=>({...f,manager:e.target.value}))} className="input" placeholder="Manager name"/></div>
                <div>
                  <label className="label">Sports Offered</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                    {DISCIPLINE_CATEGORIES.filter(c => c !== 'OTHER').map(cat => (
                      <label key={cat} className={cn('flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-colors',
                        form.sports.includes(cat) ? 'bg-primary-400/10 border-primary-400/30 text-primary-400' : 'border-dark-600 text-dark-300 hover:border-dark-500')}>
                        <input type="checkbox" checked={form.sports.includes(cat)} className="accent-primary-400"
                          onChange={e => setForm(f => ({ ...f, sports: e.target.checked ? [...f.sports, cat] : f.sports.filter(s => s !== cat) }))} />
                        {DISCIPLINE_SHORT[cat]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bg-primary-400/5 border border-primary-400/20 rounded-xl p-3 text-xs text-primary-400">
                  After adding a branch, assign fighters to it from the Fighters page and classes from the Classes page.
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Branch</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
