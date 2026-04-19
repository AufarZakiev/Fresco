<script setup lang="ts">
import { nextTick, ref, watch, computed } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import type { ManagerAutostartInfo } from "../types/boinc";

const props = defineProps<{
  open: boolean;
  info: ManagerAutostartInfo | null;
}>();

const emit = defineEmits<{
  takeover: [];
  keepBoth: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (!props.open) return;
      activate();
    } else {
      deactivate();
    }
  },
);

// Escape is intentionally treated as "Keep both" — a takeover shouldn't be
// triggered by an accidental key press, and the prompt must resolve so
// autoConnect can move on.
onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("keepBoth");
});

const autostartKind = computed(() => props.info?.kind ?? null);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('keepBoth')">
      <div
        ref="dialogRef"
        class="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-takeover-title"
        aria-describedby="onboarding-takeover-body"
      >
        <div class="onboarding-header">
          <h3 id="onboarding-takeover-title">
            {{ $t("onboarding.takeover.title") }}
          </h3>
        </div>

        <div id="onboarding-takeover-body" class="onboarding-body">
          <p>{{ $t("onboarding.takeover.lead") }}</p>
          <p class="explanation">
            {{ $t("onboarding.takeover.explanation") }}
          </p>
          <p
            v-if="autostartKind === 'MacLoginItem'"
            class="manual-note"
            data-testid="manual-note"
          >
            {{ $t("onboarding.takeover.macLoginItemNote") }}
          </p>
        </div>

        <div class="onboarding-footer">
          <button
            class="btn"
            data-testid="keep-both-btn"
            @click="emit('keepBoth')"
          >
            {{ $t("onboarding.takeover.keepBoth") }}
          </button>
          <button
            class="btn btn-primary"
            data-testid="takeover-btn"
            @click="emit('takeover')"
          >
            {{ $t("onboarding.takeover.useFrescoOnly") }}
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

.onboarding-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 90%;
  box-shadow: var(--shadow-lg);
}

.onboarding-header {
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.onboarding-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.onboarding-body {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  line-height: 1.5;
}

.onboarding-body p {
  margin: 0;
}

.explanation {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.manual-note {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: var(--space-sm);
  background: var(--color-bg-secondary, rgba(0, 0, 0, 0.04));
  border-radius: var(--radius-sm);
}

.onboarding-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--color-border);
}
</style>
