'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, Plus, Search, Phone, Mail, MessageCircle, TrendingUp, UserCheck, Clock, AlertCircle, X, ChevronDown, Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUSES = ['NEW','CONTACTED','TRIAL','NEGOTIATING','CONVERTED','LOST']
const SOURCES = ['WALK_IN','INSTAGRAM','WHATSAPP','WEBSITE','REFERRAL','OTHER']
const STATUS_COLORS: Record<string,string> = {
  NEW: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CONTACTED: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  TRIAL: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  NEGOTIATING: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  CONVERTED: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
  LOST: 'text-red-400 bg-red-400/10 border-red-400/20',
}
const SOURCE_ICONS: Record<string,string> = {
  WALK_IN:'🚶',INSTAGRAM:'📸',WHATSAPP:'💬',WEBSITE:'🌐',REFERRAL:'👥',OTHER:'📌'
}

interface Lead {
  id:string; firstName:string; lastName:string; email?:string; phone?:string
  source:string; status:string; assignedTo?:string; notes?:string
  trialStart?:string; trialEnd?:string; followUpAt?:string; createdAt:string
  interactions: { type:string; note:string; createdAt:string }[]
}
interface Stats { total:number; converted:number; trials:number; newLeads:number; followUpsDue:number; conversionRate:number }

const PIPELINE = ['NEW','CONTACTED','TRIAL','NEGOTIATING','CONVERTED']

export default function LeadsPage() {
  const [data, setData] = useState<{ leads: Lead[]; stats: Stats } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [view, setView] = useState<'pipeline'|'list'>('pipeline')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [interactionNote, setInteractionNote] = useState('')
  const [interactionType, setInteractionType] = useState('CALL')
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', source:'WALK_IN', status:'NEW', assignedTo:'', notes:'', followUpAt:'' })

  function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (filterStatus !== 'ALL') p.set('status', filterStatus)
    fetch(`/api/leads?${p}`).then(r=>r.json()).then(d=>{ setData(d); setLoading(false) }).catch(()=>setLoading(false))
  }
  useEffect(()=>{ load() },[search, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addLead(e:React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    if(res.ok){ toast.success('Lead added!'); setShowForm(false); load() }
    else { const d = await res.json().catch(()=>({})); toast.error(d.error || 'Failed to add lead') }
  }

  async function updateStatus(lead:Lead, status:string) {
    const body: any = { status }
    if(status === 'CONVERTED') body.convertedAt = new Date().toISOString()
    await fetch(`/api/leads?id=${lead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    toast.success('Status updated'); load()
    if(selected?.id === lead.id) setSelected(prev => prev ? {...prev, status} : null)
  }

  async function addInteraction() {
    if(!selected || !interactionNote.trim()) return
    await fetch(`/api/leads?id=${selected.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ interactionNote, interactionType }) })
    toast.success('Interaction logged'); setInteractionNote(''); load()
  }

  async function deleteLead(id:string) {
    await fetch(`/api/leads?id=${id}`, { method:'DELETE' })
    toast.success('Lead removed'); setSelected(null); load()
  }

  const leads = data?.leads || []
  const stats = data?.stats

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">LEADS & CRM</h1>
          <p className="text-dark-300 text-sm mt-1">Track potential fighters from first contact to conversion</p>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-primary"><Plus size={16}/> Add Lead</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label:'Total Leads', value: stats?.total ?? '—', color:'text-white' },
          { label:'New', value: stats?.newLeads ?? '—', color:'text-blue-400' },
          { label:'On Trial', value: stats?.trials ?? '—', color:'text-purple-400' },
          { label:'Converted', value: stats?.converted ?? '—', color:'text-primary-400' },
          { label:'Conversion Rate', value: stats ? `${stats.conversionRate}%` : '—', color:'text-primary-400' },
        ].map(s => (
          <div key={s.label} className="card text-center p-4">
            <div className={`font-display text-3xl mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-dark-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Follow-up alert */}
      {stats && stats.followUpsDue > 0 && (
        <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-orange-400 flex-shrink-0"/>
          <p className="text-orange-300 text-sm"><span className="font-bold">{stats.followUpsDue} lead{stats.followUpsDue>1?'s':''}</span> are overdue for follow-up. Check them below.</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search leads..." className="input pl-9"/></div>
        <div className="flex gap-2">
          <button onClick={()=>setView('pipeline')} className={cn('px-4 py-2 rounded-lg text-sm transition-all', view==='pipeline'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>Pipeline</button>
          <button onClick={()=>setView('list')} className={cn('px-4 py-2 rounded-lg text-sm transition-all', view==='list'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>List</button>
        </div>
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
          {PIPELINE.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage)
            return (
              <div key={stage} className="min-w-[180px]">
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('badge text-xs', STATUS_COLORS[stage])}>{stage}</span>
                  <span className="text-dark-500 text-xs font-mono">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map(lead => (
                    <motion.div key={lead.id} layout
                      onClick={()=>setSelected(lead)}
                      className="bg-dark-800 border border-dark-600 hover:border-primary-400/30 rounded-xl p-3 cursor-pointer transition-all">
                      <div className="text-white text-sm font-medium truncate">{lead.firstName} {lead.lastName}</div>
                      <div className="text-dark-400 text-xs mt-1 flex items-center gap-1">
                        <span>{SOURCE_ICONS[lead.source]}</span>
                        <span>{lead.source.replace('_',' ')}</span>
                      </div>
                      {lead.followUpAt && new Date(lead.followUpAt) <= new Date() && (
                        <div className="text-orange-400 text-xs mt-1 flex items-center gap-1"><Clock size={10}/> Follow-up due</div>
                      )}
                      {lead.phone && <div className="text-dark-500 text-xs mt-1 truncate">{lead.phone}</div>}
                    </motion.div>
                  ))}
                  {stageLeads.length === 0 && <div className="h-16 border-2 border-dashed border-dark-700 rounded-xl flex items-center justify-center text-dark-600 text-xs">Empty</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-dark-700"><tr>
                {['Name','Contact','Source','Status','Follow-up','Assigned To','Actions'].map(h=>(
                  <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-dark-700">
                {loading ? [...Array(4)].map((_,i)=><tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-6 skeleton rounded"/></td></tr>)
                : leads.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-dark-400">No leads found</td></tr>
                : leads.map(lead=>(
                  <tr key={lead.id} className="hover:bg-dark-750 transition-colors group cursor-pointer" onClick={()=>setSelected(lead)}>
                    <td className="px-5 py-4 text-white text-sm font-medium">{lead.firstName} {lead.lastName}</td>
                    <td className="px-5 py-4 text-dark-400 text-xs">
                      {lead.phone && <div className="flex items-center gap-1"><Phone size={10}/>{lead.phone}</div>}
                      {lead.email && <div className="flex items-center gap-1"><Mail size={10}/>{lead.email}</div>}
                    </td>
                    <td className="px-5 py-4 text-dark-300 text-sm">{SOURCE_ICONS[lead.source]} {lead.source.replace('_',' ')}</td>
                    <td className="px-5 py-4"><span className={cn('badge text-xs', STATUS_COLORS[lead.status])}>{lead.status}</span></td>
                    <td className="px-5 py-4 text-xs">
                      {lead.followUpAt ? (
                        <span className={new Date(lead.followUpAt)<=new Date() ? 'text-orange-400' : 'text-dark-400'}>
                          {formatDate(lead.followUpAt)}
                        </span>
                      ) : <span className="text-dark-600">—</span>}
                    </td>
                    <td className="px-5 py-4 text-dark-400 text-sm">{lead.assignedTo || '—'}</td>
                    <td className="px-5 py-4">
                      <button onClick={e=>{e.stopPropagation();deleteLead(lead.id)}}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-dark-600 transition-all">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD LEAD</h2>
                <button onClick={()=>setShowForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"><X size={18}/></button>
              </div>
              <form onSubmit={addLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">First Name</label><input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} required className="input"/></div>
                  <div><label className="label">Last Name</label><input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} required className="input"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="input" placeholder="+1 234 567 8900"/></div>
                  <div><label className="label">Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Source</label>
                    <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} className="input">
                      {SOURCES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Assigned To</label><input value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))} className="input" placeholder="Staff name"/></div>
                </div>
                <div><label className="label">Follow-up Date</label><input type="datetime-local" value={form.followUpAt} onChange={e=>setForm(f=>({...f,followUpAt:e.target.value}))} className="input"/></div>
                <div><label className="label">Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="input h-16 resize-none" placeholder="Any details about this lead..."/></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Lead</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lead Detail Side Panel */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="flex-1 bg-black/50" onClick={()=>setSelected(null)}/>
            <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:300}}
              className="w-full max-w-md bg-dark-900 border-l border-dark-700 flex flex-col overflow-y-auto">
              <div className="p-6 border-b border-dark-700 flex items-start justify-between">
                <div>
                  <h2 className="font-display text-2xl text-white">{selected.firstName} {selected.lastName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('badge text-xs',STATUS_COLORS[selected.status])}>{selected.status}</span>
                    <span className="text-dark-400 text-xs">{SOURCE_ICONS[selected.source]} {selected.source.replace('_',' ')}</span>
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {/* Contact */}
                <div className="space-y-2">
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors">
                      <Phone size={16} className="text-primary-400"/><span className="text-white text-sm">{selected.phone}</span>
                    </a>
                  )}
                  {selected.phone && (
                    <a href={`https://wa.me/${selected.phone.replace(/\D/g,'')}`} target="_blank"
                      className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors">
                      <MessageCircle size={16} className="text-green-400"/><span className="text-white text-sm">WhatsApp</span>
                    </a>
                  )}
                  {selected.email && (
                    <a href={`mailto:${selected.email}`} className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors">
                      <Mail size={16} className="text-blue-400"/><span className="text-white text-sm">{selected.email}</span>
                    </a>
                  )}
                </div>

                {/* Move status */}
                <div>
                  <p className="text-dark-400 text-xs mb-2 uppercase tracking-wider">Move to Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <button key={s} onClick={()=>updateStatus(selected,s)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border', selected.status===s ? STATUS_COLORS[s]+' font-bold' : 'border-dark-600 text-dark-400 hover:text-white hover:border-dark-500')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Log interaction */}
                <div>
                  <p className="text-dark-400 text-xs mb-2 uppercase tracking-wider">Log Interaction</p>
                  <div className="flex gap-2 mb-2">
                    {['CALL','MESSAGE','EMAIL','VISIT','NOTE'].map(t=>(
                      <button key={t} onClick={()=>setInteractionType(t)}
                        className={cn('px-2 py-1 rounded text-xs transition-all', interactionType===t?'bg-primary-400 text-dark-950 font-bold':'bg-dark-700 text-dark-400')}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={interactionNote} onChange={e=>setInteractionNote(e.target.value)} placeholder="What happened?" className="input flex-1 text-sm py-2"/>
                    <button onClick={addInteraction} className="btn-primary px-4 py-2 text-sm">Log</button>
                  </div>
                </div>

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <p className="text-dark-400 text-xs mb-2 uppercase tracking-wider">Notes</p>
                    <p className="text-dark-200 text-sm bg-dark-800 rounded-xl p-3">{selected.notes}</p>
                  </div>
                )}

                {/* Interactions log */}
                {selected.interactions && selected.interactions.length > 0 && (
                  <div>
                    <p className="text-dark-400 text-xs mb-2 uppercase tracking-wider">Recent Activity</p>
                    <div className="space-y-2">
                      {selected.interactions.map((int,i) => (
                        <div key={i} className="bg-dark-800 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-primary-400 font-medium">{int.type}</span>
                            <span className="text-dark-500 text-xs">{formatDate(int.createdAt)}</span>
                          </div>
                          <p className="text-dark-200 text-sm">{int.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-dark-700">
                <button onClick={()=>deleteLead(selected.id)} className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm">
                  Delete Lead
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
