<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useUpdateCheck, startBackgroundDownload } from "../composables/useUpdateCheck";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const updating = ref(false);
const updateError = ref("");
const {
  buildTime,
  updateAvailable,
  releaseDate,
  assetUrl,
  updateOnExit,
  checking,
  error: checkError,
  checkForUpdates,
  dismissUpdate,
} = useUpdateCheck();

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      updating.value = false;
      updateError.value = "";
    }
  },
);

function formatBuildTime(bt: string): string {
  if (!bt || bt === "dev") return "Development build";
  try {
    return new Date(bt).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return bt;
  }
}

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

async function openGitHub() {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl("https://github.com/AufarZakiev/Fresco");
  } catch {
    window.open("https://github.com/AufarZakiev/Fresco", "_blank");
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="about-dialog">
        <div class="about-logo">
          <img src="/icon.png" alt="Fresco" width="64" height="64" />
        </div>
        <h3>Fresco</h3>
        <p class="build-time">Built: {{ formatBuildTime(buildTime) }}</p>
        <p class="description">
          A modern alternative to the official BOINC Manager, built with Tauri.
        </p>
        <button class="link-btn" @click="openGitHub">GitHub</button>

        <div class="update-section">
          <button
            v-if="!updateAvailable"
            class="btn"
            :disabled="checking"
            @click="checkForUpdates(true)"
          >
            {{ checking ? "Checking..." : "Check for Updates" }}
          </button>

          <template v-if="updateAvailable">
            <p class="update-available">
              Update available (released {{ formatDate(releaseDate) }})
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
          </template>

          <p v-else-if="buildTime && buildTime !== 'dev' && !checking && !checkError" class="up-to-date">
            You're up to date
          </p>
          <p v-if="checkError" class="update-error">{{ checkError }}</p>
        </div>

        <div class="about-footer">
          <button class="btn" @click="emit('close')">Close</button>
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

.about-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  max-width: 360px;
  width: 90%;
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.about-logo {
  margin-bottom: var(--space-lg);
}

.about-dialog h3 {
  margin: 0 0 4px;
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.build-time {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-lg);
}

.description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.5;
  margin: 0 0 var(--space-md);
}

.link-btn {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 4px;
  margin-bottom: var(--space-lg);
}

.link-btn:hover {
  text-decoration: underline;
}

.update-section {
  margin-bottom: var(--space-xl);
}

.update-available {
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin: 0 0 var(--space-md);
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

.up-to-date {
  color: var(--color-success);
  font-size: var(--font-size-sm);
  margin: var(--space-sm) 0 0;
}

.update-error {
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  margin: 0 0 var(--space-sm);
}

.about-footer {
  display: flex;
  justify-content: center;
}
</style>
