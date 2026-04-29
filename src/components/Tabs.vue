<script setup lang="ts">
import Tab from './Tab.vue'
</script>

<template>
  <div class="flex justify-between items-center gap-2 mb-4">
    <Tab to="/">Home</Tab>
    <Tab to="/settings">Settings</Tab>
    <Tab to="/blacklist">Blacklist</Tab>
  </div>
</template>
