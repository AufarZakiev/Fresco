<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useDiskUsageStore } from "../stores/diskUsage";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";

const store = useDiskUsageStore();

const projectColors = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

function formatGB(bytes: number): string {
  if (bytes <= 0) return "0.0 GB";
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function getColor(index: number): string {
  return projectColors[index % projectColors.length];
}

/** Extract a short project name from the master_url */
function projectName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove common prefixes
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const totalProjectUsage = computed(() => {
  return store.usage.projects.reduce((sum, p) => sum + p.disk_usage, 0);
});

const freeSpace = computed(() => store.usage.d_free);

const pieSegments = computed(() => {
  const total = totalProjectUsage.value + freeSpace.value;
  if (total <= 0) return [];

  const segments: { label: string; value: number; fraction: number; color: string }[] = [];

  for (let i = 0; i < store.usage.projects.length; i++) {
    const p = store.usage.projects[i];
    segments.push({
      label: projectName(p.master_url),
      value: p.disk_usage,
      fraction: p.disk_usage / total,
      color: getColor(i),
    });
  }

  segments.push({
    label: "Free Space",
    value: freeSpace.value,
    fraction: freeSpace.value / total,
    color: "#e5e7eb",
  });

  return segments;
});

/**
 * Generate SVG arc path for a doughnut segment.
 */
function doughnutPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  // Clamp the arc to avoid full-circle issues
  const angle = Math.min(endAngle - startAngle, Math.PI * 2 - 0.001);
  const end = startAngle + angle;
  const largeArc = angle > Math.PI ? 1 : 0;

  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(end);
  const y2 = cy + outerR * Math.sin(end);
  const x3 = cx + innerR * Math.cos(end);
  const y3 = cy + innerR * Math.sin(end);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

const doughnutPaths = computed(() => {
  const cx = 120;
  const cy = 120;
  const outerR = 110;
  const innerR = 70;
  const paths: { d: string; color: string; label: string }[] = [];

  let currentAngle = -Math.PI / 2; // Start from top

  for (const seg of pieSegments.value) {
    if (seg.fraction <= 0) continue;
    const sweepAngle = seg.fraction * Math.PI * 2;
    paths.push({
      d: doughnutPath(cx, cy, outerR, innerR, currentAngle, currentAngle + sweepAngle),
      color: seg.color,
      label: `${seg.label}: ${formatGB(seg.value)}`,
    });
    currentAngle += sweepAngle;
  }

  return paths;
});

const projectBars = computed(() => {
  const dTotal = store.usage.d_total;
  if (dTotal <= 0) return [];

  return store.usage.projects.map((p, i) => ({
    url: p.master_url,
    name: projectName(p.master_url),
    usage: p.disk_usage,
    fraction: p.disk_usage / dTotal,
    color: getColor(i),
  }));
});

onMounted(() => {
  store.fetchDiskUsage();
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="disk-usage-view">
    <PageHeader title="Disk Usage" />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <div v-if="store.loading && store.usage.d_total === 0" class="loading-text">
      Loading disk usage...
    </div>

    <EmptyState
      v-else-if="store.usage.d_total === 0 && !store.loading"
      icon="&#x1f4be;"
      message="No disk usage data available."
    />

    <template v-else>
      <!-- Chart + Summary Row -->
      <div class="top-section">
        <!-- Doughnut Chart -->
        <div class="chart-card">
          <svg width="240" height="240" viewBox="0 0 240 240" class="doughnut-svg">
            <path
              v-for="(seg, i) in doughnutPaths"
              :key="i"
              :d="seg.d"
              :fill="seg.color"
              stroke="var(--color-bg)"
              stroke-width="2"
            >
              <title>{{ seg.label }}</title>
            </path>
            <!-- Center text -->
            <text x="120" y="114" class="center-label" text-anchor="middle">BOINC</text>
            <text x="120" y="134" class="center-value" text-anchor="middle">
              {{ formatGB(store.usage.d_boinc) }}
            </text>
          </svg>

          <!-- Legend -->
          <div class="legend">
            <div
              v-for="(seg, i) in pieSegments"
              :key="i"
              class="legend-item"
            >
              <span class="legend-swatch" :style="{ background: seg.color }"></span>
              <span class="legend-label">{{ seg.label }}</span>
              <span class="legend-value">{{ formatGB(seg.value) }}</span>
            </div>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <span class="summary-label">Total Disk</span>
            <span class="summary-value">{{ formatGB(store.usage.d_total) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">BOINC Usage</span>
            <span class="summary-value">{{ formatGB(store.usage.d_boinc) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Free Space</span>
            <span class="summary-value">{{ formatGB(store.usage.d_free) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Allowed</span>
            <span class="summary-value">{{ formatGB(store.usage.d_allowed) }}</span>
          </div>
        </div>
      </div>

      <!-- Per-project breakdown -->
      <div class="breakdown-section">
        <h3 class="section-title">Project Breakdown</h3>
        <div class="breakdown-list">
          <div
            v-for="proj in projectBars"
            :key="proj.url"
            class="breakdown-item"
          >
            <div class="breakdown-header">
              <span class="breakdown-name">{{ proj.name }}</span>
              <span class="breakdown-size">
                {{ formatGB(proj.usage) }}
                <span class="breakdown-pct">({{ formatPercent(proj.fraction) }})</span>
              </span>
            </div>
            <div class="breakdown-bar-track">
              <div
                class="breakdown-bar-fill"
                :style="{
                  width: formatPercent(proj.fraction),
                  background: proj.color,
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.disk-usage-view {
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

.top-section {
  display: flex;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
}

.chart-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
}

.doughnut-svg {
  flex-shrink: 0;
}

.center-label {
  font-size: 12px;
  fill: var(--color-text-tertiary);
  font-weight: 500;
}

.center-value {
  font-size: 16px;
  fill: var(--color-text-primary);
  font-weight: 600;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 160px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  flex: 1;
}

.legend-value {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  font-weight: 500;
  white-space: nowrap;
}

.summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  flex: 1;
  min-width: 240px;
}

.summary-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.summary-value {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.breakdown-section {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.section-title {
  margin: 0 0 var(--space-lg) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.breakdown-name {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text-primary);
}

.breakdown-size {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.breakdown-pct {
  color: var(--color-text-tertiary);
  font-weight: 400;
}

.breakdown-bar-track {
  width: 100%;
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.breakdown-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
  min-width: 2px;
}
</style>
