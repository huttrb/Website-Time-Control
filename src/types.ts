interface SiteStat {
  time: number
  isFavorite?: boolean
  daily?: Record<string, number>
}

export type Stats = Record<string, SiteStat>

export interface TrackedHost {
  name: string
  pattern: string | RegExp
  domain: string
}
