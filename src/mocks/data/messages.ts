import type { Message } from "../../types/boinc";
import { MSG_PRIORITY } from "../../types/boinc";
import { NOW, DAY } from "./_shared";

export const mockMessages: Message[] = [
  { seqno: 1, priority: MSG_PRIORITY.INFO, timestamp: NOW - 10 * DAY, project: "", body: "Starting BOINC client version 8.0.4 for x86_64-pc-linux-gnu" },
  { seqno: 2, priority: MSG_PRIORITY.INFO, timestamp: NOW - 10 * DAY + 1, project: "", body: "Data directory: /var/lib/boinc" },
  { seqno: 3, priority: MSG_PRIORITY.INFO, timestamp: NOW - 10 * DAY + 2, project: "", body: "Processor: 8 GenuineIntel Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz [Family 6 Model 165 Stepping 5]" },
  { seqno: 4, priority: MSG_PRIORITY.INFO, timestamp: NOW - 9 * DAY, project: "Rosetta@home", body: "Sending scheduler request: Requested by user." },
  { seqno: 5, priority: MSG_PRIORITY.INFO, timestamp: NOW - 9 * DAY + 60, project: "Rosetta@home", body: "Scheduler request completed: got 3 new tasks" },
  { seqno: 6, priority: MSG_PRIORITY.INFO, timestamp: NOW - 8 * DAY, project: "Einstein@Home", body: "Sending scheduler request: To fetch work." },
  { seqno: 7, priority: MSG_PRIORITY.INFO, timestamp: NOW - 8 * DAY + 30, project: "Einstein@Home", body: "Scheduler request completed: got 2 new tasks" },
  { seqno: 8, priority: MSG_PRIORITY.USER_ALERT, timestamp: NOW - 7 * DAY, project: "Climateprediction.net", body: "Project suspended by user" },
  { seqno: 9, priority: MSG_PRIORITY.INFO, timestamp: NOW - 6 * DAY, project: "Rosetta@home", body: "Computation for task rosetta_fold_relax_89712_1 finished" },
  { seqno: 10, priority: MSG_PRIORITY.INFO, timestamp: NOW - 6 * DAY + 60, project: "Rosetta@home", body: "Output file upload complete" },
  { seqno: 11, priority: MSG_PRIORITY.INTERNAL_ERROR, timestamp: NOW - 5 * DAY, project: "Climateprediction.net", body: "Computation for task climate_hadcm3_run42_0 failed: exit code -1073741819 (0xC0000005)" },
  { seqno: 12, priority: MSG_PRIORITY.INFO, timestamp: NOW - 4 * DAY, project: "Einstein@Home", body: "Starting task LATeah1091F_600.0_0_0 using opencl_nvidia_101 app version" },
  { seqno: 13, priority: MSG_PRIORITY.INFO, timestamp: NOW - 3 * DAY, project: "", body: "Benchmark results: 8 CPUs, 30.41 GFLOPS" },
  { seqno: 14, priority: MSG_PRIORITY.INFO, timestamp: NOW - 2 * DAY, project: "Rosetta@home", body: "Sending scheduler request: To report completed tasks." },
  { seqno: 15, priority: MSG_PRIORITY.INFO, timestamp: NOW - 2 * DAY + 30, project: "Rosetta@home", body: "Scheduler request completed" },
  { seqno: 16, priority: MSG_PRIORITY.USER_ALERT, timestamp: NOW - DAY, project: "", body: "Network connection lost, retrying in 60 seconds" },
  { seqno: 17, priority: MSG_PRIORITY.INFO, timestamp: NOW - DAY + 120, project: "", body: "Network connection recovered" },
  { seqno: 18, priority: MSG_PRIORITY.INFO, timestamp: NOW - 3600, project: "Rosetta@home", body: "Starting task rosetta_miniprotein_design_23847_0" },
  { seqno: 19, priority: MSG_PRIORITY.INFO, timestamp: NOW - 1800, project: "Einstein@Home", body: "Sending scheduler request: To fetch work." },
  { seqno: 20, priority: MSG_PRIORITY.INFO, timestamp: NOW - 1800 + 15, project: "Einstein@Home", body: "Scheduler request completed: got 1 new task" },
];
