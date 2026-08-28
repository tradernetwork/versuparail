import { NextResponse } from 'next/server'
import type { ProviderStatus, ServiceState } from '@/lib/types'

// Supabase Management API — GET /v1/projects/{ref}
// Docs: https://api.supabase.com/api/v1 (see the "status" enum on the
// project object). Values observed/plausible as of the current API:
//   ACTIVE_HEALTHY                          - project is up and healthy
//   ACTIVE_UNHEALTHY                        - project is up but degraded
//   COMING_UP, RESTARTING, RESTORING,
//   UPGRADING, RESIZING, PAUSING, GOING_DOWN - transition in progress
//   INACTIVE, REMOVED, PAUSED               - not running, not an error
//   INIT_FAILED, RESTORE_FAILED, PAUSE_FAILED - broken / failed transition
//   UNKNOWN                                 - Supabase itself doesn't know
interface SupabaseProject {
  id?: string
  ref?: string
  name?: string
  region?: string
  status?: string
  database?: {
    host?: string
    version?: string
    postgres_engine?: string
    release_channel?: string
  }
  created_at?: string
}

function mapStatus(status: string | undefined): ServiceState {
  switch (status) {
    case 'ACTIVE_HEALTHY':
      return 'ready'
    case 'COMING_UP':
    case 'RESTARTING':
    case 'RESTORING':
    case 'UPGRADING':
    case 'RESIZING':
    case 'PAUSING':
    case 'GOING_DOWN':
      return 'building'
    case 'INACTIVE':
    case 'REMOVED':
    case 'PAUSED':
      return 'offline'
    case 'ACTIVE_UNHEALTHY':
    case 'INIT_FAILED':
    case 'RESTORE_FAILED':
    case 'PAUSE_FAILED':
    case 'UNHEALTHY':
      return 'error'
    default:
      return 'unknown'
  }
}

export async function GET() {
  const fetchedAt = new Date().toISOString()

  try {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN
    const projectRef = process.env.SUPABASE_PROJECT_REF

    if (!accessToken || !projectRef) {
      const status: ProviderStatus = {
        provider: 'supabase',
        label: 'Supabase',
        overall: 'unknown',
        items: [],
        error: 'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env var',
        fetchedAt,
      }
      return NextResponse.json(status)
    }

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const status: ProviderStatus = {
        provider: 'supabase',
        label: 'Supabase',
        overall: 'unknown',
        items: [],
        error: `Supabase API responded with ${res.status} ${res.statusText}`,
        fetchedAt,
      }
      return NextResponse.json(status)
    }

    const project = (await res.json()) as SupabaseProject
    const state = mapStatus(project.status)
    const version = project.database?.version
    const region = project.region

    const detailParts = [region, version ? `Postgres ${version}` : undefined].filter(Boolean)

    const status: ProviderStatus = {
      provider: 'supabase',
      label: 'Supabase',
      overall: state === 'error' ? 'error' : 'ok',
      items: [
        {
          name: project.name || projectRef,
          state,
          detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
          // NOTE: created_at is the project's creation time, not a live
          // health/last-updated timestamp — the Management API's project
          // endpoint doesn't expose one, so this is the best available.
          timestamp: project.created_at,
          url: `https://supabase.com/dashboard/project/${projectRef}`,
        },
      ],
      fetchedAt,
    }

    return NextResponse.json(status)
  } catch (err) {
    const status: ProviderStatus = {
      provider: 'supabase',
      label: 'Supabase',
      overall: 'unknown',
      items: [],
      error: err instanceof Error ? err.message : 'Unknown error fetching Supabase status',
      fetchedAt,
    }
    return NextResponse.json(status)
  }
}
