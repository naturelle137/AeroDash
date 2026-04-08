import { createRouter, createWebHistory } from 'vue-router'
import MassBalanceView from '@/modules/mass-balance/views/MassBalanceView.vue'

// @IMP-SYS-APP-001@ (FROM: @REQ-SYS-001@)
// @IMP-UI-ROUTE-001@ (FROM: @REQ-SYS-001@)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/mass-balance',
      name: 'mass-balance',
      component: MassBalanceView,
    },
  ],
})

export default router
