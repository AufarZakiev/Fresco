import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import NoticesView from "./NoticesView.vue";
import { useNoticesStore } from "../stores/notices";
import type { Notice } from "../types/boinc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../composables/useNotifications", () => ({
  notifyNewNotices: vi.fn(),
}));

function makeNotice(overrides: Partial<Notice> = {}): Notice {
  return {
    seqno: 1,
    title: "Test Notice",
    description: "Test description",
    create_time: 1700000000,
    project_name: "Test Project",
    link: "",
    category: "server",
    is_private: false,
    ...overrides,
  };
}

describe("NoticesView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows page title", () => {
    const wrapper = mount(NoticesView);
    expect(wrapper.text()).toContain("Notices");
  });

  it("renders notices from store", () => {
    const store = useNoticesStore();
    store.notices = [
      makeNotice({ seqno: 1, title: "First notice" }),
      makeNotice({ seqno: 2, title: "Second notice" }),
    ];

    const wrapper = mount(NoticesView);
    expect(wrapper.findAll(".notice-card")).toHaveLength(2);
    expect(wrapper.text()).toContain("First notice");
    expect(wrapper.text()).toContain("Second notice");
  });

  it("renders notices sorted newest first", () => {
    const store = useNoticesStore();
    store.notices = [
      makeNotice({ seqno: 1, title: "Oldest", create_time: 1000 }),
      makeNotice({ seqno: 2, title: "Middle", create_time: 2000 }),
      makeNotice({ seqno: 3, title: "Newest", create_time: 3000 }),
    ];

    const wrapper = mount(NoticesView);
    const cards = wrapper.findAll(".notice-card");
    expect(cards[0].text()).toContain("Newest");
    expect(cards[1].text()).toContain("Middle");
    expect(cards[2].text()).toContain("Oldest");
  });

  it("shows empty state when no notices", () => {
    const store = useNoticesStore();
    store.notices = [];

    const wrapper = mount(NoticesView);
    expect(wrapper.findAll(".notice-card")).toHaveLength(0);
    expect(wrapper.text()).toContain("No notices");
  });

  it("shows notice title as link when link is present", () => {
    const store = useNoticesStore();
    store.notices = [
      makeNotice({ seqno: 1, title: "Linked notice", link: "https://example.com" }),
    ];

    const wrapper = mount(NoticesView);
    const link = wrapper.find(".notice-link");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe("https://example.com");
    expect(link.attributes("target")).toBe("_blank");
  });

  it("shows notice title as plain text when no link", () => {
    const store = useNoticesStore();
    store.notices = [makeNotice({ seqno: 1, title: "Plain notice", link: "" })];

    const wrapper = mount(NoticesView);
    expect(wrapper.find(".notice-link").exists()).toBe(false);
    expect(wrapper.text()).toContain("Plain notice");
  });

  it("does not render notice-body when description is empty", () => {
    const store = useNoticesStore();
    store.notices = [makeNotice({ seqno: 1, description: "" })];

    const wrapper = mount(NoticesView);
    expect(wrapper.find(".notice-body").exists()).toBe(false);
  });

  describe("sanitizeHtml", () => {
    it("removes script tags from notice description", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: 'Hello <script>alert("xss")</script> World' }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      expect(body.html()).not.toContain("<script");
      expect(body.html()).not.toContain("alert");
    });

    it("removes on* event handler attributes", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: '<img src="x" onerror="alert(1)">' }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      expect(body.html()).not.toContain("onerror");
      expect(body.html()).not.toContain("alert");
    });

    it("removes javascript: href", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: '<a href="javascript:alert(1)">click</a>' }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      expect(body.html()).not.toContain("javascript:");
    });

    it("removes SVG-based XSS vectors (not covered by custom regex)", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: '<svg><animate onbegin="alert(1)"/></svg>' }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      expect(body.html()).not.toContain("onbegin");
      expect(body.html()).not.toContain("alert");
    });

    it("adds target=_blank and rel=noopener to links", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: '<a href="https://example.com">visit</a>' }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      const link = body.find("a");
      expect(link.attributes("target")).toBe("_blank");
      expect(link.attributes("rel")).toContain("noopener");
    });

    it("preserves safe HTML content", () => {
      const store = useNoticesStore();
      store.notices = [
        makeNotice({ seqno: 1, description: "<p>Safe <strong>content</strong> here.</p>" }),
      ];

      const wrapper = mount(NoticesView);
      const body = wrapper.find(".notice-body");
      expect(body.find("p").exists()).toBe(true);
      expect(body.find("strong").exists()).toBe(true);
      expect(body.text()).toContain("Safe content here.");
    });
  });
});
