import { defineStore } from 'pinia'
import type { Stats } from '../types'
import { TRACKED_HOSTS } from './tracked'

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
    loaded: false,
  }),

  getters: {
    sortedStats(state): Stats {
      return Object.entries(state.stats)
        .filter(([_, v]) => v.time >= 1000)
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
      chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
        const { stats, changed } = normalizeStats(res.stats ?? {})

        this.stats = stats
        this.loaded = true

        if (changed) {
          chrome.storage.local.set({ stats })
        }
      })

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.stats) {
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

    hostDomain(key: string) {
      const match = TRACKED_HOSTS.find((host) => host.name === key)
      return match ? match.domain : key // для обычных сайтов key уже домен
    },
  },
})
