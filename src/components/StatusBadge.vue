<script setup lang="ts">
defineProps<{
  variant?: "default" | "success" | "warning" | "danger" | "info";
}>();
</script>

<template>
  <span class="status-badge" :class="`badge-${variant ?? 'default'}`">
    <slot />
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.5;
}

.badge-default {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.badge-success {
  background: var(--color-success-light);
  color: #15803d;
}

.badge-warning {
  background: var(--color-warning-light);
  color: #92400e;
}

.badge-danger {
  background: var(--color-danger-light);
  color: #991b1b;
}

.badge-info {
  background: var(--color-accent-light);
  color: #1d4ed8;
}
</style>
