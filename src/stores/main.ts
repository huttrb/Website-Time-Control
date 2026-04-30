import { defineStore } from 'pinia'
import type { AppSettings, Stats } from '../types'
import { DEFAULT_SETTINGS, normalizeSettings } from './tracked'

let storageListenerAttached = false

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeStats(stats: Stats) {
  const today = localDateKey()
  let changed = false
  const normalized: Stats = {}

  Object.entries(stats).forEach(([site, stat]) => {
    const daily = stat.daily || {}
    const dailyTotal = Object.values(daily).reduce((sum, time) => sum + time, 0)
    const missingTime = stat.time - dailyTotal

    if (missingTime > 0) {
      normalized[site] = {
        ...stat,
        daily: {
          ...daily,
          [today]: (daily[today] || 0) + missingTime,
        },
      }
      changed = true
      return
    }

    normalized[site] = stat
  })

  return { stats: normalized, changed }
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
      chrome.storage.local.get('settings', (res: { settings?: AppSettings }) => {
        this.settings = normalizeSettings(res.settings)
      })

      chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
        const { stats, changed } = normalizeStats(res.stats ?? {})

        this.stats = stats
        this.loaded = true

        if (changed) {
          chrome.storage.local.set({ stats })
        }
      })

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
      const match = this.settings.trackedHosts.find((host) => host.name === key)
      return match ? match.domain : key
    },
  },
})
