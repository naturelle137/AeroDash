import { it, expect } from 'vitest'
import router from './index'

// @UT-SYS-APP-001@ (FROM: @IMP-SYS-APP-001@)
it('registers root route with redirect to /mass-balance', () => {
  const rootWithRedirect = router.getRoutes().find((r) => r.path === '/' && r.redirect != null)
  expect(rootWithRedirect).toBeDefined()
  const redir = rootWithRedirect!.redirect
  expect(typeof redir === 'string' ? redir : (redir as { path: string }).path).toBe('/mass-balance')
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
