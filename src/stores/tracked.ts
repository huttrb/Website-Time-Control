import type { AppSettings, TrackedHost } from '../types'

export const DEFAULT_TRACKED_HOSTS: TrackedHost[] = [
  { name: 'shorts', pattern: '/shorts/', domain: 'youtube.com', enabled: true },
  { name: 'video', pattern: '/watch', domain: 'youtube.com', enabled: true },
  { name: 'home', pattern: 'youtube.com', domain: 'youtube.com', enabled: true },
]

export const DEFAULT_SETTINGS: AppSettings = {
  trackMode: 'all',
  trackedHosts: DEFAULT_TRACKED_HOSTS,
  minVisibleTimeMs: 1000,
}

export function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  const trackedHosts =
    Array.isArray(settings?.trackedHosts)
      ? settings.trackedHosts
      : DEFAULT_TRACKED_HOSTS

  return {
    trackMode: settings?.trackMode === 'selected' ? 'selected' : 'all',
    trackedHosts: trackedHosts.map((host) => ({
      name: host.name || host.domain || host.pattern || 'site',
      domain: normalizeDomain(host.domain),
      pattern: host.pattern || host.domain || '',
      enabled: host.enabled !== false,
    })),
    minVisibleTimeMs:
      typeof settings?.minVisibleTimeMs === 'number'
        ? Math.max(0, settings.minVisibleTimeMs)
        : DEFAULT_SETTINGS.minVisibleTimeMs,
  }
}

export function findTrackedHost(url: string, hosts: TrackedHost[]) {
  const normalizedUrl = url.toLowerCase()
  const hostname = hostFromUrl(url)
  const normalizedHosts = hosts.map((host) => ({
    ...host,
    pattern: host.pattern.trim().toLowerCase(),
    domain: normalizeDomain(host.domain),
  }))

  return (
    normalizedHosts.find(
      (host) => host.pattern.includes('/') && normalizedUrl.includes(host.pattern),
    ) ||
    normalizedHosts.find(
      (host) => host.pattern && normalizedUrl.includes(host.pattern),
    ) ||
    normalizedHosts.find(
      (host) => !host.pattern && host.domain && hostname.endsWith(host.domain),
    )
  )
}

export function trackingKeyForUrl(url: string, settings: AppSettings) {
  const enabledHosts = settings.trackedHosts.filter((tracked) => tracked.enabled)
  const match = findTrackedHost(url, enabledHosts)

  if (settings.trackMode === 'selected' && !match) return null

  return match?.name || hostFromUrl(url)
}

export function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^www\./, '')
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}
