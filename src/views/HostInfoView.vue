<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getHostInfo } from "../composables/useRpc";
import type { Coproc, HostInfo } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";

const hostInfo = ref<HostInfo | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

function formatGB(bytes: number): string {
  if (bytes <= 0) return "0.0 GB";
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function formatMB(bytes: number): string {
  if (bytes <= 0) return "0.0 MB";
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

function formatGFLOPS(flops: number): string {
  if (flops <= 0) return "---";
  return `${(flops / 1e9).toFixed(2)} GFLOPS`;
}

function formatGIOPS(iops: number): string {
  if (iops <= 0) return "---";
  return `${(iops / 1e9).toFixed(2)} GIOPS`;
}

function formatCudaVersion(v: number): string {
  if (v <= 0) return "";
  const major = Math.floor(v / 1000);
  const minor = Math.floor((v % 1000) / 10);
  return minor > 0 ? `${major}.${minor}` : `${major}.0`;
}

/** Deduplicate CUDA + OpenCL entries for the same GPU. Prefer CUDA, merge OpenCL-only fields. */
const mergedGpus = computed(() => {
  if (!hostInfo.value) return [];
  const coprocs = hostInfo.value.coprocs;
  const cudaEntries = coprocs.filter((c) => c.coproc_type === "CUDA");
  const openclEntries = coprocs.filter((c) => c.coproc_type === "OpenCL");

  if (cudaEntries.length === 0) return openclEntries;

  return cudaEntries.map((cuda) => {
    // Find matching OpenCL entry by name similarity
    const ocl = openclEntries.find(
      (o) =>
        o.name === cuda.name ||
        cuda.name.includes(o.name) ||
        o.name.includes(cuda.name),
    );
    if (!ocl) return cuda;
    // Merge OpenCL-only fields into the CUDA entry
    const merged: Coproc = { ...cuda };
    if (!merged.vendor && ocl.vendor) merged.vendor = ocl.vendor;
    if (!merged.opencl_device_version && ocl.opencl_device_version)
      merged.opencl_device_version = ocl.opencl_device_version;
    if (!merged.opencl_driver_version && ocl.opencl_driver_version)
      merged.opencl_driver_version = ocl.opencl_driver_version;
    if (merged.available_ram <= 0 && ocl.available_ram > 0)
      merged.available_ram = ocl.available_ram;
    if (merged.peak_flops <= 0 && ocl.peak_flops > 0)
      merged.peak_flops = ocl.peak_flops;
    return merged;
  });
});

const budaRunner = computed(() => {
  if (!hostInfo.value) return null;
  return hostInfo.value.wsl_distros.find((d) => d.is_buda_runner) ?? null;
});

const wslExpanded = ref(false);

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    hostInfo.value = await getHostInfo();
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="host-info-view">
    <PageHeader />

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="loading" class="loading-text">
      {{ $t("host.loading") }}
    </div>

    <template v-else-if="hostInfo">
      <div class="cards-grid">
        <!-- System -->
        <div class="info-card">
          <h3 class="card-title">{{ $t("host.system") }}</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.hostname") }}</span>
              <span class="info-value">{{
                hostInfo.domain_name || "---"
              }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.ipAddress") }}</span>
              <span class="info-value">{{ hostInfo.ip_addr || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.operatingSystem") }}</span>
              <span class="info-value">{{ hostInfo.os_name || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.osVersion") }}</span>
              <span class="info-value">{{ hostInfo.os_version || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.product") }}</span>
              <span class="info-value">{{
                hostInfo.product_name || "---"
              }}</span>
            </div>
          </div>
        </div>

        <!-- Processor -->
        <div class="info-card">
          <h3 class="card-title">{{ $t("host.processor") }}</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.cpuCores") }}</span>
              <span class="info-value">{{ hostInfo.p_ncpus }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.vendor") }}</span>
              <span class="info-value">{{ hostInfo.p_vendor || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.model") }}</span>
              <span class="info-value">{{ hostInfo.p_model || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.floatingPoint") }}</span>
              <span class="info-value">{{
                formatGFLOPS(hostInfo.p_fpops)
              }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.integerOps") }}</span>
              <span class="info-value">{{ formatGIOPS(hostInfo.p_iops) }}</span>
            </div>
          </div>
        </div>

        <!-- GPU (one card per merged GPU) -->
        <div v-for="(gpu, i) in mergedGpus" :key="i" class="info-card">
          <h3 class="card-title">
            {{ $t("host.gpu") }}{{ mergedGpus.length > 1 ? ` ${i + 1}` : "" }}
          </h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.gpuName") }}</span>
              <span class="info-value">{{ gpu.name || "---" }}</span>
            </div>
            <div v-if="gpu.vendor" class="info-row">
              <span class="info-label">{{ $t("host.gpuVendor") }}</span>
              <span class="info-value">{{ gpu.vendor }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.vram") }}</span>
              <span class="info-value">{{ formatGB(gpu.available_ram) }}</span>
            </div>
            <div v-if="gpu.driver_version" class="info-row">
              <span class="info-label">{{ $t("host.driverVersion") }}</span>
              <span class="info-value">{{ gpu.driver_version }}</span>
            </div>
            <div v-if="gpu.cuda_version > 0" class="info-row">
              <span class="info-label">{{ $t("host.cudaVersion") }}</span>
              <span class="info-value">{{
                formatCudaVersion(gpu.cuda_version)
              }}</span>
            </div>
            <div v-if="gpu.compute_cap_major > 0" class="info-row">
              <span class="info-label">{{ $t("host.computeCapability") }}</span>
              <span class="info-value"
                >{{ gpu.compute_cap_major }}.{{ gpu.compute_cap_minor }}</span
              >
            </div>
            <div v-if="gpu.opencl_device_version" class="info-row">
              <span class="info-label">{{ $t("host.openclVersion") }}</span>
              <span class="info-value">{{ gpu.opencl_device_version }}</span>
            </div>
          </div>
        </div>

        <!-- Memory -->
        <div class="info-card">
          <h3 class="card-title">{{ $t("host.memory") }}</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.physicalMemory") }}</span>
              <span class="info-value">{{ formatGB(hostInfo.m_nbytes) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.cache") }}</span>
              <span class="info-value">{{ formatMB(hostInfo.m_cache) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.swapSpace") }}</span>
              <span class="info-value">{{ formatGB(hostInfo.m_swap) }}</span>
            </div>
          </div>
        </div>

        <!-- Disk -->
        <div class="info-card">
          <h3 class="card-title">{{ $t("host.disk") }}</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.totalDisk") }}</span>
              <span class="info-value">{{ formatGB(hostInfo.d_total) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.freeDisk") }}</span>
              <span class="info-value">{{ formatGB(hostInfo.d_free) }}</span>
            </div>
          </div>
        </div>

        <!-- Virtualization -->
        <div class="info-card">
          <h3 class="card-title">{{ $t("host.virtualization") }}</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">{{ $t("host.virtualbox") }}</span>
              <span class="info-value">
                {{ hostInfo.virtualbox_version || $t("host.notInstalled") }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ $t("host.vmExtensions") }}</span>
              <span class="info-value">
                {{
                  hostInfo.p_vm_extensions_disabled
                    ? $t("host.vmDisabled")
                    : $t("host.vmEnabled")
                }}
              </span>
            </div>
            <div
              class="info-row wsl-header"
              :class="{ clickable: !!budaRunner }"
              @click="budaRunner && (wslExpanded = !wslExpanded)"
            >
              <span class="info-label">
                <span v-if="budaRunner" class="expand-icon">{{
                  wslExpanded ? "\u25BE" : "\u25B8"
                }}</span>
                {{ $t("host.wslBuda") }}
              </span>
              <span v-if="budaRunner" class="info-value">{{
                $t("host.installed")
              }}</span>
              <a
                v-else
                class="install-btn"
                href="https://github.com/BOINC/boinc/wiki/Installing-Docker-on-Windows"
                target="_blank"
                rel="noopener"
                @click.stop
                >{{ $t("host.install") }}</a
              >
            </div>
            <template v-if="budaRunner && wslExpanded">
              <div class="info-row sub-row">
                <span class="info-label">{{ $t("host.distro") }}</span>
                <span class="info-value">{{ budaRunner.distro_name }}</span>
              </div>
              <div v-if="budaRunner.os_version" class="info-row sub-row">
                <span class="info-label">{{ $t("host.os") }}</span>
                <span class="info-value">{{ budaRunner.os_version }}</span>
              </div>
              <div class="info-row sub-row">
                <span class="info-label">{{ $t("host.docker") }}</span>
                <span class="info-value">{{
                  budaRunner.docker_version || $t("host.notInstalled")
                }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.host-info-view {
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

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: var(--space-lg);
}

.info-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal);
}

.info-card:hover {
  box-shadow: var(--shadow-md);
}

.card-title {
  margin: 0 0 var(--space-md) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.info-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row.sub-row {
  padding-left: var(--space-lg);
}

.wsl-header.clickable {
  cursor: pointer;
  user-select: none;
}

.wsl-header.clickable:hover {
  background: var(--color-bg-hover, rgba(0, 0, 0, 0.03));
}

.expand-icon {
  display: inline-block;
  width: 1em;
  font-size: var(--font-size-sm);
}

.install-btn {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-primary, #4a90d9);
  border: 1px solid var(--color-primary, #4a90d9);
  border-radius: var(--radius-md, 6px);
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--transition-normal),
    color var(--transition-normal);
}

.install-btn:hover {
  background: var(--color-primary, #4a90d9);
  color: #fff;
}

.info-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  font-weight: 400;
}

.info-value {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  font-weight: 500;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
