<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";

export interface ContextMenuItem {
  label: string;
  action: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

const emit = defineEmits<{
  action: [action: string];
  close: [];
}>();

const menuRef = ref<HTMLElement | null>(null);

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit("close");
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  }
}

function handleAction(item: ContextMenuItem) {
  if (item.disabled) return;
  emit("action", item.action);
  emit("close");
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeydown);
      }, 0);
    } else {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    }
  },
);

onMounted(() => {
  if (props.open) {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuRef"
      class="context-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <template v-for="(item, idx) in items" :key="idx">
        <div v-if="item.divider" class="context-divider" />
        <button
          v-else
          class="context-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          :disabled="item.disabled"
          @click="handleAction(item)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: var(--z-context-menu);
  min-width: 160px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px 0;
}

.context-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 14px;
  border: none;
  background: none;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.context-item:hover:not(.disabled) {
  background: var(--color-accent-light);
  color: var(--color-accent);
}

.context-item.danger {
  color: var(--color-danger);
}

.context-item.danger:hover:not(.disabled) {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.context-item.disabled {
  color: var(--color-text-tertiary);
  cursor: default;
}

.context-divider {
  height: 1px;
  background: var(--color-border-light);
  margin: 4px 0;
}
</style>
