<script setup lang="ts">
defineProps<{ to: string }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="relative text-2xl uppercase transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-500 after:transition-all after:duration-200 hover:after:w-full"
  >
    <slot />
  </RouterLink>
</template>
