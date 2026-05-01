<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AppLanguage, AppSettings, TrackedHost } from '../types'
import { translate } from '../i18n'
import { useMainStore } from '../stores/main'
import { normalizeDomain, normalizeSettings } from '../stores/tracked'

const router = useRouter()
const store = useMainStore()

interface DraftTrackedHost extends TrackedHost {
  draftId: string
}

type DraftSettings = Omit<AppSettings, 'trackedHosts'> & {
  trackedHosts: DraftTrackedHost[]
}

let draftHostId = 0

const draft = ref<DraftSettings>(cloneSettings(store.settings))
const animateTrackedList = ref(false)
const t = computed(() => translate.bind(null, draft.value.language))
const languages: AppLanguage[] = ['ru', 'en']
const minVisibleSeconds = computed({
  get: () => Math.round(draft.value.minVisibleTimeMs / 1000),
  set: (value: number) => {
    draft.value.minVisibleTimeMs = Math.max(0, Number(value) || 0) * 1000
  },
})

onMounted(() => {
  store.load()
  chrome.storage.local.get('settings', (res: { settings?: AppSettings }) => {
    draft.value = cloneSettings(normalizeSettings(res.settings))

    requestAnimationFrame(() => {
      animateTrackedList.value = true
    })
  })
})

function addTrackedHost() {
  draft.value.trackedHosts.push(
    createDraftHost({
      name: '',
      domain: '',
      pattern: '',
      enabled: true,
    }),
  )
}

function removeTrackedHost(index: number) {
  draft.value.trackedHosts.splice(index, 1)
}

function save() {
  const settings = normalizeSettings({
    ...draft.value,
    trackedHosts: draft.value.trackedHosts
      .map(cleanTrackedHost)
      .filter((host) => host.name || host.domain || host.pattern),
  })

  store.saveSettings(settings)
  router.push('/')
}

function back() {
  router.push('/')
}

function cleanTrackedHost(host: TrackedHost): TrackedHost {
  const domain = normalizeDomain(host.domain)
  const pattern = host.pattern.trim().toLowerCase()
  const name = host.name.trim() || domain || pattern

  return {
    name,
    domain,
    pattern: pattern || domain,
    enabled: host.enabled !== false,
  }
}

function createDraftHost(host: TrackedHost): DraftTrackedHost {
  return {
    ...host,
    draftId: `tracked-host-${draftHostId++}`,
  }
}

function cloneSettings(settings: AppSettings): DraftSettings {
  return {
    ...settings,
    trackedHosts: settings.trackedHosts.map(createDraftHost),
  }
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

      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded bg-blue-950 px-3 text-sm font-semibold text-white transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
        @click="save"
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
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
        {{ t('save') }}
      </button>
    </div>

    <div class="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto pr-2">
      <div class="flex flex-col gap-4">
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold uppercase text-blue-300/90">
            {{ t('language') }}
          </h2>

          <div class="grid grid-cols-2 rounded border border-white/10 bg-zinc-900 p-1">
            <button
              v-for="language in languages"
              :key="language"
              type="button"
              class="h-8 rounded text-sm font-semibold transition"
              :class="
                draft.language === language
                  ? 'bg-blue-950 text-white shadow shadow-black/20'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              "
              @click="draft.language = language"
            >
              {{ language === 'ru' ? t('russian') : t('english') }}
            </button>
          </div>
        </section>

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold uppercase text-blue-300/90">
            {{ t('tracking') }}
          </h2>

          <label class="flex items-center justify-between gap-3 text-sm">
            <span>{{ t('trackSelectedOnly') }}</span>
            <input
              v-model="draft.trackMode"
              type="checkbox"
              true-value="selected"
              false-value="all"
              class="size-4 accent-blue-500"
            />
          </label>
        </section>

        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold uppercase text-blue-300/90">
            {{ t('itemDisplay') }}
          </h2>

          <label class="flex flex-col gap-1 text-sm">
            <span class="text-white/70">{{ t('minVisibleTimeSeconds') }}</span>
            <input
              v-model.number="minVisibleSeconds"
              type="number"
              min="0"
              step="1"
              class="no-spinner h-10 rounded border border-white/10 bg-zinc-900 px-3 text-white outline-none focus:border-blue-500"
            />
          </label>
        </section>

        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold uppercase text-blue-300/90">
              {{ t('sites') }}
            </h2>

            <button
              type="button"
              class="grid size-8 place-items-center rounded bg-blue-950 text-white transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              :title="t('addSite')"
              @click="addTrackedHost"
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          <TransitionGroup
            tag="div"
            :name="animateTrackedList ? 'tracked-list' : undefined"
            class="tracked-list relative flex flex-col gap-2"
          >
            <div
              v-for="(host, index) in draft.trackedHosts"
              :key="host.draftId"
              class="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded border border-white/10 bg-zinc-900/70 p-2"
            >
              <input
                v-model="host.enabled"
                type="checkbox"
                class="size-4 accent-blue-500"
                :title="t('enabled')"
              />
              <input
                v-model="host.name"
                type="text"
                :placeholder="t('name')"
                class="h-9 min-w-0 rounded border border-white/10 bg-zinc-950 px-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                v-model="host.domain"
                type="text"
                :placeholder="t('domain')"
                class="h-9 min-w-0 rounded border border-white/10 bg-zinc-950 px-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                v-model="host.pattern"
                type="text"
                :placeholder="t('pattern')"
                class="h-9 min-w-0 rounded border border-white/10 bg-zinc-950 px-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <button
                type="button"
                class="grid size-8 place-items-center rounded text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                :title="t('deleteSite')"
                @click="removeTrackedHost(index)"
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
          </TransitionGroup>
        </section>

        <button
          type="button"
          class="flex h-10 items-center justify-center gap-2 rounded border border-red-500/30 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          @click="store.clear"
        >
          {{ t('clearStats') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tracked-list-move,
.tracked-list-enter-active,
.tracked-list-leave-active {
  transition:
    opacity 160ms ease,
    transform 190ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tracked-list-leave-active {
  pointer-events: none;
}

.tracked-list-enter-from,
.tracked-list-leave-to {
  opacity: 0;
  transform: scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .tracked-list-move,
  .tracked-list-enter-active,
  .tracked-list-leave-active {
    transition: none;
  }
}

.no-spinner::-webkit-outer-spin-button,
.no-spinner::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}

.no-spinner {
  appearance: textfield;
  -moz-appearance: textfield;
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
