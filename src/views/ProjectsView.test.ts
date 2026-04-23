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

  it("hides drawer when no project is selected", () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);
    expect(wrapper.find(".drawer-panel").exists()).toBe(false);
  });

  it("shows drawer when a project is selected", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.find(".drawer-panel").exists()).toBe(true);
  });

  it("groups danger buttons in drawer-danger section", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const dangerSection = wrapper.find(".drawer-danger");
    expect(dangerSection.exists()).toBe(true);
    const dangerButtons = dangerSection.findAll(".btn-danger");
    expect(dangerButtons).toHaveLength(2);
    expect(dangerButtons[0].text()).toBe("Reset");
    expect(dangerButtons[1].text()).toBe("Detach");
  });

  it("shows Allow new tasks when dont_request_more_work is true", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ dont_request_more_work: true })];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const drawer = wrapper.find(".drawer-panel");
    expect(drawer.text()).toContain("Allow new tasks");
  });

  it("shows Properties button only for single selection", async () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject(),
      makeProject({
        master_url: "https://example2.com/",
        project_name: "Project 2",
      }),
    ];

    const wrapper = mount(ProjectsView);
    const rows = wrapper.findAll("tbody tr");

    // Single select → Properties visible
    await rows[0].trigger("click");
    let drawer = wrapper.find(".drawer-panel");
    expect(drawer.text()).toContain("Properties");

    // Multi-select → Properties hidden
    await rows[1].trigger("click", { ctrlKey: true });
    drawer = wrapper.find(".drawer-panel");
    expect(drawer.text()).not.toContain("Properties");
  });

  it("calls store.updateProject when Update is clicked", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];
    store.updateProject = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const updateBtn = wrapper
      .findAll(".drawer-section .btn")
      .find((b) => b.text() === "Update")!;
    await updateBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.updateProject).toHaveBeenCalledWith(
      "https://example.com/project/",
    );
  });

  it("calls store.suspendProject when Suspend is clicked", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ suspended_via_gui: false })];
    store.suspendProject = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const suspendBtn = wrapper
      .findAll(".drawer-section .btn")
      .find((b) => b.text() === "Suspend")!;
    await suspendBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.suspendProject).toHaveBeenCalledWith(
      "https://example.com/project/",
    );
  });

  it("calls store.resumeProject when Resume is clicked", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ suspended_via_gui: true })];
    store.resumeProject = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const resumeBtn = wrapper
      .findAll(".drawer-section .btn")
      .find((b) => b.text() === "Resume")!;
    await resumeBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.resumeProject).toHaveBeenCalledWith(
      "https://example.com/project/",
    );
  });

  it("calls store.noNewTasks when No new tasks is clicked", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ dont_request_more_work: false })];
    store.noNewTasks = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const btn = wrapper
      .findAll(".drawer-section .btn")
      .find((b) => b.text() === "No new tasks")!;
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.noNewTasks).toHaveBeenCalledWith(
      "https://example.com/project/",
    );
  });

  it("calls store.allowNewTasks when Allow new tasks is clicked", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject({ dont_request_more_work: true })];
    store.allowNewTasks = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const btn = wrapper
      .findAll(".drawer-section .btn")
      .find((b) => b.text() === "Allow new tasks")!;
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.allowNewTasks).toHaveBeenCalledWith(
      "https://example.com/project/",
    );
  });

  it("does not show a Web Page button in the drawer actions", async () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({
        gui_urls: [
          { name: "Home page", description: "", url: "https://example.com/" },
        ],
      }),
    ];

    const wrapper = mount(ProjectsView);
    await wrapper.find("tbody tr").trigger("click");

    const sections = wrapper.findAll(
      ".drawer-section:not(.drawer-links):not(.drawer-danger)",
    );
    const buttons = sections.flatMap((s) => s.findAll("button"));
    const labels = buttons.map((b) => b.text());
    expect(labels).not.toContain("Web Page");
  });

  it("keeps selection-dependent buttons in drawer only", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView);

    // Before selection — no drawer, so no action buttons visible
    expect(wrapper.find(".drawer-panel").exists()).toBe(false);

    // After selection — action buttons should be in the drawer
    await wrapper.find("tbody tr").trigger("click");
    const drawerButtons = wrapper.find(".drawer-panel").findAll("button");
    const drawerLabels = drawerButtons.map((b) => b.text());
    expect(drawerLabels).toContain("Update");
    expect(drawerLabels).toContain("Suspend");
    expect(drawerLabels).toContain("Reset");
  });

  it("shows web links in drawer when project with gui_urls is selected", async () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({
        gui_urls: [
          { name: "Home page", description: "", url: "https://example.com/" },
          {
            name: "Your account",
            description: "",
            url: "https://example.com/account",
          },
          {
            name: "Message boards",
            description: "",
            url: "https://example.com/forum",
          },
        ],
      }),
    ];

    const wrapper = mount(ProjectsView);
    expect(wrapper.find(".drawer-links").exists()).toBe(false);

    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.find(".drawer-links").exists()).toBe(true);
    const links = wrapper.findAll(".web-link");
    expect(links).toHaveLength(3);
    expect(links[0].text()).toBe("Home page");
    expect(links[1].text()).toBe("Your account");
    expect(links[2].text()).toBe("Message boards");
  });

  it("hides web links when no project selected", () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({
        gui_urls: [
          { name: "Home page", description: "", url: "https://example.com/" },
        ],
      }),
    ];

    const wrapper = mount(ProjectsView);
    expect(wrapper.find(".drawer-links").exists()).toBe(false);
  });

  it("opens detach confirm dialog when Backspace is pressed with selection", async () => {
    const store = useProjectsStore();
    store.projects = [makeProject()];

    const wrapper = mount(ProjectsView, { attachTo: document.body });
    await wrapper.find("tbody tr").trigger("click");

    await wrapper.trigger("keydown", { key: "Backspace" });
    await wrapper.vm.$nextTick();

    const body = document.body.textContent ?? "";
    expect(body).toContain("Detach Project");
    wrapper.unmount();
  });

  it("renders the resource share column with value and percent of total", () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({ project_name: "A", resource_share: 100 }),
      makeProject({
        master_url: "https://example2.com/",
        project_name: "B",
        resource_share: 300,
      }),
    ];

    const wrapper = mount(ProjectsView);
    const rowText = wrapper.findAll("tbody tr").map((r) => r.text()).join(" ");
    // 100 out of 400 total = 25.00%, 300 out of 400 = 75.00%
    expect(rowText).toContain("100 (25.00%)");
    expect(rowText).toContain("300 (75.00%)");
  });

  it("hides web links when multiple projects selected", async () => {
    const store = useProjectsStore();
    store.projects = [
      makeProject({
        gui_urls: [
          { name: "Home page", description: "", url: "https://example.com/" },
        ],
      }),
      makeProject({
        master_url: "https://example2.com/",
        project_name: "Project 2",
        gui_urls: [
          { name: "Home page", description: "", url: "https://example2.com/" },
        ],
      }),
    ];

    const wrapper = mount(ProjectsView);
    const rows = wrapper.findAll("tbody tr");
    await rows[0].trigger("click");
    await rows[1].trigger("click", { ctrlKey: true });

    // Multiple selected → singleSelected is null → web links hidden
    expect(wrapper.find(".drawer-links").exists()).toBe(false);
  });
});
