<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ru } from 'date-fns/locale'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TimeFilter } from '../types'
import { useMainStore } from '../stores/main'
import { trackingKeyForUrl } from '../stores/tracked'

const store = useMainStore()

type SortMode = 'nameAsc' | 'nameDesc' | 'timeDesc' | 'timeAsc'

interface ActiveTabInfo {
  title: string
  host: string
  site: string
  favicon: string
}

interface ActiveTabChangeInfo {
  url?: string
  title?: string
  favIconUrl?: string
}

const timeFilter = ref<TimeFilter>('today')
const sortMode = ref<SortMode>('timeDesc')
const isTimeOpen = ref(false)
const isSortOpen = ref(false)
const timeMenu = ref<HTMLElement | null>(null)
const sortMenu = ref<HTMLElement | null>(null)
const activeTab = ref<ActiveTabInfo | null>(null)
const customStartKey = ref<string | null>(null)
const customEndKey = ref<string | null>(null)
const draftDateRange = ref<Date[] | null>(null)
const isCalendarOpen = ref(false)

const timeFilters = computed<{ value: TimeFilter; label: string }[]>(() => {
  const weekRange = statsDateRangeForFilter('week')
  const monthRange = statsDateRangeForFilter('month')
  const allRange = allStatsDateRange.value

  return [
    { value: 'today', label: 'Сегодня' },
    { value: 'yesterday', label: 'Вчера' },
    {
      value: 'week',
      label: `Неделя (${formatDate(weekRange.start)} - ${formatDate(weekRange.end)})`,
    },
    {
      value: 'month',
      label: `Месяц (${formatDate(monthRange.start)} - ${formatDate(monthRange.end)})`,
    },
    {
      value: 'all',
      label: `Всего (${formatDate(allRange.start)} - ${formatDate(allRange.end)})`,
    },
    { value: 'custom', label: customDateLabel.value },
  ]
})

const sortModes: { value: SortMode; label: string }[] = [
  { value: 'timeDesc', label: 'По времени: убывание' },
  { value: 'timeAsc', label: 'По времени: возрастание' },
  { value: 'nameAsc', label: 'По названию A-Z' },
  { value: 'nameDesc', label: 'По названию Z-A' },
]

const selectedSortLabel = computed(
  () => sortModes.find((sort) => sort.value === sortMode.value)?.label,
)

const selectedTimeLabel = computed(
  () =>
    timeFilters.value.find((filter) => filter.value === timeFilter.value)
      ?.label,
)

const customDateLabel = computed(() => {
  if (customStartKey.value && customEndKey.value) {
    const start = dateFromKey(customStartKey.value)
    const end = dateFromKey(customEndKey.value)

    if (start && end) return `Выбрано (${formatDate(start)} - ${formatDate(end)})`
  }

  if (customStartKey.value) {
    const start = dateFromKey(customStartKey.value)
    if (start) return `Выберите конец (${formatDate(start)})`
  }

  return 'Выбрать даты'
})

const draftDateLabel = computed(() => {
  if (draftDateRange.value?.[0] && draftDateRange.value?.[1]) {
    return `${formatDate(draftDateRange.value[0])} - ${formatDate(draftDateRange.value[1])}`
  }

  if (draftDateRange.value?.[0]) {
    return `Начало: ${formatDate(draftDateRange.value[0])}`
  }

  return 'Выберите начало диапазона'
})

const allStatsDateRange = computed(() => {
  return statsDateRange()
})

const availableDateKeys = computed(
  () =>
    new Set(
      Object.values(store.stats).flatMap((stat) =>
        Object.entries(stat.daily || {})
          .filter(([_, time]) => time > 0)
          .map(([key]) => key),
      ),
    ),
)

const availableDates = computed(() =>
  Array.from(availableDateKeys.value)
    .map(dateFromKey)
    .filter((date): date is Date => Boolean(date)),
)

const activeTabStat = computed(() => {
  if (!activeTab.value) return null

  return store.stats[activeTab.value.site] || null
})

const activeTabTime = computed(() => {
  if (!activeTabStat.value) return 0

  return timeForFilter(activeTabStat.value.time, activeTabStat.value.daily || {})
})

const stats = computed(() =>
  Object.entries(store.stats)
    .map(([site, value]) => ({
      site,
      label: store.siteLabel(site),
      value,
      filteredTime: timeForFilter(value.time, value.daily || {}),
    }))
    .filter(({ filteredTime }) => filteredTime >= store.settings.minVisibleTimeMs)
    .sort((a, b) => {
      if (a.value.isFavorite && !b.value.isFavorite) return -1
      if (!a.value.isFavorite && b.value.isFavorite) return 1
      if (sortMode.value === 'nameAsc')
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      if (sortMode.value === 'nameDesc')
        return b.label.localeCompare(a.label, undefined, { sensitivity: 'base' })
      if (sortMode.value === 'timeAsc') return a.filteredTime - b.filteredTime
      return b.filteredTime - a.filteredTime
    }),
)

onMounted(() => {
  store.load()
  refreshActiveTab()
  chrome.tabs.onActivated.addListener(refreshActiveTab)
  chrome.tabs.onUpdated.addListener(handleTabUpdate)
  window.addEventListener('click', closeMenus)
})

onBeforeUnmount(() => {
  chrome.tabs.onActivated.removeListener(refreshActiveTab)
  chrome.tabs.onUpdated.removeListener(handleTabUpdate)
  window.removeEventListener('click', closeMenus)
})

watch(
  () => store.settings.trackedHosts,
  () => refreshActiveTab(),
  { deep: true },
)

function toggleTimeMenu() {
  isTimeOpen.value = !isTimeOpen.value
  isSortOpen.value = false
}

function toggleSortMenu() {
  isSortOpen.value = !isSortOpen.value
  isTimeOpen.value = false
}

function selectTimeFilter(filter: TimeFilter) {
  if (filter === 'custom') {
    openCalendar()
    return
  }

  timeFilter.value = filter
  isCalendarOpen.value = false
  isTimeOpen.value = false
}

function openCalendar() {
  const start = customStartKey.value ? dateFromKey(customStartKey.value) : null
  const end = customEndKey.value ? dateFromKey(customEndKey.value) : null

  draftDateRange.value = start && end ? [start, end] : null
  isCalendarOpen.value = true
  isTimeOpen.value = false
}

function selectSortMode(mode: SortMode) {
  sortMode.value = mode
  isSortOpen.value = false
}

function closeMenus(event: MouseEvent) {
  if (!timeMenu.value?.contains(event.target as Node)) {
    isTimeOpen.value = false
  }

  if (!sortMenu.value?.contains(event.target as Node)) {
    isSortOpen.value = false
  }
}

async function refreshActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  activeTab.value = tab ? activeTabInfo(tab) : null
}

function handleTabUpdate(
  _tabId: number,
  changeInfo: ActiveTabChangeInfo,
  tab: chrome.tabs.Tab,
) {
  if (!tab.active) return
  if (!changeInfo.url && !changeInfo.title && !changeInfo.favIconUrl) return

  activeTab.value = activeTabInfo(tab)
}

function activeTabInfo(tab: chrome.tabs.Tab): ActiveTabInfo {
  const host = hostFromUrl(tab.url)
  const site = siteFromUrl(tab.url, host)

  return {
    title: tab.title || host || 'Новая вкладка',
    host: host || 'Системная страница',
    site,
    favicon:
      tab.favIconUrl ||
      (host
        ? `https://www.google.com/s2/favicons?domain=${host}&sz=64`
        : 'images/logo.png'),
  }
}

function siteFromUrl(url?: string, host = hostFromUrl(url)) {
  if (!url || !host) return host

  return trackingKeyForUrl(url.toLowerCase(), store.settings) || host
}

function hostFromUrl(url?: string) {
  if (!url) return ''

  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function timeForFilter(totalTime: number, daily: Record<string, number>) {
  if (timeFilter.value === 'all') return totalTime
  if (timeFilter.value === 'custom') {
    return customDateKeys().reduce((sum, key) => sum + (daily[key] || 0), 0)
  }

  return dateKeysForFilter(timeFilter.value).reduce(
    (sum, key) => sum + (daily[key] || 0),
    0,
  )
}

function dateKeysForFilter(filter: Exclude<TimeFilter, 'all' | 'custom'>) {
  const daysByFilter = {
    today: 1,
    yesterday: 1,
    week: 7,
    month: 30,
  }
  const offset = filter === 'yesterday' ? 1 : 0

  return Array.from({ length: daysByFilter[filter] }, (_, index) =>
    localDateKey(daysAgo(index + offset)),
  )
}

function statsDateRangeForFilter(filter: Exclude<TimeFilter, 'all' | 'custom'>) {
  return statsDateRange(dateKeysForFilter(filter))
}

function statsDateRange(allowedKeys?: string[]) {
  const allowed = allowedKeys ? new Set(allowedKeys) : null
  const dates = Object.values(store.stats)
    .flatMap((stat) =>
      Object.entries(stat.daily || {})
        .filter(([key, time]) => time > 0 && (!allowed || allowed.has(key)))
        .map(([key]) => key),
    )
    .map(dateFromKey)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())

  return {
    start: dates[0] || new Date(),
    end: dates[dates.length - 1] || new Date(),
  }
}

function applyCustomDateRange() {
  const [start, end] = draftDateRange.value || []
  if (!start || !end) return

  customStartKey.value = localDateKey(start)
  customEndKey.value = localDateKey(end)
  timeFilter.value = 'custom'
  isCalendarOpen.value = false
}

function closeCalendar() {
  isCalendarOpen.value = false
}

function handleDateRangeUpdate(value: unknown) {
  draftDateRange.value = Array.isArray(value) ? value : null

  const [start, end] = draftDateRange.value || []
  if (start instanceof Date && end instanceof Date) {
    applyCustomDateRange()
  }
}

function customDateKeys() {
  if (!customStartKey.value) return []

  const start = customStartKey.value
  const end = customEndKey.value || customStartKey.value

  return Array.from(availableDateKeys.value).filter(
    (key) => key >= start && key <= end,
  )
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()}`
}

function formattedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  const parts: string[] = []
  if (h > 0)
    parts.push(`${h}<span class="text-blue-500 font-semibold">h</span>`)
  if (m > 0)
    parts.push(`${m}<span class="text-blue-500 font-semibold">m</span>`)
  if (s > 0 || parts.length === 0)
    parts.push(`${s}<span class="text-blue-500 font-semibold">s</span>`)

  return parts.join(' ')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <div ref="timeMenu" class="relative min-w-0 flex-1">
        <button
          type="button"
          class="flex h-10 w-full items-center justify-between gap-2 rounded bg-blue-950 px-3 text-left text-sm text-white shadow-lg shadow-black/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          :class="{ 'bg-blue-900 ring-2 ring-blue-500/70': isTimeOpen }"
          @click.stop="toggleTimeMenu"
        >
          <span class="truncate">{{ selectedTimeLabel }}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-5 shrink-0 transition-transform duration-200 ease-out"
            :class="{ 'rotate-180': isTimeOpen }"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        <Transition name="menu-pop">
          <div
            v-if="isTimeOpen"
            class="absolute left-0 top-12 z-20 w-full overflow-visible rounded-lg border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur"
            @click.stop
          >
            <button
              v-for="filter in timeFilters"
              :key="filter.value"
              type="button"
              class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
              :class="
                timeFilter === filter.value
                  ? 'text-blue-300 bg-blue-500/10'
                  : 'text-white'
              "
              @click="selectTimeFilter(filter.value)"
            >
              <span class="truncate">{{ filter.label }}</span>
              <svg
                v-if="timeFilter === filter.value"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4 shrink-0"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </button>

          </div>
        </Transition>
      </div>

      <div ref="sortMenu" class="relative">
        <button
          type="button"
          class="grid size-10 place-items-center rounded bg-blue-950 text-white shadow-lg shadow-black/20 transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          :class="{ 'bg-blue-900 ring-2 ring-blue-500/70': isSortOpen }"
          :title="selectedSortLabel"
          @click.stop="toggleSortMenu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
            />
          </svg>
        </button>

        <Transition name="menu-pop">
          <div
            v-if="isSortOpen"
            class="absolute right-0 top-12 z-20 w-61 overflow-hidden rounded-lg border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur"
            @click.stop
          >
            <button
              v-for="sort in sortModes"
              :key="sort.value"
              type="button"
              class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
              :class="
                sortMode === sort.value
                  ? 'text-blue-300 bg-blue-500/10'
                  : 'text-white'
              "
              @click="selectSortMode(sort.value)"
            >
              <span class="truncate">{{ sort.label }}</span>
              <svg
                v-if="sortMode === sort.value"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4 shrink-0"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <Transition name="modal-fade">
      <div
        v-if="isCalendarOpen"
        class="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
        @click.self="closeCalendar"
      >
        <div
          class="calendar-panel w-full max-w-[370px] rounded-lg border border-white/10 bg-zinc-900 p-3 shadow-2xl shadow-black/60"
          @click.stop
        >
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-white">Выбор дат</div>
            <div class="truncate text-xs text-white/50">{{ draftDateLabel }}</div>
          </div>

          <button
            type="button"
            class="grid size-8 shrink-0 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white"
            title="Закрыть"
            @click="closeCalendar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <VueDatePicker
          :model-value="draftDateRange"
          inline
          dark
          range
          auto-apply
          :time-picker="false"
          :locale="ru"
          :week-start="1"
          :enable-time-picker="false"
          :allowed-dates="availableDates"
          :clearable="false"
          :action-row="{
            showSelect: false,
            showCancel: false,
            showNow: false,
            showPreview: false,
          }"
          @update:model-value="handleDateRangeUpdate"
        />
        </div>
      </div>
    </Transition>

    <div
      class="rounded border border-blue-400/30 bg-blue-500/10 px-3 py-2 shadow-lg shadow-black/20"
    >
      <div class="mb-1 text-xs font-semibold uppercase text-blue-300/90">
        Текущая вкладка
      </div>
      <div class="min-h-10">
      <div
        v-if="activeTab"
        :key="activeTab.site"
        class="flex min-h-10 items-center gap-2.5"
      >
        <svg
          @click="store.toggleFavourite(activeTab.site)"
          :fill="activeTabStat?.isFavorite ? 'currentColor' : 'none'"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          :class="[
            'favorite-star size-6 shrink-0 cursor-pointer transition hover:scale-110',
            { 'is-favorite text-amber-300': activeTabStat?.isFavorite },
          ]"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>

        <img :src="activeTab.favicon" class="size-5 shrink-0 rounded" />

        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold" :title="activeTab.title">
            {{ activeTab.title }}
          </div>
          <div class="truncate text-xs text-white/60" :title="activeTab.host">
            {{ activeTab.host }}
          </div>
        </div>

        <span
          class="shrink-0 text-sm font-bold"
          v-html="formattedTime(activeTabTime)"
        ></span>

        <svg
          @click="store.remove(activeTab.site)"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-6 shrink-0 cursor-pointer text-red-700 transition hover:scale-130 hover:text-red-500"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </div>
      <div
        v-else
        key="empty-tab"
        class="flex min-h-10 items-center text-sm text-white/60"
      >
        Активная вкладка не найдена
      </div>
      </div>
    </div>

    <div class="h-82 overflow-x-hidden overflow-y-auto pr-2 custom-scrollbar">
      <TransitionGroup
        tag="ul"
        name="stat-list"
        class="stat-list relative flex flex-col gap-4"
      >
        <li
          v-for="{ site, label, value, filteredTime } in stats"
          :key="site"
          class="text-base flex justify-between items-center gap-2.5"
        >
          <div class="flex justify-between items-center w-full">
            <div class="flex gap-2 items-center">
              <svg
                @click="store.toggleFavourite(site)"
                :fill="value.isFavorite ? 'currentColor' : 'none'"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                :class="[
                  'favorite-star size-6 cursor-pointer transition hover:scale-110',
                  { 'is-favorite text-amber-300': value.isFavorite },
                ]"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                />
              </svg>
              <img
                :src="`https://www.google.com/s2/favicons?domain=${store.hostDomain(site)}&sz=64`"
                class="w-5 h-5 rounded"
              />
              <span class="font-semibold truncate max-w-37.5" :title="site">
                {{ label }}
              </span>
            </div>
            <span class="font-bold" v-html="formattedTime(filteredTime)"></span>
          </div>
          <svg
            @click="store.remove(site)"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6 text-red-700 hover:text-red-500 hover:scale-130 transition cursor-pointer"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.menu-pop-enter-active,
.menu-pop-leave-active {
  transform-origin: top right;
  transition:
    opacity 150ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 170ms ease;
}

.modal-fade-enter-active .calendar-panel,
.modal-fade-leave-active .calendar-panel {
  transition:
    opacity 170ms ease,
    transform 190ms cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .calendar-panel,
.modal-fade-leave-to .calendar-panel {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

.stat-list-move,
.stat-list-enter-active,
.stat-list-leave-active {
  transition:
    opacity 160ms ease,
    transform 190ms cubic-bezier(0.22, 1, 0.36, 1);
}

.stat-list-leave-active {
  pointer-events: none;
}

.stat-list-enter-from,
.stat-list-leave-to {
  opacity: 0;
  transform: scale(0.99);
}

.favorite-star {
  transform-origin: center;
  transition:
    color 160ms ease,
    fill 160ms ease,
    transform 160ms ease;
}

.favorite-star.is-favorite {
  animation: favorite-pop 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes favorite-pop {
  0% {
    transform: scale(1);
  }

  55% {
    transform: scale(1.22) rotate(-8deg);
  }

  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-pop-enter-active,
  .menu-pop-leave-active,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .calendar-panel,
  .modal-fade-leave-active .calendar-panel,
  .stat-list-move,
  .stat-list-enter-active,
  .stat-list-leave-active,
  .favorite-star {
    transition: none;
    animation: none;
  }
}

:deep(.dp__action_row) {
  display: none;
}

:deep(.dp__button_bottom),
:deep(.dp__button[aria-label*='time' i]) {
  display: none;
}

:deep(.dp__menu) {
  width: 100%;
  min-width: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #2b7fff;
  border-radius: 100%;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>
