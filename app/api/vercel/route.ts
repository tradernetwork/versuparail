import { NextResponse } from 'next/server'
import type { ProviderStatus, ServiceItem, ServiceState } from '@/lib/types'

interface VercelMeta {
  githubCommitRef?: string
  githubCommitMessage?: string
  githubCommitSha?: string
}

interface VercelDeployment {
  uid?: string
  id?: string
  name?: string
  readyState?: string
  ready?: number
  createdAt?: number
  meta?: VercelMeta
}

function mapReadyState(readyState: string | undefined): ServiceState {
  switch (readyState) {
    case 'READY':
      return 'ready'
    case 'BUILDING':
    case 'QUEUED':
    case 'INITIALIZING':
    case 'ANALYZING':
      return 'building'
    case 'ERROR':
    case 'CANCELED':
      return 'error'
    default:
      return 'unknown'
  }
}

function buildDetail(meta: VercelMeta | undefined): string | undefined {
  if (!meta) return undefined
  const branch = meta.githubCommitRef
  const rawMessage = meta.githubCommitMessage?.split('\n')[0]
  const shortSha = meta.githubCommitSha?.slice(0, 7)

  const messagePart = rawMessage
    ? rawMessage.length > 60
      ? `${rawMessage.slice(0, 60)}…`
      : rawMessage
    : shortSha

  if (branch && messagePart) return `${branch}: ${messagePart}`
  return branch ?? messagePart
}

async function tryFetch(
  label: string,
  url: string,
  token: string,
): Promise<{ ok: true; deployment: VercelDeployment } | { ok: false; detail: string }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return { ok: false, detail: `[${label}] ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 150)}` : ''}` }
    }
    const data = (await res.json()) as VercelDeployment | { targets?: { production?: VercelDeployment } }
    // "Get a Project" wraps the deployment under targets.production; the other two endpoints return it directly.
    const deployment = 'targets' in data ? data.targets?.production : (data as VercelDeployment)
    if (!deployment) return { ok: false, detail: `[${label}] no production deployment in response` }
    return { ok: true, deployment }
  } catch (err) {
    return { ok: false, detail: `[${label}] ${err instanceof Error ? err.message : 'fetch failed'}` }
  }
}

export async function GET() {
  const fetchedAt = new Date().toISOString()

  try {
    const token = process.env.VERCEL_API_TOKEN
    const projectName = process.env.VERCEL_PROJECT_NAME
    const teamId = process.env.VERCEL_TEAM_ID
    const teamSlug = process.env.VERCEL_TEAM_SLUG

    if (!token) throw new Error('VERCEL_API_TOKEN not set')
    if (!projectName) throw new Error('VERCEL_PROJECT_NAME not set')
    if (!teamId) throw new Error('VERCEL_TEAM_ID not set')

    // A project-scoped Vercel API token behaves inconsistently depending on WHERE the call
    // originates: calling from outside Vercel's network, all three of these endpoints work.
    // Calling from *inside* a Vercel Function (i.e. this very route, once deployed), the
    // "list deployments" endpoint 403s ("permission to list the deployment") and the
    // "get project" endpoint 404s ("Project not found") — both against the identical token
    // that works fine locally. Only the "get single deployment by production alias" endpoint
    // has been confirmed to work from inside Vercel's network. All three are tried in order
    // (cheapest/most-direct first) so this keeps working even if Vercel's platform-internal
    // restrictions change again.
    const attempts = [
      {
        label: 'deployment-by-alias',
        url: `https://api.vercel.com/v13/deployments/${projectName}.vercel.app?teamId=${encodeURIComponent(teamId)}`,
      },
      {
        label: 'get-project',
        url: `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?teamId=${encodeURIComponent(teamId)}`,
      },
      {
        label: 'list-deployments',
        url: `https://api.vercel.com/v6/deployments?${new URLSearchParams({ projectId: projectName, teamId, limit: '1', target: 'production' }).toString()}`,
      },
    ]

    const errors: string[] = []
    let deployment: VercelDeployment | undefined

    for (const attempt of attempts) {
      const result = await tryFetch(attempt.label, attempt.url, token)
      if (result.ok) {
        deployment = result.deployment
        break
      }
      errors.push(result.detail)
    }

    // list-deployments returns { deployments: [...] } rather than a bare deployment — unwrap
    // it if that was the one that succeeded (tryFetch's generic unwrap doesn't cover this shape).
    if (deployment && !('readyState' in deployment) && 'deployments' in (deployment as object)) {
      deployment = (deployment as unknown as { deployments: VercelDeployment[] }).deployments?.[0]
    }

    if (!deployment) {
      const status: ProviderStatus = {
        provider: 'vercel',
        label: 'Vercel',
        overall: 'unknown',
        items: [],
        error: `All Vercel API attempts failed: ${errors.join(' | ')}`,
        fetchedAt,
      }
      return NextResponse.json(status)
    }

    const state = mapReadyState(deployment.readyState)
    const timestampMs = deployment.ready ?? deployment.createdAt
    const deploymentId = deployment.id ?? deployment.uid

    const item: ServiceItem = {
      name: deployment.name ?? projectName,
      state,
      detail: buildDetail(deployment.meta),
      timestamp: timestampMs ? new Date(timestampMs).toISOString() : undefined,
      url:
        teamSlug && deploymentId
          ? `https://vercel.com/${teamSlug}/${projectName}/${deploymentId}`
          : teamSlug
            ? `https://vercel.com/${teamSlug}/${projectName}`
            : undefined,
    }

    const status: ProviderStatus = {
      provider: 'vercel',
      label: 'Vercel',
      overall: state === 'error' ? 'error' : 'ok',
      items: [item],
      fetchedAt,
    }

    return NextResponse.json(status)
  } catch (err) {
    const status: ProviderStatus = {
      provider: 'vercel',
      label: 'Vercel',
      overall: 'unknown',
      items: [],
      error: err instanceof Error ? err.message : 'Unknown error fetching Vercel status',
      fetchedAt,
    }
    return NextResponse.json(status)
  }
}
