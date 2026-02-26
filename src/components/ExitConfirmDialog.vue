<script setup lang="ts">
import { ref } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useManagerSettingsStore } from "../stores/managerSettings";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  confirm: [shutdownClient: boolean];
}>();

const store = useManagerSettingsStore();

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});
const shutdownClient = ref(false);
const dontAskAgain = ref(false);

function confirm() {
  if (dontAskAgain.value) {
    store.settings.showExitConfirmation = false;
  }
  emit("confirm", shutdownClient.value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-dialog-title">
        <h3 id="exit-confirm-dialog-title">{{ $t('exitConfirm.title') }}</h3>
        <p class="exit-message">
          {{ $t('exitConfirm.message') }}
        </p>

        <div class="exit-options">
          <label class="exit-toggle">
            <input type="checkbox" v-model="shutdownClient" />
            <span>{{ $t('exitConfirm.shutdownClient') }}</span>
          </label>
          <label class="exit-toggle">
            <input type="checkbox" v-model="dontAskAgain" />
            <span>{{ $t('exitConfirm.dontAskAgain') }}</span>
          </label>
        </div>

        <div class="exit-footer">
          <button class="btn" @click="emit('close')">{{ $t('exitConfirm.cancel') }}</button>
          <button class="btn btn-primary" @click="confirm">{{ $t('exitConfirm.exit') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.exit-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-lg);
}

.exit-dialog h3 {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.exit-message {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.5;
  margin: 0 0 var(--space-lg);
}

.exit-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.exit-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-md);
  cursor: pointer;
  color: var(--color-text-primary);
}

.exit-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.exit-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
