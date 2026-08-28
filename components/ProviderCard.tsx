import type { ProviderStatus } from '@/lib/types'
import { formatRelativeTime } from '@/lib/time'
import StatusPill from '@/components/StatusPill'

const OVERALL_CARD_STYLES: Record<ProviderStatus['overall'], string> = {
  ok: 'border-[var(--neon-green)]/60 shadow-[0_0_22px_-8px_var(--neon-green)]',
  error: 'border-[var(--neon-red)]/70 shadow-[0_0_22px_-6px_var(--neon-red)]',
  unknown: 'border-gray-700',
}

const OVERALL_BADGE_STYLES: Record<ProviderStatus['overall'], string> = {
  ok: 'border-[var(--neon-green)] text-[var(--neon-green)] text-glow-green',
  error: 'border-[var(--neon-red)] text-[var(--neon-red)] text-glow-red animate-pulse-glow',
  unknown: 'border-gray-600 text-gray-400',
}

const OVERALL_LABELS: Record<ProviderStatus['overall'], string> = {
  ok: 'ONLINE',
  error: 'ALERT',
  unknown: 'UNKNOWN',
}

export default function ProviderCard({ status }: { status: ProviderStatus }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border-2 bg-black p-5 ${OVERALL_CARD_STYLES[status.overall]}`}
    >
      <div className="flex items-center justify-between border-b border-green-900/40 pb-3">
        <h2 className="font-retro text-2xl tracking-wide text-white">
          {status.label}
        </h2>
        <span
          className={`inline-flex items-center rounded border bg-black/70 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider ${OVERALL_BADGE_STYLES[status.overall]}`}
        >
          {OVERALL_LABELS[status.overall]}
        </span>
      </div>

      {status.error ? (
        <p
          className="line-clamp-4 font-mono text-xs break-words text-[var(--neon-amber)]"
          title={status.error}
        >
          &gt; {status.error}
        </p>
      ) : status.items.length === 0 ? (
        <p className="font-mono text-sm text-gray-500">&gt; no services reported</p>
      ) : (
        <ul className="flex flex-col divide-y divide-green-900/30">
          {status.items.map((item) => (
            <li key={item.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-sm font-medium text-gray-100">
                  <span className="text-[var(--neon-green)]">&gt;</span> {item.name}
                </span>
                <StatusPill state={item.state} />
              </div>
              <div className="flex items-center justify-between gap-2 pl-3 font-mono text-xs text-gray-500">
                <span className="truncate">
                  {item.detail}
                  {item.detail && item.timestamp ? ' · ' : ''}
                  {item.timestamp ? formatRelativeTime(item.timestamp) : ''}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[var(--neon-cyan)] hover:text-glow-cyan hover:underline"
                  >
                    view &rarr;
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
