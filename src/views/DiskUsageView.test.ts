import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import DiskUsageView from "./DiskUsageView.vue";
import { useDiskUsageStore } from "../stores/diskUsage";
import { useProjectsStore } from "../stores/projects";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock RPC to prevent real fetch in onMounted
vi.mock("../composables/useRpc", () => ({
  getDiskUsage: vi.fn().mockResolvedValue({
    projects: [],
    d_total: 0,
    d_free: 0,
    d_boinc: 0,
    d_allowed: 0,
  }),
}));

vi.mock("../components/PageHeader.vue", () => ({
  default: { template: '<div class="page-header">Disk Usage</div>' },
}));

vi.mock("../components/EmptyState.vue", () => ({
  default: { template: '<div class="empty-state">No data</div>' },
}));

describe("DiskUsageView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows loading state when data is not yet available", () => {
    const store = useDiskUsageStore();
    store.loading = true;

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Loading disk usage");
  });

  it("shows empty state when d_total is 0 and not loading", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = {
      projects: [],
      d_total: 0,
      d_free: 0,
      d_boinc: 0,
      d_allowed: 0,
    };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.find(".empty-state").exists()).toBe(true);
  });

  it("shows error message when error is set", () => {
    const store = useDiskUsageStore();
    store.error = "Connection failed";

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Connection failed");
  });

  it("renders summary cards with formatted values", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = {
      projects: [],
      d_total: 500 * 1073741824, // 500 GB
      d_free: 200 * 1073741824, // 200 GB
      d_boinc: 50 * 1073741824, // 50 GB
      d_allowed: 100 * 1073741824, // 100 GB
    };

    const wrapper = mount(DiskUsageView);
    const text = wrapper.text();
    expect(text).toContain("500.0 GB");
    expect(text).toContain("200.0 GB");
    expect(text).toContain("50.0 GB");
    expect(text).toContain("100.0 GB");
  });

  it("renders project legend when projects exist", () => {
    const diskStore = useDiskUsageStore();
    const projStore = useProjectsStore();

    projStore.projects = [
      {
        master_url: "https://example.com/proj1",
        project_name: "Project Alpha",
      },
    ] as never[];

    diskStore.loading = false;
    diskStore.usage = {
      projects: [
        { master_url: "https://example.com/proj1", disk_usage: 1073741824 },
      ],
      d_total: 500 * 1073741824,
      d_free: 200 * 1073741824,
      d_boinc: 1073741824,
      d_allowed: 100 * 1073741824,
    };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("Project Alpha");
    expect(wrapper.text()).toContain("1.0 GB");
  });

  it("falls back to URL when project name is not found", () => {
    const diskStore = useDiskUsageStore();
    diskStore.loading = false;
    diskStore.usage = {
      projects: [{ master_url: "https://unknown.org/", disk_usage: 1048576 }],
      d_total: 500 * 1073741824,
      d_free: 200 * 1073741824,
      d_boinc: 1048576,
      d_allowed: 100 * 1073741824,
    };

    const wrapper = mount(DiskUsageView);
    expect(wrapper.text()).toContain("https://unknown.org/");
  });

  it("formats bytes correctly for MB-range values", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = {
      projects: [],
      d_total: 1048576, // 1 MB
      d_free: 524288, // 512 KB
      d_boinc: 0,
      d_allowed: 1048576,
    };

    const wrapper = mount(DiskUsageView);
    const text = wrapper.text();
    expect(text).toContain("1.0 MB");
    expect(text).toContain("512.0 KB");
  });

  it("formats bytes correctly for TB-range values", () => {
    const store = useDiskUsageStore();
    store.loading = false;
    store.usage = {
      projects: [],
      d_total: 2 * 1099511627776, // 2 TB
      d_free: 1099511627776, // 1 TB
      d_boinc: 0,
      d_allowed: 2 * 1099511627776,
    };

    const wrapper = mount(DiskUsageView);
    const text = wrapper.text();
    expect(text).toContain("2.0 TB");
    expect(text).toContain("1.0 TB");
  });

  it("shows percentage in legend for project fractions", () => {
    const diskStore = useDiskUsageStore();
    diskStore.loading = false;
    diskStore.usage = {
      projects: [
        { master_url: "https://a.org/", disk_usage: 1000 },
        { master_url: "https://b.org/", disk_usage: 3000 },
      ],
      d_total: 10000,
      d_free: 6000,
      d_boinc: 4000,
      d_allowed: 10000,
    };

    const wrapper = mount(DiskUsageView);
    const text = wrapper.text();
    // Project A: 1000/4000 = 25.0%, Project B: 3000/4000 = 75.0%
    expect(text).toContain("25.0%");
    expect(text).toContain("75.0%");
  });

  it("renders SVG doughnut chart paths for projects", () => {
    const diskStore = useDiskUsageStore();
    diskStore.loading = false;
    diskStore.usage = {
      projects: [
        { master_url: "https://a.org/", disk_usage: 500 },
        { master_url: "https://b.org/", disk_usage: 500 },
      ],
      d_total: 1000,
      d_free: 0,
      d_boinc: 1000,
      d_allowed: 1000,
    };

    const wrapper = mount(DiskUsageView);
    const paths = wrapper.findAll("svg path");
    expect(paths.length).toBe(2);
  });
});
