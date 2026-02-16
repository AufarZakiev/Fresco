<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const version = ref("0.1.0");

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        version.value = await getVersion();
      } catch {
        // Not in Tauri environment
      }
    }
  },
);

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
        <p class="description">
          Berkeley Open Infrastructure for Network Computing.
          Use your computer to help solve scientific problems.
        </p>
        <button class="link-btn" @click="openWebsite">boinc.berkeley.edu</button>
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
  margin-bottom: var(--space-xl);
}

.link-btn:hover {
  text-decoration: underline;
}

.about-footer {
  display: flex;
  justify-content: center;
}
</style>
