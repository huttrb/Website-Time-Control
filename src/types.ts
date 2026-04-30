interface SiteStat {
  time: number
  isFavorite?: boolean
  daily?: Record<string, number>
}

export type Stats = Record<string, SiteStat>

export type TimeFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month'

export interface TrackedHost {
  name: string
  pattern: string
  domain: string
  enabled?: boolean
}

export interface AppSettings {
  trackMode: 'all' | 'selected'
  trackedHosts: TrackedHost[]
  minVisibleTimeMs: number
}
