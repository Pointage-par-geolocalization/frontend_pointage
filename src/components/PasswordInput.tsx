// src/components/PasswordInput.tsx
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">

/** Champ mot de passe avec bouton afficher / masquer. `className` s'applique à l'input. */
export default function PasswordInput({ className = "", ...props }: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  )
}
