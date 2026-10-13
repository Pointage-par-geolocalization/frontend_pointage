// src/components/Toast.tsx
import { useEffect, useRef } from "react"
import { AlertCircle, CheckCircle, Info } from "lucide-react"

export default function Toast({
  message, tone = "info", onClose,
}: { message: string; tone?: "info" | "error" | "success"; onClose: () => void }) {
  // onClose via ref : un parent qui se re-rend (horloge, etc.) ne doit pas relancer le minuteur de 5 s.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), 5000)
    return () => clearTimeout(t)
  }, [message])

  // Styles de fond et icônes adaptés selon le type de message
  const toneConfig: Record<string, { bg: string; icon: any }> = {
    info: { bg: "bg-slate-900 border-slate-800", icon: Info },
    error: { bg: "bg-rose-600 border-rose-500 shadow-rose-600/20", icon: AlertCircle },
    success: { bg: "bg-emerald-600 border-emerald-500 shadow-emerald-600/20", icon: CheckCircle },
  }

  const current = toneConfig[tone] || toneConfig.info
  const Icon = current.icon

  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-md pointer-events-auto animate-fade-in-up">
      <div className={`flex items-center gap-3 ${current.bg} text-white px-4.5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium backdrop-blur-md`}>
        <Icon className="w-5 h-5 shrink-0" />
        <span className="flex-1 leading-snug">{message}</span>
        <button 
          onClick={onClose}
          className="text-white/70 hover:text-white text-xs font-bold px-2 py-1 transition ml-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}