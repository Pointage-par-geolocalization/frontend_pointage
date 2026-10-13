// src/components/EmptyState.tsx
export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-400 text-sm">
      {message}
    </div>
  )
}
