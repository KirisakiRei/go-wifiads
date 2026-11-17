export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 1) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  if (hours) return `${hours}j ${minutes}m`
  if (minutes) return `${minutes}m ${remainingSeconds}d`
  return `${remainingSeconds}d`
}

export function formatBytes(value?: number | null): string {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`
}
