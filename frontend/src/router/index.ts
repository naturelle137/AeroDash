import { createRouter, createWebHistory } from 'vue-router'
import MassBalanceView from '@/modules/mass-balance/views/MassBalanceView.vue'
import FleetManagementView from '@/modules/aircraft/views/FleetManagementView.vue'

// @IMP-SYS-APP-001@ (FROM: @REQ-SYS-001@)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // @IMP-UI-ROUTE-001@ (FROM: @REQ-SYS-001@)
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
    {
      path: '/fleet',
      name: 'fleet',
      component: FleetManagementView,
    },
  ],
})

export default router
