<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { getProxySettings, setProxySettings } from "../composables/useRpc";
import type { ProxyInfo } from "../types/boinc";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

type ProxyMode = "none" | "http" | "socks";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef, {
  allowOutsideClick: true,
});
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

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const form = ref<ProxyInfo | null>(null);

const proxyMode = computed<ProxyMode>({
  get() {
    if (!form.value) return "none";
    if (form.value.use_http_proxy) return "http";
    if (form.value.use_socks_proxy) return "socks";
    return "none";
  },
  set(mode: ProxyMode) {
    if (!form.value) return;
    form.value.use_http_proxy = mode === "http";
    form.value.use_socks_proxy = mode === "socks";
  },
});

// ── No-proxy hosts as a list ──────────────────────────────────────
const noProxyList = computed<string[]>(() => {
  if (!form.value || !form.value.noproxy_hosts) return [];
  return form.value.noproxy_hosts
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
});

function syncListToForm(list: string[]) {
  if (!form.value) return;
  form.value.noproxy_hosts = list.join(",");
}

const newHost = ref("");
const newHostInput = ref<HTMLInputElement | null>(null);

function addHost() {
  const host = newHost.value.trim();
  if (!host || noProxyList.value.includes(host)) {
    newHost.value = "";
    return;
  }
  syncListToForm([...noProxyList.value, host]);
  newHost.value = "";
  nextTick(() => newHostInput.value?.focus());
}

function removeHost(index: number) {
  const list = [...noProxyList.value];
  list.splice(index, 1);
  syncListToForm(list);
}

// ── Lifecycle ─────────────────────────────────────────────────────
onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      loading.value = true;
      error.value = "";
      newHost.value = "";
      try {
        const proxy = await getProxySettings();
        form.value = { ...proxy };
      } catch (e) {
        error.value = String(e);
      } finally {
        loading.value = false;
      }
    }
  },
);

async function save() {
  if (!form.value) return;
  saving.value = true;
  error.value = "";
  try {
    await setProxySettings(form.value);
    emit("close");
  } catch (e) {
    error.value = String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div
        ref="dialogRef"
        class="proxy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proxy-settings-dialog-title"
      >
        <div class="proxy-header">
          <h3 id="proxy-settings-dialog-title">{{ $t("proxy.title") }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">
            &times;
          </button>
        </div>

        <div v-if="loading" class="proxy-loading">
          {{ $t("proxy.loading") }}
        </div>

        <template v-else-if="form">
          <!-- Segmented control -->
          <div class="segmented-control-wrapper">
            <div class="segmented-control" role="radiogroup">
              <button
                v-for="mode in (['none', 'http', 'socks'] as const)"
                :key="mode"
                role="radio"
                :aria-checked="proxyMode === mode"
                class="segment"
                :class="{ active: proxyMode === mode }"
                @click="proxyMode = mode"
              >
                {{
                  mode === "none"
                    ? $t("proxy.none")
                    : mode === "http"
                      ? $t("proxy.httpProxy")
                      : $t("proxy.socksProxy")
                }}
              </button>
            </div>
          </div>

          <div class="proxy-body">
            <!-- HTTP Proxy fields -->
            <div v-if="proxyMode === 'http'" class="proxy-section">
              <label class="pref-row">
                <span>{{ $t("proxy.serverName") }}</span>
                <input v-model="form.http_server_name" type="text" />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.port") }}</span>
                <input
                  v-model.number="form.http_server_port"
                  type="number"
                  min="0"
                  max="65535"
                />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.useHttpAuth") }}</span>
                <span
                  class="toggle-switch"
                  :class="{ on: form.use_http_auth }"
                  role="switch"
                  :aria-checked="!!form.use_http_auth"
                  tabindex="0"
                  @click.prevent="form.use_http_auth = !form.use_http_auth"
                  @keydown.enter.prevent="
                    form.use_http_auth = !form.use_http_auth
                  "
                  @keydown.space.prevent="
                    form.use_http_auth = !form.use_http_auth
                  "
                >
                  <span class="toggle-knob" />
                </span>
              </label>
              <template v-if="form.use_http_auth">
                <label class="pref-row">
                  <span>{{ $t("proxy.username") }}</span>
                  <input v-model="form.http_user_name" type="text" />
                </label>
                <label class="pref-row">
                  <span>{{ $t("proxy.password") }}</span>
                  <input v-model="form.http_user_passwd" type="password" />
                </label>
              </template>
            </div>

            <!-- SOCKS5 Proxy fields -->
            <div v-if="proxyMode === 'socks'" class="proxy-section">
              <label class="pref-row">
                <span>{{ $t("proxy.serverName") }}</span>
                <input v-model="form.socks_server_name" type="text" />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.port") }}</span>
                <input
                  v-model.number="form.socks_server_port"
                  type="number"
                  min="0"
                  max="65535"
                />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.username") }}</span>
                <input v-model="form.socks5_user_name" type="text" />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.password") }}</span>
                <input v-model="form.socks5_user_passwd" type="password" />
              </label>
              <label class="pref-row">
                <span>{{ $t("proxy.useSocks5Dns") }}</span>
                <span
                  class="toggle-switch"
                  :class="{ on: form.socks5_remote_dns }"
                  role="switch"
                  :aria-checked="!!form.socks5_remote_dns"
                  tabindex="0"
                  @click.prevent="
                    form.socks5_remote_dns = !form.socks5_remote_dns
                  "
                  @keydown.enter.prevent="
                    form.socks5_remote_dns = !form.socks5_remote_dns
                  "
                  @keydown.space.prevent="
                    form.socks5_remote_dns = !form.socks5_remote_dns
                  "
                >
                  <span class="toggle-knob" />
                </span>
              </label>
            </div>

            <!-- No-proxy message when "None" selected -->
            <div v-if="proxyMode === 'none'" class="proxy-none-message">
              {{ $t("proxy.noProxyMessage") }}
            </div>

            <!-- No-proxy hosts list -->
            <div
              v-if="proxyMode !== 'none'"
              class="proxy-section noproxy-section"
            >
              <span class="noproxy-label">{{ $t("proxy.noProxyHosts") }}</span>
              <div class="noproxy-list">
                <div
                  v-for="(host, index) in noProxyList"
                  :key="host"
                  class="noproxy-item"
                >
                  <span class="noproxy-host">{{ host }}</span>
                  <button
                    class="noproxy-remove"
                    :aria-label="$t('proxy.removeHost')"
                    @click="removeHost(index)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
                <div class="noproxy-add-row">
                  <input
                    ref="newHostInput"
                    v-model="newHost"
                    type="text"
                    class="noproxy-add-input"
                    :placeholder="$t('proxy.addHostPlaceholder')"
                    @keydown.enter.prevent="addHost"
                  />
                  <button
                    class="noproxy-add-btn"
                    :disabled="!newHost.trim()"
                    @click="addHost"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="proxy-error">{{ error }}</div>

          <div class="proxy-footer">
            <button class="btn" @click="emit('close')">
              {{ $t("proxy.cancel") }}
            </button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? $t("proxy.saving") : $t("proxy.save") }}
            </button>
          </div>
        </template>
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

.proxy-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(520px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.proxy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.proxy-header h3 {
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

.proxy-loading {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

/* ── Segmented control ─────────────────────────────────────────── */

.segmented-control-wrapper {
  padding: 16px 20px 0;
}

.segmented-control {
  display: flex;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}

.segment {
  flex: 1;
  padding: 7px 12px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.segment:hover {
  color: var(--color-text-primary);
}

.segment.active {
  background: var(--color-bg);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* ── Body ──────────────────────────────────────────────────────── */

.proxy-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.proxy-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.proxy-none-message {
  padding: 24px 0;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: default;
}

.pref-row:last-child {
  border-bottom: none;
}

.pref-row input[type="text"],
.pref-row input[type="password"],
.pref-row input[type="number"] {
  width: min(200px, 50vw);
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.pref-row input[type="number"] {
  text-align: right;
  width: min(100px, 30vw);
  -moz-appearance: textfield;
}

.pref-row input[type="number"]::-webkit-inner-spin-button,
.pref-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* ── Toggle switch ─────────────────────────────────────────────── */

.toggle-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-text-tertiary);
  opacity: 0.4;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition:
    background 0.2s,
    opacity 0.2s;
}

.toggle-switch.on {
  background: var(--color-accent);
  opacity: 1;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: left 0.2s;
}

.toggle-switch.on .toggle-knob {
  left: 18px;
}

/* ── No-proxy hosts ────────────────────────────────────────────── */

.noproxy-section {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.noproxy-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.noproxy-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.noproxy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.noproxy-host {
  color: var(--color-text-primary);
  font-family: monospace;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.noproxy-remove {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.noproxy-remove:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.noproxy-add-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.noproxy-add-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.noproxy-add-input::placeholder {
  color: var(--color-text-tertiary);
}

.noproxy-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.noproxy-add-btn:hover:not(:disabled) {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.noproxy-add-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ── Footer / error ────────────────────────────────────────────── */

.proxy-error {
  padding: 8px 20px;
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.proxy-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}
</style>
