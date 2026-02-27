<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import DOMPurify from "dompurify";
import {
  getAllProjectsList,
  lookupAccount,
  lookupAccountPoll,
  projectAttach,
  projectAttachPoll,
  getProjectConfig,
  getProjectConfigPoll,
  createAccount,
  createAccountPoll,
  computePasswdHash,
} from "../composables/useRpc";
import type { ProjectListEntry, ProjectConfig } from "../types/boinc";
import { useProjectsStore } from "../stores/projects";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import {
  BOINC_ERROR_IN_PROGRESS,
  MAX_ATTACH_POLL_ATTEMPTS,
  ATTACH_POLL_DELAY_MS,
} from "../constants/boinc";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const dialogRef = ref<HTMLElement | null>(null);
const { activate, deactivate } = useFocusTrap(dialogRef);
watch(() => props.open, async (isOpen) => {
  if (isOpen) { await nextTick(); if (!props.open) return; activate(); }
  else { deactivate(); }
});

const { t } = useI18n();
const projects = useProjectsStore();

const step = ref(1);
const projectList = ref<ProjectListEntry[]>([]);
const loading = ref(false);
const error = ref("");
const search = ref("");
const manualUrl = ref("");

// Selected project
const selectedProject = ref<ProjectListEntry | null>(null);

// Credentials
const email = ref("");
const password = ref("");

// Result
const resultMessage = ref("");

const projectConfig = ref<ProjectConfig | null>(null);
const userName = ref("");
const teamName = ref("");
const termsAccepted = ref(false);
const authMode = ref<"login" | "create">("login");

const filteredProjects = computed(() => {
  if (!search.value) return projectList.value;
  const query = search.value.toLowerCase();
  return projectList.value.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.general_area.toLowerCase().includes(query),
  );
});

onMounted(async () => {
  try {
    projectList.value = await getAllProjectsList();
  } catch {
    // Will load when dialog opens
  }
});

async function loadProjects() {
  if (projectList.value.length > 0) return;
  loading.value = true;
  try {
    projectList.value = await getAllProjectsList();
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

function selectProject(project: ProjectListEntry) {
  selectedProject.value = project;
  manualUrl.value = project.url;
  fetchConfig();
}

function goToStep2Manual() {
  if (!manualUrl.value.trim()) return;
  selectedProject.value = null;
  fetchConfig();
}

async function fetchConfig() {
  step.value = 2;
  loading.value = true;
  error.value = "";
  projectConfig.value = null;

  try {
    const url = selectedProject.value?.url || manualUrl.value;
    await getProjectConfig(url);

    let attempts = 0;
    let config;
    while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
      config = await getProjectConfigPoll();
      if (config.error_num !== BOINC_ERROR_IN_PROGRESS) break;
      attempts++;
    }

    if (config && config.error_num === 0) {
      projectConfig.value = config;
      if (config.terms_of_use) {
        step.value = 3;
      } else {
        step.value = 4;
      }
    } else {
      // Skip config if it fails, go directly to credentials
      step.value = 4;
    }
  } catch {
    // Skip config on error, go directly to credentials
    step.value = 4;
  } finally {
    loading.value = false;
  }
}

async function doAttach() {
  if (!email.value || !password.value) {
    error.value = t("projectAttach.enterCredentials");
    return;
  }

  const url = selectedProject.value?.url || manualUrl.value;
  if (!url) return;

  step.value = 5;
  error.value = "";
  loading.value = true;

  try {
    const passwdHash = await computePasswdHash(email.value, password.value);

    if (authMode.value === "create") {
      // Create account flow
      await createAccount(url, email.value, passwdHash, userName.value, teamName.value);

      let attempts = 0;
      let accountResult;
      while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
        accountResult = await createAccountPoll();
        if (accountResult.error_num !== BOINC_ERROR_IN_PROGRESS) break;
        attempts++;
      }

      if (!accountResult || accountResult.error_num !== 0) {
        error.value = accountResult?.error_msg || t("projectAttach.accountCreationFailed");
        step.value = 4;
        loading.value = false;
        return;
      }

      const name = selectedProject.value?.name || projectConfig.value?.name || "";
      await projectAttach(url, accountResult.authenticator, name);
    } else {
      // Login flow
      await lookupAccount(url, email.value, passwdHash);

      let attempts = 0;
      let accountResult;
      while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
        accountResult = await lookupAccountPoll();
        if (accountResult.error_num !== BOINC_ERROR_IN_PROGRESS) break;
        attempts++;
      }

      if (!accountResult || accountResult.error_num !== 0) {
        error.value = accountResult?.error_msg || t("projectAttach.accountLookupFailed");
        step.value = 4;
        loading.value = false;
        return;
      }

      const name = selectedProject.value?.name || projectConfig.value?.name || "";
      await projectAttach(url, accountResult.authenticator, name);
    }

    // Poll for attach result
    let attempts = 0;
    let attachResult;
    while (attempts < MAX_ATTACH_POLL_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, ATTACH_POLL_DELAY_MS));
      attachResult = await projectAttachPoll();
      if (attachResult.error_num !== BOINC_ERROR_IN_PROGRESS) break;
      attempts++;
    }

    if (attachResult && attachResult.error_num === 0) {
      resultMessage.value = t("projectAttach.success");
      step.value = 6;
      projects.fetchProjects();
    } else {
      error.value = attachResult?.messages?.join(", ") || t("projectAttach.attachFailed");
      step.value = 4;
    }
  } catch (e) {
    error.value = String(e);
    step.value = 4;
  } finally {
    loading.value = false;
  }
}

function reset() {
  step.value = 1;
  error.value = "";
  search.value = "";
  email.value = "";
  password.value = "";
  selectedProject.value = null;
  manualUrl.value = "";
  resultMessage.value = "";
  projectConfig.value = null;
  userName.value = "";
  teamName.value = "";
  termsAccepted.value = false;
  authMode.value = "login";
  loadProjects();
}

function close() {
  reset();
  emit("close");
}

onKeyStroke("Escape", () => {
  if (!props.open) return;
  close();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-overlay" @click.self="close">
      <div ref="dialogRef" class="wizard" role="dialog" aria-modal="true" aria-labelledby="project-attach-wizard-title">
        <div class="wizard-header">
          <h3 id="project-attach-wizard-title">
            {{ step === 1 ? $t('projectAttach.title')
             : step === 2 ? $t('projectAttach.loading')
             : step === 3 ? $t('projectAttach.termsOfUse')
             : step === 4 ? $t('projectAttach.account')
             : step === 5 ? $t('projectAttach.attaching')
             : $t('projectAttach.done') }}
          </h3>
          <button class="close-btn" aria-label="Close" @click="close">&times;</button>
        </div>

        <!-- Step 1: Choose project -->
        <div v-if="step === 1" class="wizard-body">
          <input
            v-model="search"
            type="text"
            class="search-input"
            :placeholder="$t('projectAttach.searchPlaceholder')"
            @focus="loadProjects"
          />

          <div v-if="loading" class="wizard-loading">{{ $t('projectAttach.loadingList') }}</div>

          <div v-else class="project-list">
            <div
              v-for="p in filteredProjects"
              :key="p.url"
              class="project-item"
              @click="selectProject(p)"
            >
              <div class="project-name">{{ p.name }}</div>
              <div class="project-area">{{ p.general_area }} — {{ p.specific_area }}</div>
              <div class="project-desc">{{ p.description }}</div>
            </div>
            <div v-if="!loading && filteredProjects.length === 0" class="no-results">
              {{ $t('projectAttach.noResults') }}
            </div>
          </div>

          <div class="manual-url">
            <span class="manual-label">{{ $t('projectAttach.orEnterUrl') }}</span>
            <div class="manual-row">
              <input
                v-model="manualUrl"
                type="text"
                placeholder="https://..."
              />
              <button class="btn btn-primary" :disabled="!manualUrl.trim()" @click="goToStep2Manual">
                {{ $t('projectAttach.next') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Step 2: Loading project config -->
        <div v-if="step === 2" class="wizard-body wizard-center">
          <div class="spinner"></div>
          <p>{{ $t('projectAttach.fetchingConfig') }}</p>
        </div>

        <!-- Step 3: Terms of use -->
        <div v-if="step === 3" class="wizard-body">
          <div class="terms-box" v-if="projectConfig?.terms_of_use_is_html" v-html="DOMPurify.sanitize(projectConfig.terms_of_use)"></div>
          <pre v-else class="terms-box terms-text">{{ projectConfig?.terms_of_use }}</pre>
          <label class="terms-accept">
            <input v-model="termsAccepted" type="checkbox" />
            <span>{{ $t('projectAttach.acceptTerms') }}</span>
          </label>
          <div class="wizard-actions">
            <button class="btn" @click="step = 1">{{ $t('projectAttach.back') }}</button>
            <button class="btn btn-primary" :disabled="!termsAccepted" @click="step = 4">{{ $t('projectAttach.continue') }}</button>
          </div>
        </div>

        <!-- Step 4: Credentials -->
        <div v-if="step === 4" class="wizard-body">
          <div class="cred-project">
            {{ selectedProject?.name || projectConfig?.name || manualUrl }}
          </div>

          <div v-if="!projectConfig?.account_creation_disabled" class="auth-tabs">
            <button class="auth-tab" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">{{ $t('projectAttach.login') }}</button>
            <button class="auth-tab" :class="{ active: authMode === 'create' }" @click="authMode = 'create'">{{ $t('projectAttach.createAccount') }}</button>
          </div>

          <div v-if="error" class="wizard-error">{{ error }}</div>

          <label class="field">
            <span>{{ $t('projectAttach.email') }}</span>
            <input v-model="email" type="email" placeholder="you@example.com" />
          </label>
          <label class="field">
            <span>{{ $t('projectAttach.password') }}</span>
            <input v-model="password" type="password" />
          </label>
          <template v-if="authMode === 'create'">
            <label class="field">
              <span>{{ projectConfig?.uses_username ? $t('projectAttach.username') : $t('projectAttach.name') }}</span>
              <input v-model="userName" type="text" />
            </label>
            <label class="field">
              <span>{{ $t('projectAttach.teamOptional') }}</span>
              <input v-model="teamName" type="text" />
            </label>
          </template>

          <div class="wizard-actions">
            <button class="btn" @click="step = projectConfig?.terms_of_use ? 3 : 1">{{ $t('projectAttach.back') }}</button>
            <button class="btn btn-primary" @click="doAttach">
              {{ authMode === 'create' ? $t('projectAttach.createAndAttach') : $t('projectAttach.attach') }}
            </button>
          </div>
        </div>

        <!-- Step 5: Progress -->
        <div v-if="step === 5" class="wizard-body wizard-center">
          <div class="spinner"></div>
          <p>{{ $t('projectAttach.attachingToProject') }}</p>
        </div>

        <!-- Step 6: Success -->
        <div v-if="step === 6" class="wizard-body wizard-center">
          <div class="success-icon">&#10003;</div>
          <p>{{ resultMessage }}</p>
          <button class="btn btn-primary" @click="close">{{ $t('projectAttach.done') }}</button>
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

.wizard {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: min(520px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.wizard-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.wizard-body {
  padding: 16px 20px;
  flex: 1;
  overflow-y: auto;
}

.wizard-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: var(--space-lg);
}

.wizard-loading {
  padding: var(--space-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.wizard-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
  padding: 8px 12px;
  background: var(--color-danger-light);
  border-radius: var(--radius-sm);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  margin-bottom: var(--space-md);
  background: var(--color-bg);
}

.project-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-lg);
}

.project-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-light);
  transition: background var(--transition-fast);
}

.project-item:last-child {
  border-bottom: none;
}

.project-item:hover {
  background: var(--color-bg-secondary);
}

.project-name {
  font-weight: 500;
  font-size: var(--font-size-base);
  margin-bottom: 2px;
}

.project-area {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
}

.project-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.no-results {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-tertiary);
}

.manual-url {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.manual-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: block;
  margin-bottom: var(--space-sm);
}

.manual-row {
  display: flex;
  gap: var(--space-sm);
}

.manual-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
}

.cred-project {
  font-weight: 500;
  padding: 10px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-lg);
  font-size: var(--font-size-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.field input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.wizard-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-lg);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-success-light);
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}

.terms-box {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  background: var(--color-bg-secondary);
}

.terms-text {
  white-space: pre-wrap;
  font-family: inherit;
}

.terms-accept {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
  cursor: pointer;
}

.terms-accept input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
}

.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.auth-tab {
  flex: 1;
  padding: 8px 16px;
  border: none;
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.auth-tab.active {
  background: var(--color-accent);
  color: white;
}
</style>
