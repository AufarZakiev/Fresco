<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useScroll, onKeyStroke } from "@vueuse/core";
import { useMessagesStore } from "../stores/messages";
import { MSG_PRIORITY } from "../types/boinc";
import type { Message } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import LogFlagsDialog from "../components/LogFlagsDialog.vue";
import { useTableState } from "../composables/useTableState";
import type { ColumnDef } from "@tanstack/vue-table";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";

const { t } = useI18n();
const store = useMessagesStore();
const showLogFlags = ref(false);
const selectedSeqnos = ref<Set<number>>(new Set());
const tableWrapper = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const { y: scrollY } = useScroll(tableWrapper);

type TypeFilter = "all" | "alerts" | "errors";
const typeFilter = ref<TypeFilter>("all");

const { sorting, onSortingChange } = useTableState(
  "event-log",
  ["time", "project", "type", "message"],
  "time",
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
  if (priority === MSG_PRIORITY.INTERNAL_ERROR)
    return t("messages.priority.error");
  if (priority === MSG_PRIORITY.USER_ALERT) return t("messages.priority.alert");
  return t("messages.priority.info");
}

function priorityVariant(priority: number): "default" | "warning" | "danger" {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "danger";
  if (priority === MSG_PRIORITY.USER_ALERT) return "warning";
  return "default";
}

const columns: ColumnDef<Message, unknown>[] = [
  {
    id: "time",
    accessorFn: (row) => row.timestamp,
    header: () => t("messages.col.time"),
    cell: (info) => formatTimestamp(info.getValue() as number),
    meta: { class: "col-time" },
  },
  {
    id: "project",
    accessorFn: (row) => row.project,
    header: () => t("messages.col.project"),
    cell: (info) => (info.getValue() as string) || "---",
    meta: { class: "col-project" },
  },
  {
    id: "type",
    accessorFn: (row) => row.priority,
    header: () => t("messages.col.type"),
    cell: (info) =>
      h(
        StatusBadge,
        { variant: priorityVariant(info.getValue() as number) },
        () => priorityLabel(info.getValue() as number),
      ),
    meta: { class: "col-type" },
  },
  {
    id: "message",
    accessorFn: (row) => row.body,
    header: () => t("messages.col.message"),
    meta: { class: "col-message" },
  },
];

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

const table = useVueTable({
  get data() {
    return filteredByType.value;
  },
  columns,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

function isSelected(msg: Message): boolean {
  return selectedSeqnos.value.has(msg.seqno);
}

function handleRowClick(msg: Message, _index: number, event: MouseEvent) {
  const seqno = msg.seqno;
  const next = new Set(selectedSeqnos.value);
  if (event.shiftKey && next.size > 0) {
    const sortedMessages = table.getRowModel().rows.map((r) => r.original);
    const seqnos = sortedMessages.map((m) => m.seqno);
    const lastSelected = Array.from(next).pop()!;
    const startIdx = seqnos.indexOf(lastSelected);
    const endIdx = seqnos.indexOf(seqno);
    if (startIdx >= 0 && endIdx >= 0) {
      const [from, to] =
        startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
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
  selectedSeqnos.value = new Set(
    table.getRowModel().rows.map((r) => r.original.seqno),
  );
}

function formatMessage(m: {
  timestamp: number;
  project: string;
  body: string;
}): string {
  return `[${formatTimestamp(m.timestamp)}] ${m.project ? m.project + ": " : ""}${m.body}`;
}

async function copySelectedToClipboard() {
  const msgs =
    selectedSeqnos.value.size > 0
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
function scrollToBottom() {
  const el = tableWrapper.value;
  if (el) {
    el.scrollTo({ top: el.scrollHeight });
  }
}

watch(
  () => table.getRowModel().rows.length,
  (newLen, oldLen) => {
    if (newLen <= oldLen) return;

    if (
      isAtBottom.value &&
      sorting.value.length > 0 &&
      sorting.value[0].id === "time" &&
      !sorting.value[0].desc
    ) {
      nextTick(scrollToBottom);
    }
  },
);

// Scroll-up detection for loading older messages
watch(
  () => scrollY.value,
  () => {
    const el = tableWrapper.value;
    if (!el) return;

    const threshold = 30;
    isAtBottom.value =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    // Load older messages when scrolled near top
    if (el.scrollTop < 100 && store.hasMore && !store.loadingMore) {
      const prevHeight = el.scrollHeight;
      store.fetchOlderMessages().then(() => {
        // Preserve scroll position after prepending older messages
        nextTick(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop += newHeight - prevHeight;
        });
      });
    }
  },
);

function isTypingInInput(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

onKeyStroke("a", (e) => {
  if (isTypingInInput(e) || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  selectAll();
});

onKeyStroke("Escape", (e) => {
  if (isTypingInInput(e)) return;
  selectedSeqnos.value = new Set();
});

onKeyStroke("c", (e) => {
  if (isTypingInInput(e) || !(e.ctrlKey || e.metaKey)) return;
  if (selectedSeqnos.value.size === 0) return;
  e.preventDefault();
  copySelectedToClipboard();
});

onMounted(() => {
  store.startPolling(1000);
  nextTick(() => {
    const wrapper = document.querySelector(
      ".messages-view .data-table-wrapper",
    ) as HTMLElement | null;
    if (wrapper) {
      tableWrapper.value = wrapper;
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="messages-view">
    <PageHeader>
      <button class="btn" @click="showLogFlags = true">
        {{ $t("messages.logFlags") }}
      </button>
      <button class="btn" @click="selectAll">
        {{ $t("messages.selectAll") }}
      </button>
      <button class="btn" @click="copySelectedToClipboard">
        {{
          selectedSeqnos.size > 0
            ? $t("messages.copySelected", selectedSeqnos.size)
            : $t("messages.copyAll")
        }}
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
          :placeholder="$t('messages.searchPlaceholder')"
        />
      </div>

      <div class="segmented-control">
        <button
          :class="['segment', { active: typeFilter === 'all' }]"
          @click="typeFilter = 'all'"
        >
          {{ $t("messages.filterAll") }}
        </button>
        <button
          :class="['segment', { active: typeFilter === 'alerts' }]"
          @click="typeFilter = 'alerts'"
        >
          {{ $t("messages.filterAlerts") }}
        </button>
        <button
          :class="['segment', { active: typeFilter === 'errors' }]"
          @click="typeFilter = 'errors'"
        >
          {{ $t("messages.filterErrors") }}
        </button>
      </div>
    </div>

    <EmptyState
      v-if="table.getRowModel().rows.length === 0 && !store.loading"
      icon="&#x1f4ac;"
      :message="$t('messages.empty')"
    />

    <template v-else>
      <div v-if="store.loadingMore" class="loading-more">
        {{ $t("messages.loadingMore") }}
      </div>

      <DataTable
        :table="table"
        :is-row-selected="isSelected"
        :row-class="(msg: Message) => priorityClass(msg.priority)"
        @row-click="handleRowClick"
      />
    </template>

    <LogFlagsDialog :open="showLogFlags" @close="showLogFlags = false" />
  </div>
</template>

<style scoped>
.messages-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
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
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
  flex-shrink: 0;
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

.segmented-control {
  display: inline-flex;
  flex-wrap: wrap;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
}

.segment {
  padding: 5px 12px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  font-weight: 500;
}

.segment.active {
  background: var(--color-bg);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.segment:hover:not(.active) {
  color: var(--color-text-primary);
}

.loading-more {
  padding: var(--space-sm) var(--space-md);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
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
  color: var(--color-danger-text);
}

:deep(.row-alert) {
  background: var(--color-warning-light) !important;
}

:deep(.row-alert) td {
  color: var(--color-warning-text);
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
