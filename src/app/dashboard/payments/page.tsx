'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate, paymentColors, cn } from '@/lib/utils'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/payments').then(r => r.json()).then(d => { setPayments(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const total = payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0)
  const pending = payments.filter(p => p.status === 'PENDING').length

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="font-display text-4xl tracking-wider text-white">PAYMENTS</h1><p className="text-dark-300 text-sm mt-1">Revenue and billing management</p></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><DollarSign size={20} className="text-primary-400 mb-2"/><div className="font-display text-3xl text-white">{formatCurrency(total)}</div><div className="text-dark-400 text-xs mt-1">Total Collected</div></div>
        <div className="card"><TrendingUp size={20} className="text-blue-400 mb-2"/><div className="font-display text-3xl text-white">{payments.length}</div><div className="text-dark-400 text-xs mt-1">Total Transactions</div></div>
        <div className="card"><AlertCircle size={20} className="text-yellow-400 mb-2"/><div className="font-display text-3xl text-white">{pending}</div><div className="text-dark-400 text-xs mt-1">Pending</div></div>
      </div>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-dark-700"><tr>
            {['Fighter','Type','Amount','Status','Date'].map(h => <th key={h} className="text-left text-xs text-dark-400 font-medium px-5 py-3">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-dark-700">
            {loading ? [...Array(5)].map((_,i) => <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-5 skeleton rounded"/></td></tr>)
            : payments.map((p: any) => (
              <tr key={p.id} className="hover:bg-dark-750 transition-colors">
                <td className="px-5 py-4 text-white text-sm">{p.member ? `${p.member.firstName} ${p.member.lastName}` : '—'}</td>
                <td className="px-5 py-4 text-dark-300 text-sm">{p.type}</td>
                <td className="px-5 py-4 text-primary-400 font-mono text-sm font-bold">{formatCurrency(p.amount)}</td>
                <td className="px-5 py-4"><span className={cn('badge', paymentColors[p.status])}>{p.status}</span></td>
                <td className="px-5 py-4 text-dark-400 text-sm">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
