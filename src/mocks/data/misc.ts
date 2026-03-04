import type {
  ProxyInfo,
  VersionInfo,
  AcctMgrInfo,
  NewerVersionInfo,
  ProjectInitStatus,
  DailyXferHistory,
  CcState,
  OldResult,
  ProjectListEntry,
} from "../../types/boinc";
import { NOW, DAY, ROSETTA_URL, EINSTEIN_URL, CLIMATE_URL } from "./_shared";
import { mockProjects } from "./projects";
import { mockTasks } from "./tasks";
import { mockHostInfo } from "./hostInfo";

export const mockProxyInfo: ProxyInfo = {
  use_http_proxy: false,
  use_socks_proxy: false,
  use_http_auth: false,
  http_server_name: "",
  http_server_port: 0,
  http_user_name: "",
  http_user_passwd: "",
  socks_server_name: "",
  socks_server_port: 0,
  socks5_user_name: "",
  socks5_user_passwd: "",
  socks5_remote_dns: false,
  noproxy_hosts: "",
};

export const mockVersionInfo: VersionInfo = {
  major: 8,
  minor: 0,
  release: 4,
};

export const mockAcctMgrInfo: AcctMgrInfo = {
  acct_mgr_url: "",
  acct_mgr_name: "",
  have_credentials: false,
};

export const mockNewerVersion: NewerVersionInfo = {
  newer_version: "",
  download_url: "",
};

export const mockProjectInitStatus: ProjectInitStatus = {
  name: "",
  url: "",
  has_account_key: false,
  embedded: false,
  team_name: "",
};

export const mockDailyXferHistory: DailyXferHistory = {
  daily_xfers: Array.from({ length: 14 }, (_, i) => ({
    when: NOW - (13 - i) * DAY,
    up: Math.floor(Math.random() * 50_000_000) + 5_000_000,
    down: Math.floor(Math.random() * 200_000_000) + 20_000_000,
  })),
};

export const mockCcState: CcState = {
  version_info: mockVersionInfo,
  host_info: mockHostInfo,
  projects: mockProjects,
  results: mockTasks,
  platforms: ["x86_64-pc-linux-gnu", "i686-pc-linux-gnu"],
  executing_as_daemon: false,
};

export const mockOldResults: OldResult[] = [
  {
    project_url: ROSETTA_URL,
    result_name: "rosetta_fold_relax_89000_0",
    app_name: "rosetta",
    exit_status: 0,
    elapsed_time: 18200,
    cpu_time: 18000,
    completed_time: NOW - 3 * DAY,
    create_time: NOW - 5 * DAY,
  },
  {
    project_url: EINSTEIN_URL,
    result_name: "einstein_BRP4_1200_0",
    app_name: "einsteinbinary_BRP4",
    exit_status: 0,
    elapsed_time: 43200,
    cpu_time: 42000,
    completed_time: NOW - 2 * DAY,
    create_time: NOW - 6 * DAY,
  },
  {
    project_url: CLIMATE_URL,
    result_name: "climate_hadcm3_run41_0",
    app_name: "hadcm3",
    exit_status: 0,
    elapsed_time: 72000,
    cpu_time: 71500,
    completed_time: NOW - 7 * DAY,
    create_time: NOW - 14 * DAY,
  },
];

export const mockAllProjectsList: ProjectListEntry[] = [
  {
    name: "Rosetta@home",
    url: ROSETTA_URL,
    general_area: "Biology and Medicine",
    specific_area: "Protein structure prediction",
    description:
      "Determines the 3-dimensional shapes of proteins in research that may ultimately lead to finding cures for some major human diseases.",
    home: "University of Washington",
    platforms: ["x86_64-pc-linux-gnu", "windows_x86_64", "x86_64-apple-darwin"],
  },
  {
    name: "Einstein@Home",
    url: EINSTEIN_URL,
    general_area: "Physical Science",
    specific_area: "Astrophysics",
    description:
      "Search for gravitational waves from spinning neutron stars using data from the LIGO gravitational-wave detectors.",
    home: "University of Wisconsin-Milwaukee",
    platforms: ["x86_64-pc-linux-gnu", "windows_x86_64", "x86_64-apple-darwin"],
  },
  {
    name: "Climateprediction.net",
    url: CLIMATE_URL,
    general_area: "Earth Science",
    specific_area: "Climate study",
    description:
      "Study climate change by running climate models on volunteers' computers.",
    home: "University of Oxford",
    platforms: ["x86_64-pc-linux-gnu", "windows_x86_64"],
  },
];
