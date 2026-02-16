<script setup lang="ts">
import { computed } from "vue";
import type { TaskResult, Project } from "../types/boinc";
import { RESULT_STATE, ACTIVE_TASK_STATE, SCHEDULER_STATE } from "../types/boinc";

const props = defineProps<{
  open: boolean;
  type: "task" | "project";
  task?: TaskResult;
  project?: Project;
}>();

const emit = defineEmits<{ close: [] }>();

// ── Formatting helpers ──────────────────────────────────────────

function formatDate(epoch: number): string {
  if (!epoch) return "N/A";
  return new Date(epoch * 1000).toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds == null || seconds < 0) return "---";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPct(frac: number): string {
  if (frac == null) return "0%";
  return `${(frac * 100).toFixed(3)}%`;
}

function formatMB(bytes: number): string {
  if (!bytes) return "0.00 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCredit(val: number): string {
  if (val == null) return "0";
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function resultStateName(state: number): string {
  const map: Record<number, string> = {
    [RESULT_STATE.NEW]: "New",
    [RESULT_STATE.FILES_DOWNLOADING]: "Downloading",
    [RESULT_STATE.FILES_DOWNLOADED]: "Downloaded",
    [RESULT_STATE.COMPUTE_ERROR]: "Compute error",
    [RESULT_STATE.FILES_UPLOADING]: "Uploading",
    [RESULT_STATE.FILES_UPLOADED]: "Uploaded",
    [RESULT_STATE.ABORTED]: "Aborted",
    [RESULT_STATE.UPLOAD_FAILED]: "Upload failed",
  };
  return map[state] ?? `Unknown (${state})`;
}

function schedulerStateName(state: number): string {
  const map: Record<number, string> = {
    [SCHEDULER_STATE.UNINITIALIZED]: "Uninitialized",
    [SCHEDULER_STATE.PREEMPTED]: "Preempted",
    [SCHEDULER_STATE.SCHEDULED]: "Scheduled",
  };
  return map[state] ?? `Unknown (${state})`;
}

function activeTaskStateName(state: number): string {
  const map: Record<number, string> = {
    [ACTIVE_TASK_STATE.UNINITIALIZED]: "Uninitialized",
    [ACTIVE_TASK_STATE.EXECUTING]: "Executing",
    [ACTIVE_TASK_STATE.SUSPENDED]: "Suspended",
    [ACTIVE_TASK_STATE.ABORT_PENDING]: "Abort pending",
    [ACTIVE_TASK_STATE.QUIT_PENDING]: "Quit pending",
    [ACTIVE_TASK_STATE.COPY_PENDING]: "Copy pending",
  };
  return map[state] ?? `Unknown (${state})`;
}

// ── Section definitions ─────────────────────────────────────────

interface PropRow {
  label: string;
  value: string;
}

interface Section {
  title: string;
  rows: PropRow[];
}

const taskSections = computed<Section[]>(() => {
  const t = props.task;
  if (!t) return [];
  return [
    {
      title: "General",
      rows: [
        { label: "Name", value: t.name },
        { label: "Work unit", value: t.wu_name },
        { label: "Project URL", value: t.project_url },
        { label: "Plan class", value: t.plan_class || "(none)" },
        { label: "Resources", value: t.resources || "(standard)" },
        { label: "State", value: resultStateName(t.state) },
        { label: "Scheduler state", value: schedulerStateName(t.scheduler_state) },
        { label: "Active task state", value: activeTaskStateName(t.active_task_state) },
      ],
    },
    {
      title: "Timing",
      rows: [
        { label: "Received", value: formatDate(t.received_time) },
        { label: "Report deadline", value: formatDate(t.report_deadline) },
        { label: "Elapsed time", value: formatDuration(t.elapsed_time) },
        { label: "Remaining (est.)", value: formatDuration(t.estimated_cpu_time_remaining) },
        { label: "Current CPU time", value: formatDuration(t.current_cpu_time) },
        { label: "Checkpoint CPU time", value: formatDuration(t.checkpoint_cpu_time) },
      ],
    },
    {
      title: "Progress",
      rows: [
        { label: "Done", value: formatPct(t.fraction_done) },
        { label: "Progress rate", value: String(t.progress_rate) },
      ],
    },
    {
      title: "Resources",
      rows: [
        { label: "Working set", value: formatMB(t.working_set_size_smoothed) },
        { label: "Swap size", value: formatMB(t.swap_size) },
        { label: "Slot", value: String(t.slot ?? "---") },
        { label: "PID", value: String(t.pid ?? "---") },
        { label: "Slot path", value: t.slot_path || "---" },
      ],
    },
    {
      title: "Graphics",
      rows: [
        ...(t.graphics_exec_path
          ? [{ label: "Graphics app", value: t.graphics_exec_path }]
          : []),
        ...(t.web_graphics_url
          ? [{ label: "Web graphics", value: t.web_graphics_url }]
          : []),
        ...(t.remote_desktop_addr
          ? [{ label: "Remote desktop", value: t.remote_desktop_addr }]
          : []),
      ],
    },
  ].filter((s) => s.rows.length > 0);
});

const projectSections = computed<Section[]>(() => {
  const p = props.project;
  if (!p) return [];
  return [
    {
      title: "General",
      rows: [
        { label: "Project", value: p.project_name },
        { label: "Master URL", value: p.master_url },
        { label: "User", value: p.user_name || "---" },
        { label: "Team", value: p.team_name || "---" },
        { label: "Venue", value: p.venue || "(default)" },
      ],
    },
    {
      title: "Credits",
      rows: [
        { label: "User total credit", value: formatCredit(p.user_total_credit) },
        { label: "User avg credit", value: formatCredit(p.user_expavg_credit) },
        { label: "Host total credit", value: formatCredit(p.host_total_credit) },
        { label: "Host avg credit", value: formatCredit(p.host_expavg_credit) },
      ],
    },
    {
      title: "Scheduling",
      rows: [
        { label: "Resource share", value: String(p.resource_share) },
        { label: "Priority", value: String(p.sched_priority) },
        { label: "Duration correction", value: String(p.duration_correction_factor) },
      ],
    },
    {
      title: "Network",
      rows: [
        { label: "RPC failures", value: String(p.nrpc_failures) },
        { label: "Min RPC time", value: formatDate(p.min_rpc_time) },
        { label: "Last RPC time", value: formatDate(p.last_rpc_time) },
        { label: "Download backoff", value: `${p.download_backoff}s` },
        { label: "Upload backoff", value: `${p.upload_backoff}s` },
      ],
    },
    {
      title: "Status",
      rows: [
        { label: "Suspended", value: p.suspended_via_gui ? "Yes" : "No" },
        { label: "No new tasks", value: p.dont_request_more_work ? "Yes" : "No" },
        { label: "Jobs succeeded", value: String(p.njobs_success) },
        { label: "Jobs failed", value: String(p.njobs_error) },
        { label: "Disk usage", value: formatMB(p.disk_usage) },
      ],
    },
  ];
});

const sections = computed(() =>
  props.type === "task" ? taskSections.value : projectSections.value,
);

const dialogTitle = computed(() =>
  props.type === "task"
    ? props.task?.name ?? "Task Properties"
    : props.project?.project_name ?? "Project Properties",
);

const guiUrls = computed(() =>
  props.type === "project" ? props.project?.gui_urls ?? [] : [],
);

// ── Copy all ────────────────────────────────────────────────────

function copyAll() {
  const lines: string[] = [];
  for (const section of sections.value) {
    lines.push(`[${section.title}]`);
    for (const row of section.rows) {
      lines.push(`  ${row.label}: ${row.value}`);
    }
    lines.push("");
  }
  if (guiUrls.value.length > 0) {
    lines.push("[Web Links]");
    for (const gu of guiUrls.value) {
      lines.push(`  ${gu.name}: ${gu.url}`);
      if (gu.description) {
        lines.push(`    ${gu.description}`);
      }
    }
    lines.push("");
  }
  navigator.clipboard.writeText(lines.join("\n"));
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="emit('close')">
      <div class="props-dialog">
        <div class="props-header">
          <h3>{{ dialogTitle }}</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div class="props-body">
          <div v-for="section in sections" :key="section.title" class="props-section">
            <div class="section-title">{{ section.title }}</div>
            <div class="section-rows">
              <div v-for="row in section.rows" :key="row.label" class="prop-row">
                <span class="prop-label">{{ row.label }}</span>
                <span class="prop-value">{{ row.value }}</span>
              </div>
            </div>
          </div>

          <!-- GUI URLs (project only) -->
          <div v-if="guiUrls.length > 0" class="props-section">
            <div class="section-title">Web Links</div>
            <div class="section-rows">
              <div v-for="gu in guiUrls" :key="gu.url" class="gui-url-row">
                <div class="gui-url-name">{{ gu.name }}</div>
                <div v-if="gu.description" class="gui-url-desc">{{ gu.description }}</div>
                <a :href="gu.url" target="_blank" rel="noopener" class="gui-url-link">
                  {{ gu.url }}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="props-footer">
          <button class="btn" @click="copyAll">Copy All</button>
          <button class="btn btn-primary" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.props-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.props-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.props-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: var(--space-md);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.props-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 16px;
}

.props-section {
  margin-bottom: var(--space-md);
}

.props-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
  margin-bottom: 2px;
}

.section-rows {
  display: flex;
  flex-direction: column;
}

.prop-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-light);
  gap: var(--space-md);
}

.prop-row:last-child {
  border-bottom: none;
}

.prop-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.prop-value {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-all;
  min-width: 0;
}

.gui-url-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.gui-url-row:last-child {
  border-bottom: none;
}

.gui-url-name {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  font-weight: 500;
}

.gui-url-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.gui-url-link {
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  text-decoration: none;
  margin-top: 2px;
  display: inline-block;
  word-break: break-all;
}

.gui-url-link:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}

.props-footer {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
</style>
