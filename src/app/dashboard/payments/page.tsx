'use client'
import { useEffect, useState } from 'react'
import { CreditCard, DollarSign, TrendingUp, AlertCircle, Search, X } from 'lucide-react'
import { formatCurrency, formatDate, paymentColors, cn } from '@/lib/utils'
import Pagination from '@/components/dashboard/Pagination'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCollected, setTotalCollected] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [search, setSearch] = useState('')
  const [dateMode, setDateMode] = useState<'ANY' | 'ON' | 'RANGE'>('ANY')
  const [date, setDate] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function load() {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) p.set('search', search)
    if (dateMode === 'ON' && date) p.set('date', date)
    if (dateMode === 'RANGE') { if (fromDate) p.set('fromDate', fromDate); if (toDate) p.set('toDate', toDate) }
    fetch(`/api/payments?${p}`).then(r => r.json()).then(d => {
      setPayments(Array.isArray(d?.data) ? d.data : [])
      setTotalCollected(d?.totalCollected || 0); setPendingCount(d?.pendingCount || 0)
      setTotal(d?.total || 0); setTotalPages(d?.totalPages || 1)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, dateMode, date, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search, dateMode, date, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = !!search || dateMode !== 'ANY'
  function clearFilters() { setSearch(''); setDateMode('ANY'); setDate(''); setFromDate(''); setToDate('') }

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="font-display text-4xl tracking-wider text-white">PAYMENTS</h1><p className="text-dark-300 text-sm mt-1">Revenue and billing management</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card"><DollarSign size={20} className="text-primary-400 mb-2"/><div className="font-display text-3xl text-white">{formatCurrency(totalCollected)}</div><div className="text-dark-400 text-xs mt-1">Total Collected{hasFilters ? ' (filtered)' : ''}</div></div>
        <div className="card"><TrendingUp size={20} className="text-blue-400 mb-2"/><div className="font-display text-3xl text-white">{total}</div><div className="text-dark-400 text-xs mt-1">Total Transactions{hasFilters ? ' (filtered)' : ''}</div></div>
        <div className="card"><AlertCircle size={20} className="text-yellow-400 mb-2"/><div className="font-display text-3xl text-white">{pendingCount}</div><div className="text-dark-400 text-xs mt-1">Pending</div></div>
      </div>

      {/* Filters */}
      <div className="card flex flex-col md:flex-row gap-3 md:items-end flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="label text-xs">Search — fighter, phone, parent phone, class, payment ID</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Adam, +20…, Kickboxing…" className="input pl-8" />
          </div>
        </div>
        <div>
          <label className="label text-xs">Date</label>
          <select value={dateMode} onChange={e => setDateMode(e.target.value as any)} className="input w-auto">
            <option value="ANY">Any time</option>
            <option value="ON">Specific date</option>
            <option value="RANGE">Date range</option>
          </select>
        </div>
        {dateMode === 'ON' && (
          <div><label className="label text-xs">On</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" /></div>
        )}
        {dateMode === 'RANGE' && (
          <>
            <div><label className="label text-xs">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input" /></div>
            <div><label className="label text-xs">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" /></div>
          </>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-300 text-xs hover:bg-dark-600 transition-colors">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-dark-700"><tr>
              {['Fighter','Class','Type','Method','Amount','Status','Date'].map(h => <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-dark-700">
              {loading ? [...Array(5)].map((_,i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-5 skeleton rounded"/></td></tr>)
              : payments.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-dark-400">No payments found</td></tr>
              : payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-dark-750 transition-colors">
                  <td className="px-5 py-4 text-white text-sm whitespace-nowrap">
                    {p.member ? `${p.member.firstName} ${p.member.lastName}` : '—'}
                    {p.member?.phone && <div className="text-dark-500 text-xs">{p.member.phone}</div>}
                  </td>
                  <td className="px-5 py-4 text-dark-300 text-sm whitespace-nowrap">{p.class?.name || '—'}</td>
                  <td className="px-5 py-4 text-dark-300 text-sm">{p.type}</td>
                  <td className="px-5 py-4 text-dark-300 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap">{p.method ? p.method.replace('_',' ') : '—'}</span>
                      {p.proofPhoto && (
                        <a href={p.proofPhoto} target="_blank" rel="noreferrer">
                          <img src={p.proofPhoto} alt="proof" className="w-6 h-6 rounded object-cover border border-dark-600 hover:border-primary-400/50" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-primary-400 font-mono text-sm font-bold whitespace-nowrap">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-4"><span className={cn('badge', paymentColors[p.status])}>{p.status}</span></td>
                  <td className="px-5 py-4 text-dark-400 text-sm whitespace-nowrap">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
          onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1) }} />
      </div>
    </div>
  )
}
