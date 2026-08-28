import { NextResponse } from 'next/server'
import type { ProviderStatus, ServiceItem, ServiceState } from '@/lib/types'

interface VercelDeploymentMeta {
  githubCommitRef?: string
  githubCommitMessage?: string
  githubCommitSha?: string
}

interface VercelDeployment {
  uid: string
  name: string
  readyState?: string
  state?: string
  ready?: number
  createdAt?: number
  inspectorUrl?: string
  target?: string | null
  meta?: VercelDeploymentMeta
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[]
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

function buildDetail(meta: VercelDeploymentMeta | undefined): string | undefined {
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

export async function GET() {
  const fetchedAt = new Date().toISOString()

  try {
    const token = process.env.VERCEL_API_TOKEN
    const projectName = process.env.VERCEL_PROJECT_NAME
    const teamId = process.env.VERCEL_TEAM_ID

    if (!token) throw new Error('VERCEL_API_TOKEN not set')
    if (!projectName) throw new Error('VERCEL_PROJECT_NAME not set')
    if (!teamId) throw new Error('VERCEL_TEAM_ID not set')

    const params = new URLSearchParams({
      projectId: projectName,
      teamId,
      limit: '1',
      target: 'production',
    })

    const res = await fetch(`https://api.vercel.com/v6/deployments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`Vercel API error: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as VercelDeploymentsResponse
    const deployment = data.deployments?.[0]

    if (!deployment) {
      const status: ProviderStatus = {
        provider: 'vercel',
        label: 'Vercel',
        overall: 'unknown',
        items: [],
        error: 'No production deployments found',
        fetchedAt,
      }
      return NextResponse.json(status)
    }

    const state = mapReadyState(deployment.readyState ?? deployment.state)
    const timestampMs = deployment.ready ?? deployment.createdAt
    const teamSlug = process.env.VERCEL_TEAM_SLUG

    const item: ServiceItem = {
      name: deployment.name ?? projectName,
      state,
      detail: buildDetail(deployment.meta),
      timestamp: timestampMs ? new Date(timestampMs).toISOString() : undefined,
      url:
        deployment.inspectorUrl ??
        (teamSlug ? `https://vercel.com/${teamSlug}/${projectName}` : undefined),
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
