export type ServiceState = 'ready' | 'building' | 'error' | 'offline' | 'unknown'

export interface ServiceItem {
  name: string
  state: ServiceState
  detail?: string // e.g. commit sha, branch, region — short human string
  timestamp?: string // ISO 8601 — last deploy / last updated
  url?: string // link out to the provider's real dashboard for this item
}

export interface ProviderStatus {
  provider: 'vercel' | 'railway' | 'supabase'
  label: string // display name, e.g. "Vercel"
  overall: 'ok' | 'error' | 'unknown'
  items: ServiceItem[]
  error?: string // set if the whole provider fetch failed (auth, network, etc.)
  fetchedAt: string // ISO 8601, when this response was generated
}
