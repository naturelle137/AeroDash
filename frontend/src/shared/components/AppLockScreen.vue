<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'

import { useAppLockStore } from '@/stores/app-lock.store'

const props = defineProps<{
  open: boolean
  erasing: boolean
  eraseError: string | null
}>()

const emit = defineEmits<{
  erase: []
}>()

const lockStore = useAppLockStore()
const localId = useId() ?? 'app-lock'
const titleId = `${localId}-title`

const ERASE_PHRASE = 'DELETE ALL DATA'
const passcode = ref('')
const message = ref<string | null>(null)
const busy = ref(false)
const showForgot = ref(false)
const eraseText = ref('')
const input = ref<HTMLInputElement | null>(null)
const eraseReady = computed(() => eraseText.value.trim() === ERASE_PHRASE)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    passcode.value = ''
    message.value = null
    showForgot.value = false
    eraseText.value = ''
    await nextTick()
    input.value?.focus()
  },
  { immediate: true },
)

async function onUnlock(): Promise<void> {
  if (busy.value) return
  busy.value = true
  message.value = null
  try {
    const result = await lockStore.unlock(passcode.value)
    if (result === 'wrong') message.value = 'Wrong passcode.'
    else if (result === 'unsupported') {
      message.value = 'This browser cannot verify the passcode here. Use the forgotten-passcode option below.'
    }
    passcode.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app-lock__backdrop" data-testid="app-lock-screen">
      <div class="app-lock" role="alertdialog" aria-modal="true" :aria-labelledby="titleId">
        <h2 :id="titleId" class="app-lock__title">AeroDash is locked</h2>

        <p v-if="lockStore.recordCorrupt" class="app-lock__warn" role="alert" data-testid="app-lock-corrupt">
          The saved lock settings are unreadable, so the passcode cannot be checked. Only
          deleting all local data on this device removes the lock.
        </p>

        <form v-else class="app-lock__form" @submit.prevent="onUnlock">
          <label class="app-lock__field">
            <span>Passcode</span>
            <input
              ref="input"
              v-model="passcode"
              type="password"
              autocomplete="off"
              data-testid="app-lock-input"
            />
          </label>
          <p v-if="message" class="app-lock__warn" role="alert" data-testid="app-lock-error">
            {{ message }}
          </p>
          <button type="submit" class="app-lock__btn" :disabled="busy || passcode === ''" data-testid="app-lock-unlock">
            Unlock
          </button>
        </form>

        <p class="app-lock__note">
          This lock only hides the app. It does not encrypt the data stored in this browser.
        </p>

        <div class="app-lock__forgot">
          <button
            type="button"
            class="app-lock__link"
            :aria-expanded="showForgot"
            data-testid="app-lock-forgot"
            @click="showForgot = !showForgot"
          >
            Forgot the passcode?
          </button>
          <div v-if="showForgot" data-testid="app-lock-forgot-panel">
            <p>
              A forgotten passcode cannot be recovered and there is no account or backup copy of
              it. Fleet profiles and saved preparation cannot be exported while locked. Deleting
              all local data removes the lock and every aircraft profile on this device;
              downloaded backups are not affected.
            </p>
            <label class="app-lock__field">
              <span>Type <code>{{ ERASE_PHRASE }}</code> to confirm</span>
              <input v-model="eraseText" type="text" autocomplete="off" spellcheck="false" data-testid="app-lock-erase-input" />
            </label>
            <p v-if="eraseError" class="app-lock__warn" role="alert" data-testid="app-lock-erase-error">
              {{ eraseError }}
            </p>
            <button
              type="button"
              class="app-lock__btn app-lock__btn--danger"
              :disabled="erasing || !eraseReady"
              data-testid="app-lock-erase"
              @click="emit('erase')"
            >
              Delete all local data
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-lock__backdrop {
  position: fixed;
  inset: 0;
  z-index: 520;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.92);
  overflow-y: auto;
}
.app-lock {
  width: 100%;
  max-width: 28rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: var(--space-6, 1.5rem);
  border-radius: var(--radius-xl, 12px);
  background: var(--color-surface-card, var(--color-surface, #fff));
  color: var(--color-text-primary, #212121);
  border: 2px solid var(--color-border, #6b7280);
}
.app-lock__title {
  margin: 0 0 1rem;
  font-size: var(--text-xl, 1.25rem);
  text-align: center;
}
.app-lock__form,
.app-lock__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.app-lock__field input {
  min-height: 44px;
  padding: 0.5rem;
  font-size: 1rem;
}
.app-lock__btn {
  min-height: 44px;
  padding: 0.5rem 1rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid var(--color-primary, #1d4ed8);
  background: var(--color-primary, #1d4ed8);
  color: var(--color-primary-text, #fff);
}
.app-lock__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.app-lock__btn--danger {
  border-color: var(--color-danger, #b91c1c);
  background: var(--color-danger, #b91c1c);
}
.app-lock__warn {
  margin: 0.5rem 0;
  font-weight: 600;
  color: var(--color-danger, #b91c1c);
}
.app-lock__note,
.app-lock__forgot p {
  font-size: var(--text-sm, 0.9rem);
  line-height: 1.5;
}
.app-lock__forgot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.app-lock__link {
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
  background: none;
  border: none;
  text-decoration: underline;
  color: inherit;
  cursor: pointer;
}
</style>
