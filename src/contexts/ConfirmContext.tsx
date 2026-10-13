// src/contexts/ConfirmContext.tsx
// Fenêtre de confirmation (remplace window.confirm) :
//   const confirm = useConfirm()
//   if (!(await confirm({ title: "Supprimer ?", message: "…", tone: "danger" }))) return
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, HelpCircle } from "lucide-react"

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" : action destructrice (bouton rouge). */
  tone?: "danger" | "default"
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false) // une seule confirmation à la fois
    setOpts(o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const close = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }, [])

  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [opts, close])

  const danger = opts?.tone === "danger"

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[20000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                danger ? "bg-rose-100 text-rose-600" : "bg-primary-100 text-primary-600"}`}>
                {danger ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h2 id="confirm-title" className="font-bold text-lg text-slate-900 leading-snug">{opts.title}</h2>
                {opts.message && <div className="text-sm text-slate-500 mt-1 whitespace-pre-line">{opts.message}</div>}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button autoFocus={!danger} onClick={() => close(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50 transition">
                {opts.cancelLabel ?? "Annuler"}
              </button>
              <button autoFocus={danger} onClick={() => close(true)}
                className={`flex-1 text-white font-semibold py-3 rounded-xl shadow-md transition ${
                  danger ? "bg-rose-600 hover:bg-rose-700" : "bg-primary-600 hover:bg-primary-700"}`}>
                {opts.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
