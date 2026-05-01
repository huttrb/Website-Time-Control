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
      pattern: normalizePattern(host.pattern || host.domain || ''),
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
    pattern: normalizePattern(host.pattern),
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

  return match ? trackedHostKey(match) : hostFromUrl(url)
}

export function trackedHostKey(host: TrackedHost) {
  const domain = normalizeDomain(host.domain)
  const pattern = normalizePattern(host.pattern || domain)

  return `tracked:${domain || 'any'}:${pattern || 'site'}`
}

export function trackedHostLabel(key: string, settings: AppSettings) {
  const match = findTrackedHostByKey(key, settings.trackedHosts)

  return match?.name || key
}

export function trackedHostDomain(key: string, settings: AppSettings) {
  const match = findTrackedHostByKey(key, settings.trackedHosts)

  if (match?.domain) return match.domain
  if (!key.startsWith('tracked:')) return key

  const [, domain] = key.split(':')
  return domain === 'any' ? key : domain
}

function findTrackedHostByKey(key: string, hosts: TrackedHost[]) {
  return hosts.find((host) => trackedHostKey(host) === key)
}

export function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^www\./, '')
}

function normalizePattern(pattern: string) {
  return pattern.trim().toLowerCase()
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}
