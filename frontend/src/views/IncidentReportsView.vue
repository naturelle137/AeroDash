<!-- @IMP-UI-VIEW-005@ (FROM: @REQ-SYS-016@, @REQ-SYS-017@, @REQ-SYS-018@) -->
<template>
  <section class="incidents" aria-labelledby="incidents-title">
    <header class="incidents__header">
      <h1 id="incidents-title" class="incidents__title">Incident reports</h1>
      <p class="incidents__intro">
        Reports captured on this device through <strong>Report a problem</strong>.
        Each entry is stored locally and offline; nothing leaves AeroDash
        unless you open it on GitHub. Descriptions were redacted before being
        saved.
      </p>
      <div class="incidents__actions">
        <button
          type="button"
          class="incidents__btn incidents__btn--primary"
          data-testid="open-report-dialog"
          @click="dialogOpen = true"
        >
          Report a new problem
        </button>
        <button
          v-if="!store.isEmpty"
          type="button"
          class="incidents__btn incidents__btn--ghost"
          data-testid="clear-all-reports"
          @click="onClearAll"
        >
          Delete all reports ({{ store.queuedCount }})
        </button>
      </div>
    </header>

    <p
      v-if="store.lastError"
      class="incidents__error"
      role="alert"
    >{{ store.lastError }}</p>

    <p
      v-if="store.loadState === 'LOADING'"
      class="incidents__empty"
      data-testid="incidents-loading"
    >Loading queued reports…</p>

    <p
      v-else-if="store.isEmpty"
      class="incidents__empty"
      data-testid="incidents-empty"
    >No incident reports queued. Use “Report a new problem” the next time you
       hit something off.</p>

    <ul v-else class="incidents__list" data-testid="incidents-list">
      <li
        v-for="report in store.reports"
        :key="report.id"
        class="incidents__row"
      >
        <div class="incidents__row-head">
          <span class="incidents__kind">{{ kindLabel(report.kind) }}</span>
          <span class="incidents__date">{{ formatDate(report.createdAt) }}</span>
        </div>
        <p class="incidents__summary">{{ report.summary }}</p>
        <details class="incidents__details">
          <summary>Redacted description &amp; context</summary>
          <pre class="incidents__pre">{{ report.redactedDescription }}</pre>
          <dl class="incidents__context">
            <dt>App version</dt><dd>{{ report.context.appVersion }}</dd>
            <dt>Route</dt><dd>{{ report.context.routeName ?? 'unknown' }}</dd>
            <dt>Path</dt><dd>{{ report.context.pathTail ?? 'unknown' }}</dd>
            <dt>Online</dt><dd>{{ onlineLabel(report.context.online) }}</dd>
          </dl>
        </details>
        <div class="incidents__row-actions">
          <a
            class="incidents__btn incidents__btn--primary"
            :href="store.buildGithubUrl(report)"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-on-github"
          >Open on GitHub</a>
          <button
            type="button"
            class="incidents__btn incidents__btn--ghost"
            @click="onRemove(report.id)"
          >Delete</button>
        </div>
      </li>
    </ul>

    <ReportProblemDialog
      :open="dialogOpen"
      @close="dialogOpen = false"
      @saved="onSaved"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ReportProblemDialog from '@/shared/components/ReportProblemDialog.vue'
import { useIncidentReportStore } from '@/stores/incident-report.store'
import { INCIDENT_KIND_LABELS } from '@/core/logic/github-issue-url'
import type { IncidentReport } from '@/core/domain/incident-report.schema'

const store = useIncidentReportStore()
const dialogOpen = ref(false)

onMounted(() => {
  void store.loadAll()
})

function kindLabel(kind: IncidentReport['kind']): string {
  return INCIDENT_KIND_LABELS[kind]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function onlineLabel(value: boolean | null): string {
  if (value === null) return 'unknown'
  return value ? 'yes' : 'no'
}

// onRemove / onClearAll catch IDB failures (quota, private-mode, locked DB)
// so the pilot gets visible feedback rather than a silent unhandled-rejection
// (M8). The store already updates `lastError` on the write paths — re-
// throwing here would surface as an unhandled rejection in tests/devtools.
async function onRemove(id: string): Promise<void> {
  try {
    await store.remove(id)
  } catch {
    // store.lastError carries the message; the template's error banner
    // surfaces it. Nothing else to do — the row stays visible until the
    // next successful loadAll().
  }
}

async function onClearAll(): Promise<void> {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(
      'Delete every queued incident report from this device? This cannot be undone.',
    )
    if (!confirmed) return
  }
  try {
    await store.clearAll()
  } catch {
    // Same as onRemove — lastError is already populated; the banner shows it.
  }
}

function onSaved(): void {
  dialogOpen.value = false
}
</script>

<style scoped>
.incidents {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.incidents__title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
}

.incidents__intro {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.incidents__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.incidents__empty {
  font-style: italic;
  color: var(--color-text-secondary);
}

.incidents__error {
  color: var(--color-danger, #dc2626);
}

.incidents__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.incidents__row {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  background: var(--color-surface);
}

.incidents__row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.incidents__kind {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--color-info, #1d4ed8);
  color: #fff;
  border-radius: var(--radius-full);
  padding: 0.1rem 0.6rem;
}

.incidents__date {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.incidents__summary {
  margin: 0 0 var(--space-2);
  font-weight: 600;
}

.incidents__details {
  margin-bottom: var(--space-2);
}

.incidents__pre {
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  background: var(--color-surface-muted, var(--color-surface));
  padding: var(--space-2);
  border-radius: var(--radius-md);
}

.incidents__context {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px var(--space-3);
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.incidents__context dt {
  font-weight: 600;
}

.incidents__context dd {
  margin: 0;
}

.incidents__row-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.incidents__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
}

.incidents__btn--primary {
  background: var(--color-primary, #1d4ed8);
  color: #fff;
}

.incidents__btn--ghost {
  background: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
</style>
