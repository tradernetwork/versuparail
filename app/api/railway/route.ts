import { NextResponse } from 'next/server'
import type { ProviderStatus, ServiceItem, ServiceState } from '@/lib/types'

// Railway public GraphQL API (v2). Schema confirmed via introspection against
// the live endpoint (__type queries on Query/Project/Environment/Service/
// ServiceInstance/Deployment/DeploymentStatus).
//
// Deployments are scoped per-environment, not per-project, so the project ->
// services -> deployments path doesn't give a "latest deployment for this
// environment" directly. Instead we query environment(id) { serviceInstances }
// — each ServiceInstance is a (service, environment) pair and exposes
// `latestDeployment` directly, which is exactly "current status of this
// service in this environment".
//
// DeploymentStatus enum values observed via introspection:
//   BUILDING, DEPLOYING(*), INITIALIZING, QUEUED, WAITING  - in progress
//   SUCCESS                                                - healthy
//   FAILED, CRASHED                                        - broken
//   REMOVED, REMOVING, SLEEPING, SKIPPED                   - not running, not an error
//   NEEDS_APPROVAL                                         - stalled pending a human, treat as unknown
// (*) DEPLOYING wasn't present in this account's enum but is documented
//     elsewhere in Railway's schema history, so it's mapped defensively.
//
// Databases/plugins (e.g. the Redis service backing `redis-volume`) show up
// as ordinary ServiceInstance nodes with a real `latestDeployment` in this
// project, so they're handled by the same path. Some service instances have
// never been deployed at all (`latestDeployment` is null, `hasEverDeployed`
// is false) — Railway shows these as inactive rather than errored, so they
// map to 'offline'.
function mapDeploymentStatus(status: string | null | undefined): ServiceState {
  switch (status) {
    case 'SUCCESS':
      return 'ready'
    case 'BUILDING':
    case 'DEPLOYING':
    case 'INITIALIZING':
    case 'QUEUED':
    case 'WAITING':
      return 'building'
    case 'FAILED':
    case 'CRASHED':
      return 'error'
    case 'REMOVED':
    case 'REMOVING':
    case 'SLEEPING':
    case 'SKIPPED':
      return 'offline'
    case 'NEEDS_APPROVAL':
    default:
      return 'unknown'
  }
}

interface RailwayDeployment {
  id: string
  status: string | null
  createdAt: string | null
}

interface RailwayServiceInstanceNode {
  serviceId: string
  serviceName: string
  region: string | null
  latestDeployment: RailwayDeployment | null
}

interface RailwayEnvironmentResponse {
  data?: {
    environment?: {
      serviceInstances?: {
        edges?: { node: RailwayServiceInstanceNode }[]
      }
    } | null
  }
  errors?: { message: string }[]
}

const QUERY = `
  query($environmentId: String!) {
    environment(id: $environmentId) {
      serviceInstances {
        edges {
          node {
            serviceId
            serviceName
            region
            latestDeployment {
              id
              status
              createdAt
            }
          }
        }
      }
    }
  }
`

export async function GET() {
  const fetchedAt = new Date().toISOString()

  try {
    const token = process.env.RAILWAY_API_TOKEN
    const projectId = process.env.RAILWAY_PROJECT_ID
    const environmentId = process.env.RAILWAY_ENVIRONMENT_ID

    if (!token) throw new Error('RAILWAY_API_TOKEN not set')
    if (!projectId) throw new Error('RAILWAY_PROJECT_ID not set')
    if (!environmentId) throw new Error('RAILWAY_ENVIRONMENT_ID not set')

    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: QUERY, variables: { environmentId } }),
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`Railway API error: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as RailwayEnvironmentResponse

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Railway API error: ${json.errors[0].message}`)
    }

    const edges = json.data?.environment?.serviceInstances?.edges ?? []

    const items: ServiceItem[] = edges.map(({ node }) => {
      const deployment = node.latestDeployment
      // No deployment ever recorded for this service instance in this
      // environment — Railway treats this as an inactive/not-running
      // service rather than an error state.
      const state = deployment ? mapDeploymentStatus(deployment.status) : 'offline'

      const item: ServiceItem = {
        name: node.serviceName,
        state,
        detail: node.region ?? undefined,
        timestamp: deployment?.createdAt ?? undefined,
        url: node.serviceId
          ? `https://railway.com/project/${projectId}/service/${node.serviceId}`
          : undefined,
      }
      return item
    })

    const overall: ProviderStatus['overall'] = items.some((item) => item.state === 'error')
      ? 'error'
      : 'ok'

    const status: ProviderStatus = {
      provider: 'railway',
      label: 'Railway',
      overall,
      items,
      fetchedAt,
    }

    return NextResponse.json(status)
  } catch (err) {
    const status: ProviderStatus = {
      provider: 'railway',
      label: 'Railway',
      overall: 'unknown',
      items: [],
      error: err instanceof Error ? err.message : 'Unknown error fetching Railway status',
      fetchedAt,
    }
    return NextResponse.json(status)
  }
}
