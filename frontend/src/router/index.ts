import { createRouter, createWebHistory } from 'vue-router'
import MassBalanceView from '@/modules/mass-balance/views/MassBalanceView.vue'
import FleetManagementView from '@/modules/aircraft/views/FleetManagementView.vue'

// @IMP-SYS-APP-001@ (FROM: @REQ-SYS-001@)
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
    // @IMP-UI-ROUTE-003@ (FROM: @REQ-AC-001@, @REQ-UQ-003@)
    {
      path: '/fleet/new',
      name: 'fleet-new',
      component: () => import('@/modules/aircraft/views/AircraftProfileWizardView.vue'),
    },
    // @IMP-UI-ROUTE-002@ (FROM: @REQ-AC-001@, @REQ-AC-005@)
    {
      path: '/fleet/:id/edit',
      name: 'fleet-edit',
      component: () => import('@/modules/aircraft/views/AircraftProfileEditorView.vue'),
    },
    // @IMP-UI-ROUTE-004@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@)
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
    },
  ],
})

export default router
