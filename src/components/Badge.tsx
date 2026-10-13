// src/components/Badge.tsx
export default function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "green" | "red" | "yellow" | "gray" | "blue" }) {
  const tones: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
}
