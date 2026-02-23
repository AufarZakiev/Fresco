<script setup lang="ts">
import { ref, watch } from "vue";
import type { DataTableColumn } from "./DataTable.vue";

const props = defineProps<{
  open: boolean;
  columns: DataTableColumn[];
  visibleKeys: string[];
}>();

const emit = defineEmits<{
  update: [keys: string[]];
  close: [];
}>();

const localKeys = ref<Set<string>>(new Set());

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      localKeys.value = new Set(props.visibleKeys);
    }
  },
);

function toggle(key: string) {
  const next = new Set(localKeys.value);
  if (next.has(key)) {
    // Don't allow hiding all columns
    if (next.size > 1) {
      next.delete(key);
    }
  } else {
    next.add(key);
  }
  localKeys.value = next;
}

function save() {
  emit("update", Array.from(localKeys.value));
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="dialog">
        <div class="dialog-header">
          <h3>Columns</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>
        <div class="dialog-body">
          <label
            v-for="col in columns"
            :key="col.key"
            class="col-option"
          >
            <input
              type="checkbox"
              :checked="localKeys.has(col.key)"
              @change="toggle(col.key)"
            />
            <span>{{ col.label }}</span>
          </label>
        </div>
        <div class="dialog-footer">
          <button class="btn" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="save">Apply</button>
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
  width: min(320px, 95vw);
  box-shadow: var(--shadow-lg);
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
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.col-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: pointer;
}

.col-option:last-child {
  border-bottom: none;
}

.col-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.dialog-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
}
</style>
