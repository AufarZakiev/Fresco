<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useUpdateCheck } from "../composables/useUpdateCheck";

const { releaseDate, assetUrl, dismissUpdate } = useUpdateCheck();
const updating = ref(false);
const updateError = ref("");

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

async function applyUpdate() {
  if (!assetUrl.value) {
    updateError.value = "No download URL available for your platform";
    return;
  }
  updating.value = true;
  updateError.value = "";
  try {
    await invoke("download_update", { assetUrl: assetUrl.value });
    // Relaunch
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    updateError.value = e instanceof Error ? e.message : String(e);
    updating.value = false;
  }
}
</script>

<template>
  <div class="update-banner">
    <span class="update-text">
      A newer version of Fresco is available (released {{ formatDate(releaseDate) }})
    </span>
    <button
      v-if="assetUrl"
      class="update-btn"
      :disabled="updating"
      @click="applyUpdate"
    >
      {{ updating ? "Updating..." : "Update & Restart" }}
    </button>
    <button class="dismiss-btn" title="Dismiss" @click="dismissUpdate">&times;</button>
    <span v-if="updateError" class="update-error">{{ updateError }}</span>
  </div>
</template>

<style scoped>
.update-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-lg);
  background: var(--color-accent-light);
  border-bottom: 1px solid var(--color-accent);
  font-size: var(--font-size-sm);
  color: var(--color-accent-hover);
  flex-wrap: wrap;
}

.update-text {
  flex: 1;
  min-width: 0;
}

.update-btn {
  padding: 3px 12px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: white;
  font-size: var(--font-size-sm);
  cursor: pointer;
  white-space: nowrap;
}

.update-btn:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dismiss-btn {
  background: none;
  border: none;
  color: var(--color-accent-hover);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.dismiss-btn:hover {
  opacity: 0.7;
}

.update-error {
  width: 100%;
  color: var(--color-danger);
  font-size: var(--font-size-xs);
}
</style>
