<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useMessagesStore } from "../stores/messages";
import { MSG_PRIORITY } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";

const store = useMessagesStore();
const selectedSeqnos = ref<Set<number>>(new Set());

const columns = [
  { key: "time", label: "Time" },
  { key: "project", label: "Project" },
  { key: "message", label: "Message" },
];

function formatTimestamp(ts: number): string {
  if (ts <= 0) return "---";
  return new Date(ts * 1000).toLocaleString();
}

function priorityClass(priority: number): string {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "row-error";
  if (priority === MSG_PRIORITY.USER_ALERT) return "row-alert";
  return "";
}

const reversedMessages = computed(() => {
  return [...store.filteredMessages].reverse();
});

function isSelected(seqno: number): boolean {
  return selectedSeqnos.value.has(seqno);
}

function toggleSelect(seqno: number, event: MouseEvent) {
  const next = new Set(selectedSeqnos.value);
  if (event.shiftKey && next.size > 0) {
    // Range select
    const seqnos = reversedMessages.value.map((m) => m.seqno);
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
  selectedSeqnos.value = new Set(reversedMessages.value.map((m) => m.seqno));
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

onMounted(() => {
  store.startPolling();
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="messages-view">
    <PageHeader title="Messages">
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

      <div class="filter-group">
        <label class="filter-label">Project</label>
        <select v-model="store.filterProject" class="filter-select">
          <option value="">All Projects</option>
          <option v-for="p in store.projects" :key="p" :value="p">
            {{ p }}
          </option>
        </select>
      </div>

      <button
        :class="['btn', 'toggle-btn', { active: store.showErrorsOnly }]"
        @click="store.showErrorsOnly = !store.showErrorsOnly"
      >
        Errors Only
      </button>
    </div>

    <EmptyState
      v-if="!store.loading && store.filteredMessages.length === 0"
      icon="&#x1f4ac;"
      message="No messages to display."
    />

    <DataTable
      v-else
      :columns="columns"
    >
      <tr
        v-for="msg in reversedMessages"
        :key="msg.seqno"
        :class="[priorityClass(msg.priority), { 'row-selected': isSelected(msg.seqno) }]"
        @click="toggleSelect(msg.seqno, $event)"
      >
        <td class="col-time">{{ formatTimestamp(msg.timestamp) }}</td>
        <td class="col-project">{{ msg.project || "---" }}</td>
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

.filter-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  font-weight: 500;
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

.filter-select {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  min-width: 200px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.filter-select:focus {
  border-color: var(--color-accent);
}

.toggle-btn {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
}

.toggle-btn.active {
  background: var(--color-danger-light);
  color: #991b1b;
  border-color: var(--color-danger);
}

.toggle-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
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
</style>
