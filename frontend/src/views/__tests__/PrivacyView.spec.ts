/**
 * Unit tests for PrivacyView.vue.
 * Covers REQ-SYS-014 (delete-all), REQ-SYS-015 (export-all), REQ-SYS-016 (purge).
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
  BulkExportEnvelope,
  PurgeCandidate,
  WipeReport,
} from '@/modules/aircraft/services/data-rights.service'

const fleetProfiles = ref<Array<{ id: string }>>([])
const loadAllMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

vi.mock('@/modules/aircraft/stores/fleet.store', () => {
  return {
    useFleetStore: () => ({
      get profiles() {
        return fleetProfiles.value
      },
      loadAll: loadAllMock,
    }),
  }
})

const exportMock = vi.fn<(now?: Date) => Promise<BulkExportEnvelope>>()
const serializeMock = vi.fn<(envelope: BulkExportEnvelope) => string>()
const listMock = vi.fn<(retentionDays?: number, now?: Date) => Promise<PurgeCandidate[]>>()
const purgeMock = vi.fn<(retentionDays?: number, now?: Date) => Promise<PurgeCandidate[]>>()
const wipeMock = vi.fn<() => Promise<WipeReport>>()

vi.mock('@/modules/aircraft/services/data-rights.service', () => {
  return {
    DEFAULT_RETENTION_DAYS: 365,
    exportAllProfiles: (now?: Date) => exportMock(now),
    serializeBulkExport: (envelope: BulkExportEnvelope) => serializeMock(envelope),
    listPurgeCandidates: (retentionDays?: number, now?: Date) => listMock(retentionDays, now),
    purgeProfilesOlderThan: (retentionDays?: number, now?: Date) => purgeMock(retentionDays, now),
    wipeAllLocalData: () => wipeMock(),
  }
})

function defaultWipeReport(): WipeReport {
  return {
    profilesDeleted: 0,
    indexedDbCleared: true,
    localStorageKeysCleared: [],
    sessionStorageKeysCleared: [],
    clearedAt: '2026-05-27T12:00:00.000Z',
  }
}

function defaultEnvelope(): BulkExportEnvelope {
  return {
    exportSchemaVersion: 1,
    exportedAt: '2026-05-27T12:00:00.000Z',
    profileCount: 0,
    profiles: [],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  exportMock.mockReset()
  serializeMock.mockReset()
  listMock.mockReset()
  purgeMock.mockReset()
  wipeMock.mockReset()
  loadAllMock.mockClear()
  exportMock.mockResolvedValue(defaultEnvelope())
  serializeMock.mockReturnValue('{"exportSchemaVersion":1}')
  listMock.mockResolvedValue([])
  purgeMock.mockResolvedValue([])
  wipeMock.mockResolvedValue(defaultWipeReport())
  fleetProfiles.value = []

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
      exportSchemaVersion: 1,
      exportedAt: '2026-05-27T12:00:00.000Z',
      profileCount: 2,
      profiles: [],
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
})

// ─── REQ-SYS-016 ───────────────────────────────────────────────────────────
describe('PrivacyView — retention purge (REQ-SYS-016)', () => {
  it('previews candidates and only confirms via an explicit click', async () => {
    fleetProfiles.value = [{ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }]
    const candidate: PurgeCandidate = {
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      registration: 'D-OLD',
      status: 'draft',
      mostRecentValidFromIso: '2020-01-01',
      ageDays: 2000,
    }
    listMock.mockResolvedValueOnce([candidate])
    purgeMock.mockResolvedValueOnce([candidate])

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="purge-preview-btn"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.find('[data-testid="purge-dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.find('[data-testid="purge-list"]').text()).toContain('D-OLD')

    await wrapper.find('[data-testid="purge-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(purgeMock).toHaveBeenCalledWith(365, undefined)
    expect(wrapper.find('[data-testid="privacy-purge-notice"]').exists()).toBe(true)
  })

  it('cancel closes the preview without calling purgeProfilesOlderThan', async () => {
    fleetProfiles.value = [{ id: 'x' }]
    listMock.mockResolvedValueOnce([])
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="purge-preview-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="purge-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="purge-cancel-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="purge-dialog"]').exists()).toBe(false)
    expect(purgeMock).not.toHaveBeenCalled()
  })

  it('disables the preview button when the fleet is empty', async () => {
    fleetProfiles.value = []
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('[data-testid="purge-preview-btn"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
