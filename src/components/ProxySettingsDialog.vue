<script setup lang="ts">
import { ref, watch } from "vue";
import { getProxySettings, setProxySettings } from "../composables/useRpc";
import type { ProxyInfo } from "../types/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const activeTab = ref<"http" | "socks">("http");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const form = ref<ProxyInfo | null>(null);

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
      <div class="proxy-dialog">
        <div class="proxy-header">
          <h3>Proxy Settings</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div v-if="loading" class="proxy-loading">Loading proxy settings...</div>

        <template v-else-if="form">
          <div class="tabs">
            <button
              class="tab"
              :class="{ active: activeTab === 'http' }"
              @click="activeTab = 'http'"
            >
              HTTP Proxy
            </button>
            <button
              class="tab"
              :class="{ active: activeTab === 'socks' }"
              @click="activeTab = 'socks'"
            >
              SOCKS Proxy
            </button>
          </div>

          <div class="proxy-body">
            <!-- HTTP Proxy tab -->
            <div v-if="activeTab === 'http'" class="proxy-section">
              <label class="pref-row">
                <span>Use HTTP proxy</span>
                <input v-model="form.use_http_proxy" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Server name</span>
                <input v-model="form.http_server_name" type="text" />
              </label>
              <label class="pref-row">
                <span>Port</span>
                <input v-model.number="form.http_server_port" type="number" min="0" max="65535" />
              </label>
              <label class="pref-row">
                <span>Use HTTP authentication</span>
                <input v-model="form.use_http_auth" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Username</span>
                <input v-model="form.http_user_name" type="text" />
              </label>
              <label class="pref-row">
                <span>Password</span>
                <input v-model="form.http_user_passwd" type="password" />
              </label>
            </div>

            <!-- SOCKS Proxy tab -->
            <div v-if="activeTab === 'socks'" class="proxy-section">
              <label class="pref-row">
                <span>Use SOCKS proxy</span>
                <input v-model="form.use_socks_proxy" type="checkbox" />
              </label>
              <label class="pref-row">
                <span>Server name</span>
                <input v-model="form.socks_server_name" type="text" />
              </label>
              <label class="pref-row">
                <span>Port</span>
                <input v-model.number="form.socks_server_port" type="number" min="0" max="65535" />
              </label>
              <label class="pref-row">
                <span>Username</span>
                <input v-model="form.socks5_user_name" type="text" />
              </label>
              <label class="pref-row">
                <span>Password</span>
                <input v-model="form.socks5_user_passwd" type="password" />
              </label>
              <label class="pref-row">
                <span>Use SOCKS5 remote DNS</span>
                <input v-model="form.socks5_remote_dns" type="checkbox" />
              </label>
            </div>

            <!-- Common section -->
            <div class="proxy-section noproxy-section">
              <label class="pref-row noproxy-row">
                <span>No proxy hosts (comma-separated)</span>
                <textarea v-model="form.noproxy_hosts" rows="3"></textarea>
              </label>
            </div>
          </div>

          <div v-if="error" class="proxy-error">{{ error }}</div>

          <div class="proxy-footer">
            <button class="btn" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? "Saving..." : "Save" }}
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
  z-index: 1000;
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
  width: 200px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}

.pref-row input[type="number"] {
  text-align: right;
  background: var(--color-bg);
  -moz-appearance: textfield;
}

.pref-row input[type="number"]::-webkit-inner-spin-button,
.pref-row input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pref-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
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
