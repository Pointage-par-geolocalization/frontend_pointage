// src/components/Card.tsx
import type { ReactNode } from "react"

export default function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-gray-900"}`}>{value}</div>
    </Card>
  )
}
