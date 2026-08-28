import type { ServiceState } from '@/lib/types'

const STATE_STYLES: Record<ServiceState, string> = {
  ready: 'border-[var(--neon-green)] text-[var(--neon-green)] text-glow-green',
  building: 'border-[var(--neon-amber)] text-[var(--neon-amber)] text-glow-amber animate-pulse-glow',
  error: 'border-[var(--neon-red)] text-[var(--neon-red)] text-glow-red animate-pulse-glow',
  offline: 'border-gray-600 text-gray-400',
  unknown: 'border-gray-600 text-gray-400',
}

const DOT_STYLES: Record<ServiceState, string> = {
  ready: 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]',
  building: 'bg-[var(--neon-amber)] shadow-[0_0_6px_var(--neon-amber)]',
  error: 'bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red)]',
  offline: 'bg-gray-500',
  unknown: 'bg-gray-500',
}

const STATE_LABELS: Record<ServiceState, string> = {
  ready: 'READY',
  building: 'BUILDING',
  error: 'ERROR',
  offline: 'OFFLINE',
  unknown: 'UNKNOWN',
}

export default function StatusPill({ state }: { state: ServiceState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border bg-black/70 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider ${STATE_STYLES[state]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[state]}`} />
      {STATE_LABELS[state]}
    </span>
  )
}
