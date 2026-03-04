import type { HostInfo } from "../../types/boinc";

export const mockHostInfo: HostInfo = {
  domain_name: "mock-workstation",
  ip_addr: "192.168.1.42",
  host_cpid: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  p_ncpus: 8,
  p_vendor: "GenuineIntel",
  p_model:
    "Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz [Family 6 Model 165 Stepping 5]",
  p_features:
    "fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht",
  p_fpops: 3_288_945_664.0,
  p_iops: 6_577_891_328.0,
  p_membw: 1_000_000_000.0,
  p_calculated: Date.now() / 1000 - 86400,
  p_vm_extensions_disabled: false,
  m_nbytes: 34_359_738_368, // 32 GB
  m_cache: 16_777_216, // 16 MB
  m_swap: 8_589_934_592, // 8 GB
  d_total: 512_110_190_592,
  d_free: 214_748_364_800,
  os_name: "Linux",
  os_version:
    "Ubuntu 22.04.3 LTS [6.5.0-44-generic|libc 2.35 (Ubuntu GLIBC 2.35-0ubuntu3.8)]",
  product_name: "System Product Name",
  mac_address: "a0:b1:c2:d3:e4:f5",
  timezone: -10800, // UTC+3
  docker_version: "24.0.7",
  virtualbox_version: "7.0.14",
  coprocs: [
    {
      coproc_type: "NVIDIA GPU",
      count: 1,
      name: "NVIDIA GeForce RTX 3070 [1]",
      vendor: "NVIDIA",
      available_ram: 8_589_934_592,
      peak_flops: 20_312_000_000_000.0,
      driver_version: "545.29.06",
      cuda_version: 12020,
      compute_cap_major: 8,
      compute_cap_minor: 6,
      clock_rate: 1725,
      multiprocessor_count: 46,
      opencl_device_version: "OpenCL 3.0 CUDA",
      opencl_driver_version: "545.29.06",
    },
  ],
  wsl_distros: [],
};
