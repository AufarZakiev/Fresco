<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { getProxySettings, setProxySettings } from "../composables/useRpc";
import type { ProxyInfo } from "../types/boinc";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

const activeTab = ref<"http" | "socks">("http");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const form = ref<ProxyInfo | null>(null);

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
      <div ref="dialogRef" class="proxy-dialog" role="dialog" aria-modal="true" aria-labelledby="proxy-settings-dialog-title">
        <div class="proxy-header">
          <h3 id="proxy-settings-dialog-title">{{ $t('proxy.title') }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">&times;</button>
        </div>

        <div v-if="loading" class="proxy-loading">{{ $t('proxy.loading') }}</div>

        <template v-else-if="form">
          <div class="tabs">
            <button
              class="tab"
              :class="{ active: activeTab === 'http' }"
              @click="activeTab = 'http'"
            >
              {{ $t('proxy.httpProxy') }}
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'socks' }"
              @click="activeTab = 'socks'"
            >
              {{ $t('proxy.socksProxy') }}
            </button>
          </div>

          <div class="proxy-body">
            <!-- HTTP Proxy tab -->
            <div v-if="activeTab === 'http'" class="proxy-section">
              <label class="pref-row">
                <span>{{ $t('proxy.useHttp') }}</span>
                <span class="toggle-switch" :class="{ on: form.use_http_proxy }" role="button" tabindex="0" @click.prevent="form.use_http_proxy = !form.use_http_proxy" @keydown.enter.prevent="form.use_http_proxy = !form.use_http_proxy" @keydown.space.prevent="form.use_http_proxy = !form.use_http_proxy">
                  <span class="toggle-knob" />
                </span>
              </label>
              <template v-if="form.use_http_proxy">
                <label class="pref-row">
                  <span>{{ $t('proxy.serverName') }}</span>
                  <input v-model="form.http_server_name" type="text" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.port') }}</span>
                  <input v-model.number="form.http_server_port" type="number" min="0" max="65535" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.useHttpAuth') }}</span>
                  <span class="toggle-switch" :class="{ on: form.use_http_auth }" role="button" tabindex="0" @click.prevent="form.use_http_auth = !form.use_http_auth" @keydown.enter.prevent="form.use_http_auth = !form.use_http_auth" @keydown.space.prevent="form.use_http_auth = !form.use_http_auth">
                    <span class="toggle-knob" />
                  </span>
                </label>
                <template v-if="form.use_http_auth">
                  <label class="pref-row">
                    <span>{{ $t('proxy.username') }}</span>
                    <input v-model="form.http_user_name" type="text" />
                  </label>
                  <label class="pref-row">
                    <span>{{ $t('proxy.password') }}</span>
                    <input v-model="form.http_user_passwd" type="password" />
                  </label>
                </template>
              </template>
            </div>

            <!-- SOCKS Proxy tab -->
            <div v-if="activeTab === 'socks'" class="proxy-section">
              <label class="pref-row">
                <span>{{ $t('proxy.useSocks') }}</span>
                <span class="toggle-switch" :class="{ on: form.use_socks_proxy }" role="button" tabindex="0" @click.prevent="form.use_socks_proxy = !form.use_socks_proxy" @keydown.enter.prevent="form.use_socks_proxy = !form.use_socks_proxy" @keydown.space.prevent="form.use_socks_proxy = !form.use_socks_proxy">
                  <span class="toggle-knob" />
                </span>
              </label>
              <template v-if="form.use_socks_proxy">
                <label class="pref-row">
                  <span>{{ $t('proxy.serverName') }}</span>
                  <input v-model="form.socks_server_name" type="text" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.port') }}</span>
                  <input v-model.number="form.socks_server_port" type="number" min="0" max="65535" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.username') }}</span>
                  <input v-model="form.socks5_user_name" type="text" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.password') }}</span>
                  <input v-model="form.socks5_user_passwd" type="password" />
                </label>
                <label class="pref-row">
                  <span>{{ $t('proxy.useSocks5Dns') }}</span>
                  <span class="toggle-switch" :class="{ on: form.socks5_remote_dns }" role="button" tabindex="0" @click.prevent="form.socks5_remote_dns = !form.socks5_remote_dns" @keydown.enter.prevent="form.socks5_remote_dns = !form.socks5_remote_dns" @keydown.space.prevent="form.socks5_remote_dns = !form.socks5_remote_dns">
                    <span class="toggle-knob" />
                  </span>
                </label>
              </template>
            </div>

            <!-- Common section -->
            <div class="proxy-section noproxy-section">
              <label class="pref-row noproxy-row">
                <span>{{ $t('proxy.noProxyHosts') }}</span>
                <textarea v-model="form.noproxy_hosts" rows="3"></textarea>
              </label>
            </div>
          </div>

          <div v-if="error" class="proxy-error">{{ error }}</div>

          <div class="proxy-footer">
            <button class="btn" @click="emit('close')">{{ $t('proxy.cancel') }}</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? $t('proxy.saving') : $t('proxy.save') }}
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

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 16px;
}

.tab {
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text-primary);
}

.tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

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

.noproxy-section {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
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
  width: min(130px, 40vw);
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.pref-row input[type="number"] {
  text-align: right;
  -moz-appearance: textfield;
}

.pref-row input[type="number"]::-webkit-inner-spin-button,
.pref-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-text-tertiary);
  opacity: 0.4;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s, opacity 0.2s;
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

.noproxy-row {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
}

.noproxy-row textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-family: inherit;
  resize: vertical;
  background: var(--color-bg);
}

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
