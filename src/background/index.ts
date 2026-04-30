import type { Stats } from '../types'
import { TRACKED_HOSTS } from '../stores/tracked'

let activeHost: string | null = null
let startTime = 0
let intervalId: number | null = null

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
  if (msg.type === 'removeSite') removeSite(msg.site)
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

function removeSite(site: string) {
  chrome.storage.local.get('stats', (res: { stats?: Stats }) => {
    const stats = res.stats || {}
    delete stats[site]
    chrome.storage.local.set({ stats })
  })
}

function clearStats() {
  chrome.storage.local.set({ stats: {} })
}

function normalizeHost(host: string) {
  return host.replace(/^www\./, '')
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
  const host = normalizeHost(new URL(tab.url).hostname)

  // ищем первый подходящий паттерн
  const match = TRACKED_HOSTS.find((h) =>
    typeof h.pattern === 'string'
      ? url.includes(h.pattern)
      : h.pattern.test(url),
  )

  // Если нет специального совпадения - просто используем normalized host
  activeHost = match ? match.name : host

  startTime = Date.now()
  startTrackingInterval()
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
