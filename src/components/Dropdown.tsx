// src/components/Dropdown.tsx
// Liste déroulante personnalisée (remplace <select> natif, dont le rendu varie selon l'appareil).
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"

export interface DropdownOption { value: string; label: string }

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  placeholder?: string
  icon?: React.ReactNode
}

export default function Dropdown({ value, options, onChange, placeholder = "Sélectionner...", icon }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  // Fermeture au clic extérieur et avec Échap.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-2.5 border rounded-xl px-3.5 py-3 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          open ? "border-primary-500 bg-white" : "border-slate-300 bg-slate-50 hover:bg-white"
        }`}
      >
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <span className={`flex-1 truncate ${current ? "text-slate-900 font-medium" : "text-slate-400"}`}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul role="listbox" className="absolute z-50 left-0 right-0 mt-1.5 max-h-56 overflow-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1">
          {options.map((o) => {
            const selected = o.value === value
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-left transition ${
                    selected ? "bg-primary-50 text-primary-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {selected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
