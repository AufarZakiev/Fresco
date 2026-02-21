<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useMessagesStore } from "../stores/messages";
import { MSG_PRIORITY, SORT_DIR } from "../types/boinc";
import type { Message, SortDir } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import type { DataTableColumn } from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useColumnState } from "../composables/useColumnState";

const store = useMessagesStore();
const selectedSeqnos = ref<Set<number>>(new Set());
const tableWrapper = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);

type TypeFilter = "all" | "alerts" | "errors";
const typeFilter = ref<TypeFilter>("all");

const { sortKey, sortDir } = useColumnState(
  "event-log",
  ["time", "project", "type", "message"],
  "time",
  SORT_DIR.ASC,
);

const allColumns: DataTableColumn[] = [
  { key: "time", label: "Time", sortable: true },
  { key: "project", label: "Project", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "message", label: "Message", sortable: true },
];

const columns = computed(() =>
  allColumns.map((c) => ({ ...c, visible: true })),
);

function formatTimestamp(ts: number): string {
  if (ts <= 0) return "---";
  return new Date(ts * 1000).toLocaleString();
}

function priorityClass(priority: number): string {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "row-error";
  if (priority === MSG_PRIORITY.USER_ALERT) return "row-alert";
  return "";
}

function priorityLabel(priority: number): string {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "Error";
  if (priority === MSG_PRIORITY.USER_ALERT) return "Alert";
  return "Info";
}

function priorityVariant(priority: number): "default" | "warning" | "danger" {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "danger";
  if (priority === MSG_PRIORITY.USER_ALERT) return "warning";
  return "default";
}

function getSortValue(msg: Message, key: string): number | string {
  switch (key) {
    case "time": return msg.timestamp;
    case "project": return msg.project;
    case "type": return msg.priority;
    case "message": return msg.body;
    default: return 0;
  }
}

const filteredByType = computed(() => {
  const msgs = store.filteredMessages;
  if (typeFilter.value === "errors") {
    return msgs.filter((m) => m.priority === MSG_PRIORITY.INTERNAL_ERROR);
  }
  if (typeFilter.value === "alerts") {
    return msgs.filter((m) => m.priority >= MSG_PRIORITY.USER_ALERT);
  }
  return msgs;
});

const sortedMessages = computed(() => {
  const msgs = [...filteredByType.value];
  const key = sortKey.value;
  const dir = sortDir.value === SORT_DIR.ASC ? 1 : -1;
  return msgs.sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (typeof va === "string" && typeof vb === "string") {
      return dir * va.localeCompare(vb);
    }
    return dir * ((va as number) - (vb as number));
  });
});

function handleSort(key: string, dir: SortDir) {
  sortKey.value = key;
  sortDir.value = dir;
}

function isSelected(seqno: number): boolean {
  return selectedSeqnos.value.has(seqno);
}

function toggleSelect(seqno: number, event: MouseEvent) {
  const next = new Set(selectedSeqnos.value);
  if (event.shiftKey && next.size > 0) {
    const seqnos = sortedMessages.value.map((m) => m.seqno);
    const lastSelected = Array.from(next).pop()!;
    const startIdx = seqnos.indexOf(lastSelected);
    const endIdx = seqnos.indexOf(seqno);
    if (startIdx >= 0 && endIdx >= 0) {
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      for (let i = from; i <= to; i++) {
        next.add(seqnos[i]);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (next.has(seqno)) {
      next.delete(seqno);
    } else {
      next.add(seqno);
    }
  } else {
    next.clear();
    next.add(seqno);
  }
  selectedSeqnos.value = next;
}

function selectAll() {
  selectedSeqnos.value = new Set(sortedMessages.value.map((m) => m.seqno));
}

function formatMessage(m: { timestamp: number; project: string; body: string }): string {
  return `[${formatTimestamp(m.timestamp)}] ${m.project ? m.project + ": " : ""}${m.body}`;
}

async function copySelectedToClipboard() {
  const msgs = selectedSeqnos.value.size > 0
    ? store.filteredMessages.filter((m) => selectedSeqnos.value.has(m.seqno))
    : store.filteredMessages;
  const text = msgs.map(formatMessage).join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

// Auto-scroll logic
function onTableScroll(event: Event) {
  const el = event.target as HTMLElement;
  const threshold = 30;
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}

function scrollToBottom() {
  const el = tableWrapper.value;
  if (el) {
    el.scrollTo({ top: el.scrollHeight });
  }
}

watch(
  () => sortedMessages.value.length,
  () => {
    if (isAtBottom.value && sortKey.value === "time" && sortDir.value === SORT_DIR.ASC) {
      nextTick(scrollToBottom);
    }
  },
);

onMounted(() => {
  store.startPolling(1000);
  nextTick(() => {
    // Find the wrapper element and attach scroll listener
    const wrapper = document.querySelector(".messages-view .data-table-wrapper") as HTMLElement | null;
    if (wrapper) {
      tableWrapper.value = wrapper;
      wrapper.addEventListener("scroll", onTableScroll);
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  store.stopPolling();
  if (tableWrapper.value) {
    tableWrapper.value.removeEventListener("scroll", onTableScroll);
  }
});
</script>

<template>
  <div class="messages-view">
    <PageHeader title="Event Log">
      <button class="btn" @click="selectAll">Select All</button>
      <button class="btn" @click="copySelectedToClipboard">
        {{ selectedSeqnos.size > 0 ? `Copy Selected (${selectedSeqnos.size})` : "Copy All" }}
      </button>
    </PageHeader>

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <input
          v-model="store.searchText"
          type="text"
          class="search-input"
          placeholder="Search messages..."
        />
      </div>

      <div class="filter-group type-selector">
        <button
          :class="['btn', 'type-btn', { active: typeFilter === 'all' }]"
          @click="typeFilter = 'all'"
        >
          All
        </button>
        <button
          :class="['btn', 'type-btn', { active: typeFilter === 'alerts' }]"
          @click="typeFilter = 'alerts'"
        >
          User Alerts
        </button>
        <button
          :class="['btn', 'type-btn', { active: typeFilter === 'errors' }]"
          @click="typeFilter = 'errors'"
        >
          Errors
        </button>
      </div>
    </div>

    <EmptyState
      v-if="!store.loading && sortedMessages.length === 0"
      icon="&#x1f4ac;"
      message="No messages to display."
    />

    <DataTable
      v-else
      :columns="columns"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      @sort="handleSort"
    >
      <tr
        v-for="msg in sortedMessages"
        :key="msg.seqno"
        :class="[priorityClass(msg.priority), { 'row-selected': isSelected(msg.seqno) }]"
        @click="toggleSelect(msg.seqno, $event)"
      >
        <td class="col-time">{{ formatTimestamp(msg.timestamp) }}</td>
        <td class="col-project">{{ msg.project || "---" }}</td>
        <td class="col-type">
          <StatusBadge :variant="priorityVariant(msg.priority)">
            {{ priorityLabel(msg.priority) }}
          </StatusBadge>
        </td>
        <td class="col-message">{{ msg.body }}</td>
      </tr>
    </DataTable>
  </div>
</template>

<style scoped>
.messages-view {
  padding: var(--space-lg);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.search-input {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  min-width: 220px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.type-selector {
  gap: 0;
}

.type-btn {
  border-radius: 0;
  border-right-width: 0;
}

.type-btn:first-child {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.type-btn:last-child {
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  border-right-width: 1px;
}

.type-btn.active {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-color: var(--color-accent);
  border-right-width: 1px;
  z-index: 1;
  position: relative;
}

.col-time {
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 150px;
}

.col-project {
  white-space: nowrap;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-type {
  white-space: nowrap;
}

.col-message {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  word-break: break-word;
}

:deep(.row-error) {
  background: var(--color-danger-light) !important;
}

:deep(.row-error) td {
  color: #991b1b;
}

:deep(.row-alert) {
  background: var(--color-warning-light) !important;
}

:deep(.row-alert) td {
  color: #92400e;
}

:deep(.row-selected) {
  background: var(--color-accent-light) !important;
}

:deep(tr) {
  cursor: pointer;
  user-select: none;
}

@media (max-width: 767px) {
  .search-input {
    min-width: 120px;
  }
}
</style>
