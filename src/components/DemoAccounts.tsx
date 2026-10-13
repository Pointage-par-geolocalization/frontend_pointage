// src/components/DemoAccounts.tsx
// Mode démo uniquement (npm run dev:mock) : comptes de test cliquables et remise à zéro des données.
import { useState } from "react"
import { FlaskConical, RotateCcw } from "lucide-react"
import { DEMO_ACCOUNTS, DEMO_INVITE_CODE } from "../mocks/demo"

export default function DemoAccounts({ onPick }: { onPick: (identifier: string, password: string) => void }) {
  const [resetting, setResetting] = useState(false)

  async function reset() {
    setResetting(true)
    const { resetMockDb } = await import("../mocks/store")
    resetMockDb()
    window.location.reload()
  }

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
      <div className="flex items-center gap-2 font-semibold text-amber-800">
        <FlaskConical className="w-4 h-4" /> Mode démo — données fictives, aucun serveur
      </div>
      <div className="space-y-1.5">
        {DEMO_ACCOUNTS.map((a) => (
          <button key={a.identifier} type="button" onClick={() => onPick(a.identifier, a.password)}
            className="w-full flex items-center justify-between gap-2 rounded-xl bg-white border border-amber-100 px-3 py-2 text-left hover:border-amber-300 transition">
            <span className="text-slate-700 truncate">{a.label}</span>
            <span className="font-mono text-xs text-slate-500 shrink-0">{a.identifier} · {a.password}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-amber-800/80">
        Code d'invitation admin : <span className="font-mono">{DEMO_INVITE_CODE}</span>. Ouvrez un onglet par compte
        (admin + salarié) pour voir les échanges en direct. Le lieu « Entrepôt Tanambao » accepte le pointage depuis
        n'importe où.
      </p>
      <button type="button" onClick={reset} disabled={resetting}
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:underline disabled:opacity-60">
        <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser les données de démo
      </button>
    </div>
  )
}
