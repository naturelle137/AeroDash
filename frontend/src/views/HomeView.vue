<script setup lang="ts">
// @IMP-UI-VIEW-001@ (FROM: @REQ-UI-011@, @REQ-SYS-001@)
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppLogo from '@/shared/components/AppLogo.vue'

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

interface Module {
  id: string
  label: string
  description: string
  path: string
  soon: boolean
  icon: string
  active?: boolean
}

const modules: Module[] = [
  {
    id: 'mass-balance',
    label: 'Mass & Balance',
    description: 'Load stations, CG envelope, migration check',
    path: '/mass-balance',
    soon: false,
    active: true,
    icon: 'mb',
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'TOLD: Takeoff, landing distances with corrections',
    path: '/performance',
    soon: true,
    icon: 'pf',
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'METAR, TAF, surface conditions, wind limits',
    path: '/weather',
    soon: true,
    icon: 'wx',
  },
  {
    id: 'fuel',
    label: 'Fuel & Endurance',
    description: 'Fuel planning, density correction, reserves',
    path: '/fuel',
    soon: true,
    icon: 'fe',
  },
  {
    id: 'fleet',
    label: 'Fleet Management',
    description: 'Aircraft profiles, club fleet, organisation sync',
    path: '/fleet',
    soon: true,
    icon: 'fleet',
  },
  {
    id: 'airport',
    label: 'Airport Database',
    description: 'Runway data, AIP entries, local overrides',
    path: '/airport',
    soon: true,
    icon: 'ap',
  },
]

const activeModules = modules.filter((m) => !m.soon)
const soonModules = modules.filter((m) => m.soon)
</script>

<template>
  <div class="home-view">

    <!-- ─── Hero ─────────────────────────────────────────────────────────── -->
    <section class="hero" aria-labelledby="hero-heading">
      <div class="hero__inner">
        <div class="hero__logo-wrap" aria-hidden="true">
          <AppLogo :icon-only="true" :size="56" />
        </div>
        <div class="hero__copy">
          <p class="hero__greeting">{{ greeting }}, Pilot</p>
          <h1 id="hero-heading" class="hero__headline">Ready for departure?</h1>
          <p class="hero__sub">
            Flight-grade precision for every command decision.
          </p>
        </div>
      </div>

      <!-- Primary CTA: start flight prep -->
      <RouterLink to="/mass-balance" class="cta-btn" aria-label="Start flight preparation">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M17 4.5L3 9.5l5 2 2 5 5-14z" stroke="currentColor" stroke-width="1.5"
            stroke-linejoin="round" stroke-linecap="round" />
          <path d="M8.5 11.5L12 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        Start Flight Preparation
      </RouterLink>

      <p class="hero__disclaimer" role="note">
        Advisory only — verify all results against the official POH/AFM before flight.
      </p>
    </section>

    <!-- ─── Active modules ────────────────────────────────────────────────── -->
    <section class="modules-section" aria-labelledby="active-heading">
      <h2 id="active-heading" class="section-title">Flight Preparation</h2>
      <div class="modules-grid">
        <RouterLink
          v-for="mod in activeModules"
          :key="mod.id"
          :to="mod.path"
          class="module-card module-card--active"
          :aria-label="`Open ${mod.label}`"
        >
          <div class="module-card__icon" aria-hidden="true">
            <!-- M&B icon -->
            <svg v-if="mod.icon === 'mb'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.5" />
              <path d="M3 10h18" stroke="currentColor" stroke-width="1.5" />
              <path d="M8 14h2M14 14h2M8 17h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5" />
              <path d="M12 6v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </div>
          <div class="module-card__body">
            <h3 class="module-card__title">{{ mod.label }}</h3>
            <p class="module-card__desc">{{ mod.description }}</p>
          </div>
          <div class="module-card__arrow" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- ─── Coming soon modules ────────────────────────────────────────────── -->
    <section class="modules-section" aria-labelledby="soon-heading">
      <h2 id="soon-heading" class="section-title">
        Coming Soon
        <span class="section-title__sub">More modules in active development</span>
      </h2>
      <div class="modules-grid modules-grid--soon">
        <div
          v-for="mod in soonModules"
          :key="mod.id"
          class="module-card module-card--soon"
          :aria-label="`${mod.label} — coming soon`"
        >
          <div class="module-card__icon" aria-hidden="true">
            <!-- Performance -->
            <svg v-if="mod.icon === 'pf'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l4-6 4 3 4-8 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3 21h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <!-- Weather -->
            <svg v-else-if="mod.icon === 'wx'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M18 15a5 5 0 10-9.5-.5A4 4 0 107 20h11a4 4 0 000-8h-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <!-- Fuel -->
            <svg v-else-if="mod.icon === 'fe'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="3" width="11" height="17" rx="2" stroke="currentColor" stroke-width="1.5" />
              <path d="M15 8h3a1 1 0 011 1v6a1 1 0 01-1 1h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M8 8h4M8 12h4M8 16h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <!-- Fleet -->
            <svg v-else-if="mod.icon === 'fleet'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 7.5L10 12l5 3 2 6 4-13.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
              <path d="M10 12L3 9l3 3-3 3 7-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
            <!-- Airport -->
            <svg v-else-if="mod.icon === 'ap'" width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
              <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <ellipse cx="12" cy="12" rx="5" ry="9" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </div>
          <div class="module-card__body">
            <h3 class="module-card__title">{{ mod.label }}</h3>
            <p class="module-card__desc">{{ mod.description }}</p>
          </div>
          <span class="soon-pill">Soon</span>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-6);
  max-width: 900px;
  margin: 0 auto;
  min-height: calc(100vh - var(--nav-header-height));
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-10) var(--space-8);
  background: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}

/* Subtle teal accent in top-left corner */
.hero::before {
  content: '';
  position: absolute;
  top: -60px;
  left: -60px;
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, var(--color-primary-bg) 0%, transparent 70%);
  pointer-events: none;
}

.hero__inner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-5);
}

.hero__logo-wrap {
  flex-shrink: 0;
  color: var(--color-primary);
  filter: drop-shadow(var(--glow-primary));
}

.hero__copy {
  flex: 1;
}

.hero__greeting {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-1);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hero__headline {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.hero__sub {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
  font-style: italic;
}

/* ─── CTA button ─────────────────────────────────────────────────────────── */

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-primary);
  color: var(--color-primary-text);
  font-weight: 600;
  font-size: var(--text-base);
  border-radius: var(--radius-lg);
  text-decoration: none;
  box-shadow: var(--shadow-md), var(--glow-primary);
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
  align-self: flex-start;
  min-height: 44px;
}

.cta-btn:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg), var(--glow-primary);
}

.cta-btn:active {
  transform: translateY(0);
}

.cta-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.hero__disclaimer {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  opacity: 0.85;
}

/* ─── Section titles ──────────────────────────────────────────────────────── */

.section-title {
  font-size: var(--text-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-4);
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.section-title__sub {
  font-size: var(--text-xs);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

/* ─── Module cards ────────────────────────────────────────────────────────── */

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.module-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  color: inherit;
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
  min-height: 80px;
}

.module-card--active {
  cursor: pointer;
}

.module-card--active:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md), var(--glow-primary);
  transform: translateY(-2px);
}

.module-card--active:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.module-card--soon {
  opacity: 0.55;
  cursor: default;
}

.modules-grid--soon .module-card {
  border-style: dashed;
}

.module-card__icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: var(--radius-lg);
}

.module-card__body {
  flex: 1;
  min-width: 0;
}

.module-card__title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 2px;
}

.module-card__desc {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.module-card__arrow {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  opacity: 0.5;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.module-card--active:hover .module-card__arrow {
  opacity: 1;
  color: var(--color-primary);
  transform: translateX(2px);
}

.soon-pill {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2em 0.5em;
  background: var(--color-tag-soon-bg);
  color: var(--color-tag-soon-text);
  border-radius: var(--radius-full);
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */

@media (max-width: 767.98px) {
  .home-view {
    padding: var(--space-4);
    gap: var(--space-6);
  }

  .hero {
    padding: var(--space-6) var(--space-4);
  }

  .hero__inner {
    flex-direction: column;
    gap: var(--space-3);
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }
}
</style>
