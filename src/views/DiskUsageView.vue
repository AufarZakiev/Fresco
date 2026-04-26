<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useDiskUsageStore } from "../stores/diskUsage";
import { useProjectsStore } from "../stores/projects";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";

const store = useDiskUsageStore();
const projectsStore = useProjectsStore();

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

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function getColor(index: number): string {
  return projectColors[index % projectColors.length];
}

const projectNameByUrl = computed(() => {
  const map = new Map<string, string>();
  for (const p of projectsStore.projects) {
    map.set(p.master_url, p.project_name);
  }
  return map;
});

function projectName(url: string): string {
  return projectNameByUrl.value.get(url) || url;
}

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

const totalProjectUsage = computed(() => {
  return store.usage.projects.reduce((sum, p) => sum + p.disk_usage, 0);
});

const boincPieSegments = computed(() => {
  const total = totalProjectUsage.value;
  if (total <= 0) return [];

  return store.usage.projects.map((p, i) => ({
    label: projectName(p.master_url),
    value: p.disk_usage,
    fraction: p.disk_usage / total,
    color: getColor(i),
  }));
});

const boincDoughnutPaths = computed(() => {
  const cx = 120;
  const cy = 120;
  const outerR = 110;
  const innerR = 70;
  const paths: { d: string; color: string; label: string }[] = [];

  let currentAngle = -Math.PI / 2;

  for (const seg of boincPieSegments.value) {
    if (seg.fraction <= 0) continue;
    const sweepAngle = seg.fraction * Math.PI * 2;
    paths.push({
      d: doughnutPath(
        cx,
        cy,
        outerR,
        innerR,
        currentAngle,
        currentAngle + sweepAngle,
      ),
      color: seg.color,
      label: `${seg.label}: ${formatBytes(seg.value)}`,
    });
    currentAngle += sweepAngle;
  }

  return paths;
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
    <PageHeader />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <div v-if="store.loading && store.usage.d_total === 0" class="loading-text">
      {{ $t("disk.loading") }}
    </div>

    <EmptyState
      v-else-if="store.usage.d_total === 0 && !store.loading"
      icon="&#x1f4be;"
      :message="$t('disk.empty')"
    />

    <template v-else>
      <div class="content-layout">
        <!-- BOINC Usage by Project (left on wide screens) -->
        <div class="breakdown-section">
          <h3 class="section-title">{{ $t("disk.boincByProject") }}</h3>
          <div class="boinc-chart-card">
            <svg
              role="img"
              :aria-label="$t('disk.chartLabel')"
              width="240"
              height="240"
              viewBox="0 0 240 240"
              class="doughnut-svg"
            >
              <path
                v-for="(seg, i) in boincDoughnutPaths"
                :key="i"
                :d="seg.d"
                :fill="seg.color"
                stroke="var(--color-bg)"
                stroke-width="2"
              >
                <title>{{ seg.label }}</title>
              </path>
              <text x="120" y="114" class="center-label" text-anchor="middle">
                {{ $t("disk.chartTotal") }}
              </text>
              <text x="120" y="134" class="center-value" text-anchor="middle">
                {{ formatBytes(totalProjectUsage) }}
              </text>
            </svg>

            <div class="legend">
              <div
                v-for="(seg, i) in boincPieSegments"
                :key="i"
                class="legend-item"
              >
                <span
                  class="legend-swatch"
                  :style="{ background: seg.color }"
                ></span>
                <span class="legend-label">{{ seg.label }}</span>
                <span class="legend-value">
                  {{ formatBytes(seg.value) }}
                  <span class="legend-pct"
                    >({{ formatPercent(seg.fraction) }})</span
                  >
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Cards (right on wide screens) -->
        <div class="summary-cards">
          <div class="summary-card">
            <span class="summary-label">{{ $t("disk.totalDisk") }}</span>
            <span class="summary-value">{{
              formatBytes(store.usage.d_total)
            }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ $t("disk.boincUsage") }}</span>
            <span class="summary-value">{{
              formatBytes(totalProjectUsage)
            }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ $t("disk.freeSpace") }}</span>
            <span class="summary-value">{{
              formatBytes(store.usage.d_free)
            }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">{{ $t("disk.allowed") }}</span>
            <span class="summary-value">{{
              formatBytes(store.usage.d_allowed)
            }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.disk-usage-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto;
  padding: 0 var(--space-lg) var(--space-lg);
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

.content-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(350px, 100%), 1fr));
  gap: var(--space-xl);
  align-items: start;
}

.doughnut-svg {
  flex-shrink: 0;
  max-width: 240px;
  width: 100%;
  height: auto;
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
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
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

.boinc-chart-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.legend-pct {
  color: var(--color-text-tertiary);
  font-weight: 400;
}
</style>
