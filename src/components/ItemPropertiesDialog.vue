<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { TaskResult, Project } from "../types/boinc";
import { RESULT_STATE, ACTIVE_TASK_STATE, SCHEDULER_STATE } from "../types/boinc";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";

const props = defineProps<{
  open: boolean;
  type: "task" | "project";
  task?: TaskResult;
  project?: Project;
}>();

const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

onKeyStroke("Escape", () => {
  if (!props.open) return;
  emit("close");
});

const { t } = useI18n();

// ── Formatting helpers ──────────────────────────────────────────

function formatDate(epoch: number): string {
  if (!epoch) return t("properties.na");
  return new Date(epoch * 1000).toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds == null || seconds < 0) return "---";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatPercent(frac: number): string {
  if (frac == null) return "0%";
  return `${(frac * 100).toFixed(3)}%`;
}

function formatMegabytes(bytes: number): string {
  if (!bytes) return "0.00 MB";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCredit(val: number): string {
  if (val == null) return "0";
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function resultStateName(state: number): string {
  const map: Record<number, string> = {
    [RESULT_STATE.NEW]: t("properties.task.stateNew"),
    [RESULT_STATE.FILES_DOWNLOADING]: t("properties.task.stateDownloading"),
    [RESULT_STATE.FILES_DOWNLOADED]: t("properties.task.stateDownloaded"),
    [RESULT_STATE.COMPUTE_ERROR]: t("properties.task.stateComputeError"),
    [RESULT_STATE.FILES_UPLOADING]: t("properties.task.stateUploading"),
    [RESULT_STATE.FILES_UPLOADED]: t("properties.task.stateUploaded"),
    [RESULT_STATE.ABORTED]: t("properties.task.stateAborted"),
    [RESULT_STATE.UPLOAD_FAILED]: t("properties.task.stateUploadFailed"),
  };
  return map[state] ?? t("properties.unknown", { code: state });
}

function schedulerStateName(state: number): string {
  const map: Record<number, string> = {
    [SCHEDULER_STATE.UNINITIALIZED]: t("properties.task.schedulerUninitialized"),
    [SCHEDULER_STATE.PREEMPTED]: t("properties.task.schedulerPreempted"),
    [SCHEDULER_STATE.SCHEDULED]: t("properties.task.schedulerScheduled"),
  };
  return map[state] ?? t("properties.unknown", { code: state });
}

function activeTaskStateName(state: number): string {
  const map: Record<number, string> = {
    [ACTIVE_TASK_STATE.UNINITIALIZED]: t("properties.task.activeUninitialized"),
    [ACTIVE_TASK_STATE.EXECUTING]: t("properties.task.activeExecuting"),
    [ACTIVE_TASK_STATE.SUSPENDED]: t("properties.task.activeSuspended"),
    [ACTIVE_TASK_STATE.ABORT_PENDING]: t("properties.task.activeAbortPending"),
    [ACTIVE_TASK_STATE.QUIT_PENDING]: t("properties.task.activeQuitPending"),
    [ACTIVE_TASK_STATE.COPY_PENDING]: t("properties.task.activeCopyPending"),
  };
  return map[state] ?? t("properties.unknown", { code: state });
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
  const task = props.task;
  if (!task) return [];
  return [
    {
      title: t("properties.general"),
      rows: [
        { label: t("properties.task.name"), value: task.name },
        { label: t("properties.task.workUnit"), value: task.wu_name },
        { label: t("properties.task.projectUrl"), value: task.project_url },
        { label: t("properties.task.planClass"), value: task.plan_class || t("properties.none") },
        { label: t("properties.task.resources"), value: task.resources || t("properties.standard") },
        { label: t("properties.task.state"), value: resultStateName(task.state) },
        { label: t("properties.task.schedulerState"), value: schedulerStateName(task.scheduler_state) },
        { label: t("properties.task.activeTaskState"), value: activeTaskStateName(task.active_task_state) },
      ],
    },
    {
      title: t("properties.timing"),
      rows: [
        { label: t("properties.task.received"), value: formatDate(task.received_time) },
        { label: t("properties.task.reportDeadline"), value: formatDate(task.report_deadline) },
        { label: t("properties.task.elapsedTime"), value: formatDuration(task.elapsed_time) },
        { label: t("properties.task.remainingEst"), value: formatDuration(task.estimated_cpu_time_remaining) },
        { label: t("properties.task.currentCpuTime"), value: formatDuration(task.current_cpu_time) },
        { label: t("properties.task.checkpointCpuTime"), value: formatDuration(task.checkpoint_cpu_time) },
      ],
    },
    {
      title: t("properties.progress"),
      rows: [
        { label: t("properties.task.done"), value: formatPercent(task.fraction_done) },
        { label: t("properties.task.progressRate"), value: String(task.progress_rate) },
      ],
    },
    {
      title: t("properties.resources"),
      rows: [
        { label: t("properties.task.workingSet"), value: formatMegabytes(task.working_set_size_smoothed) },
        { label: t("properties.task.swapSize"), value: formatMegabytes(task.swap_size) },
        { label: t("properties.task.slot"), value: String(task.slot ?? "---") },
        { label: t("properties.task.pid"), value: String(task.pid ?? "---") },
        { label: t("properties.task.slotPath"), value: task.slot_path || "---" },
      ],
    },
    {
      title: t("properties.graphics"),
      rows: [
        ...(task.graphics_exec_path
          ? [{ label: t("properties.task.graphicsApp"), value: task.graphics_exec_path }]
          : []),
        ...(task.web_graphics_url
          ? [{ label: t("properties.task.webGraphics"), value: task.web_graphics_url }]
          : []),
        ...(task.remote_desktop_addr
          ? [{ label: t("properties.task.remoteDesktop"), value: task.remote_desktop_addr }]
          : []),
      ],
    },
  ].filter((section) => section.rows.length > 0);
});

const projectSections = computed<Section[]>(() => {
  const project = props.project;
  if (!project) return [];
  return [
    {
      title: t("properties.general"),
      rows: [
        { label: t("properties.project.project"), value: project.project_name },
        { label: t("properties.project.masterUrl"), value: project.master_url },
        { label: t("properties.project.user"), value: project.user_name || "---" },
        { label: t("properties.project.team"), value: project.team_name || "---" },
        { label: t("properties.project.venue"), value: project.venue || t("properties.default") },
      ],
    },
    {
      title: t("properties.credits"),
      rows: [
        { label: t("properties.project.userTotalCredit"), value: formatCredit(project.user_total_credit) },
        { label: t("properties.project.userAvgCredit"), value: formatCredit(project.user_expavg_credit) },
        { label: t("properties.project.hostTotalCredit"), value: formatCredit(project.host_total_credit) },
        { label: t("properties.project.hostAvgCredit"), value: formatCredit(project.host_expavg_credit) },
      ],
    },
    {
      title: t("properties.scheduling"),
      rows: [
        { label: t("properties.project.resourceShare"), value: String(project.resource_share) },
        { label: t("properties.project.priority"), value: String(project.sched_priority) },
        { label: t("properties.project.durationCorrection"), value: String(project.duration_correction_factor) },
      ],
    },
    {
      title: t("properties.network"),
      rows: [
        { label: t("properties.project.rpcFailures"), value: String(project.nrpc_failures) },
        { label: t("properties.project.minRpcTime"), value: formatDate(project.min_rpc_time) },
        { label: t("properties.project.lastRpcTime"), value: formatDate(project.last_rpc_time) },
        { label: t("properties.project.downloadBackoff"), value: `${project.download_backoff}s` },
        { label: t("properties.project.uploadBackoff"), value: `${project.upload_backoff}s` },
      ],
    },
    {
      title: t("properties.status"),
      rows: [
        { label: t("properties.project.suspended"), value: project.suspended_via_gui ? t("properties.yes") : t("properties.no") },
        { label: t("properties.project.noNewTasks"), value: project.dont_request_more_work ? t("properties.yes") : t("properties.no") },
        { label: t("properties.project.attachedViaMgr"), value: project.attached_via_acct_mgr ? t("properties.yes") : t("properties.no") },
        { label: t("properties.project.jobsSucceeded"), value: String(project.njobs_success) },
        { label: t("properties.project.jobsFailed"), value: String(project.njobs_error) },
        { label: t("properties.project.diskUsage"), value: formatMegabytes(project.disk_usage) },
      ],
    },
  ];
});

const sections = computed(() =>
  props.type === "task" ? taskSections.value : projectSections.value,
);

const dialogTitle = computed(() =>
  props.type === "task"
    ? props.task?.name ?? t("properties.taskProperties")
    : props.project?.project_name ?? t("properties.projectProperties"),
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
      <div ref="dialogRef" class="props-dialog" role="dialog" aria-modal="true" aria-labelledby="item-properties-dialog-title">
        <div class="props-header">
          <h3 id="item-properties-dialog-title">{{ dialogTitle }}</h3>
          <button class="close-btn" aria-label="Close" @click="emit('close')">&times;</button>
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
            <div class="section-title">{{ $t('properties.webLinks') }}</div>
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
          <button class="btn" @click="copyAll">{{ $t('properties.copyAll') }}</button>
          <button class="btn btn-primary" @click="emit('close')">{{ $t('properties.close') }}</button>
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
  z-index: var(--z-modal);
  backdrop-filter: blur(2px);
}

.props-dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(560px, 95vw);
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
