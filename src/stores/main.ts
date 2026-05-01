import { defineStore } from 'pinia'
import type { AppSettings, Stats } from '../types'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  trackedHostDomain,
  trackedHostKey,
  trackedHostLabel,
} from './tracked'

let storageListenerAttached = false

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeStats(stats: Stats, settings: AppSettings) {
  const today = localDateKey()
  let changed = false
  const normalized: Stats = {}
  const nameMatches = new Map<string, string[]>()

  settings.trackedHosts.forEach((host) => {
    const keys = nameMatches.get(host.name) || []
    keys.push(trackedHostKey(host))
    nameMatches.set(host.name, keys)
  })

  Object.entries(stats).forEach(([site, stat]) => {
    const keysForLegacyName = nameMatches.get(site) || []
    const normalizedKey: string =
      keysForLegacyName.length === 1 ? keysForLegacyName[0]! : site
    const daily = stat.daily || {}
    const dailyTotal = Object.values(daily).reduce((sum, time) => sum + time, 0)
    const missingTime = stat.time - dailyTotal
    const prev = normalized[normalizedKey]
    const normalizedStat = {
      ...stat,
      time: stat.time + (prev?.time || 0),
      isFavorite: stat.isFavorite || prev?.isFavorite,
      daily: mergeDaily(prev?.daily, daily),
    }

    if (normalizedKey !== site) changed = true

    if (missingTime > 0) {
      normalized[normalizedKey] = {
        ...normalizedStat,
        daily: {
          ...normalizedStat.daily,
          [today]: (normalizedStat.daily?.[today] || 0) + missingTime,
        },
      }
      changed = true
      return
    }

    normalized[normalizedKey] = normalizedStat
  })

  return { stats: normalized, changed }
}

function mergeDaily(
  first: Record<string, number> | undefined,
  second: Record<string, number> | undefined,
) {
  const daily = { ...(first || {}) }

  Object.entries(second || {}).forEach(([key, time]) => {
    daily[key] = (daily[key] || 0) + time
  })

  return daily
}

export const useMainStore = defineStore('main', {
  state: () => ({
    stats: {} as Stats,
    settings: DEFAULT_SETTINGS as AppSettings,
    loaded: false,
  }),

  getters: {
    sortedStats(state): Stats {
      return Object.entries(state.stats)
        .filter(([_, v]) => v.time >= state.settings.minVisibleTimeMs)
        .sort(([_a, a], [_b, b]) => {
          if (a.isFavorite && !b.isFavorite) return -1
          if (!a.isFavorite && b.isFavorite) return 1
          return b.time - a.time
        })
        .reduce((acc, [k, v]) => {
          acc[k] = v
          return acc
        }, {} as Stats)
    },
  },

  actions: {
    load() {
      chrome.storage.local.get(
        ['settings', 'stats'],
        (res: { settings?: AppSettings; stats?: Stats }) => {
          const settings = normalizeSettings(res.settings)
          const { stats, changed } = normalizeStats(res.stats ?? {}, settings)

          this.settings = settings
          this.stats = stats
          this.loaded = true

          if (changed) {
            chrome.storage.local.set({ stats })
          }
        },
      )

      if (storageListenerAttached) return
      storageListenerAttached = true

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return

        if (changes.settings) {
          this.settings = normalizeSettings(
            changes.settings.newValue as AppSettings | undefined,
          )
        }

        if (changes.stats) {
          const { stats, changed } = normalizeStats(
            (changes.stats.newValue ?? {}) as Stats,
            this.settings,
          )

          this.stats = stats

          if (changed) {
            chrome.storage.local.set({ stats })
          }
        }
      })
    },

    toggleFavourite(site: string) {
      chrome.runtime.sendMessage({ type: 'toggleFavourite', site })
    },

    remove(site: string) {
      chrome.runtime.sendMessage({ type: 'removeSite', site })
    },

    clear() {
      chrome.runtime.sendMessage({ type: 'clearStats' })
    },

    saveSettings(settings: AppSettings) {
      chrome.storage.local.set({ settings: normalizeSettings(settings) })
    },

    hostDomain(key: string) {
      return trackedHostDomain(key, this.settings)
    },

    siteLabel(key: string) {
      return trackedHostLabel(key, this.settings)
    },
  },
})
