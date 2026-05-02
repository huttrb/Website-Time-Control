<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import type { Marker } from '@vuepic/vue-datepicker'
import { enUS, ru } from 'date-fns/locale'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { TimeFilter } from '../types'
import { translate } from '../i18n'
import { useMainStore } from '../stores/main'

interface StatRow {
  site: string
  label: string
  domain: string
  totalTime: number
  isFavorite: boolean
  daily: Record<string, number>
}

const router = useRouter()
const store = useMainStore()
const t = computed(() => translate.bind(null, store.settings.language))
const timeFilter = ref<TimeFilter>('all')
const customStartKey = ref<string | null>(null)
const customEndKey = ref<string | null>(null)
const draftDateRange = ref<Date[] | null>(null)
const isCalendarOpen = ref(false)
const rangeKeys: TimeFilter[] = [
  'today',
  'yesterday',
  'week',
  'month',
  'all',
  'custom',
]
const calendarLocale = computed(() =>
  store.settings.language === 'ru' ? ru : enUS,
)

const rows = computed<StatRow[]>(() =>
  Object.entries(store.stats)
    .map(([site, stat]) => ({
      site,
      label: store.siteLabel(site),
      domain: store.hostDomain(site) || site,
      totalTime: stat.time,
      isFavorite: Boolean(stat.isFavorite),
      daily: stat.daily || {},
    }))
    .filter((row) => row.totalTime > 0)
    .sort((a, b) => b.totalTime - a.totalTime),
)

const visibleRows = computed(() =>
  periodRows.value.filter(
    (row) => row.totalTime >= store.settings.minVisibleTimeMs,
  ),
)

const periodRows = computed<StatRow[]>(() =>
  rows.value
    .map((row) => ({
      ...row,
      totalTime: timeForRowRange(row),
    }))
    .filter((row) => row.totalTime > 0)
    .sort((a, b) => b.totalTime - a.totalTime),
)

const totalTime = computed(() =>
  periodRows.value.reduce((sum, row) => sum + row.totalTime, 0),
)

const favoriteTime = computed(() =>
  periodRows.value.reduce(
    (sum, row) => sum + (row.isFavorite ? row.totalTime : 0),
    0,
  ),
)

const trackedDays = computed(() => {
  const keys = new Set<string>()

  rows.value.forEach((row) => {
    Object.entries(row.daily).forEach(([key, time]) => {
      if (time > 0) keys.add(key)
    })
  })

  return Array.from(keys).sort()
})

const availableDates = computed(() =>
  trackedDays.value.map(dateFromKey).filter((date) => date.getFullYear() > 0),
)

const availableDateMarkers = computed<Marker[]>(() =>
  availableDates.value.map((date) => ({
    date,
    type: 'dot',
    color: '#38bdf8',
    tooltip: [{ text: t.value('hasStats') }],
  })),
)

const activeDaysCount = computed(() => trackedDays.value.length)
const averagePerDay = computed(() =>
  periodActiveDaysCount.value ? totalTime.value / periodActiveDaysCount.value : 0,
)

const periodActiveDaysCount = computed(() => {
  const keys = selectedDateKeys.value

  if (keys.length) {
    return keys.filter((key) =>
      rows.value.some((row) => (row.daily[key] || 0) > 0),
    ).length
  }

  return activeDaysCount.value
})

const selectedDateKeys = computed(() => dateKeysForFilter(timeFilter.value))

const filterOptions = computed(() =>
  rangeKeys.map((filter) => ({
    value: filter,
    label: filterLabel(filter),
  })),
)

const chartRangeLabel = computed(() => {
  if (selectedDateKeys.value.length > 14 || timeFilter.value === 'all') {
    return t.value('last14Days')
  }

  if (timeFilter.value === 'custom') return customDateLabel()

  return filterLabel(timeFilter.value)
})

const bestDay = computed(() => {
  const keys = selectedDateKeys.value.length ? selectedDateKeys.value : trackedDays.value
  const best = keys
    .map((key) => ({
      key,
      time: rows.value.reduce((sum, row) => sum + (row.daily[key] || 0), 0),
    }))
    .sort((a, b) => b.time - a.time)[0]

  return best || { key: localDateKey(new Date()), time: 0 }
})

const topSite = computed(() => periodRows.value[0] || null)

const dailyBars = computed(() => {
  const dates = datesForChart()
  const values = dates.map((date) => {
    const key = localDateKey(date)

    return {
      key,
      label: shortDate(date),
      dayLabel: String(date.getDate()).padStart(2, '0'),
      time: rows.value.reduce((sum, row) => sum + (row.daily[key] || 0), 0),
    }
  })
  const max = Math.max(...values.map((value) => value.time), 1)

  return values.map((value) => ({
    ...value,
    height:
      value.time > 0 ? Math.max(18, Math.round((value.time / max) * 98)) : 7,
  }))
})

const topRows = computed(() => visibleRows.value.slice(0, 8))

const domainGroups = computed(() => {
  const groups = new Map<string, number>()

  periodRows.value.forEach((row) => {
    groups.set(row.domain, (groups.get(row.domain) || 0) + row.totalTime)
  })

  return Array.from(groups, ([domain, time]) => ({ domain, time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 6)
})

const recentActivity = computed(() =>
  periodRows.value
    .map((row) => {
      const allowedKeys = selectedDateKeys.value
      const dayKeys = Object.entries(row.daily)
        .filter(
          ([key, time]) =>
            time > 0 && (!allowedKeys.length || allowedKeys.includes(key)),
        )
        .map(([key]) => key)
        .sort()
      const lastKey = dayKeys[dayKeys.length - 1]

      return {
        ...row,
        lastKey,
        lastTime: lastKey ? row.daily[lastKey] || 0 : 0,
      }
    })
    .filter((row) => row.lastKey)
    .sort((a, b) => (b.lastKey || '').localeCompare(a.lastKey || ''))
    .slice(0, 7),
)

const longestStreak = computed(() => {
  const keys = new Set(trackedDays.value)
  let best = 0
  let current = 0

  lastDays(90)
    .map(localDateKey)
    .forEach((key) => {
      if (keys.has(key)) {
        current += 1
        best = Math.max(best, current)
        return
      }

      current = 0
    })

  return best
})

onMounted(() => {
  store.load()
})

function back() {
  router.push('/')
}

function selectTimeFilter(filter: TimeFilter) {
  if (filter === 'custom') {
    openCalendar()
    return
  }

  timeFilter.value = filter
  isCalendarOpen.value = false
}

function openCalendar() {
  const start = customStartKey.value ? dateFromKey(customStartKey.value) : null
  const end = customEndKey.value ? dateFromKey(customEndKey.value) : null

  draftDateRange.value = start && end ? [start, end] : null
  isCalendarOpen.value = true
}

function closeCalendar() {
  isCalendarOpen.value = false
}

function handleDateRangeUpdate(value: unknown) {
  draftDateRange.value = Array.isArray(value) ? value : null

  const [start, end] = draftDateRange.value || []
  if (start instanceof Date && end instanceof Date) {
    customStartKey.value = localDateKey(start)
    customEndKey.value = localDateKey(end)
    timeFilter.value = 'custom'
    isCalendarOpen.value = false
  }
}

function filterLabel(filter: TimeFilter) {
  if (filter === 'today') return t.value('today')
  if (filter === 'yesterday') return t.value('yesterday')
  if (filter === 'week') return t.value('week')
  if (filter === 'month') return t.value('month')
  if (filter === 'custom') return t.value('chooseDates')
  return t.value('all')
}

function customDateLabel() {
  if (customStartKey.value && customEndKey.value) {
    return `${formatDate(dateFromKey(customStartKey.value))} - ${formatDate(
      dateFromKey(customEndKey.value),
    )}`
  }

  return t.value('chooseDates')
}

function timeForRowRange(row: StatRow) {
  if (timeFilter.value === 'all') return row.totalTime

  const keys = selectedDateKeys.value
  return keys.reduce((sum, key) => sum + (row.daily[key] || 0), 0)
}

function dateKeysForFilter(filter: TimeFilter) {
  if (filter === 'all') return []
  if (filter === 'custom') return customDateKeys()

  const daysByFilter = {
    today: 1,
    yesterday: 1,
    week: 7,
    month: 30,
  }
  if (filter === 'yesterday') return [localDateKey(daysAgo(1))]

  return lastDays(daysByFilter[filter]).map(localDateKey)
}

function customDateKeys() {
  if (!customStartKey.value) return []

  const start = customStartKey.value
  const end = customEndKey.value || customStartKey.value

  return dateRangeKeys(start, end)
}

function datesForChart() {
  if (timeFilter.value === 'all') return lastDays(14)

  const keys = selectedDateKeys.value
  if (!keys.length) return lastDays(14)

  return keys.slice(-14).map(dateFromKey)
}

function dateRangeKeys(startKey: string, endKey: string) {
  const start = dateFromKey(startKey)
  const end = dateFromKey(endKey)
  const keys: string[] = []

  if (start > end) {
    return dateRangeKeys(endKey, startKey)
  }

  const date = new Date(start)
  while (date <= end) {
    keys.push(localDateKey(date))
    date.setDate(date.getDate() + 1)
  }

  return keys
}

function share(time: number) {
  if (!totalTime.value) return 0
  return Math.round((time / totalTime.value) * 100)
}

function formattedTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (!parts.length || seconds) parts.push(`${seconds}s`)

  return parts.join(' ')
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)

  return new Date(year || 0, (month || 1) - 1, day || 1)
}

function formatDate(date: Date) {
  return `${shortDate(date)}.${date.getFullYear()}`
}

function shortDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}`
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function lastDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (count - index - 1))
    return date
  })
}
</script>

<template>
  <div class="flex h-[462px] flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded bg-zinc-800 px-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
        @click="back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        {{ t('back') }}
      </button>

      <div class="text-right">
        <div class="text-sm font-semibold uppercase text-blue-300/90">
          {{ t('statistics') }}
        </div>
        <div class="text-xs text-white/45">
          {{ periodActiveDaysCount }} {{ t('activeDays') }}
        </div>
      </div>
    </div>

    <div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto pr-2">
      <div v-if="rows.length" class="flex flex-col gap-4">
        <section class="rounded border border-white/10 bg-zinc-900/70 p-2">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="filter in filterOptions"
              :key="filter.value"
              type="button"
              class="h-8 shrink-0 rounded px-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              :class="
                timeFilter === filter.value
                  ? 'bg-blue-950 text-white shadow shadow-black/20'
                  : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              "
              @click="selectTimeFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          </div>
        </section>

        <Transition name="modal-fade">
          <div
            v-if="isCalendarOpen"
            class="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
            @click.self="closeCalendar"
          >
            <div
              class="calendar-panel w-full max-w-92.5 rounded-lg border border-white/10 bg-zinc-900 p-3 shadow-2xl shadow-black/60"
              @click.stop
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-white">
                    {{ t('dateSelection') }}
                  </div>
                  <div class="truncate text-xs text-white/50">
                    {{ customDateLabel() }}
                  </div>
                </div>

                <button
                  type="button"
                  class="grid size-8 shrink-0 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white"
                  :title="t('close')"
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
                :locale="calendarLocale"
                :week-start="1"
                :enable-time-picker="false"
                :allowed-dates="availableDates"
                :highlight="{ dates: availableDates }"
                :markers="availableDateMarkers"
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

        <section class="grid grid-cols-2 gap-2">
          <div class="rounded border border-blue-400/25 bg-blue-500/10 p-3">
            <div class="text-xs uppercase text-blue-200/80">
              {{ t('totalTime') }}
            </div>
            <div class="mt-1 text-2xl font-bold">
              {{ formattedTime(totalTime) }}
            </div>
          </div>

          <div class="rounded border border-emerald-400/25 bg-emerald-500/10 p-3">
            <div class="text-xs uppercase text-emerald-200/80">
              {{ t('averagePerDay') }}
            </div>
            <div class="mt-1 text-2xl font-bold">
              {{ formattedTime(averagePerDay) }}
            </div>
          </div>

          <div class="rounded border border-amber-400/25 bg-amber-500/10 p-3">
            <div class="text-xs uppercase text-amber-200/80">
              {{ t('favoriteTime') }}
            </div>
            <div class="mt-1 text-2xl font-bold">
              {{ formattedTime(favoriteTime) }}
            </div>
          </div>

          <div class="rounded border border-fuchsia-400/25 bg-fuchsia-500/10 p-3">
            <div class="text-xs uppercase text-fuchsia-200/80">
              {{ t('longestStreak') }}
            </div>
            <div class="mt-1 text-2xl font-bold">
              {{ longestStreak }}d
            </div>
          </div>
        </section>

        <section class="rounded border border-white/10 bg-zinc-900/70 p-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold uppercase text-blue-300/90">
              {{ t('dailyDynamics') }}
            </h2>
            <span class="text-xs text-white/45">
              {{ chartRangeLabel }}
            </span>
          </div>

          <div class="flex h-27 items-end gap-1.5 px-0 pb-0 pt-3">
            <div
              v-for="day in dailyBars"
              :key="day.key"
              class="group relative flex min-w-0 flex-1 flex-col items-center gap-1"
              :title="`${day.label}: ${formattedTime(day.time)}`"
            >
              <div
                class="pointer-events-none absolute -top-7 left-1/2 z-10 min-w-17 -translate-x-1/2 rounded border border-white/10 bg-zinc-950 px-2 py-1 text-center text-[11px] font-semibold text-white opacity-0 shadow-xl shadow-black/40 transition group-hover:opacity-100"
              >
                <div>{{ day.label }}</div>
                <div class="text-blue-300">{{ formattedTime(day.time) }}</div>
              </div>

              <div class="flex h-22 w-full items-end">
                <div
                  class="w-full rounded-t-sm bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.22)] transition group-hover:bg-cyan-300"
                  :class="{ 'shadow-none': day.time === 0 }"
                  :style="{ height: `${day.height}%` }"
                ></div>
              </div>
              <span class="text-[10px] leading-none text-white/45">
                {{ day.dayLabel }}
              </span>
            </div>
          </div>
        </section>

        <section class="rounded border border-white/10 bg-zinc-900/70 p-3">
          <h2 class="mb-3 text-sm font-semibold uppercase text-blue-300/90">
            {{ t('leaders') }}
          </h2>

          <div class="flex flex-col gap-3">
            <div
              v-for="row in topRows"
              :key="row.site"
              class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
            >
              <img
                :src="`https://www.google.com/s2/favicons?domain=${row.domain}&sz=64`"
                class="size-5 rounded"
              />
              <div class="min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold" :title="row.site">
                    {{ row.label }}
                  </span>
                  <span class="text-xs text-white/45">{{ share(row.totalTime) }}%</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
                  <div
                    class="h-full rounded bg-cyan-400"
                    :style="{ width: `${share(row.totalTime)}%` }"
                  ></div>
                </div>
              </div>
              <span class="text-sm font-bold">
                {{ formattedTime(row.totalTime) }}
              </span>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-2 gap-2">
          <div class="rounded border border-white/10 bg-zinc-900/70 p-3">
            <h2 class="mb-3 text-sm font-semibold uppercase text-blue-300/90">
              {{ t('domains') }}
            </h2>

            <div class="flex flex-col gap-2">
              <div
                v-for="group in domainGroups"
                :key="group.domain"
                class="min-w-0"
              >
                <div class="flex justify-between gap-2 text-xs">
                  <span class="truncate">{{ group.domain }}</span>
                  <span class="text-white/45">{{ share(group.time) }}%</span>
                </div>
                <div class="mt-1 h-1 overflow-hidden rounded bg-white/10">
                  <div
                    class="h-full rounded bg-emerald-400"
                    :style="{ width: `${share(group.time)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded border border-white/10 bg-zinc-900/70 p-3">
            <h2 class="mb-3 text-sm font-semibold uppercase text-blue-300/90">
              {{ t('highlights') }}
            </h2>

            <div class="flex flex-col gap-2 text-sm">
              <div class="min-w-0">
                <div class="text-xs text-white/45">{{ t('topSite') }}</div>
                <div class="truncate font-semibold">
                  {{ topSite?.label || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-white/45">{{ t('bestDay') }}</div>
                <div class="font-semibold">
                  {{ shortDate(dateFromKey(bestDay.key)) }} -
                  {{ formattedTime(bestDay.time) }}
                </div>
              </div>
              <div>
                <div class="text-xs text-white/45">{{ t('trackedSites') }}</div>
                <div class="font-semibold">{{ rows.length }}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded border border-white/10 bg-zinc-900/70 p-3">
          <h2 class="mb-3 text-sm font-semibold uppercase text-blue-300/90">
            {{ t('recentActivity') }}
          </h2>

          <div class="flex flex-col gap-2">
            <div
              v-for="row in recentActivity"
              :key="`${row.site}-${row.lastKey}`"
              class="flex items-center justify-between gap-2 text-sm"
            >
              <span class="truncate">{{ row.label }}</span>
              <span class="shrink-0 text-white/60">
                {{ row.lastKey ? shortDate(dateFromKey(row.lastKey)) : '-' }}
                - {{ formattedTime(row.lastTime) }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div
        v-else
        class="grid h-full place-items-center rounded border border-white/10 bg-zinc-900/70 p-6 text-center"
      >
        <div>
          <div class="text-lg font-bold">{{ t('noStatistics') }}</div>
          <div class="mt-2 text-sm text-white/55">
            {{ t('noStatisticsDescription') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.custom-scrollbar-x::-webkit-scrollbar {
  height: 2px;
}

.custom-scrollbar-x::-webkit-scrollbar-thumb {
  background-color: #2b7fff;
  border-radius: 100%;
}

.custom-scrollbar-x::-webkit-scrollbar-track {
  background: transparent;
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

:deep(.dp__cell_highlight:not(.dp__active_date)) {
  border-color: rgb(56 189 248 / 55%);
  background: rgb(56 189 248 / 18%);
  color: #e0f2fe;
  font-weight: 700;
}

:deep(.dp__cell_highlight:not(.dp__active_date):hover) {
  background: rgb(56 189 248 / 28%);
}

:deep(.dp__cell_disabled:not(.dp__cell_highlight)) {
  opacity: 0.35;
}

:deep(.dp__marker_dot) {
  bottom: 3px;
  width: 4px;
  height: 4px;
  box-shadow: 0 0 6px rgb(56 189 248 / 80%);
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .calendar-panel,
  .modal-fade-leave-active .calendar-panel {
    transition: none;
  }
}
</style>
