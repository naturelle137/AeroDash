<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useTheme } from '@/shared/composables/useTheme'

const { theme, toggleTheme } = useTheme()
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__brand">
        <svg
          class="app-header__logo"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="14" cy="14" r="13" stroke="currentColor" stroke-width="2" fill="none" />
          <path
            d="M14 4 L14 24 M7 10 L14 4 L21 10 M7 18 L21 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="app-header__title">AeroDash</span>
      </div>

      <button
        class="theme-toggle"
        :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <svg
          v-if="theme === 'light'"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zm4.22 1.78a1 1 0 011.41 0l.71.71a1 1 0 01-1.41 1.41l-.71-.71a1 1 0 010-1.41zM18 9a1 1 0 010 2h-1a1 1 0 010-2h1zm-1.78 4.22a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 0zM10 16a1 1 0 011 1v1a1 1 0 01-2 0v-1a1 1 0 011-1zm-4.22-1.78a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 0zM4 9a1 1 0 010 2H3a1 1 0 010-2h1zm1.78-4.22a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41-1.41l.71-.71a1 1 0 011.41 0zM10 6a4 4 0 100 8 4 4 0 000-8z"
            fill="currentColor"
          />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M17.293 13.293A8 8 0 016.707 2.707a8.003 8.003 0 1010.586 10.586z"
            fill="currentColor"
          />
        </svg>
      </button>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: 100;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-primary);
}

.app-header__title {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.app-main {
  flex: 1;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-surface-alt);
  color: var(--color-text);
  cursor: pointer;
  transition: background-color 0.15s ease-out, border-color 0.15s ease-out;
}

.theme-toggle:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
</style>
