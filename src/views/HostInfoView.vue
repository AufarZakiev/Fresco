<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getHostInfo } from "../composables/useRpc";
import type { HostInfo } from "../types/boinc";
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
    <PageHeader title="Host Information" />

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="loading" class="loading-text">
      Loading host information...
    </div>

    <template v-else-if="hostInfo">
      <div class="cards-grid">
        <!-- System -->
        <div class="info-card">
          <h3 class="card-title">System</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">Hostname</span>
              <span class="info-value">{{ hostInfo.domain_name || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">IP Address</span>
              <span class="info-value">{{ hostInfo.ip_addr || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Operating System</span>
              <span class="info-value">{{ hostInfo.os_name || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">OS Version</span>
              <span class="info-value">{{ hostInfo.os_version || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Product</span>
              <span class="info-value">{{ hostInfo.product_name || "---" }}</span>
            </div>
          </div>
        </div>

        <!-- Processor -->
        <div class="info-card">
          <h3 class="card-title">Processor</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">CPU Cores</span>
              <span class="info-value">{{ hostInfo.p_ncpus }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Vendor</span>
              <span class="info-value">{{ hostInfo.p_vendor || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Model</span>
              <span class="info-value">{{ hostInfo.p_model || "---" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Floating Point</span>
              <span class="info-value">{{ formatGFLOPS(hostInfo.p_fpops) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Integer Ops</span>
              <span class="info-value">{{ formatGIOPS(hostInfo.p_iops) }}</span>
            </div>
          </div>
        </div>

        <!-- Memory -->
        <div class="info-card">
          <h3 class="card-title">Memory</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">Physical Memory</span>
              <span class="info-value">{{ formatGB(hostInfo.m_nbytes) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Cache</span>
              <span class="info-value">{{ formatMB(hostInfo.m_cache) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Swap Space</span>
              <span class="info-value">{{ formatGB(hostInfo.m_swap) }}</span>
            </div>
          </div>
        </div>

        <!-- Disk -->
        <div class="info-card">
          <h3 class="card-title">Disk</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">Total Disk</span>
              <span class="info-value">{{ formatGB(hostInfo.d_total) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Free Disk</span>
              <span class="info-value">{{ formatGB(hostInfo.d_free) }}</span>
            </div>
          </div>
        </div>

        <!-- Virtualization -->
        <div class="info-card">
          <h3 class="card-title">Virtualization</h3>
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">VirtualBox</span>
              <span class="info-value">
                {{ hostInfo.virtualbox_version || "Not installed" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.host-info-view {
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

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
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
