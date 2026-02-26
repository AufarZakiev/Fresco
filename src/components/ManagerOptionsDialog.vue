<script setup lang="ts">
import { ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useManagerSettingsStore } from "../stores/managerSettings";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = useManagerSettingsStore();
const form = ref({ ...store.settings });
const launchAtLogin = ref(false);

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      form.value = { ...store.settings };
      launchAtLogin.value = await isEnabled();
    }
  },
);

async function save() {
  Object.assign(store.settings, form.value);
  if (launchAtLogin.value) {
    await enable();
  } else {
    await disable();
  }
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="options-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-options-dialog-title">
        <div class="options-header">
          <h3 id="manager-options-dialog-title">{{ $t('managerOptions.title') }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">&times;</button>
        </div>

        <div class="options-body">
          <div class="option-group">
            <label class="option-label">{{ $t('managerOptions.appearance') }}</label>
            <select v-model="form.theme" class="option-select">
              <option value="system">{{ $t('prefs.manager.themeSystem') }}</option>
              <option value="light">{{ $t('prefs.manager.themeLight') }}</option>
              <option value="dark">{{ $t('prefs.manager.themeDark') }}</option>
            </select>
          </div>

          <div class="option-group">
            <label class="option-label">{{ $t('managerOptions.language') }}</label>
            <select v-model="form.language" class="option-select">
              <option value="auto">{{ $t('prefs.manager.langAuto') }}</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ru">Русский</option>
            </select>
          </div>

          <div class="option-group">
            <label class="option-label">{{ $t('managerOptions.noticeReminder') }}</label>
            <select v-model="form.reminderFrequency" class="option-select">
              <option value="always">{{ $t('prefs.manager.reminderAlways') }}</option>
              <option value="1h">{{ $t('prefs.manager.reminder1h') }}</option>
              <option value="6h">{{ $t('prefs.manager.reminder6h') }}</option>
              <option value="1d">{{ $t('prefs.manager.reminder1d') }}</option>
              <option value="1w">{{ $t('prefs.manager.reminder1w') }}</option>
              <option value="never">{{ $t('prefs.manager.reminderNever') }}</option>
            </select>
          </div>

          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" v-model="form.showExitConfirmation" />
              <span>{{ $t('managerOptions.showExitConfirm') }}</span>
            </label>
          </div>

          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" v-model="form.showShutdownConfirmation" />
              <span>{{ $t('managerOptions.showShutdownConfirm') }}</span>
            </label>
          </div>

          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" v-model="form.minimizeToTrayOnClose" />
              <span>{{ $t('managerOptions.minimizeToTray') }}</span>
            </label>
          </div>

          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" v-model="form.startMinimizedToTray" />
              <span>{{ $t('managerOptions.startMinimized') }}</span>
            </label>
          </div>

          <div class="option-group">
            <label class="option-toggle">
              <input type="checkbox" v-model="launchAtLogin" />
              <span>{{ $t('managerOptions.launchAtLogin') }}</span>
            </label>
          </div>
        </div>

        <div class="options-footer">
          <button class="btn" @click="emit('close')">{{ $t('managerOptions.cancel') }}</button>
          <button class="btn btn-primary" @click="save">{{ $t('managerOptions.save') }}</button>
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

.options-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  max-width: 440px;
  width: 90%;
  box-shadow: var(--shadow-lg);
}

.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.options-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.options-body {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.option-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.option-select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.option-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-md);
  cursor: pointer;
  color: var(--color-text-primary);
}

.option-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.options-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--color-border);
}
</style>
