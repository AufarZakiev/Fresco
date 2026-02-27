<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { useUpdateCheck, startBackgroundDownload } from "../composables/useUpdateCheck";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

const { t } = useI18n();
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

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

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
  if (!bt || bt === "dev") return t("about.devBuild");
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
    updateError.value = t("about.noDownloadUrl");
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
      <div ref="dialogRef" class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-dialog-title">
        <div class="about-logo">
          <img src="/icon.png" alt="Fresco" width="64" height="64" />
        </div>
        <h3 id="about-dialog-title">{{ $t('about.title') }}</h3>
        <p class="build-time">{{ $t('about.built', { time: formatBuildTime(buildTime) }) }}</p>
        <p class="description">
          {{ $t('about.description') }}
        </p>
        <button class="link-btn" @click="openGitHub">{{ $t('about.github') }}</button>

        <div class="update-section">
          <button
            v-if="!updateAvailable"
            class="btn"
            :disabled="checking"
            @click="checkForUpdates(true)"
          >
            {{ checking ? $t('about.checking') : $t('about.checkForUpdates') }}
          </button>

          <template v-if="updateAvailable">
            <p class="update-available">
              {{ $t('about.updateAvailable', { date: formatDate(releaseDate) }) }}
            </p>
            <p v-if="updateError" class="update-error">{{ updateError }}</p>
            <div class="update-actions">
              <button
                class="btn btn-primary"
                :disabled="updating || !assetUrl"
                @click="updateNow"
              >
                {{ updating ? $t('about.updating') : $t('about.updateNow') }}
              </button>
              <button class="btn" :disabled="updating" @click="setUpdateOnExit">
                {{ $t('about.updateOnExit') }}
              </button>
              <button class="btn" :disabled="updating" @click="dismissUpdate">
                {{ $t('about.remindLater') }}
              </button>
            </div>
          </template>

          <p v-else-if="buildTime && buildTime !== 'dev' && !checking && !checkError" class="up-to-date">
            {{ $t('about.upToDate') }}
          </p>
          <p v-if="checkError" class="update-error">{{ checkError }}</p>
        </div>

        <div class="about-footer">
          <button class="btn" @click="emit('close')">{{ $t('about.close') }}</button>
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
