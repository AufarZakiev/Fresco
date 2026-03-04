<script setup lang="ts">
import { nextTick, ref, computed, watch, onUnmounted } from "vue";
import { onKeyStroke } from "@vueuse/core";
import type { DataTableColumn } from "./DataTable.vue";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

const props = defineProps<{
  open: boolean;
  columns: DataTableColumn[];
  visibleKeys: string[];
  columnOrder?: string[];
}>();

const emit = defineEmits<{
  update: [keys: string[]];
  "update-order": [order: string[]];
  close: [];
}>();

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

const localKeys = ref<Set<string>>(new Set());
const localOrder = ref<string[]>([]);

// Drag state — pointer-based, not HTML5 Drag API
const draggedIndex = ref<number | null>(null);
const dragDeltaY = ref(0);
const itemHeight = ref(0);
const pointerStartY = ref(0);
onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      localKeys.value = new Set(props.visibleKeys);
      localOrder.value = props.columnOrder
        ? [...props.columnOrder]
        : props.columns.map((c) => c.key);
    }
  },
);

const orderedColumns = computed(() => {
  const colMap = new Map(props.columns.map((c) => [c.key, c]));
  return localOrder.value
    .filter((key) => colMap.has(key))
    .map((key) => colMap.get(key)!);
});

function toggle(key: string) {
  const next = new Set(localKeys.value);
  if (next.has(key)) {
    if (next.size > 1) {
      next.delete(key);
    }
  } else {
    next.add(key);
  }
  localKeys.value = next;
}

function onPointerDown(event: PointerEvent, index: number) {
  const target = event.target as HTMLElement;
  if (!target.closest(".drag-handle")) return;

  event.preventDefault();
  (target.closest(".drag-handle") as HTMLElement).setPointerCapture(
    event.pointerId,
  );

  const row = target.closest(".col-option") as HTMLElement;
  itemHeight.value = row.offsetHeight;
  pointerStartY.value = event.clientY;
  draggedIndex.value = index;
  dragDeltaY.value = 0;

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event: PointerEvent) {
  if (draggedIndex.value === null) return;

  const delta = event.clientY - pointerStartY.value;
  dragDeltaY.value = delta;

  // How many positions has the pointer moved?
  const shift = Math.round(delta / itemHeight.value);
  const targetIndex = Math.max(
    0,
    Math.min(draggedIndex.value + shift, localOrder.value.length - 1),
  );

  if (targetIndex !== draggedIndex.value) {
    const order = [...localOrder.value];
    const [moved] = order.splice(draggedIndex.value, 1);
    order.splice(targetIndex, 0, moved);
    localOrder.value = order;

    // Adjust baseline so drag feels continuous
    pointerStartY.value +=
      (targetIndex - draggedIndex.value) * itemHeight.value;
    dragDeltaY.value = event.clientY - pointerStartY.value;
    draggedIndex.value = targetIndex;
  }
}

function cleanupDrag() {
  draggedIndex.value = null;
  dragDeltaY.value = 0;
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

function onPointerUp() {
  cleanupDrag();
}

// Cleanup drag listeners if dialog closes mid-drag
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen && draggedIndex.value !== null) {
      cleanupDrag();
    }
  },
);

onUnmounted(cleanupDrag);

function getDragStyle(index: number) {
  if (draggedIndex.value === index) {
    return {
      transform: `translateY(${dragDeltaY.value}px) scale(1.02)`,
      zIndex: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      transition: "box-shadow 0.2s, scale 0.2s",
    };
  }
  // Non-dragged items animate via CSS transition
  if (draggedIndex.value !== null) {
    return { transition: "transform 0.25s cubic-bezier(0.2, 0, 0, 1)" };
  }
  return {};
}

function save() {
  emit("update", Array.from(localKeys.value));
  emit("update-order", localOrder.value);
  emit("close");
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
        aria-labelledby="column-dialog-title"
      >
        <div class="dialog-header">
          <h3 id="column-dialog-title">{{ $t("columns.title") }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">
            &times;
          </button>
        </div>
        <div class="dialog-body">
          <div
            v-for="(col, index) in orderedColumns"
            :key="col.key"
            class="col-option"
            :class="{ dragging: draggedIndex === index }"
            :style="getDragStyle(index)"
            @pointerdown="onPointerDown($event, index)"
          >
            <span class="drag-handle" touch-action="none">
              <svg
                width="10"
                height="14"
                viewBox="0 0 10 14"
                fill="currentColor"
              >
                <circle cx="2.5" cy="2" r="1.5" />
                <circle cx="7.5" cy="2" r="1.5" />
                <circle cx="2.5" cy="7" r="1.5" />
                <circle cx="7.5" cy="7" r="1.5" />
                <circle cx="2.5" cy="12" r="1.5" />
                <circle cx="7.5" cy="12" r="1.5" />
              </svg>
            </span>
            <label class="col-label" @pointerdown.stop>
              <input
                type="checkbox"
                :checked="localKeys.has(col.key)"
                @change="toggle(col.key)"
              />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn" @click="emit('close')">
            {{ $t("columns.cancel") }}
          </button>
          <button class="btn btn-primary" @click="save">
            {{ $t("columns.apply") }}
          </button>
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
  padding: 8px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.col-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  position: relative;
  user-select: none;
  background: var(--color-bg);
}

.col-option.dragging {
  background: var(--color-bg-elevated, var(--color-bg));
  border-radius: var(--radius-md);
}

.drag-handle {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
  display: flex;
  align-items: center;
  padding: 4px 2px;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.drag-handle:hover {
  color: var(--color-text-secondary);
}

.col-option.dragging .drag-handle {
  cursor: grabbing;
}

.col-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
}

.col-label input[type="checkbox"] {
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
