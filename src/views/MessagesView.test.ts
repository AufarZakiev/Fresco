import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import MessagesView from "./MessagesView.vue";
import { useMessagesStore } from "../stores/messages";
import type { Message } from "../types/boinc";
import { MSG_PRIORITY } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    project: "Test Project",
    priority: MSG_PRIORITY.INFO,
    seqno: 1,
    body: "Test message body",
    timestamp: 1700000000,
    ...overrides,
  };
}

describe("MessagesView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("renders messages in chronological order by default (oldest first)", () => {
    const store = useMessagesStore();
    store.messages = [
      makeMessage({ seqno: 1, timestamp: 1000, body: "First" }),
      makeMessage({ seqno: 2, timestamp: 2000, body: "Second" }),
      makeMessage({ seqno: 3, timestamp: 3000, body: "Third" }),
    ];

    const wrapper = mount(MessagesView);
    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain("First");
    expect(rows[1].text()).toContain("Second");
    expect(rows[2].text()).toContain("Third");
  });

  it("sort by project column works", async () => {
    const store = useMessagesStore();
    store.messages = [
      makeMessage({ seqno: 1, project: "Zebra", timestamp: 1000 }),
      makeMessage({ seqno: 2, project: "Alpha", timestamp: 2000 }),
      makeMessage({ seqno: 3, project: "Middle", timestamp: 3000 }),
    ];

    const wrapper = mount(MessagesView);

    // Click on Project header to sort
    const headers = wrapper.findAll("th");
    const projectHeader = headers.find((h) => h.text().includes("Project"));
    expect(projectHeader).toBeTruthy();
    await projectHeader!.trigger("click");

    const rows = wrapper.findAll("tbody tr");
    expect(rows[0].text()).toContain("Alpha");
    expect(rows[1].text()).toContain("Middle");
    expect(rows[2].text()).toContain("Zebra");
  });

  it("message-type selector filters correctly", async () => {
    const store = useMessagesStore();
    store.messages = [
      makeMessage({ seqno: 1, priority: MSG_PRIORITY.INFO, body: "Info msg" }),
      makeMessage({ seqno: 2, priority: MSG_PRIORITY.USER_ALERT, body: "Alert msg" }),
      makeMessage({ seqno: 3, priority: MSG_PRIORITY.INTERNAL_ERROR, body: "Error msg" }),
    ];

    const wrapper = mount(MessagesView);

    // Default: All messages shown
    expect(wrapper.findAll("tbody tr")).toHaveLength(3);

    // Click "Errors" button
    const typeButtons = wrapper.findAll(".type-btn");
    const errorsBtn = typeButtons.find((b) => b.text() === "Errors");
    expect(errorsBtn).toBeTruthy();
    await errorsBtn!.trigger("click");

    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("Error msg");

    // Click "User Alerts" — shows alerts + errors
    const alertsBtn = typeButtons.find((b) => b.text() === "User Alerts");
    await alertsBtn!.trigger("click");

    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("Alert msg");
    expect(wrapper.text()).toContain("Error msg");

    // Click "All" to reset
    const allBtn = typeButtons.find((b) => b.text() === "All");
    await allBtn!.trigger("click");

    expect(wrapper.findAll("tbody tr")).toHaveLength(3);
  });

  it("displays type column with StatusBadge", () => {
    const store = useMessagesStore();
    store.messages = [
      makeMessage({ seqno: 1, priority: MSG_PRIORITY.INFO }),
      makeMessage({ seqno: 2, priority: MSG_PRIORITY.USER_ALERT }),
      makeMessage({ seqno: 3, priority: MSG_PRIORITY.INTERNAL_ERROR }),
    ];

    const wrapper = mount(MessagesView);
    const badges = wrapper.findAll(".status-badge");
    const labels = badges.map((b) => b.text());
    expect(labels).toContain("Info");
    expect(labels).toContain("Alert");
    expect(labels).toContain("Error");
  });

  it("shows page title as Event Log", () => {
    const wrapper = mount(MessagesView);
    expect(wrapper.text()).toContain("Event Log");
  });
});
