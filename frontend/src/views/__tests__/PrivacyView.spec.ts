/**
 * Unit tests for PrivacyView.vue.
 * Covers REQ-SYS-014 (delete-all) and REQ-SYS-015 (export-all).
 *
 * @see frontend/src/views/PrivacyView.vue
 */

// @UT-UI-VIEW-002@ (FROM: @IMP-UI-VIEW-002@)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import PrivacyView from '../PrivacyView.vue'
import type {
  BulkExportResult,
  WipeReport,
} from '@/modules/aircraft/services/data-rights.service'

const fleetProfiles = ref<Array<{ id: string }>>([])
const fleetUnreadable = ref(0)
const loadAllMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

vi.mock('@/modules/aircraft/stores/fleet.store', () => {
  return {
    useFleetStore: () => ({
      get profiles() {
        return fleetProfiles.value
      },
      get unreadableProfileCount() {
        return fleetUnreadable.value
      },
      loadAll: loadAllMock,
    }),
  }
})

type Envelope = BulkExportResult['envelope']

const exportMock = vi.fn<(now?: Date) => Promise<BulkExportResult>>()
const serializeMock = vi.fn<(envelope: Envelope) => string>()
const wipeMock = vi.fn<() => Promise<WipeReport>>()

vi.mock('@/modules/aircraft/services/data-rights.service', () => {
  return {
    exportAllProfiles: (now?: Date) => exportMock(now),
    serializeBulkExport: (envelope: Envelope) => serializeMock(envelope),
    wipeAllLocalData: () => wipeMock(),
  }
})

function defaultWipeReport(): WipeReport {
  return {
    profilesDeleted: 0,
    indexedDbCleared: true,
    localStorageKeysCleared: [],
    sessionStorageKeysCleared: [],
    failures: [],
    complete: true,
    clearedAt: '2026-05-27T12:00:00.000Z',
  }
}

function defaultExportResult(): BulkExportResult {
  return {
    envelope: {
      exportSchemaVersion: 1,
      exportedAt: '2026-05-27T12:00:00.000Z',
      profileCount: 0,
      profiles: [],
    },
    omitted: [],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  exportMock.mockReset()
  serializeMock.mockReset()
  wipeMock.mockReset()
  loadAllMock.mockClear()
  exportMock.mockResolvedValue(defaultExportResult())
  serializeMock.mockReturnValue('{"exportSchemaVersion":1}')
  wipeMock.mockResolvedValue(defaultWipeReport())
  fleetProfiles.value = []
  fleetUnreadable.value = 0

  const createObjectURL = vi.fn<() => string>(() => 'blob:test')
  const revokeObjectURL = vi.fn<(url: string) => void>()
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true })
})

afterEach(() => {
  document.body.innerHTML = ''
})

function mountView() {
  return mount(PrivacyView, { attachTo: document.body })
}

// ─── REQ-SYS-015 ───────────────────────────────────────────────────────────
describe('PrivacyView — bulk export (REQ-SYS-015)', () => {
  it('triggers exportAllProfiles + serializeBulkExport and surfaces the timestamp', async () => {
    fleetProfiles.value = [{ id: 'p1' }, { id: 'p2' }]
    exportMock.mockResolvedValueOnce({
      envelope: {
        exportSchemaVersion: 1,
        exportedAt: '2026-05-27T12:00:00.000Z',
        profileCount: 2,
        profiles: [],
      },
      omitted: [],
    })

    const wrapper = mountView()
    await flushPromises()

    const btn = wrapper.find('[data-testid="export-all-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    await flushPromises()

    expect(exportMock).toHaveBeenCalledTimes(1)
    expect(serializeMock).toHaveBeenCalledTimes(1)

    const notice = wrapper.find('[data-testid="privacy-export-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('Bulk JSON export generated')
    // No unreadable profiles → no incomplete-export warning.
    expect(wrapper.find('[data-testid="privacy-export-omitted"]').exists()).toBe(false)
  })

  it('warns that the export is incomplete when profiles could not be included (M1)', async () => {
    fleetProfiles.value = [{ id: 'p1' }]
    exportMock.mockResolvedValueOnce({
      envelope: {
        exportSchemaVersion: 1,
        exportedAt: '2026-05-27T12:00:00.000Z',
        profileCount: 1,
        profiles: [],
      },
      omitted: [
        {
          id: 'p-future',
          reason: 'unsupported-future-version',
          storedVersion: 99,
          detail: 'newer build',
        },
      ],
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="export-all-btn"]').trigger('click')
    await flushPromises()

    const warn = wrapper.find('[data-testid="privacy-export-omitted"]')
    expect(warn.exists()).toBe(true)
    expect(warn.text()).toContain('not a complete copy')
  })

  it('surfaces an error banner when the export fails (m3)', async () => {
    fleetProfiles.value = [{ id: 'p1' }]
    exportMock.mockRejectedValueOnce(new Error('export blew up'))

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="export-all-btn"]').trigger('click')
    await flushPromises()

    const err = wrapper.find('[data-testid="privacy-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('export blew up')
    expect(wrapper.find('[data-testid="privacy-export-notice"]').exists()).toBe(false)
  })

  it('disables the export button when the fleet is empty', async () => {
    fleetProfiles.value = []
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('[data-testid="export-all-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})

// ─── REQ-SYS-014 ───────────────────────────────────────────────────────────
describe('PrivacyView — delete-all (REQ-SYS-014)', () => {
  it('requires the confirmation phrase before enabling the destructive button', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()

    const confirmBtn = wrapper.find('[data-testid="wipe-confirm-btn"]')
    const input = wrapper.find('[data-testid="wipe-confirm-input"]')
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(true)

    await input.setValue('wrong phrase')
    await nextTick()
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(true)

    await input.setValue('DELETE ALL DATA')
    await nextTick()
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(false)

    await confirmBtn.trigger('click')
    await flushPromises()

    expect(wipeMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="privacy-wipe-notice"]').exists()).toBe(true)
  })

  it('cancel closes the dialog without calling wipeAllLocalData', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="wipe-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="wipe-cancel-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="wipe-dialog"]').exists()).toBe(false)
    expect(wipeMock).not.toHaveBeenCalled()
  })

  it('reports an incomplete erasure as CRITICAL and never shows the success notice (M2)', async () => {
    wipeMock.mockResolvedValueOnce({
      profilesDeleted: 1,
      indexedDbCleared: true,
      localStorageKeysCleared: ['aerodash:session:payload'],
      sessionStorageKeysCleared: [],
      failures: [{ store: 'localStorage', key: 'aerodash-theme', detail: 'removeItem failed' }],
      complete: false,
      clearedAt: '2026-05-27T12:00:00.000Z',
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-input"]').setValue('DELETE ALL DATA')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="privacy-wipe-notice"]').exists()).toBe(false)
    const err = wrapper.find('[data-testid="privacy-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('Erasure incomplete')
  })

  it('clears a stale export notice when a wipe succeeds (NIT-1)', async () => {
    fleetProfiles.value = [{ id: 'p1' }]
    const wrapper = mountView()
    await flushPromises()

    // First export — shows the export-success notice.
    await wrapper.find('[data-testid="export-all-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="privacy-export-notice"]').exists()).toBe(true)

    // Then wipe — the now-deleted data must not keep advertising an export.
    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-input"]').setValue('DELETE ALL DATA')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="privacy-export-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="privacy-wipe-notice"]').exists()).toBe(true)
  })

  it('warns about unreadable rows even when the fleet has zero readable profiles (M1)', async () => {
    fleetProfiles.value = []
    fleetUnreadable.value = 2

    const wrapper = mountView()
    await flushPromises()

    // Export is disabled (nothing readable to serialise) ...
    expect((wrapper.find('[data-testid="export-all-btn"]').element as HTMLButtonElement).disabled).toBe(
      true,
    )
    // ... but the at-risk rows are still surfaced, independent of any export.
    const standing = wrapper.find('[data-testid="privacy-unreadable-warning"]')
    expect(standing.exists()).toBe(true)
    expect(standing.text()).toContain('2 profiles')

    // The wipe dialog repeats the warning before the destructive confirm.
    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="wipe-unreadable-warning"]').exists()).toBe(true)
  })

  it('reports an unknown profile count without claiming a false 0 (m1)', async () => {
    wipeMock.mockResolvedValueOnce({
      profilesDeleted: null,
      indexedDbCleared: true,
      localStorageKeysCleared: [],
      sessionStorageKeysCleared: [],
      failures: [],
      complete: true,
      clearedAt: '2026-05-27T12:00:00.000Z',
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-input"]').setValue('DELETE ALL DATA')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-btn"]').trigger('click')
    await flushPromises()

    const notice = wrapper.find('[data-testid="privacy-wipe-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('count unavailable')
  })

  it('surfaces an error banner when wipeAllLocalData rejects (m3)', async () => {
    wipeMock.mockRejectedValueOnce(new Error('wipe blew up'))

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="wipe-request-btn"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-input"]').setValue('DELETE ALL DATA')
    await nextTick()
    await wrapper.find('[data-testid="wipe-confirm-btn"]').trigger('click')
    await flushPromises()

    const err = wrapper.find('[data-testid="privacy-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('wipe blew up')
    expect(wrapper.find('[data-testid="privacy-wipe-notice"]').exists()).toBe(false)
  })
})
