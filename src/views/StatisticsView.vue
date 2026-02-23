<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useStatisticsStore } from "../stores/statistics";
import { useProjectsStore } from "../stores/projects";
import type { DailyStats } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import StatisticsChart from "../components/StatisticsChart.vue";

const store = useStatisticsStore();
const projectsStore = useProjectsStore();

type ViewMode = "single" | "all" | "separate" | "total";

const viewMode = ref<ViewMode>("single");
const selectedProjectUrl = ref("");

const seriesConfig = [
  { key: "user_total_credit" as const, label: "User Total", color: "#3b82f6" },
  { key: "user_expavg_credit" as const, label: "User Avg", color: "#8b5cf6" },
  { key: "host_total_credit" as const, label: "Host Total", color: "#10b981" },
  { key: "host_expavg_credit" as const, label: "Host Avg", color: "#f59e0b" },
];

const enabledSeries = ref<Set<string>>(new Set(seriesConfig.map((s) => s.key)));

function toggleSeries(key: string) {
  const next = new Set(enabledSeries.value);
  if (next.has(key)) {
    if (next.size > 1) next.delete(key);
  } else {
    next.add(key);
  }
  enabledSeries.value = next;
}

function hasRecentActivity(stats: DailyStats[]): boolean {
  if (stats.length < 2) return false;
  const first = stats[0];
  const last = stats[stats.length - 1];
  return (
    last.user_total_credit > first.user_total_credit ||
    last.host_total_credit > first.host_total_credit
  );
}

const projectOptions = computed(() =>
  store.projectStats
    .filter((p) => hasRecentActivity(p.daily_statistics))
    .map((p) => {
      const project = projectsStore.projects.find((proj) => proj.master_url === p.master_url);
      return {
        url: p.master_url,
        label: project?.project_name || p.master_url,
      };
    }),
);

const activeProject = computed(() => {
  if (!selectedProjectUrl.value && projectOptions.value.length > 0) {
    selectedProjectUrl.value = projectOptions.value[0].url;
  }
  return store.projectStats.find((p) => p.master_url === selectedProjectUrl.value);
});

function mergeAllProjects(): DailyStats[] {
  const dayMap = new Map<number, DailyStats>();
  for (const project of store.projectStats) {
    for (const ds of project.daily_statistics) {
      const existing = dayMap.get(ds.day);
      if (existing) {
        existing.user_total_credit += ds.user_total_credit;
        existing.user_expavg_credit += ds.user_expavg_credit;
        existing.host_total_credit += ds.host_total_credit;
        existing.host_expavg_credit += ds.host_expavg_credit;
      } else {
        dayMap.set(ds.day, { ...ds });
      }
    }
  }
  return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
}

const chartData = computed(() => {
  if (store.projectStats.length === 0) return null;

  if (viewMode.value === "single") {
    if (!activeProject.value) return null;
    const stats = activeProject.value.daily_statistics;
    return stats.length === 0 ? null : stats;
  } else if (viewMode.value === "all" || viewMode.value === "total") {
    const stats = mergeAllProjects();
    return stats.length === 0 ? null : stats;
  }

  // "separate" mode is handled differently — returns null here
  return null;
});

const separateCharts = computed(() => {
  if (viewMode.value !== "separate") return [];
  return store.projectStats
    .filter((p) => p.daily_statistics.length > 0)
    .map((p) => ({
      url: p.master_url,
      data: [...p.daily_statistics].sort((a, b) => a.day - b.day),
    }));
});

onMounted(() => {
  store.fetchStatistics();
});

onUnmounted(() => {
  // nothing to clean up
});
</script>

<template>
  <div class="statistics-view">
    <PageHeader title="Statistics" />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <div v-if="store.loading && store.projectStats.length === 0" class="loading-text">
      Loading statistics...
    </div>

    <EmptyState
      v-else-if="store.projectStats.length === 0 && !store.loading"
      icon="&#x1f4ca;"
      message="No statistics available yet. Attach a project and compute to see data."
    />

    <template v-else>
      <!-- Segmented control -->
      <div class="segmented-control">
        <button
          :class="['segment', { active: viewMode === 'single' }]"
          @click="viewMode = 'single'"
        >
          Single Project
        </button>
        <button
          :class="['segment', { active: viewMode === 'all' }]"
          @click="viewMode = 'all'"
        >
          All Together
        </button>
        <button
          :class="['segment', { active: viewMode === 'separate' }]"
          @click="viewMode = 'separate'"
        >
          All Separate
        </button>
        <button
          :class="['segment', { active: viewMode === 'total' }]"
          @click="viewMode = 'total'"
        >
          Total
        </button>
      </div>

      <!-- Project picker -->
      <div v-if="viewMode === 'single'" class="project-picker">
        <label class="picker-label">Project</label>
        <select v-model="selectedProjectUrl" class="picker-select">
          <option v-for="opt in projectOptions" :key="opt.url" :value="opt.url">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Series toggles -->
      <div class="series-toggles">
        <label
          v-for="s in seriesConfig"
          :key="s.key"
          class="series-toggle"
        >
          <input
            type="checkbox"
            :checked="enabledSeries.has(s.key)"
            @change="toggleSeries(s.key)"
          />
          <span class="series-swatch" :style="{ background: s.color }"></span>
          <span class="series-label">{{ s.label }}</span>
        </label>
      </div>

      <!-- Single chart for single/all/total modes -->
      <StatisticsChart
        v-if="chartData && viewMode !== 'separate'"
        :data="chartData"
        :enabled-series="enabledSeries"
      />

      <!-- Separate charts: one per project -->
      <div v-if="viewMode === 'separate'" class="separate-charts">
        <StatisticsChart
          v-for="chart in separateCharts"
          :key="chart.url"
          :data="chart.data"
          :title="chart.url"
          :enabled-series="enabledSeries"
        />
        <EmptyState
          v-if="separateCharts.length === 0"
          icon="&#x1f4ca;"
          message="No project statistics to display."
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.statistics-view {
  padding: var(--space-lg);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  padding: var(--space-xl) 0;
}

.segmented-control {
  display: inline-flex;
  flex-wrap: wrap;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
  margin-bottom: var(--space-lg);
}

.segment {
  padding: 6px 16px;
  border: none;
  background: transparent;
  font-size: var(--font-size-md);
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

.project-picker {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.picker-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.picker-select {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  min-width: min(280px, 60vw);
  outline: none;
  transition: border-color var(--transition-fast);
}

.picker-select:focus {
  border-color: var(--color-accent);
}

.series-toggles {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.series-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.series-toggle input {
  display: none;
}

.series-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.series-label {
  font-weight: 500;
}

.series-toggle:has(input:not(:checked)) .series-swatch {
  opacity: 0.3;
}

.series-toggle:has(input:not(:checked)) .series-label {
  opacity: 0.5;
  text-decoration: line-through;
}

.separate-charts {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
</style>
