<script setup lang="ts">
// @IMP-PF-VIEW-002@ (FROM: @REQ-PF-012@)
defineEmits<{ acknowledge: [] }>()
</script>

<template>
  <div class="extrapolation-ack" role="alert">
    <p class="extrapolation-ack__title">⚠ Extrapolated performance data</p>
    <p class="extrapolation-ack__body">
      The entered conditions are beyond the POH/AFM performance charts. A fixed +20% conservative
      penalty has been applied. This result is <strong>not usable</strong> until you confirm it as
      Pilot-in-Command.
    </p>
    <button
      type="button"
      class="extrapolation-ack__btn"
      @click="$emit('acknowledge')"
    >
      Pilot-in-Command acknowledges extrapolated data
    </button>
  </div>
</template>

<style scoped>
.extrapolation-ack {
  border: 2px solid #f59e0b;
  background: #fffbeb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
}

.extrapolation-ack__title {
  margin: 0 0 0.5rem;
  font-weight: 700;
  color: #92400e;
}

.extrapolation-ack__body {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.extrapolation-ack__btn {
  font-weight: 600;
  color: #fff;
  background: #b45309;
  border: none;
  border-radius: 0.375rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  min-height: 44px;
}

.extrapolation-ack__btn:hover {
  background: #92400e;
}
</style>
