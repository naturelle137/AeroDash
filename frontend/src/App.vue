<script setup lang="ts">
// @IMP-UI-SHARED-002@ (FROM: @REQ-UI-011@, @REQ-SYS-001@)
import { ref, computed } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useTheme } from '@/shared/composables/useTheme'
import AppLogo from '@/shared/components/AppLogo.vue'

const { theme, toggleTheme } = useTheme()
const route = useRoute()

const sidebarCollapsed = ref(false)

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
  { id: 'fleet',       label: 'Fleet',       path: '/fleet',       icon: 'fleet', soon: true },
  { id: 'weather',     label: 'Weather',     path: '/weather',     icon: 'wx',   soon: true },
  { id: 'fuel',        label: 'Fuel',        path: '/fuel',        icon: 'fuel', soon: true },
  { id: 'airport',     label: 'Airport DB',  path: '/airport',     icon: 'ap',   soon: true },
]

/** Bottom nav shows 4 primary items on mobile */
const bottomNavItems = navItems.slice(0, 4)

function isActive(item: NavItem): boolean {
  if (item.path === '/') return route.path === '/'
  return route.path.startsWith(item.path)
}

const themeLabel = computed(() =>
  theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar--collapsed': sidebarCollapsed }">

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
            </span>

            <span class="sidebar-nav__label">{{ item.label }}</span>

            <span v-if="item.soon" class="soon-badge">Soon</span>
          </component>
        </li>
      </ul>

      <!-- Sidebar footer: advisory -->
      <div class="sidebar-footer">
        <p class="sidebar-footer__text">Advisory only. Verify against POH/AFM.</p>
      </div>
    </nav>

    <!-- ═══ Main content ════════════════════════════════════════════════════ -->
    <main class="app-main" id="main-content">
      <RouterView />
    </main>

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
            </span>
            <span class="bottom-nav__label">{{ item.label }}</span>
          </component>
        </li>
      </ul>
    </nav>

  </div>
</template>

<style scoped>
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
.sidebar--collapsed .sidebar-footer__text {
  display: none;
}

/* ─── Sidebar footer ──────────────────────────────────────────────────────── */

.sidebar-footer {
  padding: var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-divider);
}

.sidebar-footer__text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* ─── Main content ────────────────────────────────────────────────────────── */

.app-main {
  grid-area: main;
  min-width: 0;
  overflow-y: auto;
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
