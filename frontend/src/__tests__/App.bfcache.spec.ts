/**
 * Regression tests for issue #232 — Delete button unresponsive on /fleet after
 * the pilot returns from /fleet/:id/edit via the browser back button (or the
 * iOS Safari swipe-back edge gesture).
 *
 * The fix listens for `pageshow` with `event.persisted === true` (the bfcache
 * restore signal) and forces the active RouterView to remount via a key that
 * advances on every detected restoration, scoped to routes that have no
 * unsaved pilot input. Without the remount, iOS Safari restores a Vue
 * instance whose template @click handlers no longer fire even though the DOM
 * button stays focusable.
 *
 * Two layers of coverage:
 *
 * 1. `makeBfcacheGate` — a minimal mirror of App.vue's bfcache pattern. Lets
 *    us drive the listener / key invariants in isolation, without pulling
 *    App.vue's full dependency tree into every assertion (PWA store, version
 *    store, theme composable, AppLogo / AppVersion components).
 *
 * 2. The real `App.vue` mounted against a memory-history router — pins
 *    IMP-SYS-SHARED-007 to the actual production wiring, so a future edit
 *    that moved the listener off App.vue, swapped the route-scoped check
 *    for an unconditional bump, or unbound `:key` from `<RouterView>` would
 *    break this suite rather than silently regress the production bug.
 */

// @UT-SYS-APP-031@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-032@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-033@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-034@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-035@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-036@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-037@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-038@ (FROM: @IMP-SYS-SHARED-007@)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type Ref,
} from 'vue'

import App from '../App.vue'
import {
  STORAGE_KEY as DISCLAIMER_STORAGE_KEY,
  computeDisclaimerBaseline,
} from '../stores/disclaimer-acknowledgement.store'

/**
 * Pre-seed the REQ-SYS-016 disclaimer acknowledgement record so the modal
 * does not block <RouterView /> from mounting inside the App shell. The
 * baseline must match what the store computes from `__APP_VERSION__`;
 * otherwise the store treats the seed as a stale baseline and re-opens the
 * gate.
 */
function seedDisclaimerAccepted(): void {
  const version = __APP_VERSION__
  const baseline = computeDisclaimerBaseline(version)
  if (baseline === null) return
  localStorage.setItem(
    DISCLAIMER_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      acceptedVersion: version,
      acceptedBaseline: baseline,
      acceptedAt: 1_780_000_000_000,
    }),
  )
}

interface MountTracker {
  /** Total number of times the wrapped child has executed `onMounted`. */
  mountCount: Ref<number>
}

/**
 * Mirrors App.vue's bfcache handler + RouterView key binding. The
 * `tracker.mountCount` ref is incremented inside the child's `onMounted` so
 * the test can assert how many times the child has been re-instantiated.
 */
function makeBfcacheGate(tracker: MountTracker) {
  const Child = defineComponent({
    name: 'BfcacheChildSpy',
    setup() {
      onMounted(() => {
        tracker.mountCount.value += 1
      })
      return () => h('div', { 'data-testid': 'child' }, 'child')
    },
  })

  return defineComponent({
    name: 'BfcacheGate',
    setup() {
      const bfcacheNonce = ref(0)

      function handlePageShow(event: PageTransitionEvent): void {
        if (event.persisted) {
          bfcacheNonce.value += 1
        }
      }

      onMounted(() => {
        window.addEventListener('pageshow', handlePageShow)
      })

      onBeforeUnmount(() => {
        window.removeEventListener('pageshow', handlePageShow)
      })

      return () => h(Child, { key: bfcacheNonce.value })
    },
  })
}

function firePageshow(persisted: boolean): void {
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted }))
}

describe('App.vue — bfcache restoration (issue #232)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // Defensive: tear down any stray pageshow listeners between tests so an
    // unmount failure in one case cannot pollute the next.
    document.body.innerHTML = ''
  })

  // @UT-SYS-APP-031@ (FROM: @IMP-SYS-SHARED-007@)
  it('mounts the child exactly once on initial render', async () => {
    const tracker: MountTracker = { mountCount: ref(0) }
    const Gate = makeBfcacheGate(tracker)
    mount(Gate)
    await flushPromises()
    expect(tracker.mountCount.value).toBe(1)
  })

  // @UT-SYS-APP-032@ (FROM: @IMP-SYS-SHARED-007@)
  it('does not remount the child when pageshow fires with persisted=false (normal load)', async () => {
    const tracker: MountTracker = { mountCount: ref(0) }
    const Gate = makeBfcacheGate(tracker)
    const wrapper = mount(Gate)
    await flushPromises()
    expect(tracker.mountCount.value).toBe(1)

    firePageshow(false)
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(tracker.mountCount.value).toBe(1)
  })

  // @UT-SYS-APP-033@ (FROM: @IMP-SYS-SHARED-007@)
  it('remounts the child when pageshow fires with persisted=true (bfcache restore)', async () => {
    const tracker: MountTracker = { mountCount: ref(0) }
    const Gate = makeBfcacheGate(tracker)
    const wrapper = mount(Gate)
    await flushPromises()
    expect(tracker.mountCount.value).toBe(1)

    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(tracker.mountCount.value).toBe(2)
  })

  // @UT-SYS-APP-034@ (FROM: @IMP-SYS-SHARED-007@)
  it('remounts on every subsequent bfcache restoration', async () => {
    const tracker: MountTracker = { mountCount: ref(0) }
    const Gate = makeBfcacheGate(tracker)
    const wrapper = mount(Gate)
    await flushPromises()

    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()
    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()
    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()

    // 1 initial mount + 3 forced remounts
    expect(tracker.mountCount.value).toBe(4)
  })

  // @UT-SYS-APP-035@ (FROM: @IMP-SYS-SHARED-007@)
  it('detaches the pageshow listener on unmount (no leak across components)', async () => {
    const tracker: MountTracker = { mountCount: ref(0) }
    const Gate = makeBfcacheGate(tracker)
    const wrapper = mount(Gate)
    await flushPromises()
    expect(tracker.mountCount.value).toBe(1)

    wrapper.unmount()

    // After the gate is gone the pageshow listener must be detached so a later
    // restore event cannot bump a now-unmounted ref. We can only assert via
    // proxy: mounting a fresh gate (with its own tracker) then firing pageshow
    // should not affect the prior tracker.
    const tracker2: MountTracker = { mountCount: ref(0) }
    const Gate2 = makeBfcacheGate(tracker2)
    const wrapper2 = mount(Gate2)
    await flushPromises()

    firePageshow(true)
    await wrapper2.vm.$nextTick()
    await flushPromises()

    expect(tracker.mountCount.value).toBe(1)
    expect(tracker2.mountCount.value).toBe(2)
  })
})

/**
 * Integration-level unit suite that exercises the real `App.vue` against a
 * memory-history router. These tests are what makes the traceability link
 * `UT-SYS-APP-036..038 → IMP-SYS-SHARED-007` load-bearing: a future edit
 * that decoupled the pageshow listener from App.vue, dropped the
 * `:key="bfcacheNonce"` binding on `<RouterView>`, or widened the
 * remount-route scope past the documented allowlist would fail one of
 * these assertions instead of silently regressing the production bug.
 */
describe('App.vue — bfcache restoration against real component (issue #232)', () => {
  // A stub RouterView whose `onMounted` hook runs on every (re)mount; the
  // spec hands the counter ref to the stub before mounting so each test
  // gets a clean mount-count baseline. We increment in `onMounted` rather
  // than `setup` because Vue's compiler may invoke a stubbed component's
  // `setup` once for dependency probing during render, which would
  // double-count and mask a missed remount; `onMounted` is the actual
  // lifecycle signal we care about.
  function makeRouterViewStub(mountCountRef: Ref<number>) {
    return defineComponent({
      name: 'RouterView',
      setup() {
        onMounted(() => {
          mountCountRef.value += 1
        })
        return () => h('div', { 'data-testid': 'router-view-stub' })
      },
    })
  }

  function buildRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        { path: '/fleet', name: 'fleet', component: { template: '<div />' } },
        {
          path: '/mass-balance',
          name: 'mass-balance',
          component: { template: '<div />' },
        },
        {
          path: '/fleet/new',
          name: 'fleet-new',
          component: { template: '<div />' },
        },
      ],
    })
  }

  async function mountApp(rvMountCount: Ref<number>, initialPath = '/fleet') {
    // PR review M3 — App.vue now hides <RouterView> behind
    // `v-if="!disclaimerStore.gateOpen"` so the safety-critical surface does
    // not mount until the pilot has acknowledged the disclaimer. Pre-seed
    // the acceptance so this bfcache suite continues to exercise its actual
    // subject (the pageshow → :key remount wiring).
    localStorage.clear()
    seedDisclaimerAccepted()
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter()
    await router.push(initialPath)
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
        stubs: {
          RouterView: makeRouterViewStub(rvMountCount),
          RouterLink: {
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          },
          AppLogo: { template: '<div />' },
          AppVersion: { template: '<div />' },
        },
      },
    })
    await flushPromises()
    activeWrappers.push(wrapper)
    return { wrapper, router }
  }

  // Tracks every mounted wrapper so afterEach can fully tear them down — Vue
  // components left mounted between tests keep their window pageshow listener
  // attached and would otherwise fire on a subsequent test's synthetic event.
  const activeWrappers: Array<ReturnType<typeof mount>> = []

  afterEach(() => {
    while (activeWrappers.length > 0) {
      const w = activeWrappers.pop()
      try {
        w?.unmount()
      } catch {
        /* best-effort cleanup */
      }
    }
    document.body.innerHTML = ''
  })

  // @UT-SYS-APP-036@ (FROM: @IMP-SYS-SHARED-007@)
  it('remounts <RouterView> on /fleet when pageshow fires with persisted=true', async () => {
    const rvMounts = ref(0)
    const { wrapper } = await mountApp(rvMounts, '/fleet')
    expect(rvMounts.value).toBe(1)

    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()

    // Real App.vue's bfcacheNonce should have advanced, forcing the stub to
    // remount exactly once.
    expect(rvMounts.value).toBe(2)
  })

  // @UT-SYS-APP-037@ (FROM: @IMP-SYS-SHARED-007@)
  it('does NOT remount <RouterView> when the active route is outside the allowlist (state-preserving scope)', async () => {
    const rvMounts = ref(0)
    const { wrapper } = await mountApp(rvMounts, '/mass-balance')
    expect(rvMounts.value).toBe(1)

    // On /mass-balance a remount would silently wipe partial Mass-Balance
    // entry — a worse regression than the original bug. The scoped handler
    // must leave the active component intact.
    firePageshow(true)
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(rvMounts.value).toBe(1)
  })

  // @UT-SYS-APP-038@ (FROM: @IMP-SYS-SHARED-007@)
  it('does not remount <RouterView> when pageshow fires with persisted=false on /fleet', async () => {
    const rvMounts = ref(0)
    const { wrapper } = await mountApp(rvMounts, '/fleet')
    expect(rvMounts.value).toBe(1)

    firePageshow(false)
    await wrapper.vm.$nextTick()
    await flushPromises()

    // Normal SPA navigation / first paint must not trip the bfcache nonce.
    expect(rvMounts.value).toBe(1)
  })
})
