'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  page, totalPages, total, pageSize, onPage, onPageSize,
}: {
  page: number; totalPages: number; total: number; pageSize: number
  onPage: (p: number) => void; onPageSize: (n: number) => void
}) {
  if (total === 0) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-dark-700 text-sm">
      <span className="text-dark-400 text-xs">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-3">
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))}
          className="bg-dark-800 border border-dark-600 rounded-lg px-2 py-1.5 text-xs text-dark-200">
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}
            className="p-1.5 rounded-lg border border-dark-600 text-dark-300 disabled:opacity-40 hover:bg-dark-700 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-dark-300 text-xs px-1">Page {page} of {totalPages}</span>
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-dark-600 text-dark-300 disabled:opacity-40 hover:bg-dark-700 transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
