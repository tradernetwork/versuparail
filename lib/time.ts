/** Format an ISO 8601 timestamp as a short relative time string, e.g. "3m ago". */
export function formatRelativeTime(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const diffMs = now - then
  const future = diffMs < 0
  const diffSec = Math.round(Math.abs(diffMs) / 1000)

  let value: number
  let unit: string
  if (diffSec < 60) {
    value = diffSec
    unit = 's'
  } else if (diffSec < 3600) {
    value = Math.round(diffSec / 60)
    unit = 'm'
  } else if (diffSec < 86400) {
    value = Math.round(diffSec / 3600)
    unit = 'h'
  } else {
    value = Math.round(diffSec / 86400)
    unit = 'd'
  }

  return future ? `in ${value}${unit}` : `${value}${unit} ago`
}
