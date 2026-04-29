import type { TrackedHost } from '../types'

export const TRACKED_HOSTS: TrackedHost[] = [
  { name: 'shorts', pattern: '/shorts/', domain: 'youtube.com' },
  { name: 'video', pattern: '/watch', domain: 'youtube.com' },
  { name: 'home', pattern: 'youtube.com', domain: 'youtube.com' },
]
