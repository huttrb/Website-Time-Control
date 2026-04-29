import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Settings from '../views/Settings.vue'
import Blacklist from '../views/Blacklist.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
    { path: '/blacklist', component: Blacklist },
  ],
  linkActiveClass: 'after:w-full',
  linkExactActiveClass: 'after:w-full',
})
