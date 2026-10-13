// src/components/ThemeToggle.tsx
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../contexts/ThemeContext"

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Mode sombre
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition ${dark ? "bg-primary-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${dark ? "translate-x-5" : ""}`} />
      </button>
    </div>
  )
}
