import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import HostInfoView from "./HostInfoView.vue";
import type { HostInfo, Coproc, WslDistro } from "../types/boinc";

const mockGetHostInfo = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../composables/useRpc", () => ({
  getHostInfo: () => mockGetHostInfo(),
}));

function makeCoproc(overrides: Partial<Coproc> = {}): Coproc {
  return {
    coproc_type: "CUDA",
    name: "NVIDIA RTX 3080",
    count: 1,
    available_ram: 10e9,
    driver_version: "535.129.03",
    cuda_version: 12010,
    compute_cap_major: 8,
    compute_cap_minor: 6,
    clock_rate: 1710,
    multiprocessor_count: 68,
    peak_flops: 29.77e12,
    opencl_device_version: "",
    opencl_driver_version: "",
    vendor: "",
    ...overrides,
  };
}

function makeWslDistro(overrides: Partial<WslDistro> = {}): WslDistro {
  return {
    distro_name: "Ubuntu-22.04",
    os_name: "Ubuntu",
    os_version: "22.04",
    wsl_version: "2",
    is_buda_runner: false,
    buda_runner_version: 0,
    docker_version: "",
    docker_type: "",
    ...overrides,
  };
}

function makeHostInfo(overrides: Partial<HostInfo> = {}): HostInfo {
  return {
    domain_name: "test-host",
    ip_addr: "192.168.1.100",
    p_ncpus: 8,
    p_vendor: "GenuineIntel",
    p_model: "Intel Core i7-10700K",
    p_fpops: 3.29e9,
    p_iops: 6.58e9,
    m_nbytes: 34.4e9,
    m_cache: 16.8e6,
    m_swap: 8.6e9,
    d_total: 512.1e9,
    d_free: 214.7e9,
    os_name: "Linux",
    os_version: "Ubuntu 22.04",
    product_name: "System Product Name",
    virtualbox_version: "7.0.14",
    timezone: 10800,
    host_cpid: "abc123",
    p_features: "sse sse2 avx",
    p_membw: 0,
    p_calculated: 0,
    p_vm_extensions_disabled: false,
    mac_address: "00:11:22:33:44:55",
    docker_version: "",
    coprocs: [],
    wsl_distros: [],
    ...overrides,
  };
}

function mountView() {
  return mount(HostInfoView, {
    global: {
      stubs: { PageHeader: true },
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

describe("HostInfoView", () => {
  beforeEach(() => {
    mockGetHostInfo.mockReset();
  });

  it("shows loading state initially", () => {
    mockGetHostInfo.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();
    expect(wrapper.text()).toContain("host.loading");
  });

  it("renders system info after loading", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo());
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("test-host");
    expect(wrapper.text()).toContain("192.168.1.100");
    expect(wrapper.text()).toContain("Linux");
    expect(wrapper.text()).toContain("Ubuntu 22.04");
  });

  it("renders processor info", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo());
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("8");
    expect(wrapper.text()).toContain("GenuineIntel");
    expect(wrapper.text()).toContain("Intel Core i7-10700K");
  });

  it("formats GFLOPS correctly", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ p_fpops: 3.29e9 }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("3.29 GFLOPS");
  });

  it("formats GIOPS correctly", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ p_iops: 6.58e9 }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("6.58 GIOPS");
  });

  it("shows --- for zero GFLOPS/GIOPS", async () => {
    mockGetHostInfo.mockResolvedValue(
      makeHostInfo({ p_fpops: 0, p_iops: 0 }),
    );
    const wrapper = mountView();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("---");
  });

  it("formats memory in GB", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ m_nbytes: 34.4e9 }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("34.4 GB");
  });

  it("formats cache in MB", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ m_cache: 16.8e6 }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("16.8 MB");
  });

  it("formats disk in GB", async () => {
    mockGetHostInfo.mockResolvedValue(
      makeHostInfo({ d_total: 512.1e9, d_free: 214.7e9 }),
    );
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("512.1 GB");
    expect(wrapper.text()).toContain("214.7 GB");
  });

  it("shows error message on fetch failure", async () => {
    mockGetHostInfo.mockRejectedValue(new Error("Connection lost"));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find(".error-text").text()).toContain("Connection lost");
  });

  it("renders GPU card for CUDA coproc", async () => {
    const gpu = makeCoproc();
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ coprocs: [gpu] }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("NVIDIA RTX 3080");
    expect(wrapper.text()).toContain("10.0 GB");
    expect(wrapper.text()).toContain("535.129.03");
  });

  it("formats CUDA version correctly", async () => {
    const gpu = makeCoproc({ cuda_version: 12010 });
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ coprocs: [gpu] }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("12.1");
  });

  it("formats CUDA version with zero minor", async () => {
    const gpu = makeCoproc({ cuda_version: 11000 });
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ coprocs: [gpu] }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("11.0");
  });

  it("merges CUDA and OpenCL entries for same GPU", async () => {
    const cuda = makeCoproc({
      coproc_type: "CUDA",
      name: "NVIDIA RTX 3080",
      vendor: "",
      opencl_device_version: "",
    });
    const opencl = makeCoproc({
      coproc_type: "OpenCL",
      name: "NVIDIA RTX 3080",
      vendor: "NVIDIA Corporation",
      opencl_device_version: "OpenCL 3.0",
      cuda_version: 0,
      compute_cap_major: 0,
      compute_cap_minor: 0,
    });
    mockGetHostInfo.mockResolvedValue(
      makeHostInfo({ coprocs: [cuda, opencl] }),
    );
    const wrapper = mountView();
    await flushPromises();

    // Should show only one GPU card (merged)
    const cards = wrapper.findAll(".card-title");
    const gpuCards = cards.filter((c) => c.text().includes("host.gpu"));
    expect(gpuCards).toHaveLength(1);

    // Should have OpenCL version from the OpenCL entry
    expect(wrapper.text()).toContain("OpenCL 3.0");
  });

  it("shows OpenCL-only GPU when no CUDA entries", async () => {
    const opencl = makeCoproc({
      coproc_type: "OpenCL",
      name: "Intel UHD 630",
      cuda_version: 0,
    });
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ coprocs: [opencl] }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Intel UHD 630");
  });

  it("shows VM extensions enabled/disabled", async () => {
    mockGetHostInfo.mockResolvedValue(
      makeHostInfo({ p_vm_extensions_disabled: false }),
    );
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("host.vmEnabled");
  });

  it("shows Install link when no buda runner", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ wsl_distros: [] }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find(".install-btn").exists()).toBe(true);
    expect(wrapper.find(".install-btn").text()).toContain("host.install");
  });

  it("shows buda runner info and expands on click", async () => {
    const distro = makeWslDistro({
      is_buda_runner: true,
      distro_name: "Ubuntu-22.04",
      docker_version: "24.0.7",
    });
    mockGetHostInfo.mockResolvedValue(
      makeHostInfo({ wsl_distros: [distro] }),
    );
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("host.installed");
    expect(wrapper.find(".sub-row").exists()).toBe(false);

    // Click to expand
    await wrapper.find(".wsl-header.clickable").trigger("click");

    expect(wrapper.find(".sub-row").exists()).toBe(true);
    expect(wrapper.text()).toContain("Ubuntu-22.04");
    expect(wrapper.text()).toContain("24.0.7");
  });

  it("shows --- for missing domain_name", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ domain_name: "" }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("---");
  });

  it("shows 0.0 GB for zero memory", async () => {
    mockGetHostInfo.mockResolvedValue(makeHostInfo({ m_nbytes: 0 }));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("0.0 GB");
  });
});
