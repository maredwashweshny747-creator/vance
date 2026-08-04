'use client'
import { useEffect, useState } from 'react'
import { MessageSquare, Trash2, Mail, MailOpen } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FeedbackMsg {
  id: string; message: string; isRead: boolean; createdAt: string
  member: { id: string; firstName: string; lastName: string; fighterId: string; phone?: string | null }
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<FeedbackMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')

  function load() {
    setLoading(true)
    fetch('/api/fighter-feedback').then(r => r.ok ? r.json() : []).then(d => { setMessages(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function markRead(id: string, isRead: boolean) {
    setMessages(m => m.map(x => x.id === id ? { ...x, isRead } : x)) // optimistic
    const res = await fetch(`/api/fighter-feedback?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead }) })
    if (!res.ok) { toast.error('Failed to update'); load() }
  }

  async function remove(id: string) {
    if (!confirm('Delete this message? This cannot be undone.')) return
    const res = await fetch(`/api/fighter-feedback?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); setMessages(m => m.filter(x => x.id !== id)) } else toast.error('Failed to delete')
  }

  const shown = filter === 'UNREAD' ? messages.filter(m => !m.isRead) : messages
  const unreadCount = messages.filter(m => !m.isRead).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wider text-white">FIGHTER MESSAGES</h1>
          <p className="text-dark-300 text-sm mt-1">{messages.length} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}</p>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="input w-auto">
          <option value="ALL">All messages</option>
          <option value="UNREAD">Unread only</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="h-20 skeleton rounded-2xl"/>)}</div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-16"><MessageSquare size={48} className="mx-auto text-dark-600 mb-4"/><p className="text-dark-400">No messages{filter === 'UNREAD' ? ' — you\'re all caught up' : ' yet'}</p></div>
      ) : (
        <div className="space-y-3">
          {shown.map(m => (
            <div key={m.id} className={cn('card flex items-start gap-3', !m.isRead && 'border-primary-400/30 bg-primary-400/[0.03]')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-semibold text-sm">{m.member.firstName} {m.member.lastName}</span>
                  <span className="text-dark-500 text-xs font-mono">ID: {m.member.fighterId}</span>
                  {!m.isRead && <span className="badge text-xs bg-primary-400/10 text-primary-400 border-primary-400/20">New</span>}
                </div>
                <p className="text-dark-200 text-sm whitespace-pre-wrap">{m.message}</p>
                <p className="text-dark-500 text-xs mt-2">{formatDateTime(m.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => markRead(m.id, !m.isRead)} title={m.isRead ? 'Mark unread' : 'Mark read'}
                  className="p-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-300 hover:text-primary-400 transition-colors">
                  {m.isRead ? <MailOpen size={14}/> : <Mail size={14}/>}
                </button>
                <button onClick={() => remove(m.id)} title="Delete"
                  className="p-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-300 hover:bg-crimson-500/10 hover:text-crimson-400 transition-colors">
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
