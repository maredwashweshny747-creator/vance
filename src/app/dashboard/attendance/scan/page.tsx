'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, CheckCircle2, XCircle, UserCheck, ArrowLeft, WifiOff, Zap } from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'
import { disciplineLabel } from '@/lib/categories'

interface ScanResult {
  ok: boolean
  member?: { firstName: string; lastName: string; enrollments?: { class: { name: string } }[] }
  message: string
}
interface PendingChoice {
  memberId: string
  firstName: string
  lastName: string
  plans: { id: string; plan: { id: string; name: string; category?: string | null } }[]
}

export default function QRScannerPage() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const lastScanned = useRef<string>('')
  const lastScannedTime = useRef<number>(0)

  const [cameraReady, setCameraReady]   = useState(false)
  const [cameraError, setCameraError]   = useState<string | null>(null)
  const [result, setResult]             = useState<ScanResult | null>(null)
  const [processing, setProcessing]     = useState(false)
  const [todayCount, setTodayCount]     = useState(0)
  const [recentScans, setRecentScans]   = useState<{ name: string; time: string; ok: boolean }[]>([])
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null)

  // Load today count
  useEffect(() => {
    fetch('/api/attendance?view=today')
      .then(r => r.json())
      .then(d => { if (d.todayCount !== undefined) setTodayCount(d.todayCount) })
  }, [])

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setCameraReady(true)
        }
      } catch (err: any) {
        setCameraError(err.message || 'Camera access denied')
      }
    }
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      scanningRef.current = false
    }
  }, [])

  // Scan loop — reads canvas frames and looks for QR pattern
  useEffect(() => {
    if (!cameraReady) return
    scanningRef.current = true

    async function scan() {
      if (!scanningRef.current) return
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== 4) {
        requestAnimationFrame(scan); return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) { requestAnimationFrame(scan); return }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      try {
        // Use BarcodeDetector if available (Chrome 83+, Edge, Android)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
          const codes = await detector.detect(canvas)
          if (codes.length > 0) {
            const raw = codes[0].rawValue as string
            const now = Date.now()
            if (raw !== lastScanned.current || now - lastScannedTime.current > 3000) {
              lastScanned.current = raw
              lastScannedTime.current = now
              await processQR(raw)
            }
          }
        }
      } catch (e) {
        // BarcodeDetector not supported — show fallback message
      }

      if (scanningRef.current) requestAnimationFrame(scan)
    }

    requestAnimationFrame(scan)
  }, [cameraReady]) // eslint-disable-line react-hooks/exhaustive-deps

  async function completeCheckIn(memberId: string, memberPlanId?: string) {
    setProcessing(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, memberPlanId, method: 'QR' }),
      })
      const data = await res.json()

      if (res.ok) {
        const mRes = await fetch(`/api/members?id=${memberId}`)
        const mData = mRes.ok ? await mRes.json() : null
        setResult({ ok: true, member: mData ? { firstName: mData.firstName, lastName: mData.lastName, enrollments: mData.enrollments } : undefined, message: 'Checked in successfully!' })
        setTodayCount(c => c + 1)
        if (mData) {
          setRecentScans(prev => [{ name: `${mData.firstName} ${mData.lastName}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ok: true }, ...prev].slice(0, 8))
        }
      } else {
        setResult({ ok: false, message: data.error || 'Check-in failed' })
        setRecentScans(prev => [{ name: 'Unknown', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ok: false }, ...prev].slice(0, 8))
      }
      setTimeout(() => setResult(null), 3500)
    } catch {
      setResult({ ok: false, message: 'Network error — check connection' })
      setTimeout(() => setResult(null), 3000)
    } finally {
      setProcessing(false)
      setPendingChoice(null)
    }
  }

  const processQR = useCallback(async (raw: string) => {
    // Expected format: vance:checkin:{memberId}
    if (!raw.startsWith('vance:checkin:')) return
    const memberId = raw.replace('vance:checkin:', '').trim()
    if (!memberId || processing || pendingChoice) return

    setProcessing(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, method: 'QR' }),
      })
      const data = await res.json()

      if (res.status === 409 && data.error === 'MULTIPLE_PLANS') {
        // Fighter trains more than one discipline — ask which session this is for ("the plan of the day")
        const mRes = await fetch(`/api/members?id=${memberId}`)
        const mData = mRes.ok ? await mRes.json() : null
        setProcessing(false)
        setPendingChoice({ memberId, firstName: mData?.firstName || 'Fighter', lastName: mData?.lastName || '', plans: data.plans || [] })
        return
      }

      if (res.ok) {
        const mRes = await fetch(`/api/members?id=${memberId}`)
        const mData = mRes.ok ? await mRes.json() : null
        setResult({ ok: true, member: mData ? { firstName: mData.firstName, lastName: mData.lastName, enrollments: mData.enrollments } : undefined, message: 'Checked in successfully!' })
        setTodayCount(c => c + 1)
        if (mData) {
          setRecentScans(prev => [{ name: `${mData.firstName} ${mData.lastName}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ok: true }, ...prev].slice(0, 8))
        }
      } else {
        setResult({ ok: false, message: data.error || 'Check-in failed' })
        setRecentScans(prev => [{ name: 'Unknown', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ok: false }, ...prev].slice(0, 8))
      }

      setTimeout(() => setResult(null), 3500)
    } catch {
      setResult({ ok: false, message: 'Network error — check connection' })
      setTimeout(() => setResult(null), 3000)
    } finally {
      setProcessing(false)
    }
  }, [processing, pendingChoice]) // eslint-disable-line

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900">
        <Link href="/dashboard/attendance" className="flex items-center gap-2 text-dark-300 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Attendance
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-primary-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-dark-300">{cameraReady ? 'Scanner Active' : 'Starting camera…'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <UserCheck size={15} className="text-primary-400" />
          <span className="text-white font-bold">{todayCount}</span>
          <span className="text-dark-400">today</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Camera feed */}
        <div className="flex-1 relative flex items-center justify-center bg-black min-h-[400px]">
          {cameraError ? (
            <div className="text-center p-8">
              <WifiOff size={48} className="mx-auto text-red-400 mb-4" />
              <p className="text-white font-semibold text-lg mb-2">Camera Not Available</p>
              <p className="text-dark-400 text-sm mb-2">{cameraError}</p>
              <p className="text-dark-500 text-xs max-w-xs mx-auto">
                Make sure your browser has camera permission enabled. In Chrome: click the camera icon in the address bar.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning overlay */}
              {!result && !pendingChoice && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-64">
                    {/* Corner brackets */}
                    {[
                      'top-0 left-0 border-t-4 border-l-4',
                      'top-0 right-0 border-t-4 border-r-4',
                      'bottom-0 left-0 border-b-4 border-l-4',
                      'bottom-0 right-0 border-b-4 border-r-4',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-10 h-10 border-primary-400 rounded-sm ${cls}`} />
                    ))}
                    {/* Scanning line */}
                    <motion.div
                      className="absolute left-2 right-2 h-0.5 bg-primary-400 opacity-80"
                      animate={{ top: ['10%', '90%', '10%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-white/60 text-xs text-center mt-32">Point camera at fighter QR code</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan-of-the-day picker — fighter trains more than one discipline */}
              <AnimatePresence>
                {pendingChoice && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-dark-950/90 backdrop-blur-sm p-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
                      <div className="w-14 h-14 rounded-full bg-primary-400/20 border-2 border-primary-400 flex items-center justify-center font-bold text-primary-400 text-lg mx-auto mb-3">
                        {getInitials(`${pendingChoice.firstName} ${pendingChoice.lastName}`)}
                      </div>
                      <p className="text-white font-display text-2xl tracking-wider text-center mb-1">{pendingChoice.firstName.toUpperCase()}</p>
                      <p className="text-dark-300 text-sm text-center mb-4">Trains more than one discipline — which session is this?</p>
                      <div className="space-y-2">
                        {pendingChoice.plans.map(p => (
                          <button key={p.id} onClick={() => completeCheckIn(pendingChoice.memberId, p.id)} disabled={processing}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-dark-800 border border-dark-600 hover:border-primary-400/50 transition-all text-left">
                            <div>
                              <div className="text-white text-sm font-medium">{p.plan.name}</div>
                              <div className="text-dark-500 text-xs">{disciplineLabel(p.plan.category)}</div>
                            </div>
                            <Zap size={14} className="text-primary-400" />
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setPendingChoice(null)} className="w-full text-center text-dark-500 text-xs mt-4 hover:text-dark-300">Cancel</button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Result overlay */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 flex items-center justify-center ${result.ok ? 'bg-primary-400/20' : 'bg-red-500/20'} backdrop-blur-sm`}
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="text-center p-8"
                    >
                      {result.ok ? (
                        <CheckCircle2 size={80} className="mx-auto text-primary-400 mb-4" />
                      ) : (
                        <XCircle size={80} className="mx-auto text-red-400 mb-4" />
                      )}
                      {result.member && (
                        <>
                          <div className="w-16 h-16 rounded-full bg-primary-400/20 border-2 border-primary-400 flex items-center justify-center font-bold text-primary-400 text-xl mx-auto mb-3">
                            {getInitials(`${result.member.firstName} ${result.member.lastName}`)}
                          </div>
                          <p className="text-white font-display text-3xl tracking-wider mb-1">
                            {result.member.firstName.toUpperCase()}
                          </p>
                          <p className="text-primary-400 text-sm mb-3">{result.member.enrollments?.[0]?.class?.name || 'Fighter'}</p>
                        </>
                      )}
                      <p className={`font-bold text-xl ${result.ok ? 'text-primary-400' : 'text-red-400'}`}>
                        {result.message}
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Side panel — recent scans */}
        <div className="w-full lg:w-80 bg-dark-900 border-l border-dark-700 flex flex-col">
          <div className="p-4 border-b border-dark-700">
            <h2 className="font-display text-xl tracking-wider text-white">RECENT SCANS</h2>
            {!('BarcodeDetector' in window) && (
              <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-300">
                ⚠️ Your browser does not support automatic QR scanning. Use Chrome on Android or desktop for best results.
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentScans.length === 0 ? (
              <div className="text-center py-12 text-dark-500 text-sm">
                <QrCode size={32} className="mx-auto mb-2 opacity-30" />
                No scans yet — point camera at a fighter QR code
              </div>
            ) : recentScans.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-dark-800 rounded-xl p-3 border border-dark-700"
              >
                {s.ok
                  ? <CheckCircle2 size={16} className="text-primary-400 flex-shrink-0" />
                  : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.name}</p>
                  <p className="text-dark-500 text-xs">{s.time}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Manual check-in fallback */}
          <div className="p-4 border-t border-dark-700">
            <p className="text-dark-500 text-xs mb-2">QR not working? Use manual check-in:</p>
            <Link href="/dashboard/attendance"
              className="btn-ghost w-full justify-center text-sm">
              Manual Check-in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
