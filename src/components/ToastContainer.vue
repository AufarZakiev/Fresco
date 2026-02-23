<script setup lang="ts">
import { useToastStore } from "../stores/toast";

const toast = useToastStore();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          :class="['toast', `toast-${t.type}`]"
          @click="toast.dismiss(t.id)"
        >
          <span class="toast-icon">
            <template v-if="t.type === 'success'">&#x2713;</template>
            <template v-else-if="t.type === 'error'">&#x2717;</template>
            <template v-else>&#x2139;</template>
          </span>
          <span class="toast-message">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 40px;
  right: 16px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  min-width: 250px;
  max-width: 400px;
}

.toast-success {
  background: #065f46;
  color: #d1fae5;
}

.toast-error {
  background: #991b1b;
  color: #fee2e2;
}

.toast-info {
  background: var(--color-text-primary);
  color: var(--color-bg);
}

.toast-icon {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
}

.toast-message {
  flex: 1;
}

/* Transition animations */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
