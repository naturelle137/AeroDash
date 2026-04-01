import { createRouter, createWebHistory } from 'vue-router'
import MassBalanceView from '@/modules/mass-balance/views/MassBalanceView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/mass-balance',
    },
    {
      path: '/mass-balance',
      name: 'mass-balance',
      component: MassBalanceView,
    },
  ],
})

export default router
