<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { DailyStats } from "../types/boinc";

const props = defineProps<{
  data: DailyStats[];
  title?: string;
  enabledSeries: Set<string>;
  height?: number;
}>();

const containerRef = ref<HTMLElement | null>(null);
const measuredWidth = ref(700);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    measuredWidth.value = containerRef.value.clientWidth;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measuredWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

const seriesConfig = [
  { key: "user_total_credit" as const, label: "User Total", color: "#3b82f6" },
  { key: "user_expavg_credit" as const, label: "User Avg", color: "#8b5cf6" },
  { key: "host_total_credit" as const, label: "Host Total", color: "#10b981" },
  { key: "host_expavg_credit" as const, label: "Host Avg", color: "#f59e0b" },
];

const hoveredPoint = ref<{
  x: number;
  y: number;
  label: string;
  value: number;
} | null>(null);

const svgWidth = computed(() => measuredWidth.value);
const svgHeight = computed(() => props.height ?? 340);
const PADDING = { top: 20, right: 20, bottom: 50, left: 70 };

const chartW = computed(() => svgWidth.value - PADDING.left - PADDING.right);
const chartH = computed(() => svgHeight.value - PADDING.top - PADDING.bottom);

function dayToDate(day: number): Date {
  return new Date(day * 1000);
}

function formatDateShort(day: number): string {
  const d = dayToDate(day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const yMax = computed(() => {
  let max = 0;
  for (const ds of props.data) {
    for (const s of seriesConfig) {
      if (props.enabledSeries.has(s.key)) {
        max = Math.max(max, ds[s.key]);
      }
    }
  }
  return max > 0 ? max : 1;
});

const xRange = computed(() => {
  if (props.data.length === 0) return { min: 0, max: 1 };
  const days = props.data.map((d) => d.day);
  const min = Math.min(...days);
  const max = Math.max(...days);
  return { min, max: max === min ? min + 1 : max };
});

function scaleX(day: number): number {
  const range = xRange.value;
  return PADDING.left + ((day - range.min) / (range.max - range.min)) * chartW.value;
}

function scaleY(value: number): number {
  return PADDING.top + chartH.value - (value / yMax.value) * chartH.value;
}

function polylinePoints(key: keyof DailyStats): string {
  return props.data
    .map((ds) => `${scaleX(ds.day)},${scaleY(ds[key] as number)}`)
    .join(" ");
}

const xTicks = computed(() => {
  if (props.data.length === 0) return [];
  const days = props.data.map((d) => d.day);
  const count = Math.min(days.length, 8);
  const step = Math.max(1, Math.floor(days.length / count));
  const ticks: number[] = [];
  for (let i = 0; i < days.length; i += step) {
    ticks.push(days[i]);
  }
  return ticks;
});

const yTicks = computed(() => {
  const max = yMax.value;
  const ticks: number[] = [];
  const step = max / 5;
  for (let i = 0; i <= 5; i++) {
    ticks.push(step * i);
  }
  return ticks;
});

function formatCredit(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function handleChartMouseMove(event: MouseEvent) {
  if (props.data.length === 0) return;
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;

  let closest: DailyStats | null = null;
  let closestDist = Infinity;
  for (const ds of props.data) {
    const sx = scaleX(ds.day);
    const dist = Math.abs(sx - mouseX);
    if (dist < closestDist) {
      closestDist = dist;
      closest = ds;
    }
  }

  if (closest && closestDist < 30) {
    let bestKey = "";
    let bestVal = 0;
    for (const s of seriesConfig) {
      if (props.enabledSeries.has(s.key)) {
        const val = closest[s.key];
        if (val > bestVal) {
          bestVal = val;
          bestKey = s.label;
        }
      }
    }
    hoveredPoint.value = {
      x: scaleX(closest.day),
      y: scaleY(bestVal),
      label: `${formatDateShort(closest.day)} - ${bestKey}: ${formatCredit(bestVal)}`,
      value: bestVal,
    };
  } else {
    hoveredPoint.value = null;
  }
}

function handleChartMouseLeave() {
  hoveredPoint.value = null;
}

const activeSeries = computed(() =>
  seriesConfig.filter((sc) => props.enabledSeries.has(sc.key)),
);
</script>

<template>
  <div class="chart-wrapper">
    <h3 v-if="title" class="chart-title">{{ title }}</h3>
    <div ref="containerRef" class="chart-container">
      <svg
        :width="svgWidth"
        :height="svgHeight"
        class="chart-svg"
        @mousemove="handleChartMouseMove"
        @mouseleave="handleChartMouseLeave"
      >
        <!-- Grid lines -->
        <line
          v-for="tick in yTicks"
          :key="'yg-' + tick"
          :x1="PADDING.left"
          :y1="scaleY(tick)"
          :x2="svgWidth - PADDING.right"
          :y2="scaleY(tick)"
          class="grid-line"
        />

        <!-- Y axis labels -->
        <text
          v-for="tick in yTicks"
          :key="'yl-' + tick"
          :x="PADDING.left - 8"
          :y="scaleY(tick) + 4"
          class="axis-label axis-label-y"
        >
          {{ formatCredit(tick) }}
        </text>

        <!-- X axis labels -->
        <text
          v-for="tick in xTicks"
          :key="'xl-' + tick"
          :x="scaleX(tick)"
          :y="svgHeight - PADDING.bottom + 20"
          class="axis-label axis-label-x"
        >
          {{ formatDateShort(tick) }}
        </text>

        <!-- Axis lines -->
        <line
          :x1="PADDING.left"
          :y1="PADDING.top"
          :x2="PADDING.left"
          :y2="PADDING.top + chartH"
          class="axis-line"
        />
        <line
          :x1="PADDING.left"
          :y1="PADDING.top + chartH"
          :x2="svgWidth - PADDING.right"
          :y2="PADDING.top + chartH"
          class="axis-line"
        />

        <!-- Data series -->
        <template v-if="data.length > 1">
          <polyline
            v-for="s in activeSeries"
            :key="s.key"
            :points="polylinePoints(s.key as keyof DailyStats)"
            fill="none"
            :stroke="s.color"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </template>

        <!-- Single point indicator -->
        <template v-if="data.length === 1">
          <circle
            v-for="s in activeSeries"
            :key="'dot-' + s.key"
            :cx="scaleX(data[0].day)"
            :cy="scaleY(data[0][s.key as keyof DailyStats] as number)"
            r="4"
            :fill="s.color"
          />
        </template>

        <!-- Hover indicator -->
        <template v-if="hoveredPoint">
          <line
            :x1="hoveredPoint.x"
            :y1="PADDING.top"
            :x2="hoveredPoint.x"
            :y2="PADDING.top + chartH"
            stroke="var(--color-text-tertiary)"
            stroke-width="1"
            stroke-dasharray="4 2"
          />
          <circle
            :cx="hoveredPoint.x"
            :cy="hoveredPoint.y"
            r="5"
            fill="var(--color-accent)"
            stroke="white"
            stroke-width="2"
          />
        </template>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="hoveredPoint"
        class="chart-tooltip"
        :style="{
          left: hoveredPoint.x + 'px',
          top: hoveredPoint.y - 10 + 'px',
        }"
      >
        {{ hoveredPoint.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  margin-bottom: var(--space-lg);
}

.chart-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.chart-container {
  position: relative;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.chart-svg {
  display: block;
}

.grid-line {
  stroke: var(--color-border-light);
  stroke-width: 1;
}

.axis-line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis-label {
  font-size: 10px;
  fill: var(--color-text-tertiary);
}

.axis-label-y {
  text-anchor: end;
}

.axis-label-x {
  text-anchor: middle;
}

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--color-text-primary);
  color: var(--color-bg);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
</style>
