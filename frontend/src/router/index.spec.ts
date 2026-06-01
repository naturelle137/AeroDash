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
it('registers /privacy as the privacy view (REQ-SYS-014, REQ-SYS-015)', () => {
  expect(router.hasRoute('privacy')).toBe(true)
  const resolved = router.resolve({ name: 'privacy' })
  expect(resolved.path).toBe('/privacy')
})

// @UT-SYS-APP-004@ (FROM: @IMP-SYS-APP-001@)
it('scrollBehavior resets to the top on plain pushes and restores savedPosition on back/forward', () => {
  const sb = router.options.scrollBehavior
  expect(typeof sb).toBe('function')
  // Vue Router's scrollBehavior may return a Promise or void; this app's
  // implementation is synchronous so we can assert the return value directly.
  const route = router.resolve({ name: 'mass-balance' })
  const fresh = (sb as (to: unknown, from: unknown, saved: unknown) => unknown)(
    route,
    route,
    null,
  )
  expect(fresh).toEqual({ top: 0, left: 0 })
  const restored = (sb as (to: unknown, from: unknown, saved: unknown) => unknown)(
    route,
    route,
    { top: 240, left: 0 },
  )
  expect(restored).toEqual({ top: 240, left: 0 })
})
