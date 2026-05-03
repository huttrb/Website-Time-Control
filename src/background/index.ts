import type { AppSettings, Stats } from '../types'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  trackingKeyForUrl,
} from '../stores/tracked'

let activeHost: string | null = null
let startTime = 0
let intervalId: number | null = null
let settings: AppSettings = DEFAULT_SETTINGS

chrome.storage.local.get('settings', (res: { settings?: AppSettings }) => {
  settings = normalizeSettings(res.settings)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    settings = normalizeSettings(changes.settings.newValue as AppSettings)
    refreshCurrentTabTracking()
  }
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  handleTabChange(tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) handleTabChange(tabId)
})

chrome.tabs.onRemoved.addListener(stopTracking)
chrome.runtime.onSuspend.addListener(stopTracking)

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'toggleFavourite') toggleFavourite(msg.site)
  if (msg.type === 'removeSite') removeSite(msg.site, msg.dateKeys)
  if (msg.type === 'clearStats') clearStats()
})

function toggleFavourite(site: string) {
  chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
    const stats = res.stats || {}
    const prev = stats[site] || { time: 0, isFavorite: false, daily: {} }

    stats[site] = { ...prev, isFavorite: !prev.isFavorite }
    chrome.storage.local.set({ stats })
  })
}

function removeSite(site: string, dateKeys?: string[]) {
  chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
    const stats = res.stats || {}
    const prev = stats[site]

    if (!prev) return

    if (dateKeys === undefined) {
      delete stats[site]
      chrome.storage.local.set({ stats })
      return
    }

    if (!dateKeys.length) return

    const datesToRemove = new Set(dateKeys)
    const daily = { ...(prev.daily || {}) }

    dateKeys.forEach((key) => {
      delete daily[key]
    })

    const nextTime = Object.values(daily).reduce((sum, time) => sum + time, 0)

    if (nextTime <= 0) {
      delete stats[site]
    } else {
      stats[site] = {
        ...prev,
        time: nextTime,
        daily: Object.fromEntries(
          Object.entries(daily).filter(
            ([key, time]) => !datesToRemove.has(key) && time > 0,
          ),
        ),
      }
    }

    chrome.storage.local.set({ stats })
  })
}

function clearStats() {
  chrome.storage.local.set({ stats: {} })
}

function startTrackingInterval() {
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(() => {
    if (!activeHost || !startTime) return
    const delta = Date.now() - startTime
    saveTime(activeHost, delta)
    startTime = Date.now()
  }, 1000)
}

async function handleTabChange(tabId: number) {
  stopTracking()

  const tab = await chrome.tabs.get(tabId)
  if (!tab.url || tab.url.startsWith('chrome://')) return

  const url = tab.url.toLowerCase()
  activeHost = trackingKeyForUrl(url, settings)
  if (!activeHost) return

  startTime = Date.now()
  startTrackingInterval()
}

async function refreshCurrentTabTracking() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    stopTracking()
    return
  }

  handleTabChange(tab.id)
}

function stopTracking() {
  if (!activeHost || !startTime) return

  const delta = Date.now() - startTime
  saveTime(activeHost, delta)

  activeHost = null
  startTime = 0

  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function saveTime(site: string, ms: number) {
  chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
    const stats = res.stats || {}
    const prev = stats[site] || { time: 0, isFavorite: false }
    const today = localDateKey()

    stats[site] = {
      ...prev,
      time: prev.time + ms,
      daily: {
        ...(prev.daily || {}),
        [today]: (prev.daily?.[today] || 0) + ms,
      },
    }

    chrome.storage.local.set({ stats })
  })
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
