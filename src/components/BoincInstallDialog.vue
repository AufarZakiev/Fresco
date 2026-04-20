<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import type { BoincInstallOptions } from "../types/boinc";

const props = defineProps<{
  open: boolean;
  options: BoincInstallOptions;
  installing: boolean;
}>();

const emit = defineEmits<{
  install: [];
  skip: [];
  copyCommand: [cmd: string];
  openUrl: [url: string];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
const showMorePMs = ref(false);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      if (!props.open) return;
      activate();
    } else {
      deactivate();
      showMorePMs.value = false;
    }
  },
  // `immediate: true` — the dialog is mounted via `v-if="installOptions"`
  // with `open=true` already set in the same tick, so a plain watcher
  // would never see the false→true transition and the focus trap would
  // never activate on first render.
  { immediate: true },
);

// Escape skips the dialog — the user can still install manually.
onKeyStroke("Escape", () => {
  if (!props.open) return;
  if (props.installing) return;
  emit("skip");
});

const PM_COMMANDS: Record<string, string> = {
  apt: "sudo apt install boinc-client",
  dnf: "sudo dnf install boinc-client",
  pacman: "sudo pacman -S boinc",
};

const hasBrew = computed(() =>
  props.options.platform === "macos"
    && props.options.package_managers.includes("brew"),
);

const linuxPMs = computed(() =>
  props.options.platform === "linux"
    ? props.options.package_managers.filter((pm) => pm in PM_COMMANDS)
    : [],
);

const primaryCommand = computed(() => {
  const pm = linuxPMs.value[0];
  return pm ? PM_COMMANDS[pm] : "";
});

const extraCommands = computed(() =>
  linuxPMs.value.slice(1).map((pm) => PM_COMMANDS[pm]),
);

function handleInstallClick() {
  if (props.installing) return;
  emit("install");
}

function handleCopyPrimary() {
  if (primaryCommand.value) emit("copyCommand", primaryCommand.value);
}

function handleCopyExtra(cmd: string) {
  emit("copyCommand", cmd);
}

function handleDownloadClick() {
  emit("openUrl", props.options.official_download_url);
}

function handleOverlayClick() {
  if (props.installing) return;
  emit("skip");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="handleOverlayClick">
      <div
        ref="dialogRef"
        class="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-install-title"
        aria-describedby="onboarding-install-body"
      >
        <div class="onboarding-header">
          <h3 id="onboarding-install-title">
            {{ $t("onboarding.install.title") }}
          </h3>
        </div>

        <div id="onboarding-install-body" class="onboarding-body">
          <p>{{ $t("onboarding.install.lead") }}</p>

          <!-- macOS + Homebrew -->
          <template v-if="hasBrew">
            <p
              v-if="installing"
              class="install-progress"
              data-testid="brew-progress"
            >
              {{ $t("onboarding.install.brewInProgress") }}
            </p>
          </template>

          <!-- macOS without brew -->
          <template v-else-if="options.platform === 'macos'">
            <p class="explanation">
              {{ $t("onboarding.install.macosNoBrewLead") }}
            </p>
          </template>

          <!-- Linux -->
          <template v-else-if="options.platform === 'linux'">
            <p class="explanation">
              {{ $t("onboarding.install.linuxLead") }}
            </p>
            <div v-if="primaryCommand" class="command-block">
              <pre data-testid="linux-primary-command">{{ primaryCommand }}</pre>
              <button
                class="btn btn-small"
                data-testid="linux-copy-btn"
                @click="handleCopyPrimary"
              >
                {{ $t("onboarding.install.linuxCopyButton") }}
              </button>
            </div>
            <div v-if="extraCommands.length > 0" class="extra-pms">
              <button
                class="btn-link"
                type="button"
                @click="showMorePMs = !showMorePMs"
              >
                {{ showMorePMs ? "▾" : "▸" }}
                {{ $t("onboarding.install.showMore") }}
              </button>
              <div v-if="showMorePMs">
                <div
                  v-for="cmd in extraCommands"
                  :key="cmd"
                  class="command-block"
                >
                  <pre>{{ cmd }}</pre>
                  <button
                    class="btn btn-small"
                    @click="handleCopyExtra(cmd)"
                  >
                    {{ $t("onboarding.install.linuxCopyButton") }}
                  </button>
                </div>
              </div>
            </div>
            <p v-if="!primaryCommand" class="explanation">
              {{ $t("onboarding.install.linuxNoPmFallback") }}
            </p>
          </template>

          <!-- Windows -->
          <template v-else>
            <p class="explanation">
              {{ $t("onboarding.install.windowsLead") }}
            </p>
            <p class="manual-note">
              {{ $t("onboarding.install.windowsManagerNote") }}
            </p>
          </template>
        </div>

        <div class="onboarding-footer">
          <button
            class="btn"
            data-testid="skip-btn"
            :disabled="installing"
            @click="emit('skip')"
          >
            {{ $t("onboarding.install.skip") }}
          </button>

          <button
            v-if="hasBrew"
            class="btn btn-primary"
            data-testid="brew-install-btn"
            :disabled="installing"
            @click="handleInstallClick"
          >
            {{
              installing
                ? $t("onboarding.install.brewInProgress")
                : $t("onboarding.install.brewAction")
            }}
          </button>

          <button
            v-else-if="options.platform === 'macos' || options.platform === 'windows' || (options.platform === 'linux' && !primaryCommand)"
            class="btn btn-primary"
            data-testid="download-btn"
            @click="handleDownloadClick"
          >
            {{ $t("onboarding.install.downloadButton") }}
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
  max-width: 520px;
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

.install-progress {
  color: var(--color-text-secondary);
  font-style: italic;
}

.command-block {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg-secondary, rgba(0, 0, 0, 0.04));
  border-radius: var(--radius-sm);
}

.command-block pre {
  flex: 1;
  margin: 0;
  font-family: var(--font-mono, monospace);
  font-size: var(--font-size-sm);
  white-space: pre-wrap;
  word-break: break-all;
}

.extra-pms {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.btn-link {
  background: transparent;
  border: 0;
  color: var(--color-accent, #0b74de);
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  font-size: var(--font-size-sm);
}

.onboarding-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--color-border);
}
</style>
