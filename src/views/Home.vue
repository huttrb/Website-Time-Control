<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMainStore } from '../stores/main'

const store = useMainStore()

type TimeFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month'
type SortMode = 'nameAsc' | 'nameDesc' | 'timeDesc' | 'timeAsc'

const timeFilter = ref<TimeFilter>('all')
const sortMode = ref<SortMode>('timeDesc')
const isTimeOpen = ref(false)
const isSortOpen = ref(false)
const timeMenu = ref<HTMLElement | null>(null)
const sortMenu = ref<HTMLElement | null>(null)

const timeFilters: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'Всего' },
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
]

const sortModes: { value: SortMode; label: string }[] = [
  { value: 'nameAsc', label: 'По названию A-Z' },
  { value: 'nameDesc', label: 'По названию Z-A' },
  { value: 'timeDesc', label: 'По времени: убывание' },
  { value: 'timeAsc', label: 'По времени: возрастание' },
]

const selectedSortLabel = computed(
  () => sortModes.find((sort) => sort.value === sortMode.value)?.label,
)

const selectedTimeLabel = computed(
  () => timeFilters.find((filter) => filter.value === timeFilter.value)?.label,
)

const stats = computed(() =>
  Object.entries(store.stats)
    .map(([site, value]) => ({
      site,
      value,
      filteredTime: timeForFilter(value.time, value.daily || {}),
    }))
    .filter(({ filteredTime }) => filteredTime >= 1000)
    .sort((a, b) => {
      if (a.value.isFavorite && !b.value.isFavorite) return -1
      if (!a.value.isFavorite && b.value.isFavorite) return 1
      if (sortMode.value === 'nameAsc')
        return a.site.localeCompare(b.site, undefined, { sensitivity: 'base' })
      if (sortMode.value === 'nameDesc')
        return b.site.localeCompare(a.site, undefined, { sensitivity: 'base' })
      if (sortMode.value === 'timeAsc') return a.filteredTime - b.filteredTime
      return b.filteredTime - a.filteredTime
    }),
)

onMounted(() => {
  store.load()
  window.addEventListener('click', closeMenus)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenus)
})

function toggleTimeMenu() {
  isTimeOpen.value = !isTimeOpen.value
  isSortOpen.value = false
}

function toggleSortMenu() {
  isSortOpen.value = !isSortOpen.value
  isTimeOpen.value = false
}

function selectTimeFilter(filter: TimeFilter) {
  timeFilter.value = filter
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

function timeForFilter(totalTime: number, daily: Record<string, number>) {
  if (timeFilter.value === 'all') return totalTime

  return dateKeysForFilter(timeFilter.value).reduce(
    (sum, key) => sum + (daily[key] || 0),
    0,
  )
}

function dateKeysForFilter(filter: Exclude<TimeFilter, 'all'>) {
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

        <div
          v-if="isTimeOpen"
          class="absolute left-0 top-12 z-20 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur"
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
      </div>
    </div>

    <div class="h-78 overflow-y-auto pr-2 custom-scrollbar">
      <ul class="flex flex-col gap-4">
        <li
          v-for="{ site, value, filteredTime } in stats"
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
                  'size-6 cursor-pointer',
                  { 'text-amber-300': value.isFavorite },
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
                {{ site }}
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
      </ul>
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
