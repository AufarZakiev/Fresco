<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useUpdateCheck } from "../composables/useUpdateCheck";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const version = ref("0.1.0");
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
  async (isOpen) => {
    if (isOpen) {
      updating.value = false;
      updateError.value = "";
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        version.value = await getVersion();
      } catch {
        // Not in Tauri environment
      }
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
    await invoke("download_update", { assetUrl: assetUrl.value });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    updateError.value = e instanceof Error ? e.message : String(e);
    updating.value = false;
  }
}

function setUpdateOnExit() {
  updateOnExit.value = true;
  dismissUpdate();
}

async function openWebsite() {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl("https://boinc.berkeley.edu");
  } catch {
    window.open("https://boinc.berkeley.edu", "_blank");
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="about-dialog">
        <div class="about-logo">
          <svg viewBox="0 0 48 48" width="64" height="64" fill="none">
            <circle cx="24" cy="24" r="22" fill="var(--color-accent)" opacity="0.1" />
            <circle cx="24" cy="24" r="16" fill="var(--color-accent)" opacity="0.2" />
            <circle cx="24" cy="24" r="10" fill="var(--color-accent)" />
            <text
              x="24"
              y="28"
              text-anchor="middle"
              fill="white"
              font-size="12"
              font-weight="700"
              font-family="system-ui"
            >
              B
            </text>
          </svg>
        </div>
        <h3>Fresco</h3>
        <p class="version">Version {{ version }}</p>
        <p class="build-time">Built: {{ formatBuildTime(buildTime) }}</p>
        <p class="description">
          Berkeley Open Infrastructure for Network Computing.
          Use your computer to help solve scientific problems.
        </p>
        <button class="link-btn" @click="openWebsite">boinc.berkeley.edu</button>

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

.version {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0 0 2px;
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
