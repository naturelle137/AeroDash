import { createRouter, createWebHistory } from 'vue-router'
import MassBalanceView from '@/modules/mass-balance/views/MassBalanceView.vue'
import FleetManagementView from '@/modules/aircraft/views/FleetManagementView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Vue Router preserves the previous page's scroll offset by default — landing
  // on Mass & Balance from a scrolled wizard would silently drop the pilot
  // mid-page, hiding the freshly-selected aircraft. Reset to the top on every
  // route push, respecting browser back/forward navigation history.
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  },
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
    {
      path: '/performance',
      name: 'performance',
      component: () => import('@/modules/performance/views/PerformanceView.vue'),
    },
    {
      path: '/fleet',
      name: 'fleet',
      component: FleetManagementView,
    },
    {
      path: '/fleet/new',
      name: 'fleet-new',
      component: () => import('@/modules/aircraft/views/AircraftProfileWizardView.vue'),
    },
    {
      path: '/fleet/:id/edit',
      name: 'fleet-edit',
      component: () => import('@/modules/aircraft/views/AircraftProfileEditorView.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
    },
    {
      path: '/contribute',
      name: 'contribute',
      component: () => import('@/views/ContributeView.vue'),
    },
  ],
})

export default router
