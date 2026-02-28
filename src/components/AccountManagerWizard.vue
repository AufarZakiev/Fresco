<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { acctMgrInfo, acctMgrRpc, acctMgrRpcPoll } from "../composables/useRpc";
import type { AcctMgrInfo } from "../types/boinc";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import {
  BOINC_ERROR_IN_PROGRESS,
  MAX_ATTACH_POLL_ATTEMPTS,
  ATTACH_POLL_DELAY_MS,
} from "../constants/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

const { t } = useI18n();
const step = ref<"form" | "processing" | "result">("form");
const loading = ref(false);
const error = ref("");
const resultMessage = ref("");

// Current account manager state
const currentMgr = ref<AcctMgrInfo | null>(null);

// Form fields
const mgrUrl = ref("");
const userName = ref("");
const password = ref("");

onKeyStroke("Escape", () => {
  if (!props.open) return;
  close();
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      reset();
      await loadCurrentInfo();
    }
  },
);

async function loadCurrentInfo() {
  loading.value = true;
  try {
    currentMgr.value = await acctMgrInfo();
  } catch {
    currentMgr.value = null;
  } finally {
    loading.value = false;
  }
}

async function doAttach() {
  if (!mgrUrl.value.trim()) {
    error.value = t("accountManager.enterUrl");
    return;
  }

  step.value = "processing";
  error.value = "";

  try {
    await acctMgrRpc(mgrUrl.value, userName.value, password.value);

    // Poll for result
    let attempts = 0;
    let reply;
    while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
      reply = await acctMgrRpcPoll();
      if (reply.error_num !== BOINC_ERROR_IN_PROGRESS) break;
      attempts++;
    }

    if (reply && reply.error_num === 0) {
      resultMessage.value = t("accountManager.successAttach");
      step.value = "result";
    } else {
      error.value =
        reply?.messages?.join(", ") || t("accountManager.failAttach");
      step.value = "form";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    step.value = "form";
  }
}

async function doDetach() {
  step.value = "processing";
  error.value = "";

  try {
    await acctMgrRpc("", "", "");

    // Poll for result
    let attempts = 0;
    let reply;
    while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
      reply = await acctMgrRpcPoll();
      if (reply.error_num !== BOINC_ERROR_IN_PROGRESS) break;
      attempts++;
    }

    if (reply && reply.error_num === 0) {
      resultMessage.value = t("accountManager.successDetach");
      currentMgr.value = null;
      step.value = "result";
    } else {
      error.value =
        reply?.messages?.join(", ") || t("accountManager.failDetach");
      step.value = "form";
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    step.value = "form";
  }
}

function reset() {
  step.value = "form";
  error.value = "";
  resultMessage.value = "";
  mgrUrl.value = "";
  userName.value = "";
  password.value = "";
  currentMgr.value = null;
}

function close() {
  reset();
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="close">
      <div ref="dialogRef" class="wizard" role="dialog" aria-modal="true" aria-labelledby="account-manager-wizard-title">
        <div class="wizard-header">
          <h3 id="account-manager-wizard-title">
            {{
              step === "form"
                ? $t('accountManager.title')
                : step === "processing"
                  ? $t('accountManager.processing')
                  : $t('accountManager.done')
            }}
          </h3>
          <button class="close-btn" aria-label="Close" @click="close">&times;</button>
        </div>

        <!-- Step 1: Form -->
        <div v-if="step === 'form'" class="wizard-body">
          <!-- Current manager info -->
          <div v-if="currentMgr?.have_credentials" class="current-mgr">
            <div class="current-mgr-label">{{ $t('accountManager.currentlyAttached') }}</div>
            <div class="current-mgr-name">{{ currentMgr.acct_mgr_name }}</div>
            <div class="current-mgr-url">{{ currentMgr.acct_mgr_url }}</div>
            <button class="btn btn-danger-outline detach-btn" @click="doDetach">
              {{ $t('accountManager.detach') }}
            </button>
          </div>

          <div v-if="currentMgr?.have_credentials" class="divider">
            <span>{{ $t('accountManager.orAttachDifferent') }}</span>
          </div>

          <div v-if="error" class="wizard-error">{{ error }}</div>

          <label class="field">
            <span>{{ $t('accountManager.managerUrl') }}</span>
            <input
              v-model="mgrUrl"
              type="text"
              placeholder="https://..."
            />
          </label>

          <label class="field">
            <span>{{ $t('accountManager.userName') }}</span>
            <input
              v-model="userName"
              type="text"
              :placeholder="$t('accountManager.userNamePlaceholder')"
            />
          </label>

          <label class="field">
            <span>{{ $t('accountManager.password') }}</span>
            <input
              v-model="password"
              type="password"
              :placeholder="$t('accountManager.passwordPlaceholder')"
            />
          </label>

          <div class="wizard-actions">
            <button class="btn" @click="close">{{ $t('accountManager.cancel') }}</button>
            <button
              class="btn btn-primary"
              :disabled="!mgrUrl.trim()"
              @click="doAttach"
            >
              {{ $t('accountManager.attach') }}
            </button>
          </div>
        </div>

        <!-- Step 2: Processing -->
        <div v-if="step === 'processing'" class="wizard-body wizard-center">
          <div class="spinner"></div>
          <p>{{ $t('accountManager.communicating') }}</p>
        </div>

        <!-- Step 3: Result -->
        <div v-if="step === 'result'" class="wizard-body wizard-center">
          <div class="success-icon">&#10003;</div>
          <p>{{ resultMessage }}</p>
          <button class="btn btn-primary" @click="close">{{ $t('accountManager.done') }}</button>
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

.wizard {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.wizard-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.wizard-body {
  padding: 16px 20px;
  flex: 1;
  overflow-y: auto;
}

.wizard-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: var(--space-lg);
}

.wizard-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
  padding: 8px 12px;
  background: var(--color-danger-light);
  border-radius: var(--radius-sm);
}

.current-mgr {
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.current-mgr-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
}

.current-mgr-name {
  font-weight: 600;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.current-mgr-url {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.detach-btn {
  margin-top: var(--space-sm);
}

.btn-danger-outline {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: transparent;
}

.btn-danger-outline:hover {
  background: var(--color-danger-light);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin: var(--space-lg) 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.field input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.wizard-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-lg);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-success-light);
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}
</style>
