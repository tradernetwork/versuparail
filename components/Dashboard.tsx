'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProviderStatus } from '@/lib/types'
import { formatRelativeTime } from '@/lib/time'
import ProviderCard from '@/components/ProviderCard'

const REFRESH_INTERVAL_MS = 60_000

const PROVIDERS: { key: 'vercel' | 'railway' | 'supabase'; endpoint: string; label: string }[] = [
  { key: 'vercel', endpoint: '/api/vercel', label: 'Vercel' },
  { key: 'railway', endpoint: '/api/railway', label: 'Railway' },
  { key: 'supabase', endpoint: '/api/supabase', label: 'Supabase' },
]

async function fetchProvider(
  key: 'vercel' | 'railway' | 'supabase',
  endpoint: string,
  label: string,
): Promise<ProviderStatus> {
  try {
    const res = await fetch(endpoint, { cache: 'no-store' })
    if (!res.ok) {
      return {
        provider: key,
        label,
        overall: 'unknown',
        items: [],
        error: `Request failed with status ${res.status}`,
        fetchedAt: new Date().toISOString(),
      }
    }
    const data = (await res.json()) as ProviderStatus
    return data
  } catch (err) {
    return {
      provider: key,
      label,
      overall: 'unknown',
      items: [],
      error: err instanceof Error ? err.message : 'Network error',
      fetchedAt: new Date().toISOString(),
    }
  }
}

export default function Dashboard() {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus | null>>({
    vercel: null,
    railway: null,
    supabase: null,
  })
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all(
      PROVIDERS.map((p) => fetchProvider(p.key, p.endpoint, p.label)),
    )
    setStatuses((prev) => {
      const next = { ...prev }
      results.forEach((result, i) => {
        next[PROVIDERS[i].key] = result
      })
      return next
    })
    setLastRefreshed(new Date())
    setLoading(false)
  }, [])

  const restartInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS)
  }, [refresh])

  useEffect(() => {
    // Initial fetch on mount — setLoading(true) inside refresh() is an intentional
    // synchronous kick-off of the loading state, not a reaction to a state change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    restartInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render periodically so "Last refreshed: Xs ago" stays fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const handleRefreshClick = () => {
    refresh()
    restartInterval()
  }

  const providerList = PROVIDERS.map((p) => statuses[p.key]).filter(
    (s): s is ProviderStatus => s !== null,
  )
  const booting = providerList.length < PROVIDERS.length
  const errored = providerList.filter((s) => s.overall === 'error')
  const degraded = providerList.filter((s) => s.overall === 'unknown')
  // 'error' = a provider confirmed something's actually broken (e.g. a failed deploy).
  // 'unknown' = we couldn't determine status (API hiccup, bad token, etc.) — real, but not
  // the same severity as a confirmed outage, so it gets its own amber tier instead of
  // triggering the same red DANGER alarm.
  const severity = booting ? 'booting' : errored.length > 0 ? 'danger' : degraded.length > 0 ? 'degraded' : 'ok'

  const BANNER_STYLES: Record<typeof severity, string> = {
    booting: 'border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-glow-cyan',
    ok: 'border-[var(--neon-green)] text-[var(--neon-green)] text-glow-green',
    degraded: 'border-[var(--neon-amber)] text-[var(--neon-amber)] text-glow-amber',
    danger: 'border-[var(--neon-red)] text-[var(--neon-red)] text-glow-red animate-pulse-glow',
  }
  const BANNER_TEXT: Record<typeof severity, string> = {
    booting: '◍ INITIALIZING…',
    ok: '● ALL SYSTEMS GO',
    degraded: '◆ DEGRADED',
    danger: '▲ DANGER',
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 bg-black px-5 py-4 font-retro text-3xl tracking-widest sm:text-4xl ${BANNER_STYLES[severity]}`}
      >
        <span>{BANNER_TEXT[severity]}</span>
        {(severity === 'danger' || severity === 'degraded') && (
          <span className="font-mono text-xs font-bold tracking-normal opacity-90 sm:text-sm">
            {[...errored, ...degraded].map((s) => s.label.toUpperCase()).join(' · ')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 font-mono text-xs text-gray-500">
        <p>
          {lastRefreshed
            ? `last refreshed: ${formatRelativeTime(lastRefreshed.toISOString())}`
            : 'booting…'}
        </p>
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={loading}
          className="rounded border border-[var(--neon-cyan)]/60 bg-black px-3 py-1.5 text-xs font-bold tracking-wider text-[var(--neon-cyan)] hover:text-glow-cyan hover:border-[var(--neon-cyan)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? '[ REFRESHING… ]' : '[ REFRESH ]'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PROVIDERS.map((p) => {
          const status = statuses[p.key]
          return status ? (
            <ProviderCard key={p.key} status={status} />
          ) : (
            <div
              key={p.key}
              className="flex h-40 items-center justify-center rounded-lg border-2 border-gray-700 bg-black font-mono text-sm text-gray-500"
            >
              loading {p.label.toLowerCase()}
              <span className="animate-blink">_</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
