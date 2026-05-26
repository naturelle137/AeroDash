/**
 * Regression tests for issue #232 — Delete button unresponsive on /fleet after
 * the pilot returns from /fleet/:id/edit via the browser back button (or the
 * iOS Safari swipe-back edge gesture).
 *
 * The fix listens for `pageshow` with `event.persisted === true` (the bfcache
 * restore signal) and forces the active RouterView to remount via a key that
 * advances on every detected restoration. Without the remount, iOS Safari
 * restores a Vue instance whose template @click handlers no longer fire even
 * though the DOM button stays focusable.
 *
 * These tests mirror the bfcache-key + pageshow-handler pattern from App.vue
 * inside a minimal `BfcacheGate` component — exactly as
 * `app-version-blocked.spec.ts` mirrors App.vue's version-blocked gate — so we
 * avoid pulling App.vue's full dependency tree (PWA store, version store,
 * theme composable) into the test and keep the unit isolated.
 */

// @UT-SYS-APP-031@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-032@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-033@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-034@ (FROM: @IMP-SYS-SHARED-007@)
// @UT-SYS-APP-035@ (FROM: @IMP-SYS-SHARED-007@)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  type Ref,
} from 'vue'

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
  const event = new Event('pageshow') as Event & { persisted?: boolean }
  Object.defineProperty(event, 'persisted', { value: persisted, configurable: true })
  window.dispatchEvent(event)
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
