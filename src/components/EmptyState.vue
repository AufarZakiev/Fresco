<script setup lang="ts">
defineProps<{
  icon?: string;
  message: string;
}>();
</script>

<template>
  <div class="empty-state">
    <span v-if="icon" class="empty-icon">{{ icon }}</span>
    <p class="empty-message">{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--color-text-tertiary);
  min-height: 200px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-md);
  opacity: 0.5;
}

.empty-message {
  font-size: var(--font-size-base);
  text-align: center;
}
</style>
