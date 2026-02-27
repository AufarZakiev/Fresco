<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("cancel");
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('cancel')">
      <div ref="dialogRef" class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h3 id="confirm-dialog-title">{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="dialog-actions">
          <button class="btn" @click="emit('cancel')">{{ $t('confirm.cancel') }}</button>
          <button class="btn btn-danger-fill" @click="emit('confirm')">
            {{ confirmLabel ?? $t('confirm.confirm') }}
          </button>
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

.dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-lg);
}

.dialog h3 {
  margin: 0 0 8px 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.dialog p {
  margin: 0 0 20px 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

.btn-danger-fill {
  background: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
}

.btn-danger-fill:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}
</style>
