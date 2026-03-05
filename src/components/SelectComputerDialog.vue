<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { useConnectionStore } from "../stores/connection";
import { CONNECTION_STATE } from "../types/boinc";
import { getOS, defaultDataDir } from "../composables/usePlatform";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; connected: [] }>();

const { t } = useI18n();
const connection = useConnectionStore();

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

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

const hostname = ref("localhost");
const port = ref(31416);
const password = ref("");
const connecting = ref(false);
const error = ref("");

async function doConnect() {
  connecting.value = true;
  error.value = "";
  await connection.connectToRemote(hostname.value.trim(), port.value, password.value);
  if (connection.state === CONNECTION_STATE.CONNECTED) {
    emit("connected");
    emit("close");
  } else {
    error.value = connection.error ?? t("selectComputer.connectionFailed");
  }
  connecting.value = false;
}

async function doConnectLocal() {
  connecting.value = true;
  error.value = "";
  try {
    const os = await getOS();
    const dataDir = defaultDataDir(os);
    await connection.connectToLocal(dataDir);
    if (connection.state === CONNECTION_STATE.CONNECTED) {
      emit("connected");
      emit("close");
    } else {
      error.value = connection.error ?? t("selectComputer.connectionFailed");
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    connecting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div
        ref="dialogRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-computer-dialog-title"
      >
        <div class="dialog-header">
          <h3 id="select-computer-dialog-title">
            {{ $t("selectComputer.title") }}
          </h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">
            &times;
          </button>
        </div>

        <div class="dialog-body">
          <div v-if="error" class="dialog-error">{{ error }}</div>

          <label class="field">
            <span>{{ $t("selectComputer.hostname") }}</span>
            <input
              v-model="hostname"
              type="text"
              placeholder="localhost"
              :disabled="connecting"
            />
          </label>

          <label class="field">
            <span>{{ $t("selectComputer.port") }}</span>
            <input
              v-model.number="port"
              type="number"
              placeholder="31416"
              :disabled="connecting"
            />
          </label>

          <label class="field">
            <span>{{ $t("selectComputer.password") }}</span>
            <input
              v-model="password"
              type="password"
              :placeholder="$t('selectComputer.passwordPlaceholder')"
              :disabled="connecting"
            />
          </label>

          <div class="dialog-actions">
            <button class="btn" :disabled="connecting" @click="emit('close')">
              {{ $t("selectComputer.cancel") }}
            </button>
            <button
              class="btn btn-primary"
              :disabled="connecting || !hostname.trim()"
              @click="doConnect"
            >
              {{
                connecting
                  ? $t("selectComputer.connecting")
                  : $t("selectComputer.connect")
              }}
            </button>
          </div>

          <div class="divider">
            <span>{{ $t("selectComputer.or") }}</span>
          </div>

          <div class="local-section">
            <p class="local-info">
              {{ $t("selectComputer.localInfo") }}
            </p>
            <button
              class="btn btn-primary local-btn"
              :disabled="connecting"
              @click="doConnectLocal"
            >
              {{
                connecting
                  ? $t("selectComputer.connecting")
                  : $t("selectComputer.connectLocal")
              }}
            </button>
          </div>
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
  width: min(420px, 95vw);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h3 {
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

.dialog-body {
  padding: 16px 20px;
}

.dialog-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
  padding: 8px 12px;
  background: var(--color-danger-light);
  border-radius: var(--radius-sm);
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

.dialog-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-lg);
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

.local-section {
  text-align: center;
}

.local-info {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.local-btn {
  width: 100%;
}
</style>
