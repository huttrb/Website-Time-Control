<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { translate } from '../i18n'
import { useMainStore } from '../stores/main'

type RangeKey = 'today' | 'week' | 'month' | 'all'

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
const rangeKeys: RangeKey[] = ['today', 'week', 'month', 'all']

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
  rows.value.filter((row) => row.totalTime >= store.settings.minVisibleTimeMs),
)

const totalTime = computed(() =>
  rows.value.reduce((sum, row) => sum + row.totalTime, 0),
)

const favoriteTime = computed(() =>
  rows.value.reduce((sum, row) => sum + (row.isFavorite ? row.totalTime : 0), 0),
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

const activeDaysCount = computed(() => trackedDays.value.length)
const averagePerDay = computed(() =>
  activeDaysCount.value ? totalTime.value / activeDaysCount.value : 0,
)

const bestDay = computed(() => {
  const best = trackedDays.value
    .map((key) => ({
      key,
      time: rows.value.reduce((sum, row) => sum + (row.daily[key] || 0), 0),
    }))
    .sort((a, b) => b.time - a.time)[0]

  return best || { key: localDateKey(new Date()), time: 0 }
})

const topSite = computed(() => rows.value[0] || null)

const rangeStats = computed(() =>
  rangeKeys.map((range) => ({
    key: range,
    label: rangeLabel(range),
    time: timeForRange(range),
  })),
)

const dailyBars = computed(() => {
  const values = lastDays(14).map((date) => {
    const key = localDateKey(date)

    return {
      key,
      label: shortDate(date),
      time: rows.value.reduce((sum, row) => sum + (row.daily[key] || 0), 0),
    }
  })
  const max = Math.max(...values.map((value) => value.time), 1)

  return values.map((value) => ({
    ...value,
    height: Math.max(6, Math.round((value.time / max) * 100)),
  }))
})

const topRows = computed(() => visibleRows.value.slice(0, 8))

const domainGroups = computed(() => {
  const groups = new Map<string, number>()

  rows.value.forEach((row) => {
    groups.set(row.domain, (groups.get(row.domain) || 0) + row.totalTime)
  })

  return Array.from(groups, ([domain, time]) => ({ domain, time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 6)
})

const recentActivity = computed(() =>
  rows.value
    .map((row) => {
      const dayKeys = Object.entries(row.daily)
        .filter(([_, time]) => time > 0)
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

function timeForRange(range: RangeKey) {
  if (range === 'all') return totalTime.value

  const daysByRange = {
    today: 1,
    week: 7,
    month: 30,
  }

  const keys = new Set(
    lastDays(daysByRange[range]).map((date) => localDateKey(date)),
  )

  return rows.value.reduce(
    (sum, row) =>
      sum +
      Object.entries(row.daily).reduce(
        (dailySum, [key, time]) => dailySum + (keys.has(key) ? time : 0),
        0,
      ),
    0,
  )
}

function rangeLabel(range: RangeKey) {
  if (range === 'today') return t.value('today')
  if (range === 'week') return t.value('week')
  if (range === 'month') return t.value('month')
  return t.value('all')
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

function shortDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}`
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
          {{ activeDaysCount }} {{ t('activeDays') }}
        </div>
      </div>
    </div>

    <div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto pr-2">
      <div v-if="rows.length" class="flex flex-col gap-4">
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

        <section class="grid grid-cols-4 gap-2">
          <div
            v-for="range in rangeStats"
            :key="range.key"
            class="rounded border border-white/10 bg-zinc-900/70 p-2"
          >
            <div class="truncate text-xs text-white/50">
              {{ range.label }}
            </div>
            <div class="mt-1 truncate text-sm font-bold">
              {{ formattedTime(range.time) }}
            </div>
          </div>
        </section>

        <section class="rounded border border-white/10 bg-zinc-900/70 p-3">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold uppercase text-blue-300/90">
              {{ t('dailyDynamics') }}
            </h2>
            <span class="text-xs text-white/45">
              {{ t('last14Days') }}
            </span>
          </div>

          <div class="flex h-32 items-end gap-1.5">
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

              <div class="flex h-24 w-full items-end">
                <div
                  class="w-full rounded-t bg-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.28)] transition group-hover:bg-cyan-300"
                  :style="{ height: `${day.height}%` }"
                ></div>
              </div>
              <span class="text-[10px] leading-none text-white/45">
                {{ day.label.slice(0, 2) }}
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
