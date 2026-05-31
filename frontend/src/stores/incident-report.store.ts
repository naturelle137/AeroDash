/**
 * Incident Report Store — P3 App Shell.
 *
 * Orchestrates the in-app incident-reporting MVP (issue #281, PR-006):
 *  - Validates pilot-supplied {@link IncidentDraft} input via Zod.
 *  - Runs the free-text description through the P1 redactor BEFORE
 *    persistence, so unredacted text never reaches IndexedDB or the
 *    GitHub deep link.
 *  - Persists redacted reports offline via {@link incident-queue}.
 *  - Builds the prefilled GitHub-issue URL on demand.
 *
 * The store NEVER auto-submits a report. Submission is always pilot-driven
 * — the destination is github.com (outside the GDPR data perimeter), so the
 * pilot must explicitly open the deep link.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import {
  IncidentDraftSchema,
  IncidentReportSchema,
  type IncidentContext,
  type IncidentDraft,
  type IncidentReport,
} from '@/core/domain/incident-report.schema'
import {
  redactIncidentText,
  totalRedactions,
  type RedactionCounts,
} from '@/core/logic/incident-redaction'
import {
  buildGithubIssueUrl as buildGithubIssueUrlPure,
} from '@/core/logic/github-issue-url'
import {
  clearAllReports,
  enqueueReport,
  listReports,
  removeReport,
} from '@/shared/utils/incident-queue'

// @IMP-SYS-STORE-022@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@, @REQ-SYS-018@)

// Allow a fork or release-channel build to retarget the GitHub deep link via
// `VITE_INCIDENT_REPO_URL` (m6) — a fork that shipped without this override
// would otherwise file pilot incidents against this upstream repo.
const APP_REPO_URL =
  (import.meta.env.VITE_INCIDENT_REPO_URL as string | undefined) ??
  'https://github.com/naturelle137/AeroDash'

export type IncidentLoadState = 'IDLE' | 'LOADING' | 'READY' | 'ERROR'

function snapshotContext(): IncidentContext {
  const appVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0-dev'
  if (typeof window === 'undefined') {
    return {
      appVersion,
      routeName: null,
      pathTail: null,
      userAgent: null,
      online: null,
    }
  }
  const path = window.location?.pathname ?? null
  const pathTail = path && path !== '/' ? path.split('/').filter(Boolean).slice(-2).join('/') : path
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null
  const online =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : null
  return {
    appVersion,
    routeName: null,
    pathTail: pathTail ? pathTail.slice(0, 128) : null,
    userAgent: ua ? ua.slice(0, 256) : null,
    online,
  }
}

export const useIncidentReportStore = defineStore('incidentReport', () => {
  const reports = ref<IncidentReport[]>([])
  const loadState = ref<IncidentLoadState>('IDLE')
  const lastError = ref<string | null>(null)

  const queuedCount = computed(() => reports.value.length)
  const isEmpty = computed(() => reports.value.length === 0)

  async function loadAll(): Promise<void> {
    loadState.value = 'LOADING'
    lastError.value = null
    try {
      reports.value = await listReports()
      loadState.value = 'READY'
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Failed to read incident queue.'
      loadState.value = 'ERROR'
    }
  }

  function previewRedaction(text: string): { redacted: string; counts: RedactionCounts; total: number } {
    const { redacted, counts } = redactIncidentText(text)
    return { redacted, counts, total: totalRedactions(counts) }
  }

  /**
   * Combined preview of the redactor's output for both the summary and the
   * description (B1). The summary leaks into the public GitHub issue title
   * + body, so it must go through the same redaction filter as the
   * description; the pilot needs to see both before submission.
   */
  function previewDraft(draft: { summary: string; description: string }): {
    summary: { redacted: string; counts: RedactionCounts; total: number }
    description: { redacted: string; counts: RedactionCounts; total: number }
    total: number
  } {
    const summary = previewRedaction(draft.summary)
    const description = previewRedaction(draft.description)
    return { summary, description, total: summary.total + description.total }
  }

  /**
   * Build (without persisting) the canonical report shape that would be
   * stored for the given draft, given current build/route metadata. The
   * caller may pass an explicit `routeName` (from `useRoute().name`) so the
   * store stays decoupled from `vue-router`.
   *
   * The pilot-supplied `summary` is redacted alongside `description` so the
   * public GitHub issue title cannot leak PII (B1, REQ-SYS-017).
   */
  function buildReport(
    draft: IncidentDraft,
    overrides: { routeName?: string | null; now?: Date; id?: string } = {},
  ): IncidentReport {
    const parsedDraft = IncidentDraftSchema.parse(draft)
    const { redacted: redactedSummary } = redactIncidentText(parsedDraft.summary)
    const { redacted: redactedDescription } = redactIncidentText(parsedDraft.description)
    const context: IncidentContext = {
      ...snapshotContext(),
      routeName: overrides.routeName ?? null,
    }
    const report: IncidentReport = {
      id: overrides.id ?? uuidv4(),
      createdAt: (overrides.now ?? new Date()).toISOString(),
      kind: parsedDraft.kind,
      summary: redactedSummary,
      redactedDescription,
      context,
      schemaVersion: 1,
    }
    return IncidentReportSchema.parse(report)
  }

  /** Validate → redact → persist. Returns the persisted report. */
  async function capture(
    draft: IncidentDraft,
    overrides: { routeName?: string | null } = {},
  ): Promise<IncidentReport> {
    const report = buildReport(draft, overrides)
    try {
      await enqueueReport(report)
      lastError.value = null
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : 'Failed to queue incident report.'
      throw err
    }
    await loadAll()
    return report
  }

  /** Delete one report. Surfaces an IDB failure via {@link lastError} (M8). */
  async function remove(id: string): Promise<void> {
    try {
      await removeReport(id)
      lastError.value = null
    } catch (err) {
      lastError.value =
        err instanceof Error ? err.message : 'Failed to delete the incident report.'
      throw err
    }
    await loadAll()
  }

  /** Wipe every queued report. Surfaces an IDB failure via {@link lastError} (M8). */
  async function clearAll(): Promise<number> {
    try {
      const removed = await clearAllReports()
      lastError.value = null
      await loadAll()
      return removed
    } catch (err) {
      lastError.value =
        err instanceof Error ? err.message : 'Failed to clear incident reports.'
      throw err
    }
  }

  function buildGithubUrl(report: IncidentReport): string {
    return buildGithubIssueUrlPure({ repoUrl: APP_REPO_URL, report })
  }

  return {
    reports,
    loadState,
    lastError,
    queuedCount,
    isEmpty,
    loadAll,
    previewRedaction,
    previewDraft,
    buildReport,
    capture,
    remove,
    clearAll,
    buildGithubUrl,
  }
})
