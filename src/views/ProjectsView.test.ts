import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ProjectsView from "./ProjectsView.vue";
import { useProjectsStore } from "../stores/projects";
import type { Project } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    master_url: "https://example.com/project/",
    project_name: "Example Project",
    user_name: "testuser",
    team_name: "Test Team",
    user_total_credit: 12345,
    user_expavg_credit: 100,
    host_total_credit: 5000,
    host_expavg_credit: 50,
    suspended_via_gui: false,
    dont_request_more_work: false,
    attached_via_acct_mgr: false,
    resource_share: 100,
    hostid: 0,
    disk_usage: 0,
    nrpc_failures: 0,
    min_rpc_time: 0,
    download_backoff: 0,
    upload_backoff: 0,
    sched_priority: 0,
    duration_correction_factor: 1,
    last_rpc_time: 0,
    njobs_success: 0,
    njobs_error: 0,
    venue: "",
    gui_urls: [],
    ...overrides,
  };
}

describe("ProjectsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows empty message when no projects", () => {
    const wrapper = mount(ProjectsView);
    expect(wrapper.text()).toContain("No projects attached");
  });

  it("renders projects table with data", () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({ project_name: "SETI@home" }),
      makeProject({
        master_url: "https://example2.com/",
        project_name: "Rosetta",
        suspended_via_gui: true,
      }),
    ];

    const wrapper = mount(ProjectsView);
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);
    // Alphabetical sort: Rosetta before SETI@home
    expect(rows[0].text()).toContain("Rosetta");
    expect(rows[0].text()).toContain("Suspended");
    expect(rows[1].text()).toContain("SETI@home");
    expect(rows[1].text()).toContain("Active");
  });

  it("shows action buttons when a project is selected", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);

    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.text()).toContain("Update");
    expect(wrapper.text()).toContain("Suspend");
    expect(wrapper.text()).toContain("No new tasks");
  });

  it("shows Resume when suspended project selected", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ suspended_via_gui: true })];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.text()).toContain("Resume");
  });

  it("shows confirm dialog for reset", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const dangerButtons = wrapper.findAll(".btn-danger");
    await dangerButtons[0].trigger("click");
    await wrapper.vm.$nextTick();

    // Dialog is teleported to body
    const body = document.body.textContent ?? "";
    expect(body).toContain("Reset Project");
    expect(body).toContain("will be lost");
  });

  it("shows confirm dialog for detach", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const dangerButtons = wrapper.findAll(".btn-danger");
    await dangerButtons[1].trigger("click");
    await wrapper.vm.$nextTick();

    const body = document.body.textContent ?? "";
    expect(body).toContain("Detach Project");
    expect(body).toContain("stop contributing");
  });

  it("renders source column with 'User' for manually added projects", () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ attached_via_acct_mgr: false })];

    const wrapper = mount(ProjectsView);
    const row = wrapper.find("tbody tr");
    expect(row.text()).toContain("User");
  });

  it("renders source column with 'Manager' for acct-mgr-attached projects", () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ attached_via_acct_mgr: true })];

    const wrapper = mount(ProjectsView);
    const row = wrapper.find("tbody tr");
    expect(row.text()).toContain("Manager");
  });

  it("renders source badge with correct CSS class", () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({ attached_via_acct_mgr: true }),
      makeProject({
        master_url: "https://example2.com/",
        attached_via_acct_mgr: false,
      }),
    ];

    const wrapper = mount(ProjectsView);
    const badges = wrapper.findAll(".source-badge");
    expect(badges.length).toBe(2);
    // Sorted alphabetically, both have same project_name so order by master_url
    const classLists = badges.map((b) => b.classes());
    expect(classLists.some((c) => c.includes("source-manager"))).toBe(true);
    expect(classLists.some((c) => c.includes("source-user"))).toBe(true);
  });

  it("shows Add Project and Account Manager buttons in header", () => {
    const wrapper = mount(ProjectsView);
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels).toContain("Add Project");
    expect(labels).toContain("Account Manager");
  });
});
