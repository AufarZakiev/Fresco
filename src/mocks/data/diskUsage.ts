import type { DiskUsage } from "../../types/boinc";
import { ROSETTA_URL, EINSTEIN_URL, CLIMATE_URL } from "./_shared";

export const mockDiskUsage: DiskUsage = {
  d_total: 512_110_190_592,      // 477 GB
  d_free: 214_748_364_800,       // 200 GB
  d_boinc: 4_831_838_208,        // ~4.5 GB
  d_allowed: 256_055_095_296,    // ~238 GB (50% of total)
  projects: [
    { master_url: ROSETTA_URL, disk_usage: 2_147_483_648 },
    { master_url: EINSTEIN_URL, disk_usage: 1_610_612_736 },
    { master_url: CLIMATE_URL, disk_usage: 536_870_912 },
  ],
};
