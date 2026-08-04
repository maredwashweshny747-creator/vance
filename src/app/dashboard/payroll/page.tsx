'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Plus, Users, Printer, Check, X, Trash2, ChevronLeft, ChevronRight, RefreshCw, Swords } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Staff { id:string; firstName:string; lastName:string; email:string; role:string; salary:number; salaryType:string; isActive:boolean }
interface PayrollRun { id:string; staffId:string; month:number; year:number; baseSalary:number; commission:number; bonus:number; deductions:number; total:number; status:string; paidAt?:string; notes?:string; staff:Staff }
interface CoachRow { coachId:string; firstName:string; lastName:string; sessionRate:number; privateSessionRate:number; sessionCount:number; privateSessionCount:number; liveSessionCount:number; livePrivateSessionCount:number; totalPlayersAttended:number; runId:string|null; bonus:number; deductions:number; total:number; status:string; paidAt?:string; notes?:string }

const ROLES = ['STAFF','MANAGER']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function PayrollPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [coachRows, setCoachRows] = useState<CoachRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'payroll'|'coaches'|'staff'>('payroll')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [showPayrollForm, setShowPayrollForm] = useState(false)
  const [staffForm, setStaffForm] = useState({ firstName:'', lastName:'', email:'', phone:'', role:'STAFF', salary:0, salaryType:'MONTHLY' })
  const [payrollForm, setPayrollForm] = useState({ staffId:'', baseSalary:0, commission:0, bonus:0, deductions:0, notes:'' })

  function loadStaff() {
    fetch('/api/payroll?type=staff').then(r=>r.json()).then(d=>{ setStaff(Array.isArray(d)?d:[]); setLoading(false) })
  }
  function loadPayroll() {
    fetch(`/api/payroll?type=payroll&month=${month}&year=${year}`).then(r=>r.json()).then(d=>{ setRuns(Array.isArray(d)?d:[]); setLoading(false) })
  }
  function loadCoachRows() {
    fetch(`/api/payroll?type=coachPayroll&month=${month}&year=${year}`).then(r=>r.json()).then(d=>{ setCoachRows(Array.isArray(d)?d:[]); setLoading(false) })
  }

  useEffect(()=>{ loadStaff(); loadPayroll(); loadCoachRows() },[month, year]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addStaff(e:React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...staffForm, _type:'staff'}) })
    if(res.ok){ toast.success('Staff member added!'); setShowStaffForm(false); loadStaff() } else { toast.error('Failed') }
  }

  async function runPayroll(e:React.FormEvent) {
    e.preventDefault()
    const member = staff.find(s=>s.id===payrollForm.staffId)
    const body = { ...payrollForm, _type:'payroll', month, year, baseSalary: payrollForm.baseSalary || (member?.salary||0) }
    const res = await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    if(res.ok){ toast.success('Payroll entry created!'); setShowPayrollForm(false); loadPayroll() }
    else { const d=await res.json(); toast.error(d.error||'Failed — may already exist for this month') }
  }

  async function markPaid(runId:string) {
    const res = await fetch(`/api/payroll?id=${runId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_type:'markPaid'}) })
    if(res.ok){ toast.success('Marked as paid'); loadPayroll() }
  }

  async function deleteRun(id:string) {
    await fetch(`/api/payroll?id=${id}&type=payroll`, { method:'DELETE' })
    toast.success('Entry deleted'); loadPayroll()
  }

  async function generateCoachPayroll(coachId: string) {
    const res = await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ _type:'coachPayroll', coachId, month, year }) })
    if(res.ok){ toast.success('Coach payroll generated'); loadCoachRows() } else toast.error('Failed to generate')
  }

  async function markCoachPaid(runId: string) {
    const res = await fetch(`/api/payroll?id=${runId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_type:'markCoachPaid'}) })
    if(res.ok){ toast.success('Marked as paid'); loadCoachRows() }
  }

  const totalPending = runs.filter(r=>r.status==='PENDING').reduce((s,r)=>s+r.total,0)
  const totalPaid = runs.filter(r=>r.status==='PAID').reduce((s,r)=>s+r.total,0)
  const coachTotalOwed = coachRows.reduce((s,r)=>s+r.total,0)

  function printPayslip(run: PayrollRun) {
    const html = `<html><head><title>Payslip</title><style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto}h1{font-size:28px;margin-bottom:4px}.meta{color:#666;font-size:14px;margin-bottom:32px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}.total{display:flex;justify-content:space-between;padding:16px 0;font-weight:bold;font-size:18px;border-top:3px solid #000}.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;background:${run.status==='PAID'?'#d1fae5':'#fef3c7'};color:${run.status==='PAID'?'#065f46':'#92400e'}}</style></head><body>
    <h1>PAYSLIP</h1><div class="meta">${MONTHS[run.month-1]} ${run.year} — Generated ${new Date().toLocaleDateString()}</div>
    <div class="row"><span>Employee</span><span>${run.staff.firstName} ${run.staff.lastName}</span></div>
    <div class="row"><span>Role</span><span>${run.staff.role}</span></div>
    <div class="row"><span>Base Salary</span><span>$${run.baseSalary.toFixed(2)}</span></div>
    <div class="row"><span>Commission</span><span>$${run.commission.toFixed(2)}</span></div>
    <div class="row"><span>Bonus</span><span>$${run.bonus.toFixed(2)}</span></div>
    <div class="row"><span>Deductions</span><span>-$${run.deductions.toFixed(2)}</span></div>
    <div class="total"><span>NET TOTAL</span><span>$${run.total.toFixed(2)}</span></div>
    <div style="margin-top:16px"><span class="badge">${run.status}</span></div>
    ${run.notes?`<p style="margin-top:16px;color:#666;font-size:14px">Notes: ${run.notes}</p>`:''}
    </body></html>`
    const w = window.open('','_blank'); w?.document.write(html); w?.document.close(); w?.print()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">PAYROLL</h1>
          <p className="text-dark-300 text-sm mt-1">Salaried staff, plus coaches paid per session taught</p>
        </div>
        <div className="flex gap-2">
          {tab === 'staff' && <button onClick={()=>setShowStaffForm(true)} className="btn-ghost text-sm">Add Staff</button>}
          {tab === 'payroll' && <button onClick={()=>setShowPayrollForm(true)} className="btn-primary text-sm"><Plus size={16}/> Run Payroll</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setTab('payroll')} className={cn('px-5 py-2.5 rounded-xl text-sm font-medium transition-all', tab==='payroll'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>Staff Payroll</button>
        <button onClick={()=>setTab('coaches')} className={cn('px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5', tab==='coaches'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}><Swords size={14}/> Coach Payroll</button>
        <button onClick={()=>setTab('staff')} className={cn('px-5 py-2.5 rounded-xl text-sm font-medium transition-all', tab==='staff'?'bg-primary-400 text-dark-950 font-bold':'bg-dark-800 border border-dark-600 text-dark-300')}>Staff ({staff.length})</button>
      </div>

      {/* Month navigator (shared by Payroll + Coaches tabs) */}
      {(tab === 'payroll' || tab === 'coaches') && (
        <div className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <button onClick={()=>{ if(month===1){setMonth(12);setYear(y=>y-1)}else setMonth(m=>m-1) }} className="p-2 rounded-lg hover:bg-dark-700 transition-colors"><ChevronLeft size={18}/></button>
          <div className="text-center">
            <div className="font-display text-2xl text-white">{MONTHS[month-1]} {year}</div>
            <div className="text-dark-400 text-sm mt-0.5">{tab === 'payroll' ? `${runs.length} entries` : `${coachRows.length} coaches`}</div>
          </div>
          <button onClick={()=>{ if(month===12){setMonth(1);setYear(y=>y+1)}else setMonth(m=>m+1) }} className="p-2 rounded-lg hover:bg-dark-700 transition-colors"><ChevronRight size={18}/></button>
        </div>
      )}

      {tab === 'payroll' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center"><div className="font-display text-3xl text-white mb-1">{formatCurrency(totalPending+totalPaid)}</div><div className="text-xs text-dark-400">Total This Month</div></div>
            <div className="card text-center"><div className="font-display text-3xl text-yellow-400 mb-1">{formatCurrency(totalPending)}</div><div className="text-xs text-dark-400">Pending</div></div>
            <div className="card text-center"><div className="font-display text-3xl text-primary-400 mb-1">{formatCurrency(totalPaid)}</div><div className="text-xs text-dark-400">Paid</div></div>
          </div>

          {/* Payroll table */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-700"><tr>
                  {['Staff Member','Role','Base','Commission','Bonus','Deductions','Total','Status','Actions'].map(h=>(
                    <th key={h} className="text-left text-xs text-dark-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-dark-700">
                  {loading ? [...Array(3)].map((_,i)=><tr key={i}><td colSpan={9}><div className="h-12 skeleton m-4 rounded"/></td></tr>)
                  : runs.length===0 ? <tr><td colSpan={9} className="px-5 py-12 text-center text-dark-400">No payroll entries for {MONTHS[month-1]} {year}</td></tr>
                  : runs.map(run=>(
                    <tr key={run.id} className="hover:bg-dark-750 group transition-colors">
                      <td className="px-4 py-3 text-white text-sm font-medium">{run.staff.firstName} {run.staff.lastName}</td>
                      <td className="px-4 py-3 text-dark-400 text-sm">{run.staff.role}</td>
                      <td className="px-4 py-3 text-dark-300 text-sm">{formatCurrency(run.baseSalary)}</td>
                      <td className="px-4 py-3 text-primary-400 text-sm">+{formatCurrency(run.commission)}</td>
                      <td className="px-4 py-3 text-blue-400 text-sm">+{formatCurrency(run.bonus)}</td>
                      <td className="px-4 py-3 text-crimson-400 text-sm">-{formatCurrency(run.deductions)}</td>
                      <td className="px-4 py-3 text-white font-bold text-sm">{formatCurrency(run.total)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs', run.status==='PAID'?'text-primary-400 bg-primary-400/10 border-primary-400/20':'text-yellow-400 bg-yellow-400/10 border-yellow-400/20')}>{run.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={()=>printPayslip(run)} title="Print payslip" className="p-1.5 rounded hover:bg-dark-600 text-dark-400 hover:text-white"><Printer size={14}/></button>
                          {run.status==='PENDING' && <button onClick={()=>markPaid(run.id)} title="Mark paid" className="p-1.5 rounded hover:bg-primary-400/10 text-dark-400 hover:text-primary-400"><Check size={14}/></button>}
                          <button onClick={()=>deleteRun(run.id)} title="Delete" className="p-1.5 rounded hover:bg-crimson-500/10 text-dark-500 hover:text-crimson-400"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'coaches' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="card text-center"><div className="font-display text-3xl text-white mb-1">{coachRows.reduce((s,r)=>s+r.sessionCount,0)}</div><div className="text-xs text-dark-400">Sessions Taught</div></div>
            <div className="card text-center"><div className="font-display text-3xl text-primary-400 mb-1">{formatCurrency(coachTotalOwed)}</div><div className="text-xs text-dark-400">Total Owed</div></div>
          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-700"><tr>
                  {['Coach','Rate / Session','Sessions','Rate / Private','Private Sessions','Players Attended','Total','Status','Actions'].map(h=>(
                    <th key={h} className="text-left text-xs text-dark-400 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-dark-700">
                  {loading ? [...Array(3)].map((_,i)=><tr key={i}><td colSpan={9}><div className="h-12 skeleton m-4 rounded"/></td></tr>)
                  : coachRows.length===0 ? <tr><td colSpan={9} className="px-5 py-12 text-center text-dark-400">No coaches yet — add one from Settings → Team Access</td></tr>
                  : coachRows.map(row=>(
                    <tr key={row.coachId} className="hover:bg-dark-750 group transition-colors">
                      <td className="px-4 py-3 text-white text-sm font-medium">{row.firstName} {row.lastName}</td>
                      <td className="px-4 py-3 text-dark-300 text-sm">{formatCurrency(row.sessionRate)}</td>
                      <td className="px-4 py-3 text-dark-300 text-sm">
                        {row.sessionCount}
                        {row.status !== 'DRAFT' && row.liveSessionCount !== row.sessionCount && (
                          <span className="text-yellow-400 text-xs ml-1.5">({row.liveSessionCount} now)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-dark-300 text-sm">{formatCurrency(row.privateSessionRate)}</td>
                      <td className="px-4 py-3 text-dark-300 text-sm">
                        {row.privateSessionCount}
                        {row.status !== 'DRAFT' && row.livePrivateSessionCount !== row.privateSessionCount && (
                          <span className="text-yellow-400 text-xs ml-1.5">({row.livePrivateSessionCount} now)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-dark-300 text-sm">{row.totalPlayersAttended}</td>
                      <td className="px-4 py-3 text-white font-bold text-sm">{formatCurrency(row.total)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs',
                          row.status==='PAID' ? 'text-primary-400 bg-primary-400/10 border-primary-400/20'
                          : row.status==='PENDING' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
                          : 'text-dark-400 bg-dark-700 border-dark-600')}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {row.status === 'DRAFT' ? (
                            <button onClick={()=>generateCoachPayroll(row.coachId)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 text-xs font-semibold transition-colors">
                              <RefreshCw size={12}/> Generate
                            </button>
                          ) : row.status === 'PENDING' ? (
                            <button onClick={()=>markCoachPaid(row.runId!)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-400/10 border border-primary-400/20 text-primary-400 hover:bg-primary-400/20 text-xs font-semibold transition-colors">
                              <Check size={12}/> Mark Paid
                            </button>
                          ) : (
                            <span className="text-dark-500 text-xs">Paid {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : ''}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-dark-500 text-xs">Sessions counted are approved classes/private sessions that have already started this month. Generate a coach's entry once you're ready to lock in their pay for the month.</p>
        </>
      )}

      {tab === 'staff' && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-dark-700"><tr>
                {['Name','Email','Role','Base Salary','Type','Status'].map(h=>(
                  <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-dark-700">
                {staff.length===0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-dark-400">No staff added yet</td></tr>
                : staff.map(s=>(
                  <tr key={s.id} className="hover:bg-dark-750 transition-colors">
                    <td className="px-5 py-4 text-white text-sm font-medium">{s.firstName} {s.lastName}</td>
                    <td className="px-5 py-4 text-dark-400 text-sm">{s.email}</td>
                    <td className="px-5 py-4"><span className="badge text-xs text-blue-400 bg-blue-400/10 border-blue-400/20">{s.role}</span></td>
                    <td className="px-5 py-4 text-white font-semibold text-sm">{formatCurrency(s.salary)}</td>
                    <td className="px-5 py-4 text-dark-400 text-sm">{s.salaryType}</td>
                    <td className="px-5 py-4"><span className={cn('badge text-xs', s.isActive?'text-primary-400 bg-primary-400/10 border-primary-400/20':'text-crimson-400 bg-crimson-400/10 border-crimson-400/20')}>{s.isActive?'Active':'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      <AnimatePresence>
        {showStaffForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">ADD STAFF</h2>
                <button onClick={()=>setShowStaffForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <p className="text-dark-400 text-xs -mt-4 mb-4">For front-desk and management roles. Coaches are added from Settings → Team Access and paid per session instead.</p>
              <form onSubmit={addStaff} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">First Name</label><input value={staffForm.firstName} onChange={e=>setStaffForm(f=>({...f,firstName:e.target.value}))} required className="input"/></div>
                  <div><label className="label">Last Name</label><input value={staffForm.lastName} onChange={e=>setStaffForm(f=>({...f,lastName:e.target.value}))} required className="input"/></div>
                </div>
                <div><label className="label">Email</label><input type="email" value={staffForm.email} onChange={e=>setStaffForm(f=>({...f,email:e.target.value}))} required className="input"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Role</label>
                    <select value={staffForm.role} onChange={e=>setStaffForm(f=>({...f,role:e.target.value}))} className="input">
                      {ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Salary Type</label>
                    <select value={staffForm.salaryType} onChange={e=>setStaffForm(f=>({...f,salaryType:e.target.value}))} className="input">
                      <option>MONTHLY</option><option>HOURLY</option>
                    </select>
                  </div>
                </div>
                <div><label className="label">Base Salary ($)</label><input type="number" value={staffForm.salary} onChange={e=>setStaffForm(f=>({...f,salary:+e.target.value}))} min={0} className="input"/></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowStaffForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Add Staff</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Run Payroll Modal */}
      <AnimatePresence>
        {showPayrollForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl tracking-wider text-white">RUN PAYROLL</h2>
                <button onClick={()=>setShowPayrollForm(false)} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400"><X size={18}/></button>
              </div>
              <p className="text-dark-400 text-sm mb-4">Creating entry for <span className="text-white font-semibold">{MONTHS[month-1]} {year}</span></p>
              <form onSubmit={runPayroll} className="space-y-4">
                <div><label className="label">Staff Member</label>
                  <select value={payrollForm.staffId} onChange={e=>{
                    const s=staff.find(st=>st.id===e.target.value)
                    setPayrollForm(f=>({...f,staffId:e.target.value,baseSalary:s?.salary||0}))
                  }} required className="input">
                    <option value="">Select staff...</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Base Salary ($)</label><input type="number" value={payrollForm.baseSalary} onChange={e=>setPayrollForm(f=>({...f,baseSalary:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                  <div><label className="label">Commission ($)</label><input type="number" value={payrollForm.commission} onChange={e=>setPayrollForm(f=>({...f,commission:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Bonus ($)</label><input type="number" value={payrollForm.bonus} onChange={e=>setPayrollForm(f=>({...f,bonus:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                  <div><label className="label">Deductions ($)</label><input type="number" value={payrollForm.deductions} onChange={e=>setPayrollForm(f=>({...f,deductions:+e.target.value}))} min={0} step={0.01} className="input"/></div>
                </div>
                <div className="bg-dark-700 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-dark-300 text-sm">NET TOTAL</span>
                  <span className="text-white font-display text-2xl">
                    ${(payrollForm.baseSalary+payrollForm.commission+payrollForm.bonus-payrollForm.deductions).toFixed(2)}
                  </span>
                </div>
                <div><label className="label">Notes (optional)</label><input value={payrollForm.notes} onChange={e=>setPayrollForm(f=>({...f,notes:e.target.value}))} className="input" placeholder="e.g. Bonus for new member referrals"/></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setShowPayrollForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">Create Entry</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
