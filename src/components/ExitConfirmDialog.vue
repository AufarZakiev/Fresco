<script setup lang="ts">
import { ref } from "vue";
import { useManagerSettingsStore } from "../stores/managerSettings";
import { useUpdateCheck } from "../composables/useUpdateCheck";

const props = defineProps<{ open: boolean; updateAvailable?: boolean }>();
const emit = defineEmits<{
  close: [];
  confirm: [shutdownClient: boolean, applyUpdate: boolean];
}>();

const { releaseDate } = useUpdateCheck();
const store = useManagerSettingsStore();
const shutdownClient = ref(false);
const applyUpdate = ref(false);
const dontAskAgain = ref(false);

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function confirm() {
  if (dontAskAgain.value) {
    store.settings.showExitConfirmation = false;
  }
  emit("confirm", shutdownClient.value, applyUpdate.value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="exit-dialog">
        <h3>Exit BOINC Manager</h3>
        <p class="exit-message">
          Are you sure you want to exit? BOINC will continue running in the background.
        </p>

        <p v-if="props.updateAvailable" class="update-notice">
          A newer version is available (released {{ formatDate(releaseDate) }})
        </p>

        <div class="exit-options">
          <label class="exit-toggle">
            <input type="checkbox" v-model="shutdownClient" />
            <span>Also shut down the BOINC client</span>
          </label>
          <label v-if="props.updateAvailable" class="exit-toggle">
            <input type="checkbox" v-model="applyUpdate" />
            <span>Apply update before exiting</span>
          </label>
          <label class="exit-toggle">
            <input type="checkbox" v-model="dontAskAgain" />
            <span>Don't ask again</span>
          </label>
        </div>

        <div class="exit-footer">
          <button class="btn" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="confirm">
            {{ applyUpdate ? "Update & Exit" : "Exit" }}
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
  z-index: 1000;
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

.update-notice {
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin: 0 0 var(--space-md);
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
