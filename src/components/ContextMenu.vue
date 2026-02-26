<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";

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
const focusedIndex = ref(-1);

// Indices of non-divider items within props.items
const actionableIndices = computed(() =>
  props.items.reduce<number[]>((acc, item, i) => {
    if (!item.divider) acc.push(i);
    return acc;
  }, []),
);

const enabledIndices = computed(() =>
  actionableIndices.value.filter((i) => !props.items[i].disabled),
);

function getMenuItemButtons(): HTMLElement[] {
  if (!menuRef.value) return [];
  return Array.from(menuRef.value.querySelectorAll<HTMLElement>("[role='menuitem']"));
}

function focusActionableAt(actionablePos: number) {
  focusedIndex.value = actionablePos;
  const buttons = getMenuItemButtons();
  buttons[actionablePos]?.focus();
}

function findActionablePos(itemIndex: number): number {
  return actionableIndices.value.indexOf(itemIndex);
}

function focusFirstEnabled() {
  const firstIdx = enabledIndices.value[0];
  if (firstIdx !== undefined) {
    focusActionableAt(findActionablePos(firstIdx));
  }
}

function focusLastEnabled() {
  const lastIdx = enabledIndices.value[enabledIndices.value.length - 1];
  if (lastIdx !== undefined) {
    focusActionableAt(findActionablePos(lastIdx));
  }
}

function focusNextEnabled() {
  const currentItemIdx = actionableIndices.value[focusedIndex.value];
  const currentEnabledPos = enabledIndices.value.indexOf(currentItemIdx);
  const nextPos = (currentEnabledPos + 1) % enabledIndices.value.length;
  focusActionableAt(findActionablePos(enabledIndices.value[nextPos]));
}

function focusPrevEnabled() {
  const currentItemIdx = actionableIndices.value[focusedIndex.value];
  const currentEnabledPos = enabledIndices.value.indexOf(currentItemIdx);
  const prevPos = (currentEnabledPos - 1 + enabledIndices.value.length) % enabledIndices.value.length;
  focusActionableAt(findActionablePos(enabledIndices.value[prevPos]));
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit("close");
  }
}

function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "Escape":
      emit("close");
      break;
    case "ArrowDown":
      e.preventDefault();
      if (focusedIndex.value < 0) {
        focusFirstEnabled();
      } else {
        focusNextEnabled();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (focusedIndex.value < 0) {
        focusLastEnabled();
      } else {
        focusPrevEnabled();
      }
      break;
    case "Home":
      e.preventDefault();
      focusFirstEnabled();
      break;
    case "End":
      e.preventDefault();
      focusLastEnabled();
      break;
  }
}

function handleAction(item: ContextMenuItem) {
  if (item.disabled) return;
  emit("action", item.action);
  emit("close");
}

function getTabIndex(itemIndex: number): number {
  const actionablePos = findActionablePos(itemIndex);
  return actionablePos === focusedIndex.value ? 0 : -1;
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      focusedIndex.value = -1;
      document.addEventListener("keydown", handleKeydown);
      // Delay click listener to avoid the opening click from immediately closing
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      await nextTick();
      focusFirstEnabled();
    } else {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    }
  },
);

onMounted(() => {
  if (props.open) {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("click", handleClickOutside);
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
      role="menu"
      class="context-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <template v-for="(item, idx) in items" :key="idx">
        <div v-if="item.divider" role="separator" class="context-divider" />
        <button
          v-else
          role="menuitem"
          class="context-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          :disabled="item.disabled || undefined"
          :aria-disabled="item.disabled || undefined"
          :tabindex="getTabIndex(idx)"
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

.context-item:hover:not(.disabled),
.context-item:focus:not(.disabled) {
  background: var(--color-accent-light);
  color: var(--color-accent);
  outline: none;
}

.context-item.danger {
  color: var(--color-danger);
}

.context-item.danger:hover:not(.disabled),
.context-item.danger:focus:not(.disabled) {
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
