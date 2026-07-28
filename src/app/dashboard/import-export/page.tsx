'use client'
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Download, FileText, Users, CreditCard, Target,
  CheckCircle2, AlertCircle, X, FileDown, AlertTriangle, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ImportResult { success: boolean; message: string; imported: number; skipped: number; errors: string[] }

const EXPORTS = [
  { id: 'members',  icon: Users,       label: 'Fighters',     desc: 'All fighter profiles, plans, expiry dates, and contact info' },
  { id: 'payments', icon: CreditCard,  label: 'Payments',     desc: 'Complete payment history with member names, amounts, and dates' },
  { id: 'leads',    icon: Target,      label: 'Leads & CRM',  desc: 'All leads with status, source, follow-up dates, and notes' },
]

export default function ImportExportPage() {
  const fileRef          = useRef<HTMLInputElement>(null)
  const [importing, setImporting]   = useState(false)
  const [exporting, setExporting]   = useState<string | null>(null)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [dragOver, setDragOver]     = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  function downloadExport(type: string) {
    setExporting(type)
    const a = document.createElement('a')
    a.href = `/api/import-export?type=${type}`
    a.click()
    setTimeout(() => setExporting(null), 1500)
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} export started`)
  }

  function downloadTemplate() {
    const a = document.createElement('a')
    a.href = '/api/import-export?type=template'
    a.click()
    toast.success('Import template downloaded')
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { toast.error('Please upload a .csv file'); return }
    setSelectedFile(file)
    setResult(null)
  }

  async function runImport() {
    if (!selectedFile) return
    setImporting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch('/api/import-export', { method: 'POST', body: fd })
      const data = await res.json()
      setResult(data)
      if (data.success && data.imported > 0) toast.success(data.message)
      else if (!data.success) toast.error(data.error || 'Import failed')
    } catch {
      toast.error('Network error during import')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-4xl tracking-wider text-white">IMPORT & EXPORT</h1>
        <p className="text-dark-300 text-sm mt-1">Bulk import members from CSV or export all your data anytime</p>
      </div>

      {/* Import section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white text-lg flex items-center gap-2"><Upload size={18} className="text-primary-400"/> Import Fighters</h2>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs text-primary-400 hover:text-primary-300 transition-colors border border-primary-400/20 rounded-lg px-3 py-1.5">
            <FileDown size={13}/> Download Template
          </button>
        </div>

        {/* How it works */}
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5">
          <p className="text-dark-300 text-sm font-semibold mb-3">How to import:</p>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            {[
              { n:'1', t:'Download the template', d:'Click "Download Template" above to get a blank CSV file with the correct column names.' },
              { n:'2', t:'Fill in your members', d:'Open in Excel or Google Sheets. Add one member per row. Required: firstName, lastName, email.' },
              { n:'3', t:'Upload and import', d:'Drag the file below or click to upload. Vance will import all valid rows and skip duplicates.' },
            ].map(s => (
              <div key={s.n} className="flex gap-3">
                <div className="w-6 h-6 bg-primary-400 rounded-full flex items-center justify-center text-dark-950 font-bold flex-shrink-0">{s.n}</div>
                <div><p className="text-white font-medium mb-0.5">{s.t}</p><p className="text-dark-400">{s.d}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported columns */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-dark-400 text-xs mb-2 font-semibold uppercase tracking-wider">Supported CSV Columns</p>
          <div className="flex flex-wrap gap-2">
            {[
              { col:'firstName', req:true }, { col:'lastName', req:true }, { col:'email', req:true },
              { col:'phone', req:false }, { col:'class', req:false },
              { col:'startDate', req:false }, { col:'notes', req:false },
            ].map(({ col, req }) => (
              <span key={col} className={cn('text-xs px-2 py-1 rounded-lg font-mono', req ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20' : 'bg-dark-700 text-dark-400')}>
                {col}{req ? ' *' : ''}
              </span>
            ))}
          </div>
          <p className="text-dark-600 text-xs mt-2">* Required · class: name of an existing class (e.g. Kickboxing Adults) · startDate: YYYY-MM-DD</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f) }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
            dragOver ? 'border-primary-400 bg-primary-400/5' : 'border-dark-600 hover:border-primary-400/40 hover:bg-dark-800'
          )}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />
          <Upload size={32} className={cn('mx-auto mb-3', dragOver ? 'text-primary-400' : 'text-dark-500')} />
          {selectedFile ? (
            <div>
              <p className="text-white font-semibold">{selectedFile.name}</p>
              <p className="text-dark-400 text-sm mt-1">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change file</p>
            </div>
          ) : (
            <div>
              <p className="text-white font-semibold mb-1">Drop your CSV file here</p>
              <p className="text-dark-400 text-sm">or click to browse files</p>
            </div>
          )}
        </div>

        {selectedFile && !result && (
          <div className="flex gap-3">
            <button onClick={() => { setSelectedFile(null); setResult(null) }} className="btn-ghost">
              <X size={16}/> Clear
            </button>
            <button onClick={runImport} disabled={importing} className="btn-primary flex-1 justify-center">
              {importing ? <><Loader2 size={16} className="animate-spin"/> Importing…</> : <><Upload size={16}/> Import Fighters</>}
            </button>
          </div>
        )}

        {/* Import result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              className={cn('rounded-2xl p-5 border', result.success ? 'bg-primary-400/5 border-primary-400/20' : 'bg-red-500/5 border-red-500/20')}>
              <div className="flex items-start gap-3">
                {result.success
                  ? <CheckCircle2 size={20} className="text-primary-400 flex-shrink-0 mt-0.5"/>
                  : <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5"/>}
                <div className="flex-1">
                  <p className={cn('font-semibold text-sm', result.success ? 'text-primary-300' : 'text-red-300')}>{result.message || result.errors?.[0]}</p>
                  {result.success && (
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-primary-400">✓ {result.imported} imported</span>
                      {result.skipped > 0 && <span className="text-yellow-400">⊘ {result.skipped} skipped</span>}
                    </div>
                  )}
                  {result.errors?.length > 0 && (
                    <button onClick={() => setShowErrors(s=>!s)} className="text-dark-400 text-xs mt-2 hover:text-white transition-colors">
                      {showErrors ? 'Hide' : 'Show'} {result.errors.length} detail{result.errors.length>1?'s':''}
                    </button>
                  )}
                  <AnimatePresence>
                    {showErrors && result.errors.length > 0 && (
                      <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                        className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {result.errors.map((e,i) => (
                          <p key={i} className="text-xs text-dark-400 font-mono bg-dark-800 rounded p-1.5">{e}</p>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={()=>{setResult(null);setSelectedFile(null)}} className="text-dark-500 hover:text-white"><X size={16}/></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-dark-700" />

      {/* Export section */}
      <div className="space-y-4">
        <h2 className="font-semibold text-white text-lg flex items-center gap-2"><Download size={18} className="text-primary-400"/> Export Your Data</h2>
        <p className="text-dark-400 text-sm">Download a complete CSV of your data at any time. Your data always belongs to you.</p>

        <div className="grid sm:grid-cols-3 gap-4">
          {EXPORTS.map(exp => {
            const Icon = exp.icon
            const isExporting = exporting === exp.id
            return (
              <motion.div key={exp.id} whileHover={{y:-2}} className="card-hover group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary-400/10 border border-primary-400/20 rounded-xl flex items-center justify-center">
                    <Icon size={18} className="text-primary-400"/>
                  </div>
                  <FileText size={14} className="text-dark-600 group-hover:text-dark-400 transition-colors"/>
                </div>
                <h3 className="text-white font-semibold mb-1">{exp.label}</h3>
                <p className="text-dark-400 text-xs mb-4 leading-relaxed">{exp.desc}</p>
                <button
                  onClick={() => downloadExport(exp.id)}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-dark-700 border border-dark-600 text-dark-300 hover:text-white hover:border-dark-500 transition-all text-sm disabled:opacity-50"
                >
                  {isExporting
                    ? <><Loader2 size={14} className="animate-spin"/> Preparing…</>
                    : <><Download size={14}/> Export CSV</>}
                </button>
              </motion.div>
            )
          })}
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5"/>
          <div className="text-xs text-dark-400">
            <span className="text-white font-semibold">Your data is always yours.</span> Exports include all records with no limits. Files open in Excel, Google Sheets, or any CSV reader. We never delete your data without your explicit request.
          </div>
        </div>
      </div>
    </div>
  )
}
