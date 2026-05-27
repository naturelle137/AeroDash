import { it, expect } from 'vitest'
import router from './index'

// @UT-SYS-APP-001@ (FROM: @IMP-SYS-APP-001@)
it('registers root route as named home with HomeView component (no redirect)', () => {
  const homeRoute = router.getRoutes().find((r) => r.path === '/')
  expect(homeRoute).toBeDefined()
  expect(homeRoute!.name).toBe('home')
  // The root is a real component route, not a redirect
  expect(homeRoute!.redirect).toBeUndefined()
})

// @UT-UI-ROUTE-001@ (FROM: @IMP-UI-ROUTE-001@)
it('resolves named home route to / path', () => {
  expect(router.hasRoute('home')).toBe(true)
  const resolved = router.resolve({ name: 'home' })
  expect(resolved.name).toBe('home')
  expect(resolved.path).toBe('/')
})

// @UT-SYS-APP-002@ (FROM: @IMP-SYS-APP-001@)
it('resolves named mass-balance route to /mass-balance', () => {
  expect(router.hasRoute('mass-balance')).toBe(true)
  const resolved = router.resolve({ name: 'mass-balance' })
  expect(resolved.name).toBe('mass-balance')
  expect(resolved.path).toBe('/mass-balance')
})

// @UT-SYS-APP-003@ (FROM: @IMP-SYS-APP-001@)
it('resolves /mass-balance path to mass-balance route record', () => {
  const resolved = router.resolve({ path: '/mass-balance' })
  expect(resolved.name).toBe('mass-balance')
})

// @UT-UI-ROUTE-004@ (FROM: @IMP-UI-ROUTE-004@)
it('registers /privacy as the privacy view (REQ-SYS-014, REQ-SYS-015, REQ-SYS-016)', () => {
  expect(router.hasRoute('privacy')).toBe(true)
  const resolved = router.resolve({ name: 'privacy' })
  expect(resolved.path).toBe('/privacy')
})
