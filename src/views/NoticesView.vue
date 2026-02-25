<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import DOMPurify from "dompurify";
import { useNoticesStore } from "../stores/notices";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";

const store = useNoticesStore();

function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html);
  // Ensure all links open in a new tab without giving the target page window.opener access
  return clean.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

function formatDate(timestamp: number): string {
  if (timestamp <= 0) return "";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(timestamp: number): string {
  if (timestamp <= 0) return "";
  return new Date(timestamp * 1000).toLocaleString();
}

const sortedNotices = computed(() => {
  return [...store.notices].sort((a, b) => b.create_time - a.create_time);
});

onMounted(() => {
  store.startPolling();
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="notices-view">
    <PageHeader title="Notices" />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <div v-if="store.loading && store.notices.length === 0" class="loading-text">
      Loading notices...
    </div>

    <EmptyState
      v-else-if="store.notices.length === 0 && !store.loading"
      icon="&#x1f4f0;"
      message="No notices at this time."
    />

    <div v-else class="notices-list">
      <article
        v-for="notice in sortedNotices"
        :key="notice.seqno"
        class="notice-card"
      >
        <div class="notice-header">
          <h3 class="notice-title">
            <a
              v-if="notice.link"
              :href="notice.link"
              target="_blank"
              rel="noopener"
              class="notice-link"
            >
              {{ notice.title }}
            </a>
            <span v-else>{{ notice.title }}</span>
          </h3>
          <div class="notice-meta">
            <StatusBadge v-if="notice.project_name" variant="info">
              {{ notice.project_name }}
            </StatusBadge>
            <StatusBadge v-if="notice.category" variant="default">
              {{ notice.category }}
            </StatusBadge>
            <span class="notice-date" :title="formatDateTime(notice.create_time)">
              {{ formatDate(notice.create_time) }}
            </span>
          </div>
        </div>

        <div
          v-if="notice.description"
          class="notice-body"
          v-html="sanitizeHtml(notice.description)"
        />
      </article>
    </div>
  </div>
</template>

<style scoped>
.notices-view {
  padding: var(--space-lg);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  padding: var(--space-xl) 0;
}

.notices-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.notice-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal);
}

.notice-card:hover {
  box-shadow: var(--shadow-md);
}

.notice-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.notice-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.notice-link {
  color: var(--color-accent);
  text-decoration: none;
}

.notice-link:hover {
  text-decoration: underline;
}

.notice-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.notice-date {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.notice-body {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.6;
  overflow-wrap: break-word;
}

.notice-body :deep(a) {
  color: var(--color-accent);
  text-decoration: none;
}

.notice-body :deep(a:hover) {
  text-decoration: underline;
}

.notice-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

.notice-body :deep(p) {
  margin: 0 0 var(--space-sm) 0;
}

.notice-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
