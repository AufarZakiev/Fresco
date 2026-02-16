import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ItemPropertiesDialog from "./ItemPropertiesDialog.vue";
import type { TaskResult, Project } from "../types/boinc";

function makeTask(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    name: "task_001_0",
    wu_name: "task_001",
    project_url: "https://example.com/",
    report_deadline: 1700000000,
    received_time: 1699900000,
    elapsed_time: 3661,
    estimated_cpu_time_remaining: 7200,
    fraction_done: 0.456,
    state: 2,
    scheduler_state: 2,
    active_task_state: 1,
    active_task: true,
    suspended_via_gui: false,
    project_suspended_via_gui: false,
    ready_to_report: false,
    got_server_ack: false,
    plan_class: "sse2",
    resources: "1 CPU",
    version_num: 710,
    slot: 0,
    pid: 12345,
    checkpoint_cpu_time: 1100,
    current_cpu_time: 1200,
    progress_rate: 0.001,
    working_set_size_smoothed: 104857600,
    swap_size: 0,
    slot_path: "/slots/0",
    graphics_exec_path: "",
    web_graphics_url: "",
    remote_desktop_addr: "",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    master_url: "https://example.com/",
    project_name: "Test Project",
    user_name: "testuser",
    team_name: "Team",
    user_total_credit: 12345,
    user_expavg_credit: 100,
    host_total_credit: 5000,
    host_expavg_credit: 50,
    suspended_via_gui: false,
    dont_request_more_work: false,
    resource_share: 100,
    hostid: 1,
    disk_usage: 1073741824,
    nrpc_failures: 0,
    min_rpc_time: 0,
    download_backoff: 0,
    upload_backoff: 0,
    sched_priority: 0,
    duration_correction_factor: 1,
    last_rpc_time: 1700000000,
    njobs_success: 42,
    njobs_error: 3,
    venue: "home",
    gui_urls: [
      { name: "Home Page", description: "Project home", url: "https://example.com/" },
    ],
    ...overrides,
  };
}

describe("ItemPropertiesDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render when closed", () => {
    mount(ItemPropertiesDialog, {
      props: { open: false, type: "task" },
    });
    expect(document.body.querySelector(".dialog-overlay")).toBeNull();
  });

  it("renders task properties when open", () => {
    const task = makeTask();
    mount(ItemPropertiesDialog, {
      props: { open: true, type: "task", task },
    });
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    const text = overlay!.textContent ?? "";
    expect(text).toContain("task_001_0");
    expect(text).toContain("task_001");
    expect(text).toContain("45.600%");
  });

  it("renders project properties when open", () => {
    const project = makeProject();
    mount(ItemPropertiesDialog, {
      props: { open: true, type: "project", project },
    });
    const overlay = document.body.querySelector(".dialog-overlay");
    expect(overlay).not.toBeNull();
    const text = overlay!.textContent ?? "";
    expect(text).toContain("Test Project");
    expect(text).toContain("testuser");
    expect(text).toContain("home");
  });

  it("shows gui_urls for projects", () => {
    const project = makeProject();
    mount(ItemPropertiesDialog, {
      props: { open: true, type: "project", project },
    });
    const text = document.body.textContent ?? "";
    expect(text).toContain("Home Page");
  });

  it("has Copy All button", () => {
    const task = makeTask();
    mount(ItemPropertiesDialog, {
      props: { open: true, type: "task", task },
    });
    const buttons = document.body.querySelectorAll("button");
    const copyBtn = Array.from(buttons).find(b => b.textContent?.includes("Copy"));
    expect(copyBtn).not.toBeUndefined();
  });
});
