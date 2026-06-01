<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMassBalanceStore } from '@/modules/mass-balance/stores/mass-balance.store'
import { AircraftContextSchema } from '@/modules/mass-balance/data/aircraft-context.schema'
import {
  OCCUPANT_PRESET_MASSES_KG,
  OCCUPANT_PRESET_MASSES_LB,
} from '@/modules/mass-balance/data/occupant-presets'
import { mapFleetProfileToContext } from '@/modules/mass-balance/services/fleet-profile.mapper'
import { useFleetStore } from '@/modules/aircraft/stores/fleet.store'
import { useActiveAircraftStore } from '@/modules/aircraft/stores/active-aircraft.store'
import { useSessionPersistenceStore } from '@/stores/session-persistence.store'
import type { AircraftProfile } from '@/core/adapters/aircraft.schema'
import type { SessionDropNotification } from '@/stores/session-persistence.store'
import {
  VERIFICATION_VALIDITY_DAYS,
  evaluateVerificationFreshness,
  type VerificationFreshness,
} from '@/core/logic/profile-verification'
import InputGroupCard from '@/modules/mass-balance/components/InputGroupCard.vue'
import MassStationInput from '@/modules/mass-balance/components/MassStationInput.vue'
import CGEnvelopeChart from '@/modules/mass-balance/components/CGEnvelopeChart.vue'
import ResultSummary from '@/modules/mass-balance/components/ResultSummary.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import UndoToast from '@/shared/components/UndoToast.vue'

// @IMP-MB-UI-FLEET-001@ (FROM: @REQ-AC-001@, @REQ-MB-002@, @UJ-F-002@)

const catalogueError = ref<string | null>(null)

/**
 * One-shot INFO banner shown when a persisted session payload could not be
 * restored on the most recent full reload (PWA-cache rollback / corrupt
 * payload). Drained from `sessionPersistenceStore.consumeDropNotification()`
 * after `restoreSession()` runs. The pilot dismisses it to acknowledge that
 * a fresh session was started. Refs #259, #353 review feedback.
 */
const sessionDropBanner = ref<SessionDropNotification | null>(null)

function dismissSessionDropBanner(): void {
  sessionDropBanner.value = null
}

// ---------------------------------------------------------------------------
// Store connection (single source of truth)
// ---------------------------------------------------------------------------

const store = useMassBalanceStore()
const fleetStore = useFleetStore()
const activeAircraftStore = useActiveAircraftStore()
const sessionPersistenceStore = useSessionPersistenceStore()
const router = useRouter()

// ---------------------------------------------------------------------------
// Fleet projections
// ---------------------------------------------------------------------------

const isFleetLoading = computed(() => fleetStore.fleetLoadState === 'LOADING')
const isFleetError = computed(() => fleetStore.fleetLoadState === 'ERROR')
const hasFleet = computed(
  () => fleetStore.fleetLoadState === 'READY' && fleetStore.profiles.length > 0,
)
const isFleetEmpty = computed(
  () => fleetStore.fleetLoadState === 'READY' && fleetStore.profiles.length === 0,
)

// @IMP-MB-VIEW-011@ (FROM: @REQ-AC-005@, @REQ-AC-007@)
// Draft-aware aircraft picker (UX-005 / UX-007). The legacy alphabetical-only
// list let a pilot pick an unverified Draft envelope with no grouping or guard.
// The picker now: groups options into Verified / Draft <optgroup>s, surfaces the
// last-used airframe in its own group at the top for quick re-selection, marks
// Drafts with a destructive `[Draft]` tag, and routes a Draft selection through
// an inline WARN-AC-002 acknowledgement before the profile is loaded for
// computation (H-011 mitigation).
//
// A Verified profile whose sign-off has *expired* — aged past the validity
// window or bound to a weighing report that has since changed — is treated as
// unverified at this Go/No-Go entry point (REQ-AC-007): it is marked `[Expired]`
// destructively and routed through the same inline acknowledgement before load,
// so an expired envelope can never reach the M&B store silently. The same gate
// guards the on-mount auto-load / session-restore path below.

function byRegistration(a: AircraftProfile, b: AircraftProfile): number {
  return a.registration.localeCompare(b.registration)
}

/** Freshness of a profile's verification, evaluated against the current date. */
function freshnessFor(profile: AircraftProfile): VerificationFreshness {
  return evaluateVerificationFreshness(profile, new Date())
}

/** A Verified profile whose sign-off is expired/stale and must be re-verified before use. */
function isExpiredVerified(profile: AircraftProfile): boolean {
  return profile.status === 'verified' && freshnessFor(profile).requiresReverification
}

/** The last-used airframe (the active aircraft), pinned at the top of the picker. */
const lastUsedProfile = computed<AircraftProfile | null>(() => {
  const id = activeAircraftStore.activeProfile?.id
  if (!id) return null
  return fleetStore.profiles.find((p) => p.id === id) ?? null
})

/** Verified fleet profiles, alphabetical by registration. */
const verifiedProfiles = computed(() =>
  fleetStore.profiles.filter((p) => p.status === 'verified').sort(byRegistration),
)

/** Draft fleet profiles, alphabetical by registration. */
const draftProfiles = computed(() =>
  fleetStore.profiles.filter((p) => p.status === 'draft').sort(byRegistration),
)

/** Option label — keeps the `[Draft]` suffix the E2E suite asserts on; an expired Verified profile is marked `[Expired]`. */
function optionLabel(aircraft: AircraftProfile): string {
  const base = `${aircraft.registration} — ${aircraft.manufacturer} ${aircraft.model}`
  if (aircraft.status === 'draft') return `${base} [Draft]`
  if (isExpiredVerified(aircraft)) return `${base} [Expired]`
  return base
}

/**
 * Why a selection must be acknowledged before it loads into the M&B store:
 * `draft` (unverified) or an expired Verified sign-off (aged / source-changed),
 * which REQ-AC-007 requires be surfaced as unverified for safety-critical use.
 */
type PendingReason = 'draft' | 'expired-aged' | 'expired-source-changed'

interface PendingSelection {
  readonly profile: AircraftProfile
  readonly reason: PendingReason
}

/** A selection awaiting the pilot's inline acknowledgement before load (H-011, REQ-AC-005/007). */
const pendingSelection = ref<PendingSelection | null>(null)

// @IMP-MB-VIEW-013@ (FROM: @REQ-AC-001@, @REQ-AC-005@)
// The <select> normally mirrors the loaded aircraft and snaps back to it while
// a draft/expired pick is awaiting acknowledgement (so a stray tap can't appear
// to silently switch the airframe). But when arriving from the wizard's
// "Start flight prep" with no aircraft yet loaded, falling back to the pending
// profile keeps the dropdown in lockstep with the ack banner — the pilot sees
// the registration they just saved, instead of a blank "— choose aircraft —".
const selectedAircraftId = computed<string>(() => {
  if (store.aircraft?.id) return store.aircraft.id
  return pendingSelection.value?.profile.id ?? ''
})

/**
 * A restored session payload held back until its (expired/draft) profile is
 * acknowledged. Applied on confirm; discarded — with the stale session — on cancel.
 */
const pendingRestoredPayload = ref<ReturnType<
  typeof sessionPersistenceStore.restoreSession
> | null>(null)

/** Reason a profile must be gated before load, or null when it may load directly. */
function guardReasonFor(profile: AircraftProfile): PendingReason | null {
  if (profile.status === 'draft') return 'draft'
  const f = freshnessFor(profile)
  if (f.state === 'expired-aged' || f.state === 'expired-source-changed') return f.state
  return null
}

/** Heading + body for the inline acknowledgement, derived from the pending reason. */
const pendingAck = computed(() => {
  const p = pendingSelection.value
  if (!p) return null
  const reg = p.profile.registration
  if (p.reason === 'draft') {
    return {
      heading: 'WARN-AC-002 — Draft Profile.',
      body: `“${reg}” is unverified. Verify its data against the POH/AFM before using it for a Go/No-Go decision.`,
    }
  }
  if (p.reason === 'expired-source-changed') {
    return {
      heading: 'Verification expired.',
      body: `“${reg}” was verified, but its source weighing report has since changed. Re-verify it against the POH/AFM before using it for a Go/No-Go decision.`,
    }
  }
  return {
    heading: 'Verification expired.',
    body: `“${reg}” was verified more than ${VERIFICATION_VALIDITY_DAYS} days ago. Re-verify it against the POH/AFM before using it for a Go/No-Go decision.`,
  }
})

// ---------------------------------------------------------------------------
// Stacking sticky strips (REQ-UI-SCROLL)
// ---------------------------------------------------------------------------
//
// Why a single fixed-position stack instead of per-card `position: sticky`?
// - `position: sticky` is bounded by the nearest scrolling ancestor's content
//   area. As soon as the pilot scrolls past the bottom of a card, that card's
//   sticky header un-pins and disappears. So once you're deep inside card 02,
//   card 01's strip is gone — the breadcrumb of past widgets evaporates.
// - iOS Safari adds a known stacking-context defect when stacking multiple
//   `position: sticky` siblings with custom z-index — the wrong header paints
//   on top mid-scroll, looking like a title is "weirdly floating in front".
//
// The fix: render ONE fixed stack at the top of the viewport that mirrors the
// title + badge of every card the pilot has scrolled past. Each card keeps
// its own in-flow (non-sticky) header for the full-height rendering when
// it's in view. A scroll listener computes which cards are past, in DOM
// order, and rebuilds the stack reactively. Tapping a strip smooth-scrolls
// the page back to that card with a custom eased animation so it feels
// natural — not the snap-fast `scrollIntoView({behavior: 'smooth'})` that
// Safari produces.
//
// Each strip is `--prep-sticky-h` tall. The stack pins below the app header
// (`--nav-header-height`).

interface CardMeta {
  id: string
  badge: string
  title: string
  /** When set, the strip uses the muted "coming soon" badge styling. */
  soon?: boolean
}

const CARD_ORDER = computed<readonly CardMeta[]>(() => [
  { id: 'aircraft', badge: '01', title: 'Aircraft' },
  { id: 'mb', badge: '02', title: 'Mass & Balance' },
  { id: 'performance', badge: '03', title: 'Performance', soon: true },
  { id: 'weather', badge: '04', title: 'Weather', soon: true },
  // `title` follows the electric/combustion discriminator so the sticky
  // strip chip reads "Energy & Endurance" on a Velis Electro profile.
  { id: 'fuel', badge: '05', title: energySectionTitle.value, soon: true },
])

/** Strip height in px — kept in sync with --prep-sticky-h (2.75rem @16px). */
const STRIP_HEIGHT_PX = 44

/** Cards the pilot has scrolled past, currently shown as compressed strips. */
const stuckCards = ref<CardMeta[]>([])

function getNavHeaderHeightPx(): number {
  if (typeof document === 'undefined') return 56
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-header-height')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 56
}

/**
 * Walk the cards top-to-bottom: a card joins the stack when its in-flow
 * header has scrolled above the bottom of the next strip slot. The cumulative
 * offset grows by STRIP_HEIGHT_PX for each stuck card so deeper cards have
 * a higher entry threshold — that's how we stack symmetrically on the way
 * down AND release symmetrically on the way back up.
 */
function recomputeStuck(): void {
  if (typeof document === 'undefined') return
  const navHeader = getNavHeaderHeightPx()
  const next: CardMeta[] = []
  let cumOffset = navHeader

  for (const meta of CARD_ORDER.value) {
    const el = document.getElementById(`prep-card-${meta.id}`)
    if (!el) continue

    const rect = el.getBoundingClientRect()
    const stripBottom = cumOffset + STRIP_HEIGHT_PX

    // The card's natural top has scrolled above the bottom of where its
    // strip would sit → the card is "past" → keep its strip pinned.
    if (rect.top < stripBottom) {
      next.push(meta)
      cumOffset = stripBottom
    }
  }

  // Cheap reference-equality short-circuit so Vue doesn't re-render every
  // scroll frame when the stack hasn't changed.
  if (
    next.length === stuckCards.value.length &&
    next.every((c, i) => c.id === stuckCards.value[i]?.id)
  ) {
    return
  }
  stuckCards.value = next
}

let scrollRafPending = false
let stickyCleanup: (() => void) | null = null

function setupStickyStackObserver(): void {
  if (typeof window === 'undefined') return

  const onScroll = (): void => {
    if (scrollRafPending) return
    scrollRafPending = true
    window.requestAnimationFrame(() => {
      recomputeStuck()
      scrollRafPending = false
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  stickyCleanup = () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  }
  recomputeStuck()
}

/**
 * Custom-duration eased scroll. The browser's
 * `scrollIntoView({behavior:'smooth'})` runs in well under 200ms on iOS
 * which the pilot perceives as a hard snap; 500ms with easeInOutCubic
 * feels natural and clearly conveys the page motion. Falls back to native
 * smooth scroll when prefers-reduced-motion is set.
 */
function smoothScrollTo(targetY: number, duration = 500): void {
  if (typeof window === 'undefined') return

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion) {
    window.scrollTo({ top: targetY, behavior: 'smooth' })
    return
  }

  const startY = window.scrollY
  const dy = targetY - startY
  if (Math.abs(dy) < 1) return
  const t0 = performance.now()

  const step = (now: number): void => {
    const t = Math.min(1, (now - t0) / duration)
    // easeInOutCubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    window.scrollTo(0, startY + dy * eased)
    if (t < 1) window.requestAnimationFrame(step)
  }

  window.requestAnimationFrame(step)
}

/**
 * Whether a strip should carry the green left-accent border, mirroring
 * the in-flow card. Cards 01 and 02 (when not locked) are accented; the
 * three "coming soon" cards are not.
 */
function stripIsAccented(meta: CardMeta): boolean {
  if (meta.soon) return false
  if (meta.id === 'mb') return !viewModel.value.mbLocked
  return true
}

/** Tap a strip → smooth-scroll the page back to its owning card. */
function onStripTap(meta: CardMeta): void {
  const el = document.getElementById(`prep-card-${meta.id}`)
  if (!el) return

  // Strips above the tapped one stay pinned, so the card needs to land just
  // below them. Index in the current stack determines how many strips remain.
  const idxInStack = stuckCards.value.findIndex((c) => c.id === meta.id)
  const remainingStripsAbove = Math.max(0, idxInStack)
  const navHeader = getNavHeaderHeightPx()
  const offsetFromTop = navHeader + remainingStripsAbove * STRIP_HEIGHT_PX

  const absTop = el.getBoundingClientRect().top + window.scrollY
  smoothScrollTo(absTop - offsetFromTop)
}

/**
 * Map + validate a fleet profile into an AircraftContext and load it into the
 * M&B store. Returns true when the store was populated, false on validation
 * failure (a corrupt profile leaves the store in INITIAL).
 */
function loadProfileIntoStore(profile: AircraftProfile): boolean {
  const mapped = mapFleetProfileToContext(profile)
  const validation = AircraftContextSchema.safeParse(mapped)
  if (!validation.success) return false
  store.loadProfile(validation.data)
  return true
}

// ─── Fleet-load timeout escalation (UX-014) ──────────────────────────────────
// @IMP-MB-VIEW-012@ (FROM: @REQ-AC-001@, @REQ-MB-002@)
//
// `fleetStore.loadAll()` reads IndexedDB, which can stall indefinitely (storage
// blocked by another tab, a quota prompt, a wedged transaction). Without a
// watchdog the pilot is left staring at a spinner with no recovery. After
// FLEET_LOAD_TIMEOUT_MS still in LOADING we flip `loadTimedOut`, which swaps the
// spinner for an actionable inline error offering Retry or a jump to the Fleet
// page. The flag is reset whenever a (re)load is kicked off or completes.

const FLEET_LOAD_TIMEOUT_MS = 10_000
const loadTimedOut = ref(false)
let loadWatchdog: ReturnType<typeof setTimeout> | null = null

function clearLoadWatchdog(): void {
  if (loadWatchdog !== null) {
    clearTimeout(loadWatchdog)
    loadWatchdog = null
  }
}

async function runFleetLoad(): Promise<void> {
  loadTimedOut.value = false
  clearLoadWatchdog()
  loadWatchdog = setTimeout(() => {
    if (fleetStore.fleetLoadState === 'LOADING') loadTimedOut.value = true
  }, FLEET_LOAD_TIMEOUT_MS)
  try {
    await fleetStore.loadAll()
  } catch {
    /* fleetLoadState surfaces the error */
  } finally {
    clearLoadWatchdog()
    loadTimedOut.value = false
  }
}

// @IMP-MB-UI-SESSION-001@ (FROM: @REQ-SYS-013@)
onMounted(async () => {
  // Only auto-load on the first mount (initial LOADING state). If a previous
  // attempt errored, let the pilot retry explicitly via the Retry button.
  if (fleetStore.fleetLoadState === 'LOADING' && fleetStore.profiles.length === 0) {
    await runFleetLoad()
  }

  if (!store.aircraft) {
    // In-memory active aircraft survives SPA navigation but not a full reload.
    const active = activeAircraftStore.activeProfile
    if (active) {
      // An expired/draft active aircraft must be re-acknowledged as unverified
      // before it silently reloads into the Go/No-Go view (REQ-AC-007, H-011).
      const reason = guardReasonFor(active)
      if (reason) {
        pendingSelection.value = { profile: active, reason }
      } else {
        loadProfileIntoStore(active)
      }
    } else {
      // Full-reload path: attempt to restore the pilot's last session from
      // localStorage. An invalid/stale payload has already been cleared by
      // `restoreSession()`, so a null result means "start clean".
      const payload = sessionPersistenceStore.restoreSession()
      if (payload) {
        const fleetProfile = fleetStore.profiles.find((p) => p.id === payload.aircraftId)
        if (!fleetProfile) {
          // Aircraft no longer in the fleet (deleted between sessions) —
          // discard the payload so it doesn't haunt future reloads.
          sessionPersistenceStore.clearSession()
        } else {
          const reason = guardReasonFor(fleetProfile)
          if (reason) {
            // Defer the restore behind the acknowledgement: an expired/draft
            // profile must not silently reload into the Go/No-Go view.
            pendingSelection.value = { profile: fleetProfile, reason }
            pendingRestoredPayload.value = payload
          } else if (loadProfileIntoStore(fleetProfile)) {
            activeAircraftStore.setActiveProfile(fleetProfile)
            store.applyRestoredSession(payload)
          } else {
            sessionPersistenceStore.clearSession()
          }
        }
      }
      // Drain any drop notification produced by `restoreSession()` and surface
      // it as a dismissible INFO banner. Without this, a dropped session would
      // silently disappear with no recovery hint for the pilot (refs #259, #353).
      sessionDropBanner.value = sessionPersistenceStore.consumeDropNotification()
    }
  }

  // Start the debounced auto-save watcher. Must run after any restoration is
  // finished so the initial default-state mutation doesn't overwrite the
  // payload we just applied. `startWatching()` is idempotent for remounts.
  sessionPersistenceStore.startWatching()

  setupStickyStackObserver()
})

onBeforeUnmount(() => {
  stickyCleanup?.()
  stickyCleanup = null
  clearLoadWatchdog()
})

function onAddAircraft(): void {
  if (router.hasRoute('fleet-new')) {
    void router.push({ name: 'fleet-new' })
  } else {
    void router.push('/fleet')
  }
}

function onRetry(): void {
  void runFleetLoad()
}

/** Escape hatch from a stalled fleet load — go manage/select aircraft directly. */
function onGoToFleet(): void {
  void router.push({ name: 'fleet' })
}

// ---------------------------------------------------------------------------
// Data bindings — direct store projections for child component props
// ---------------------------------------------------------------------------

const stations = computed(() => store.availableStations)
const notifications = computed(() => store.notifications)
const lastResult = computed(() => store.lastResult)

// UX-002: one-tap preset weights for occupant (non-fuel) stations. Fuel tanks
// are scrubbed via their slider, so they get no presets. Presets are unit-aware
// so an imperial profile sees pound figures. The preset values are source-cited
// in docs/data_constants/registry.json (occupant-preset-masses-*).
function presetsForStation(stationIndex: number): readonly number[] {
  const lp = store.aircraft?.loadPoints[stationIndex]
  if (!lp || lp.fuelTank) return []
  const isImperial = lp.unit?.toLowerCase() === 'lb'
  return isImperial ? OCCUPANT_PRESET_MASSES_LB : OCCUPANT_PRESET_MASSES_KG
}

const aircraftLabel = computed(() => {
  if (!store.aircraft) return ''
  return `${store.aircraft.registration} — ${store.aircraft.manufacturer} ${store.aircraft.model}`
})

// @IMP-MB-VIEW-010@ (FROM: @REQ-AD-020@)
// Battery-electric airframes surface an "Energy & Endurance" placeholder
// rather than the combustion "Fuel & Endurance" card. The page-header subtitle
// and sticky-strip chip follow the same discriminator so the pilot never sees
// fuel-centric language on an electric profile. Legacy profiles (missing
// `powertrain`) fall through to the combustion default.
const isElectric = computed(() => store.aircraft?.powertrain === 'electric')

const energySectionTitle = computed(() => (isElectric.value ? 'Energy & Endurance' : 'Fuel & Endurance'))

const energySectionDescription = computed(() =>
  isElectric.value
    ? 'Battery state-of-charge projection, energy reserve margin, motor-hour endurance.'
    : 'Fuel density correction, endurance vs planned flight time, reserve calculation.',
)

const categories = computed(
  () => store.aircraft?.certificationCategories.map((c) => c.category) ?? [],
)
const activeCategory = computed(() => store.activeCategory)

const envelope = computed(() => store.activeCategoryDef?.envelope ?? [])
const graphType = computed(() => store.activeCategoryDef?.graphType ?? 'arm')

const categoryLimits = computed(() => {
  const def = store.activeCategoryDef
  if (!def) return null
  return {
    maxTakeoffMass: def.maxTakeoffMass,
    maxZeroFuelMass: def.maxZeroFuelMass,
  }
})

// ---------------------------------------------------------------------------
// ViewModel — single deterministic mapping of uiState → presentational flags
//
// Every UI rendering decision lives here. A test can set store.uiState to any
// value and snapshot the entire viewModel to verify correctness.
// ---------------------------------------------------------------------------

// @IMP-MB-UI-004@ (FROM: @REQ-UI-018@)
const viewModel = computed(() => {
  const state = store.uiState

  const bannerSeverity: 'success' | 'warning' | 'critical' | null =
    state === 'VERIFIED_SAFE'
      ? 'success'
      : state === 'WARNING'
        ? 'warning'
        : state === 'ERROR_CRITICAL'
          ? 'critical'
          : null

  return {
    stateClass: `state--${state}` as const,

    isInitial: state === 'INITIAL',
    isLoading: state === 'LOADING',
    isError: state === 'ERROR_CRITICAL',
    isWarning: state === 'WARNING',
    isSafe: state === 'VERIFIED_SAFE',

    /** M&B section is locked until an aircraft is loaded */
    mbLocked: state === 'INITIAL' || state === 'LOADING',

    inputsDisabled: state === 'INITIAL' || state === 'LOADING',

    statusHint:
      state === 'UNCONFIGURED'
        ? 'Complete required fields'
        : state === 'UNVERIFIED'
          ? 'Review and verify inputs'
          : null,

    bannerSeverity,

    canExport: state === 'VERIFIED_SAFE' || state === 'WARNING',
    exportRequiresConfirmation: state === 'UNVERIFIED',

    showChart: state !== 'INITIAL' && state !== 'LOADING',
    showResultSummary: store.lastResult !== null,
  }
})

// ---------------------------------------------------------------------------
// Event handlers — pure delegation to store actions
// ---------------------------------------------------------------------------

function onStationWeightChange(stationIndex: number, weight: number): void {
  store.updateStationWeight(stationIndex, weight)
}

function onCategoryChange(category: string): void {
  store.changeCertificationCategory(category)
}

// ─── UX-004: confirm-then-undo Reset Payload ──────────────────────────────
// @IMP-MB-UI-FLEET-002@ (FROM: @REQ-UI-018@)
//
// A single tap on Reset Payload wipes every station weight — catastrophic
// workload at a just-loaded, engine-running aircraft. Gate it behind a confirm
// carrying the discard count, then offer a short undo window that restores the
// captured pre-reset weights via the public updateStationWeight action.

const showResetConfirm = ref(false)
const resetSnapshot = ref<{ index: number; weight: number }[] | null>(null)

/** Stations the pilot has actually entered a non-default weight for. */
const resetCandidateCount = computed(
  () => stations.value.filter((s) => s.touched && s.weight > 0).length,
)

function onResetPayload(): void {
  showResetConfirm.value = true
}

function onCancelReset(): void {
  showResetConfirm.value = false
}

function onConfirmReset(): void {
  showResetConfirm.value = false
  // Snapshot before wiping so undo can restore the exact prior load.
  resetSnapshot.value = stations.value.map((s) => ({ index: s.index, weight: s.weight }))
  store.resetPayload()
}

function onUndoReset(): void {
  const snapshot = resetSnapshot.value
  resetSnapshot.value = null
  if (!snapshot) return
  for (const s of snapshot) {
    store.updateStationWeight(s.index, s.weight)
  }
}

function onDismissResetUndo(): void {
  resetSnapshot.value = null
}

function onAircraftSelected(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  if (!id) return
  catalogueError.value = null

  const fleetProfile = fleetStore.profiles.find((a) => a.id === id)
  if (!fleetProfile) return

  // A Draft, or a Verified profile whose sign-off has expired, must not be
  // loaded for computation until the pilot explicitly acknowledges it inline
  // (REQ-AC-005/007, H-011). The controlled `:value` binding reverts the
  // <select> to the current aircraft until the acknowledgement resolves.
  const reason = guardReasonFor(fleetProfile)
  if (reason) {
    pendingSelection.value = { profile: fleetProfile, reason }
    return
  }

  loadSelectedProfile(fleetProfile)
}

/** Map → validate → load a selected fleet profile into the M&B store. */
function loadSelectedProfile(fleetProfile: AircraftProfile): void {
  // Loading a profile resolves any pending acknowledgement — clearing it here
  // also dismisses a stale banner if the pilot picks a clean profile while one
  // is still showing.
  pendingSelection.value = null

  const mapped = mapFleetProfileToContext(fleetProfile)
  const validation = AircraftContextSchema.safeParse(mapped)
  if (!validation.success) {
    catalogueError.value = `Aircraft profile "${fleetProfile.id}" failed validation — data may be corrupted.`
    return
  }

  activeAircraftStore.setActiveProfile(fleetProfile)
  store.loadProfile(validation.data)
}

/** Pilot confirmed the acknowledgement — load the gated (draft/expired) profile. */
function onConfirmSelection(): void {
  const pending = pendingSelection.value
  const payload = pendingRestoredPayload.value
  pendingSelection.value = null
  pendingRestoredPayload.value = null
  if (!pending) return
  loadSelectedProfile(pending.profile)
  // Restored station weights are re-applied only once the profile loads cleanly.
  if (payload && store.aircraft) store.applyRestoredSession(payload)
}

/** Pilot declined — leave the current aircraft loaded, drop the pending selection. */
function onCancelSelection(): void {
  pendingSelection.value = null
  // Declining a deferred restore discards the stale session so it doesn't
  // reload on the next mount.
  if (pendingRestoredPayload.value) {
    pendingRestoredPayload.value = null
    sessionPersistenceStore.clearSession()
  }
}
</script>

<template>
  <div class="fp-view" :class="viewModel.stateClass">

    <!-- ═══ Sticky breadcrumb stack (REQ-UI-SCROLL) ════════════════════════ -->
    <!-- One row per card the pilot has scrolled past. Each strip mirrors  -->
    <!-- the in-flow card header — same badge, title, accent border, AND   -->
    <!-- the right-aligned trailing content (aircraft label / state badge  -->
    <!-- / locked badge / "Coming soon" pill). Tap a strip to return.       -->
    <div
      v-if="stuckCards.length > 0"
      class="prep-sticky-stack"
      role="navigation"
      aria-label="Scrolled-past sections"
    >
      <button
        v-for="card in stuckCards"
        :key="card.id"
        type="button"
        class="prep-sticky-strip"
        :class="{
          'prep-sticky-strip--accent': stripIsAccented(card),
          'prep-sticky-strip--soon': card.soon,
        }"
        :aria-label="`Scroll to ${card.title}`"
        @click="onStripTap(card)"
      >
        <span
          class="prep-sticky-strip__badge"
          :class="{ 'prep-sticky-strip__badge--soon': card.soon }"
        >
          {{ card.badge }}
        </span>
        <span
          class="prep-sticky-strip__title"
          :class="{ 'prep-sticky-strip__title--soon': card.soon }"
        >{{ card.title }}</span>

        <!-- Trailing content — same as the in-flow card header so the
             pinned strip carries the card's identity (registration,
             verification state, or coming-soon hint). -->
        <template v-if="card.id === 'aircraft'">
          <span v-if="aircraftLabel" class="prep-sticky-strip__aircraft-label">{{ aircraftLabel }}</span>
        </template>
        <template v-else-if="card.id === 'mb'">
          <span
            v-if="viewModel.mbLocked"
            class="prep-sticky-strip__locked"
            aria-label="Select an aircraft to unlock"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
              <path d="M4 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            <span class="prep-sticky-strip__locked-text">Select aircraft to unlock</span>
          </span>
          <span
            v-else-if="viewModel.bannerSeverity"
            class="prep-sticky-strip__state-badge"
            :class="`prep-sticky-strip__state-badge--${viewModel.bannerSeverity}`"
          >
            {{ viewModel.isSafe ? 'VERIFIED SAFE' : viewModel.isWarning ? 'WARNING' : 'CRITICAL' }}
          </span>
        </template>
        <span v-else-if="card.soon" class="prep-sticky-strip__soon-pill">Coming soon</span>
      </button>
    </div>

    <!-- ═══ Page header ════════════════════════════════════════════════════ -->
    <div class="fp-page-header">
      <h1 class="fp-page-title">Flight Preparation</h1>
      <p class="fp-page-sub">Mass &amp; Balance · Performance · Weather · {{ isElectric ? 'Energy' : 'Fuel' }}</p>
    </div>

    <!-- ═══ Session restore banner (INFO-SYS-001) ════════════════════════════
         Shown when the persisted preflight session could not be restored on
         this reload (PWA-cache rollback or corrupt payload). Dismissible —
         the pilot acknowledges that a fresh session was started.
         Refs #259, #353. -->
    <div
      v-if="sessionDropBanner"
      class="session-drop-banner"
      :data-reason="sessionDropBanner.reason"
      role="status"
      aria-live="polite"
    >
      <strong>{{ sessionDropBanner.code }}</strong>
      <span class="session-drop-banner__message">{{ sessionDropBanner.message }}</span>
      <button
        type="button"
        class="session-drop-banner__dismiss"
        aria-label="Dismiss notification"
        @click="dismissSessionDropBanner"
      >
        Dismiss
      </button>
    </div>

    <!-- ═══ AIRCRAFT SELECTION CARD (always visible) ══════════════════════ -->
    <section
      id="prep-card-aircraft"
      class="prep-card prep-card--aircraft"
      aria-label="Aircraft selection"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge">01</span>
        <h2 class="prep-card__title">Aircraft</h2>
        <span v-if="aircraftLabel" class="aircraft-label">{{ aircraftLabel }}</span>
      </div>

      <!-- Catalogue validation error -->
      <div v-if="catalogueError" class="inline-alert inline-alert--critical" role="alert">
        {{ catalogueError }}
      </div>

      <!-- Fleet load timed out (UX-014): escalate the spinner to an actionable error -->
      <div
        v-if="isFleetLoading && loadTimedOut"
        class="inline-alert inline-alert--critical fleet-error"
        role="alert"
      >
        <span>Loading your fleet is taking longer than expected. Your device storage may be busy.</span>
        <div class="fleet-error__actions">
          <button type="button" class="retry-btn" @click="onRetry">Retry</button>
          <button type="button" class="retry-btn retry-btn--ghost" @click="onGoToFleet">
            Go to Fleet
          </button>
        </div>
      </div>

      <!-- Fleet hydrating -->
      <div v-else-if="isFleetLoading" class="loading" aria-busy="true" aria-live="polite">
        <span class="loading-spinner" aria-hidden="true" />
        <span>Loading your fleet…</span>
      </div>

      <!-- Fleet load error -->
      <div
        v-else-if="isFleetError"
        class="inline-alert inline-alert--critical fleet-error"
        role="alert"
      >
        <span>{{ fleetStore.fleetLoadError }}</span>
        <button type="button" class="retry-btn" @click="onRetry">Retry</button>
      </div>

      <!-- Empty fleet CTA (REQ-AC-001, UJ-F-002) -->
      <section
        v-else-if="isFleetEmpty"
        class="fleet-empty"
        aria-label="No aircraft in fleet"
      >
        <p class="fleet-empty__text">
          No aircraft in your fleet yet. Add your first aircraft to start Mass &amp; Balance
          planning.
        </p>
        <button type="button" class="fleet-empty__cta" @click="onAddAircraft">
          + Add Aircraft
        </button>
      </section>

      <!-- Populated fleet picker -->
      <div v-else-if="hasFleet" class="aircraft-selector-row">
        <div class="aircraft-selector-field">
          <!-- Label text changes so "Select aircraft" is absent from rendered text after an aircraft is loaded -->
          <label for="aircraft-select" class="field-label">
            {{ store.aircraft ? 'Aircraft' : 'Select aircraft' }}
          </label>
          <select
            id="aircraft-select"
            :value="selectedAircraftId"
            aria-label="Select aircraft"
            class="aircraft-select"
            @change="onAircraftSelected"
          >
            <option value="">— choose aircraft —</option>
            <optgroup v-if="lastUsedProfile" label="Last used">
              <option
                :value="lastUsedProfile.id"
                :class="{
                  'opt-draft': lastUsedProfile.status === 'draft' || isExpiredVerified(lastUsedProfile),
                }"
              >
                {{ optionLabel(lastUsedProfile) }}
              </option>
            </optgroup>
            <optgroup v-if="verifiedProfiles.length > 0" label="Verified">
              <option
                v-for="aircraft in verifiedProfiles"
                :key="aircraft.id"
                :value="aircraft.id"
                :class="{ 'opt-draft': isExpiredVerified(aircraft) }"
              >
                {{ optionLabel(aircraft) }}
              </option>
            </optgroup>
            <optgroup v-if="draftProfiles.length > 0" label="Draft">
              <option
                v-for="aircraft in draftProfiles"
                :key="aircraft.id"
                :value="aircraft.id"
                class="opt-draft"
              >
                {{ optionLabel(aircraft) }}
              </option>
            </optgroup>
          </select>

          <!-- Inline acknowledgement before an unverified (draft) or expired
               Verified envelope loads — both are gated at this Go/No-Go entry
               point (REQ-AC-005/007, H-011). -->
          <div
            v-if="pendingAck"
            class="draft-ack"
            role="alertdialog"
            aria-label="Unverified profile acknowledgement"
          >
            <p class="draft-ack__message">
              <strong>{{ pendingAck.heading }}</strong>
              {{ pendingAck.body }}
            </p>
            <div class="draft-ack__actions">
              <button type="button" class="draft-ack__btn draft-ack__btn--cancel" @click="onCancelSelection">
                Cancel
              </button>
              <button type="button" class="draft-ack__btn draft-ack__btn--continue" @click="onConfirmSelection">
                Continue anyway
              </button>
            </div>
          </div>
        </div>

        <div v-if="categories.length > 1" class="aircraft-selector-field">
          <label class="field-label" for="category-select">Category</label>
          <select
            id="category-select"
            :value="activeCategory"
            :disabled="viewModel.inputsDisabled"
            aria-label="Certification category"
            class="aircraft-select"
            @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
      </div>

      <!-- Mass-balance profile-loading spinner (distinct from fleet hydration) -->
      <div v-if="viewModel.isLoading" class="loading" aria-busy="true" aria-live="polite">
        <span class="loading-spinner" aria-hidden="true" />
        <span>Loading aircraft profile…</span>
      </div>
    </section>

    <!-- ═══ MASS & BALANCE CARD ════════════════════════════════════════════ -->
    <section
      id="prep-card-mb"
      class="prep-card prep-card--mb"
      :class="{ 'prep-card--locked': viewModel.mbLocked }"
      aria-label="Mass and Balance"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge">02</span>
        <h2 class="prep-card__title">Mass &amp; Balance</h2>
        <span v-if="viewModel.mbLocked" class="locked-badge" aria-label="Select an aircraft to unlock">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <path d="M4 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          Select aircraft to unlock
        </span>
        <span v-else-if="viewModel.bannerSeverity" class="state-badge" :class="`state-badge--${viewModel.bannerSeverity}`">
          {{ viewModel.isSafe ? 'VERIFIED SAFE' : viewModel.isWarning ? 'WARNING' : 'CRITICAL' }}
        </span>
      </div>

      <!-- Locked overlay (INITIAL/LOADING with no aircraft) -->
      <div v-if="viewModel.mbLocked" class="locked-placeholder" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" class="locked-icon">
          <rect x="6" y="18" width="28" height="18" rx="4" stroke="currentColor" stroke-width="2" />
          <path d="M12 18V13a8 8 0 0116 0v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="20" cy="27" r="2" fill="currentColor" />
        </svg>
        <p class="locked-hint">Select an aircraft above to start Mass &amp; Balance</p>
      </div>

      <!-- Active M&B content -->
      <template v-else>
        <!-- Status banner (WARNING / ERROR_CRITICAL / VERIFIED_SAFE) -->
        <div
          v-if="viewModel.bannerSeverity"
          class="state-banner"
          :class="`banner--${viewModel.bannerSeverity}`"
          role="alert"
          :aria-live="viewModel.isError ? 'assertive' : 'polite'"
        >
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notification"
            :class="`notification--${n.severity.toLowerCase()}`"
          >
            {{ n.message }}
          </div>
          <div v-if="viewModel.isSafe" class="notification notification--success">
            Mass &amp; Balance verified — safe for flight
          </div>
        </div>

        <!-- Status hint (UNCONFIGURED / UNVERIFIED) -->
        <p v-if="viewModel.statusHint" class="status-hint" role="status">
          {{ viewModel.statusHint }}
        </p>

        <!-- Two-column (desktop) / stacked (mobile) layout -->
        <div class="mb-layout">
          <!-- Left column: station inputs -->
          <section class="mb-layout__inputs">
            <InputGroupCard>
              <!-- @IMP-MB-UI-007@ (FROM: @REQ-UQ-005@) -->
              <MassStationInput
                v-for="station in stations"
                :key="station.index"
                :station="station"
                :unit="store.aircraft?.loadPoints[station.index]?.unit"
                :unusable-fuel="store.aircraft?.loadPoints[station.index]?.fuelTank?.unusableFuel ?? 0"
                :max-capacity="store.aircraft?.loadPoints[station.index]?.fuelTank
                  ? (store.aircraft?.loadPoints[station.index]?.operationalLimit ?? null)
                  : null"
                :presets="presetsForStation(station.index)"
                :disabled="viewModel.inputsDisabled"
                @update:weight="onStationWeightChange(station.index, $event)"
              />
            </InputGroupCard>

            <div class="input-actions">
              <button
                class="reset-btn"
                :disabled="viewModel.inputsDisabled"
                @click="onResetPayload"
              >
                Reset Payload
              </button>
            </div>
          </section>

          <!-- Right column: chart + result summary -->
          <aside class="mb-layout__results">
            <CGEnvelopeChart
              v-if="viewModel.showChart"
              :result="lastResult"
              :envelope="envelope"
              :graph-type="graphType"
              :severity="viewModel.bannerSeverity"
            />

            <ResultSummary
              v-if="viewModel.showResultSummary"
              :result="lastResult"
              :limits="categoryLimits"
              :can-export="viewModel.canExport"
              :export-requires-confirmation="viewModel.exportRequiresConfirmation"
            />
          </aside>
        </div>
      </template>
    </section>

    <!-- ═══ COMING SOON: Performance ══════════════════════════════════════ -->
    <section
      id="prep-card-performance"
      class="prep-card prep-card--soon"
      aria-label="Performance — coming soon"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">03</span>
        <h2 class="prep-card__title prep-card__title--soon">Performance</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">
        TOLD calculations — takeoff &amp; landing distances with POH-based correction factors,
        wet/dry/grass surface conditions, operational safety factors.
      </p>
    </section>

    <!-- ═══ COMING SOON: Weather ════════════════════════════════════════════ -->
    <section
      id="prep-card-weather"
      class="prep-card prep-card--soon"
      aria-label="Weather — coming soon"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">04</span>
        <h2 class="prep-card__title prep-card__title--soon">Weather</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">
        METAR &amp; TAF integration, crosswind component, runway surface conditions,
        wind limit advisory.
      </p>
    </section>

    <!-- ═══ COMING SOON: Fuel / Energy & Endurance ═════════════════════════ -->
    <section
      id="prep-card-fuel"
      class="prep-card prep-card--soon"
      :aria-label="`${energySectionTitle} — coming soon`"
    >
      <div class="prep-card__header">
        <span class="prep-card__badge prep-card__badge--soon">05</span>
        <h2 class="prep-card__title prep-card__title--soon">{{ energySectionTitle }}</h2>
        <span class="soon-pill">Coming soon</span>
      </div>
      <p class="soon-desc">{{ energySectionDescription }}</p>
    </section>

    <!-- ═══ Operational disclaimer (bottom, non-blocking) ═════════════════ -->
    <div class="disclaimer" role="note" aria-label="Operational disclaimer">
      <strong>Advisory only</strong> — verify all results against the official POH/AFM before
      flight. This tool is not a certified aviation device.
    </div>

    <!-- UX-004: Reset Payload confirmation + undo -->
    <ConfirmDialog
      :open="showResetConfirm"
      title="Reset payload?"
      :message="
        resetCandidateCount > 0
          ? `Discard ${resetCandidateCount} entered ${resetCandidateCount === 1 ? 'weight' : 'weights'} and reset all stations to POH defaults? You can undo for a few seconds.`
          : 'Reset all stations to POH defaults?'
      "
      confirm-label="Reset"
      cancel-label="Keep"
      variant="danger"
      @confirm="onConfirmReset"
      @cancel="onCancelReset"
    />

    <UndoToast
      :open="resetSnapshot !== null"
      message="Payload reset"
      action-label="Undo"
      :duration="5000"
      @undo="onUndoReset"
      @dismiss="onDismissResetUndo"
    />

  </div>
</template>

<style scoped>
/* ─── Page shell ─────────────────────────────────────────────────────────── */

.fp-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  max-width: 1280px;
  margin: 0 auto;
  --prep-sticky-h: 2.75rem;
}

/* ─── Sticky breadcrumb stack (fixed-position, fills the gap below the
 *      app header with one strip per card the pilot has scrolled past) ── */

.prep-sticky-stack {
  position: fixed;
  top: var(--nav-header-height);
  left: 0;
  right: 0;
  z-index: 150; /* below app header (200) + PWA banner (150), above main content */
  display: flex;
  flex-direction: column;
  pointer-events: none; /* let the underlying scroll show through gaps */
}

.prep-sticky-strip {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--prep-sticky-h);
  padding: 0 var(--space-6);
  background: var(--color-surface-card);
  border: 0;
  border-bottom: 1px solid var(--color-divider);
  /* Mirror the in-flow card's left accent. The in-flow `.prep-card` uses
   * `border-left: 3px solid var(--color-primary)` when active; we use a
   * box-shadow inset instead so the strip still reaches edge-to-edge of
   * the viewport. */
  box-shadow: none;
  color: var(--color-text-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  /* iOS Safari: avoid double-tap zoom + the 300ms tap delay */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--transition-fast, 120ms) ease,
    color var(--transition-fast, 120ms) ease;
}

.prep-sticky-strip--accent {
  box-shadow: inset 3px 0 0 0 var(--color-primary);
}

.prep-sticky-strip:hover,
.prep-sticky-strip:focus-visible {
  background: var(--color-surface-hover, var(--color-surface-card));
}

.prep-sticky-strip:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.prep-sticky-strip__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.prep-sticky-strip__badge--soon {
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
}

.prep-sticky-strip__title {
  font-size: var(--text-base);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.prep-sticky-strip__title--soon {
  color: var(--color-text-secondary);
}

/* ── Trailing content (mirrors the in-flow card header) ──────────────── */

.prep-sticky-strip__aircraft-label {
  flex: 1;
  text-align: right;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.prep-sticky-strip__locked {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* On narrow viewports the icon is enough; the text would push the title
 * off-screen. */
@media (max-width: 479.98px) {
  .prep-sticky-strip__locked-text {
    display: none;
  }
}

.prep-sticky-strip__state-badge {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.2em 0.6em;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.prep-sticky-strip__state-badge--success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.prep-sticky-strip__state-badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.prep-sticky-strip__state-badge--critical {
  background: var(--color-critical-bg);
  color: var(--color-critical);
}

.prep-sticky-strip__soon-pill {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2em 0.5em;
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

@media (max-width: 767.98px) {
  .prep-sticky-strip {
    padding: 0 var(--space-4);
    gap: var(--space-2);
  }
}

/*
 * scroll-margin-top reserves space below the strip stack so anchor /
 * smooth-scroll targets land BELOW the remaining strips. The custom-eased
 * smoothScrollTo() in the script accounts for this manually, but keeping
 * the CSS hint in place means anchor links and devtools-driven scrollIntoView
 * also behave correctly.
 */
.prep-card {
  scroll-margin-top: calc(var(--nav-header-height) + 5 * var(--prep-sticky-h));
}

/* ─── Page header ─────────────────────────────────────────────────────────── */

.fp-page-header {
  padding-bottom: var(--space-2);
}

.fp-page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1);
  letter-spacing: -0.02em;
}

.fp-page-sub {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

/* ─── Prep cards (sections) ─────────────────────────────────────────────── */

.prep-card {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5) var(--space-6);
  transition: border-color var(--transition-normal);
}

.prep-card--aircraft {
  border-left: 3px solid var(--color-primary);
}

.prep-card--mb:not(.prep-card--locked) {
  border-left: 3px solid var(--color-primary);
}

.prep-card--mb.prep-card--locked {
  border-left: 3px solid var(--color-border);
  opacity: 0.7;
}

.prep-card--soon {
  border-style: dashed;
  opacity: 0.5;
}

.prep-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
  flex-wrap: wrap;
}

.prep-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.prep-card__badge--soon {
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
}

.prep-card__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.prep-card__title--soon {
  color: var(--color-text-secondary);
}

/* ─── Aircraft label (shown after selection, kept for E2E) ───────────────── */

.aircraft-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-primary);
  flex: 1;
  text-align: right;
}

/* ─── Inline alert ───────────────────────────────────────────────────────── */

.inline-alert {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  margin-bottom: var(--space-4);
}

.inline-alert--critical {
  background: var(--color-critical-bg);
  border: 1px solid var(--color-critical);
  color: var(--color-critical);
}

/* ─── Session drop banner (INFO-SYS-001) ─────────────────────────────────── */

.session-drop-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-info-bg, #eff6ff);
  border: 1px solid var(--color-info, #3b82f6);
  color: var(--color-info, #1e40af);
  font-size: var(--text-sm);
  flex-wrap: wrap;
}

.session-drop-banner__message {
  flex: 1 1 auto;
}

.session-drop-banner__dismiss {
  padding: var(--space-1) var(--space-3);
  border: 1px solid currentColor;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.fleet-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.retry-btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid currentColor;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--color-critical);
  color: #fff;
}

.fleet-error__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.retry-btn--ghost {
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.retry-btn--ghost:hover {
  background: var(--color-surface-hover, var(--color-surface-card));
  color: var(--color-text-primary);
}

/* ─── Empty fleet CTA ────────────────────────────────────────────────────── */

.fleet-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
}

.fleet-empty__text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.fleet-empty__cta {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-text, #fff);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}

.fleet-empty__cta:hover {
  background: var(--color-primary-hover, var(--color-primary));
}

.fleet-empty__cta:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ─── Aircraft selector row ──────────────────────────────────────────────── */

.aircraft-selector-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.aircraft-selector-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 220px;
}

.field-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.aircraft-select {
  /* Native <select> sizes itself to its widest option unless width is
     explicitly constrained. With long registrations + manufacturer + model
     (e.g. "D-EBPN — Pipistrel Velis Electro [Draft]") the control was
     overflowing the parent card on 390 px viewports. width:100% + max-width:100%
     + box-sizing:border-box pins it to the flex container, and the browser
     handles truncation of the selected-option display natively. */
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  min-height: 44px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.aircraft-select:hover {
  border-color: var(--color-primary);
}

/* Draft options carry the destructive colour where the browser honours
 * <option> styling (Firefox; most Chromium/WebKit ignore it — the `[Draft]`
 * suffix and the dedicated "Draft" optgroup remain the reliable signal). */
.aircraft-select .opt-draft {
  color: var(--color-critical, #dc2626);
}

/* ─── Inline draft acknowledgement (WARN-AC-002) ─────────────────────────── */

.draft-ack {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-warning, #fcd34d);
  border-left: 4px solid var(--color-warning, #f59e0b);
  border-radius: var(--radius-md);
  background: var(--color-warning-bg, #fef3c7);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.draft-ack__message {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
}

.draft-ack__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.draft-ack__btn {
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.draft-ack__btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.draft-ack__btn--cancel {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.draft-ack__btn--continue {
  background: var(--color-warning, #d97706);
  color: var(--neutral-0, #fff);
}

.aircraft-select:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

/* ─── Loading row ────────────────────────────────────────────────────────── */

.loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Locked badges ─────────────────────────────────────────────────────── */

.locked-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.2em 0.6em;
  border-radius: var(--radius-full);
}

.state-badge--success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.state-badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.state-badge--critical {
  background: var(--color-critical-bg);
  color: var(--color-critical);
}

/* ─── Locked placeholder ─────────────────────────────────────────────────── */

.locked-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-secondary);
}

.locked-icon {
  opacity: 0.3;
}

.locked-hint {
  font-size: var(--text-sm);
  margin: 0;
}

/* ─── Status banner ──────────────────────────────────────────────────────── */

.state-banner {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.banner--success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success);
}

.banner--warning {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
}

.banner--critical {
  background: var(--color-critical-bg);
  border: 1px solid var(--color-critical);
}

.notification {
  font-size: var(--text-sm);
  font-weight: 500;
}

.notification--success {
  color: var(--color-success);
}

.notification--warning {
  color: var(--color-warning);
}

.notification--critical {
  color: var(--color-critical);
}

/* ─── Status hint ────────────────────────────────────────────────────────── */

.status-hint {
  padding: var(--space-2) var(--space-4);
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3);
}

/* ─── M&B layout ─────────────────────────────────────────────────────────── */

.mb-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mb-layout__inputs {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) 0 0;
}

.reset-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-family: inherit;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  color: var(--color-text);
  cursor: pointer;
  min-height: 44px;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.reset-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reset-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ─── Desktop: side-by-side M&B layout ──────────────────────────────────── */

@media (min-width: 900px) {
  .mb-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  .mb-layout__inputs {
    flex: 0 0 42%;
    overflow-y: auto;
    max-height: calc(100vh - 16rem);
  }

  .mb-layout__results {
    flex: 1;
    position: sticky;
    top: calc(var(--nav-header-height) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
}

/* ─── Mobile: chart + result flow naturally below inputs ──────────────── */
/* Previously the results were pinned as a sticky footer above the bottom
 * nav. On a 390px portrait iPhone that cram-fit the 600×400 CG chart plus
 * ResultSummary into ~250px of vertical space — chart truncated and the
 * summary overflowed. Let the results flow in normal page order on mobile
 * so the pilot can scroll between inputs and the chart. The chart height
 * is capped so it can't exceed half the viewport. */

@media (max-width: 899.98px) {
  .mb-layout__results {
    position: static;
    background: transparent;
    padding: 0;
    border-top: none;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .mb-layout__results :deep(.cg-chart) {
    max-height: 50vh;
  }
}

/* ─── Coming soon sections ────────────────────────────────────────────────── */

.soon-pill {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2em 0.5em;
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
  border-radius: var(--radius-full);
}

.soon-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* ─── Disclaimer ─────────────────────────────────────────────────────────── */

.disclaimer {
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-text-primary);
  opacity: 0.8;
}

/* ─── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 767.98px) {
  .fp-view {
    padding: var(--space-4);
  }

  .prep-card {
    padding: var(--space-4);
  }

  .aircraft-selector-row {
    flex-direction: column;
  }

  .aircraft-selector-field {
    min-width: 0;
  }
}
</style>
