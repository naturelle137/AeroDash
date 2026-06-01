<script setup lang="ts">
// @IMP-UI-SHARED-002@ (FROM: @REQ-UI-011@, @REQ-SYS-001@, @REQ-SYS-006@, @H-019@, @REQ-SYS-016@, @DES-ARCH-014@, @DES-ARCH-015@)
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useTheme } from '@/shared/composables/useTheme'
import AppLogo from '@/shared/components/AppLogo.vue'
import AppVersion from '@/shared/components/AppVersion.vue'
import DisclaimerAcknowledgementModal from '@/shared/components/DisclaimerAcknowledgementModal.vue'
import { usePwaUpdateStore } from '@/stores/pwa-update.store'
import { useAppVersionStore, attachConnectivityRefresh } from '@/stores/app-version.store'
import { useDisclaimerAcknowledgementStore } from '@/stores/disclaimer-acknowledgement.store'

const pwaStore = usePwaUpdateStore()
const appVersionStore = useAppVersionStore()
const disclaimerStore = useDisclaimerAcknowledgementStore()
const disclaimerStorageWriteFailed = ref(false)
onMounted(() => {
  disclaimerStore.loadFromStorage()
})
async function onDisclaimerAccept(): Promise<void> {
  const ok = disclaimerStore.acknowledge()
  disclaimerStorageWriteFailed.value = !ok
  if (ok) {
    // Move focus into the now-revealed content so keyboard / AT users are not
    // stranded after the modal closes.
    await nextTick()
    document.getElementById('main-content')?.focus()
  }
}

// REQ-SYS-006 / H-019 must pre-empt REQ-SYS-016 (M2): a kill-switched cold
// start replaces the whole app with the version-blocked screen, so the
// disclaimer overlay (and its inert guard on .app-shell) must stand down to
// keep that screen reachable to assistive technologies.
const disclaimerGateActive = computed(
  () => disclaimerStore.gateOpen && !appVersionStore.versionBlocked,
)

// REQ-SYS-006 / H-019 (issue #271): check minimum safe version on every
// mount. The check itself works offline — it reads the last-known
// minSafeVersion from IndexedDB and enforces it even when navigator.onLine
// is false — so resurrecting an old, kill-switched bundle via Service Worker
// rollback cannot bypass the gate by going offline. When connectivity is
// available we also opportunistically refresh from /version.json and bind
// `window.online` so a return to network re-checks without a cold start.
let detachVersionConnectivity: (() => void) | null = null
onMounted(() => {
  void appVersionStore.checkMinSafeVersion()
  // Detach any prior listener before re-binding. App.vue mounts once for the
  // SPA lifetime today, so this is dead-code-safe, but it hardens against a
  // future error-boundary / HMR re-mount leaking a duplicate listener (n1).
  detachVersionConnectivity?.()
  detachVersionConnectivity = attachConnectivityRefresh()
})
onBeforeUnmount(() => {
  detachVersionConnectivity?.()
  detachVersionConnectivity = null
})

const { theme, toggleTheme } = useTheme()
const route = useRoute()

const sidebarCollapsed = ref(false)

// @IMP-SYS-SHARED-007@ (FROM: @REQ-SYS-001@)
// iOS Safari aggressively restores SPA pages from the back/forward cache
// (bfcache) when the pilot uses the browser back button — or, more commonly
// on a tablet, the swipe-back edge gesture — to return from a deep route
// (e.g. /fleet/:id/edit → /fleet). The restored page comes back with its
// previous DOM and JS state intact, but Vue's reactive bindings and any
// pending microtasks are not re-initialised, so template @click handlers
// silently no-op even though the button itself is still focusable and
// visually enabled (issue #232: the Fleet list Delete control). Listening
// for `pageshow` with `event.persisted === true` lets us spot the bfcache
// restore and force the active route component to remount cleanly via a
// route key, which re-runs `onMounted` and re-binds every reactive handler.
//
// Scope: we only force-remount on routes we can safely tear down and rebuild.
// Multi-step wizards and entry forms (/fleet/new, /fleet/:id/edit,
// /mass-balance) hold partial pilot input in component-local refs — silently
// wiping that input on an iOS app-switch / swipe-back would be a worse UX
// regression than the original Delete-button bug. List/index views like
// /fleet have no such hidden state, so a remount is safe there. Extend this
// allowlist only after confirming the target route has no unsaved local
// state (or after migrating that state to a store).
//
// The pageshow listener attaches in onMounted, so a `persisted=true` event
// fired before App.vue itself is mounted (a bfcache restore on the very
// first page load) is intentionally missed — at that point JS is freshly
// initialised anyway and there is nothing to remount.
const BFCACHE_REMOUNT_ROUTES: ReadonlySet<string> = new Set(['fleet'])
const bfcacheNonce = ref(0)

function handlePageShow(event: PageTransitionEvent): void {
  if (event.persisted && BFCACHE_REMOUNT_ROUTES.has(String(route.name ?? ''))) {
    bfcacheNonce.value += 1
  }
}

onMounted(() => {
  window.addEventListener('pageshow', handlePageShow)
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', handlePageShow)
})

interface NavItem {
  id: string
  label: string
  path: string
  soon?: boolean
  icon: string
}

const navItems: NavItem[] = [
  { id: 'home',        label: 'Home',        path: '/',            icon: 'home' },
  { id: 'flight-prep', label: 'Flight Prep', path: '/mass-balance', icon: 'prep' },
  { id: 'fleet',       label: 'Fleet',       path: '/fleet',       icon: 'fleet' },
  { id: 'weather',     label: 'Weather',     path: '/weather',     icon: 'wx',   soon: true },
  { id: 'fuel',        label: 'Fuel',        path: '/fuel',        icon: 'fuel', soon: true },
  { id: 'airport',     label: 'Airport DB',  path: '/airport',     icon: 'ap',   soon: true },
  // @IMP-UI-SHARED-007@ (FROM: @REQ-SYS-014@, @REQ-SYS-015@)
  { id: 'privacy',     label: 'Privacy',     path: '/privacy',     icon: 'privacy' },
]

// Mobile bottom nav (phone-width < 768px, where the sidebar is hidden): the
// primary task destinations plus Privacy, so the GDPR data-rights surface
// (REQ-SYS-014/015) stays reachable on phones. The icon-rail sidebar already
// exposes every destination, including Privacy, at >= 768px.
const BOTTOM_NAV_IDS = ['home', 'flight-prep', 'fleet', 'weather', 'privacy'] as const
const bottomNavItems = BOTTOM_NAV_IDS.map((id) => navItems.find((item) => item.id === id)).filter(
  (item): item is NavItem => item !== undefined,
)

function isActive(item: NavItem): boolean {
  if (item.path === '/') return route.path === '/'
  return route.path.startsWith(item.path)
}

const themeLabel = computed(() =>
  theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'sidebar--collapsed': sidebarCollapsed }"
    :inert="disclaimerGateActive || undefined"
    :aria-hidden="disclaimerGateActive ? 'true' : undefined"
  >

    <!-- ═══ Top header ══════════════════════════════════════════════════════ -->
    <header class="app-header" role="banner">
      <div class="app-header__start">
        <!-- Sidebar collapse toggle (desktop) -->
        <button
          class="nav-collapse-btn"
          :aria-label="sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          :title="sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          aria-controls="app-sidebar"
          :aria-expanded="!sidebarCollapsed"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="1" y="3.5" width="16" height="2" rx="1" fill="currentColor" />
            <rect x="1" y="8" width="16" height="2" rx="1" fill="currentColor" />
            <rect x="1" y="12.5" width="16" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        <RouterLink to="/" class="header-logo-link" aria-label="AeroDash home">
          <AppLogo :icon-only="sidebarCollapsed" :size="28" />
        </RouterLink>
      </div>

      <div class="app-header__end">
        <!-- Theme toggle -->
        <button
          class="icon-btn"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="toggleTheme"
        >
          <!-- Sun icon -->
          <svg v-if="theme === 'light'" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4" fill="currentColor" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <!-- Moon icon -->
          <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.003 8.003 0 1010.586 10.586z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>

    <!-- ═══ Sidebar navigation (desktop) ═══════════════════════════════════ -->
    <nav
      id="app-sidebar"
      class="app-sidebar"
      aria-label="Main navigation"
    >
      <ul class="sidebar-nav" role="list">
        <li v-for="item in navItems" :key="item.id" class="sidebar-nav__item">
          <component
            :is="item.soon ? 'span' : RouterLink"
            :to="item.soon ? undefined : item.path"
            class="sidebar-nav__link"
            :class="{
              'sidebar-nav__link--active': !item.soon && isActive(item),
              'sidebar-nav__link--soon': item.soon,
            }"
            :aria-current="!item.soon && isActive(item) ? 'page' : undefined"
            :aria-disabled="item.soon"
            :title="item.soon ? `${item.label} — Coming soon` : item.label"
          >
            <!-- Icon -->
            <span class="sidebar-nav__icon" aria-hidden="true">
              <!-- Home -->
              <svg v-if="item.icon === 'home'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M7 18v-6h6v6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
              <!-- Flight Prep / airplane -->
              <svg v-else-if="item.icon === 'prep'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M17 4.5L3 9.5l5 2 2 5 5-14z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
                <path d="M8.5 11.5L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <!-- Fleet -->
              <svg v-else-if="item.icon === 'fleet'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="7" width="16" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
                <path d="M6 7V5a2 2 0 014 0v2M10 7V5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <circle cx="6" cy="14" r="1.5" fill="currentColor" />
                <circle cx="14" cy="14" r="1.5" fill="currentColor" />
              </svg>
              <!-- Weather -->
              <svg v-else-if="item.icon === 'wx'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 13a4 4 0 10-7.938-.5A3 3 0 106 18h9a3 3 0 000-6h-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <!-- Fuel -->
              <svg v-else-if="item.icon === 'fuel'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="4" y="3" width="9" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                <path d="M13 7h2a1 1 0 011 1v5a1 1 0 01-1 1h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path d="M7 7h3M7 10h3M7 13h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <!-- Airport -->
              <svg v-else-if="item.icon === 'ap'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5" />
                <path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <ellipse cx="10" cy="10" rx="4" ry="7" stroke="currentColor" stroke-width="1.5" />
              </svg>
              <!-- Privacy (shield) -->
              <svg v-else-if="item.icon === 'privacy'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2l6 2.5v5c0 4-3 7-6 8-3-1-6-4-6-8v-5L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M7.5 10l2 2 3-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>

            <span class="sidebar-nav__label">{{ item.label }}</span>

            <span v-if="item.soon" class="soon-badge">Soon</span>
          </component>
        </li>
      </ul>

      <!-- Sidebar footer: contribute link + advisory + version -->
      <div class="sidebar-footer">
        <!-- @IMP-UI-SHARED-015@ (FROM: @REQ-SYS-017@, @DES-UX-013@) -->
        <RouterLink
          to="/contribute"
          class="sidebar-contribute"
          title="Help / contribute"
          aria-label="Open the contribution hub"
          data-testid="sidebar-contribute-link"
        >
          <span class="sidebar-contribute__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 5h12a2 2 0 012 2v6a2 2 0 01-2 2h-6l-4 3v-3H4a2 2 0 01-2-2V7a2 2 0 012-2z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="sidebar-contribute__label">Help / contribute</span>
        </RouterLink>
        <p class="sidebar-footer__text">Advisory only. Verify against POH/AFM.</p>
        <AppVersion />
      </div>
    </nav>

    <!-- ═══ PWA update banner (INFO-SYS-001) ════════════════════════════════ -->
    <div v-if="pwaStore.needsUpdate" class="pwa-update-banner" role="status" aria-live="polite">
      <span>A new version of AeroDash is available.</span>
      <button class="pwa-update-btn" @click="pwaStore.applyUpdate()">Reload to update</button>
    </div>

    <!-- ═══ Session-storage advisory (issue #263 — DP-004 / CS-012) ═══════
         Surfaced once per tab when sessionStorage is unreachable so the
         pilot knows cold-start silent updates have been downgraded to the
         consent-required banner path for the rest of the tab lifetime.
         Dismissible; not auto-recovered (the failure is sticky for the tab). -->
    <div
      v-if="pwaStore.sessionStorageAdvisory"
      class="session-storage-advisory"
      role="status"
      aria-live="polite"
      data-testid="session-storage-advisory"
    >
      <span>
        Session storage is unavailable in this browser tab. App updates will
        require an explicit reload — silent cold-start updates are disabled.
      </span>
      <button
        class="session-storage-advisory__btn"
        type="button"
        aria-label="Dismiss session-storage advisory"
        @click="pwaStore.dismissSessionStorageAdvisory()"
      >
        Dismiss
      </button>
    </div>

    <!-- ═══ Main content ════════════════════════════════════════════════════ -->
    <!-- REQ-SYS-006: Block all safety-critical features when version is below minimum -->
    <main class="app-main" id="main-content" tabindex="-1">
      <div
        v-if="appVersionStore.versionBlocked"
        class="version-blocked-screen"
        role="alert"
        aria-live="assertive"
        data-testid="version-blocked-screen"
      >
        <div class="version-blocked-screen__card">
          <div class="version-blocked-screen__icon" aria-hidden="true">⛔</div>
          <h1 class="version-blocked-screen__title">Application Update Required</h1>
          <p class="version-blocked-screen__body">
            This version of AeroDash (<strong>{{ appVersionStore.currentVersion }}</strong>) is
            below the minimum required version
            (<strong>{{ appVersionStore.minSafeVersion }}</strong>).
          </p>
          <p class="version-blocked-screen__body">
            Safety-critical features (Mass &amp; Balance, Performance, Fuel &amp; Endurance) are
            <strong>disabled</strong> until the application is updated.
          </p>
          <p class="version-blocked-screen__advisory">
            Please refresh the page or update your PWA installation. If this error persists, clear
            your browser cache and reload.
          </p>
        </div>
      </div>
      <RouterView v-else-if="!disclaimerGateActive" :key="bfcacheNonce" />
      <p v-else class="app-main__gate-placeholder">
        Acknowledge the disclaimer to continue.
      </p>
    </main>

    <!-- Teleports to <body>, outside the inert .app-shell, so it stays interactive while the gate is open. -->
    <DisclaimerAcknowledgementModal
      :open="disclaimerGateActive"
      :storage-unavailable="disclaimerStore.storageUnavailable"
      :write-failed="disclaimerStorageWriteFailed"
      @accept="onDisclaimerAccept"
    />

    <!-- ═══ Bottom navigation (mobile only) ════════════════════════════════ -->
    <nav class="app-bottom-nav" aria-label="Main navigation (mobile)">
      <ul class="bottom-nav" role="list">
        <li v-for="item in bottomNavItems" :key="item.id" class="bottom-nav__item">
          <component
            :is="item.soon ? 'span' : RouterLink"
            :to="item.soon ? undefined : item.path"
            class="bottom-nav__link"
            :class="{
              'bottom-nav__link--active': !item.soon && isActive(item),
              'bottom-nav__link--soon': item.soon,
            }"
            :aria-current="!item.soon && isActive(item) ? 'page' : undefined"
            :aria-disabled="item.soon"
          >
            <span class="bottom-nav__icon" aria-hidden="true">
              <svg v-if="item.icon === 'home'" width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M7 18v-6h6v6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.icon === 'prep'" width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M17 4.5L3 9.5l5 2 2 5 5-14z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
                <path d="M8.5 11.5L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <svg v-else-if="item.icon === 'fleet'" width="22" height="22" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="7" width="16" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
                <path d="M6 7V5a2 2 0 014 0v2M10 7V5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <circle cx="6" cy="14" r="1.5" fill="currentColor" />
                <circle cx="14" cy="14" r="1.5" fill="currentColor" />
              </svg>
              <svg v-else-if="item.icon === 'wx'" width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M15 13a4 4 0 10-7.938-.5A3 3 0 106 18h9a3 3 0 000-6h-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.icon === 'privacy'" width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M10 2l6 2.5v5c0 4-3 7-6 8-3-1-6-4-6-8v-5L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M7.5 10l2 2 3-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="bottom-nav__label">{{ item.label }}</span>
          </component>
        </li>
      </ul>
    </nav>

  </div>
</template>

<style scoped>
/* ─── PWA update banner ───────────────────────────────────────────────────── */

.pwa-update-banner {
  position: fixed;
  top: var(--nav-header-height);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--color-info, #1d4ed8);
  color: #fff;
  font-size: var(--text-sm);
  z-index: 150; /* above main content (scrolls under banner) but below header (z-index 200) */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.pwa-update-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.pwa-update-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* ─── Session-storage advisory (issue #263) ─────────────────────────────── */

.session-storage-advisory {
  position: fixed;
  top: var(--nav-header-height);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--color-warning, #b45309);
  color: #fff;
  font-size: var(--text-sm);
  z-index: 150;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.session-storage-advisory__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.session-storage-advisory__btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* ─── Version-blocked screen (REQ-SYS-006) ───────────────────────────────── */

.version-blocked-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: var(--space-8);
  background: var(--color-bg);
}

.version-blocked-screen__card {
  max-width: 480px;
  width: 100%;
  padding: var(--space-8);
  background: var(--color-surface);
  border: 2px solid var(--color-danger, #dc2626);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.version-blocked-screen__icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.version-blocked-screen__title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-danger, #dc2626);
  margin: 0 0 var(--space-4);
}

.version-blocked-screen__body {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3);
  line-height: 1.6;
}

.version-blocked-screen__advisory {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: var(--space-4) 0 0;
  line-height: 1.5;
}

/* ─── Shell grid ──────────────────────────────────────────────────────────── */

.app-shell {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main";
  grid-template-columns: var(--nav-sidebar-width) 1fr;
  grid-template-rows: var(--nav-header-height) 1fr;
  min-height: 100vh;
  background: var(--color-bg);
}

.app-shell.sidebar--collapsed {
  grid-template-columns: var(--nav-sidebar-collapsed) 1fr;
}

/* ─── Header ──────────────────────────────────────────────────────────────── */

.app-header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: var(--color-nav-bg);
  border-bottom: 1px solid var(--color-divider);
  box-shadow: var(--shadow-xs);
  z-index: 200;
  position: sticky;
  top: 0;
}

.app-header__start {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-header__end {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-logo-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */

.app-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  background: var(--color-nav-bg);
  border-right: 1px solid var(--color-divider);
  overflow: hidden;
  position: sticky;
  top: var(--nav-header-height);
  height: calc(100vh - var(--nav-header-height));
  overflow-y: auto;
  transition: width var(--transition-normal);
}

.sidebar-nav {
  list-style: none;
  margin: 0;
  padding: var(--space-3) var(--space-2);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar-nav__item {
  width: 100%;
}

.sidebar-nav__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  color: var(--color-nav-text);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
  min-height: 44px;
}

.sidebar-nav__link:hover:not(.sidebar-nav__link--soon) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.sidebar-nav__link--active {
  background: var(--color-nav-active-bg);
  color: var(--color-nav-active-text);
  font-weight: 600;
  box-shadow: var(--glow-primary);
}

.sidebar-nav__link--soon {
  opacity: 0.5;
  cursor: default;
}

.sidebar-nav__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.sidebar-nav__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity var(--transition-normal), width var(--transition-normal);
}

.soon-badge {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
  padding: 0.1em 0.4em;
  border-radius: var(--radius-full);
}

/* Collapsed sidebar: hide labels + badges */
.sidebar--collapsed .sidebar-nav__label,
.sidebar--collapsed .soon-badge,
.sidebar--collapsed .sidebar-footer__text,
.sidebar--collapsed .sidebar-contribute__label {
  display: none;
}

/* ─── Sidebar footer ──────────────────────────────────────────────────────── */

.sidebar-footer {
  padding: var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-divider);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-footer__text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.sidebar-contribute {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-xs);
  font-weight: 600;
  min-height: 36px;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sidebar-contribute:hover,
.sidebar-contribute:focus-visible {
  background: var(--color-surface-hover);
  color: var(--color-primary);
  outline: none;
}

.sidebar-contribute:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.sidebar-contribute__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.sidebar-contribute__label {
  flex: 1;
}

/* ─── Main content ────────────────────────────────────────────────────────── */

.app-main {
  grid-area: main;
  min-width: 0;
  /* Intentionally no `overflow-y: auto` — letting the document/window be the
   * scroll container is the only reliable way to make `position: sticky`
   * children (e.g. prep-card titles) actually pin on iOS Safari, which has a
   * long-standing quirk where sticky inside an overflow:auto box fails to
   * engage. The header / sidebar / bottom-nav stay put via their own
   * `position: sticky | fixed` rules. */
}

/* ─── Icon / collapse buttons ─────────────────────────────────────────────── */

.icon-btn,
.nav-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.icon-btn:hover,
.nav-collapse-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.icon-btn:focus-visible,
.nav-collapse-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ─── Bottom navigation (mobile only) ────────────────────────────────────── */

.app-bottom-nav {
  display: none;
}

/* ─── Responsive: mobile (< 768 px) ──────────────────────────────────────── */

@media (max-width: 767.98px) {
  .app-shell {
    grid-template-areas:
      "header"
      "main"
      "bottom-nav";
    grid-template-columns: 1fr;
    grid-template-rows: var(--nav-header-height) 1fr var(--nav-bottom-height);
  }

  /* All column variants collapse to zero on mobile */
  .app-shell,
  .app-shell.sidebar--collapsed {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    display: none;
  }

  .nav-collapse-btn {
    display: none;
  }

  .app-main {
    grid-area: main;
    padding-bottom: var(--nav-bottom-height);
  }

  .app-bottom-nav {
    display: block;
    grid-area: bottom-nav;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-nav-bg);
    border-top: 1px solid var(--color-divider);
    box-shadow: var(--shadow-lg);
    z-index: 200;
    height: var(--nav-bottom-height);
  }

  .bottom-nav {
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    height: 100%;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .bottom-nav__item {
    flex: 1;
  }

  .bottom-nav__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 2px;
    text-decoration: none;
    color: var(--color-nav-text);
    font-size: 0.625rem;
    font-weight: 500;
    transition: color var(--transition-fast);
    cursor: pointer;
  }

  .bottom-nav__link--active {
    color: var(--color-nav-active-text);
  }

  .bottom-nav__link--soon {
    opacity: 0.4;
    cursor: default;
  }

  .bottom-nav__icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bottom-nav__label {
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
}

/* ─── Responsive: narrow desktop / tablet (768–1024 px) ──────────────────── */

@media (min-width: 768px) and (max-width: 1023.98px) {
  .app-shell:not(.sidebar--collapsed) {
    grid-template-columns: var(--nav-sidebar-collapsed) 1fr;
  }

  .app-shell:not(.sidebar--collapsed) .sidebar-nav__label,
  .app-shell:not(.sidebar--collapsed) .soon-badge,
  .app-shell:not(.sidebar--collapsed) .sidebar-footer__text {
    display: none;
  }
}
</style>
