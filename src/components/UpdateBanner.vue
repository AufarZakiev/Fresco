<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import Tooltip from "./Tooltip.vue";
import { useUpdateCheck, startBackgroundDownload } from "../composables/useUpdateCheck";

const { releaseDate, assetUrl, updateOnExit, dismissUpdate } = useUpdateCheck();
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

async function updateNow() {
  if (!assetUrl.value) {
    updateError.value = "No download URL available for your platform";
    return;
  }
  updating.value = true;
  updateError.value = "";
  try {
    // Single command: download + swap + relaunch, all in Rust.
    // On Windows Rust calls process::exit so this never resolves.
    // On other platforms it returns true (caller should relaunch).
    const shouldRelaunch: boolean = await invoke("update_now", {
      assetUrl: assetUrl.value,
    });
    if (shouldRelaunch) {
      const process = await import("@tauri-apps/plugin-process");
      await process.relaunch();
    }
  } catch (e) {
    updateError.value = e instanceof Error ? e.message : String(e);
    updating.value = false;
  }
}

function setUpdateOnExit() {
  updateOnExit.value = true;
  startBackgroundDownload();
  dismissUpdate();
}
</script>

<template>
  <Teleport to="body">
    <div class="update-notification">
      <div class="update-header">
        <span class="update-title">Update available</span>
        <Tooltip text="Dismiss">
          <button class="close-btn" @click="dismissUpdate">&times;</button>
        </Tooltip>
      </div>
      <p class="update-text">
        A newer version of Fresco was released on {{ formatDate(releaseDate) }}
      </p>
      <p v-if="updateError" class="update-error">{{ updateError }}</p>
      <div class="update-actions">
        <button
          class="btn btn-primary"
          :disabled="updating || !assetUrl"
          @click="updateNow"
        >
          {{ updating ? "Updating..." : "Update now" }}
        </button>
        <button class="btn" :disabled="updating" @click="setUpdateOnExit">
          Update on exit
        </button>
        <button class="btn" :disabled="updating" @click="dismissUpdate">
          Remind me later
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.update-notification {
  position: fixed;
  bottom: 40px;
  right: 16px;
  width: 320px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-lg);
  z-index: var(--z-update-banner);
}

.update-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.update-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.update-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0 0 var(--space-md);
}

.update-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  margin: 0 0 var(--space-sm);
}

.update-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.update-actions .btn {
  width: 100%;
  text-align: center;
}
</style>
