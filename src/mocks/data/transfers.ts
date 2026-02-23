import type { FileTransfer } from "../../types/boinc";
import { NOW, ROSETTA_URL, EINSTEIN_URL } from "./_shared";

export const mockTransfers: FileTransfer[] = [
  {
    name: "rosetta_miniprotein_input_23847.tar.gz",
    project_url: ROSETTA_URL,
    project_name: "Rosetta@home",
    nbytes: 52428800, // 50 MB
    is_upload: false,
    status: 0,
    bytes_xferred: 31457280, // 30 MB
    file_offset: 31457280,
    xfer_speed: 1048576, // 1 MB/s
    hostname: "boinc.bakerlab.org",
    time_so_far: 30,
    estimated_xfer_time_remaining: 20,
    first_request_time: NOW - 30,
    next_request_time: NOW,
    num_retries: 0,
    project_backoff: 0,
  },
  {
    name: "einstein_O3AS_0982_output.zip",
    project_url: EINSTEIN_URL,
    project_name: "Einstein@Home",
    nbytes: 10485760, // 10 MB
    is_upload: true,
    status: 0,
    bytes_xferred: 5242880, // 5 MB
    file_offset: 5242880,
    xfer_speed: 524288, // 512 KB/s
    hostname: "einstein.phys.uwm.edu",
    time_so_far: 10,
    estimated_xfer_time_remaining: 10,
    first_request_time: NOW - 10,
    next_request_time: NOW,
    num_retries: 0,
    project_backoff: 0,
  },
  {
    name: "einstein_BRP4_app_v140.exe",
    project_url: EINSTEIN_URL,
    project_name: "Einstein@Home",
    nbytes: 8388608, // 8 MB
    is_upload: false,
    status: -114, // ERR_GETHOSTBYNAME
    bytes_xferred: 2097152, // 2 MB
    file_offset: 2097152,
    xfer_speed: 0,
    hostname: "einstein.phys.uwm.edu",
    time_so_far: 45,
    estimated_xfer_time_remaining: -1,
    first_request_time: NOW - 300,
    next_request_time: NOW + 600,
    num_retries: 3,
    project_backoff: 600,
  },
];
