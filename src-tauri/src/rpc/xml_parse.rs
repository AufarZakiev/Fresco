use quick_xml::events::Event;
use quick_xml::Reader;

use super::types::{
    AccountOut, AcctMgrInfo, AcctMgrRpcReply, CcConfig, CcState, CcStatus, Coproc, DailyStats,
    DailyXfer, DailyXferHistory, DayOfWeekPrefs, DiskUsage, DiskUsageProject, FileTransfer,
    GlobalPreferences, GuiUrl, HostInfo, LogFlags, Message, NewerVersionInfo, Notice, OldResult,
    Project, ProjectAttachReply, ProjectConfig, ProjectInitStatus, ProjectListEntry,
    ProjectStatistics, ProxyInfo, TaskResult, VersionInfo, WslDistro,
};

/// Extract text content of an XML element, advancing the reader past its end tag.
/// Handles both regular text and CDATA sections.
fn read_text(reader: &mut Reader<&[u8]>) -> String {
    let mut buf = Vec::new();
    let mut text = String::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Text(e)) => {
                text.push_str(&e.unescape().unwrap_or_default());
            }
            Ok(Event::CData(e)) => {
                if let Ok(s) = std::str::from_utf8(&e) {
                    text.push_str(s);
                }
            }
            Ok(Event::End(_)) | Ok(Event::Eof) => break,
            _ => {}
        }
        buf.clear();
    }
    text
}

/// Parse the `<results>` section from a `get_results` or `get_state` response.
pub fn parse_results(xml: &str) -> Vec<TaskResult> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut results = Vec::new();
    let mut in_result = false;
    let mut in_active_task = false;
    let mut current = TaskResult::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "result" => {
                        in_result = true;
                        current = TaskResult::default();
                    }
                    "active_task" if in_result => {
                        in_active_task = true;
                        current.active_task = true;
                    }
                    _ if in_result => {
                        let text = read_text(&mut reader);
                        if in_active_task {
                            match tag.as_str() {
                                "active_task_state" => {
                                    current.active_task_state =
                                        text.parse().unwrap_or(0);
                                }
                                "scheduler_state" => {
                                    current.scheduler_state =
                                        text.parse().unwrap_or(0);
                                }
                                "elapsed_time" => {
                                    current.elapsed_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "fraction_done" => {
                                    current.fraction_done =
                                        text.parse().unwrap_or(0.0);
                                }
                                "checkpoint_cpu_time" => {
                                    current.checkpoint_cpu_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "current_cpu_time" => {
                                    current.current_cpu_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "progress_rate" => {
                                    current.progress_rate =
                                        text.parse().unwrap_or(0.0);
                                }
                                "working_set_size_smoothed" => {
                                    current.working_set_size_smoothed =
                                        text.parse().unwrap_or(0.0);
                                }
                                "swap_size" => {
                                    current.swap_size =
                                        text.parse().unwrap_or(0.0);
                                }
                                "slot" => {
                                    current.slot = text.parse().unwrap_or(-1);
                                }
                                "pid" => {
                                    current.pid = text.parse().unwrap_or(0);
                                }
                                "slot_path" => current.slot_path = text,
                                "graphics_exec_path" => {
                                    current.graphics_exec_path = text
                                }
                                "web_graphics_url" => {
                                    current.web_graphics_url = text
                                }
                                "remote_desktop_addr" => {
                                    current.remote_desktop_addr = text
                                }
                                _ => {}
                            }
                        } else {
                            match tag.as_str() {
                                "name" => current.name = text,
                                "wu_name" => current.wu_name = text,
                                "project_url" => current.project_url = text,
                                "report_deadline" => {
                                    current.report_deadline =
                                        text.parse().unwrap_or(0.0);
                                }
                                "received_time" => {
                                    current.received_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "estimated_cpu_time_remaining" => {
                                    current.estimated_cpu_time_remaining =
                                        text.parse().unwrap_or(0.0);
                                }
                                "state" => {
                                    current.state = text.parse().unwrap_or(0);
                                }
                                "scheduler_state" => {
                                    current.scheduler_state =
                                        text.parse().unwrap_or(0);
                                }
                                "suspended_via_gui" => {
                                    current.suspended_via_gui = true;
                                }
                                "project_suspended_via_gui" => {
                                    current.project_suspended_via_gui = true;
                                }
                                "ready_to_report" => {
                                    current.ready_to_report = true;
                                }
                                "got_server_ack" => {
                                    current.got_server_ack = true;
                                }
                                "plan_class" => current.plan_class = text,
                                "resources" => current.resources = text,
                                "version_num" => {
                                    current.version_num =
                                        text.parse().unwrap_or(0);
                                }
                                _ => {}
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_result => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "active_task" => current.active_task = true,
                    "suspended_via_gui" => current.suspended_via_gui = true,
                    "project_suspended_via_gui" => {
                        current.project_suspended_via_gui = true;
                    }
                    "ready_to_report" => current.ready_to_report = true,
                    "got_server_ack" => current.got_server_ack = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "result" => {
                        in_result = false;
                        in_active_task = false;
                        results.push(current.clone());
                    }
                    "active_task" => {
                        in_active_task = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    results
}

/// Parse `<projects>` section from a `get_state` or `get_project_status` response.
pub fn parse_projects(xml: &str) -> Vec<Project> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut projects = Vec::new();
    let mut in_project = false;
    let mut in_gui_urls = false;
    let mut in_gui_url = false;
    let mut current = Project::default();
    let mut current_gui_url = GuiUrl::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project" => {
                        in_project = true;
                        current = Project::default();
                    }
                    "gui_urls" if in_project => {
                        in_gui_urls = true;
                    }
                    "gui_url" if in_gui_urls => {
                        in_gui_url = true;
                        current_gui_url = GuiUrl::default();
                    }
                    _ if in_gui_url => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "name" => current_gui_url.name = text,
                            "description" => current_gui_url.description = text,
                            "url" => current_gui_url.url = text,
                            _ => {}
                        }
                    }
                    _ if in_project && !in_gui_urls => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "master_url" => current.master_url = text,
                            "project_name" => current.project_name = text,
                            "user_name" => current.user_name = text,
                            "team_name" => current.team_name = text,
                            "user_total_credit" => {
                                current.user_total_credit =
                                    text.parse().unwrap_or(0.0);
                            }
                            "user_expavg_credit" => {
                                current.user_expavg_credit =
                                    text.parse().unwrap_or(0.0);
                            }
                            "host_total_credit" => {
                                current.host_total_credit =
                                    text.parse().unwrap_or(0.0);
                            }
                            "host_expavg_credit" => {
                                current.host_expavg_credit =
                                    text.parse().unwrap_or(0.0);
                            }
                            "resource_share" => {
                                current.resource_share =
                                    text.parse().unwrap_or(0.0);
                            }
                            "hostid" => {
                                current.hostid = text.parse().unwrap_or(0);
                            }
                            "disk_usage" => {
                                current.disk_usage =
                                    text.parse().unwrap_or(0.0);
                            }
                            "nrpc_failures" => {
                                current.nrpc_failures =
                                    text.parse().unwrap_or(0);
                            }
                            "min_rpc_time" => {
                                current.min_rpc_time =
                                    text.parse().unwrap_or(0.0);
                            }
                            "download_backoff" => {
                                current.download_backoff =
                                    text.parse().unwrap_or(0.0);
                            }
                            "upload_backoff" => {
                                current.upload_backoff =
                                    text.parse().unwrap_or(0.0);
                            }
                            "sched_priority" => {
                                current.sched_priority =
                                    text.parse().unwrap_or(0.0);
                            }
                            "duration_correction_factor" => {
                                current.duration_correction_factor =
                                    text.parse().unwrap_or(0.0);
                            }
                            "last_rpc_time" => {
                                current.last_rpc_time =
                                    text.parse().unwrap_or(0.0);
                            }
                            "njobs_success" => {
                                current.njobs_success =
                                    text.parse().unwrap_or(0);
                            }
                            "njobs_error" => {
                                current.njobs_error =
                                    text.parse().unwrap_or(0);
                            }
                            "venue" => current.venue = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_project => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "suspended_via_gui" => current.suspended_via_gui = true,
                    "dont_request_more_work" => {
                        current.dont_request_more_work = true;
                    }
                    "attached_via_acct_mgr" => {
                        current.attached_via_acct_mgr = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project" => {
                        in_project = false;
                        in_gui_urls = false;
                        in_gui_url = false;
                        projects.push(current.clone());
                    }
                    "gui_urls" => {
                        in_gui_urls = false;
                    }
                    "gui_url" => {
                        in_gui_url = false;
                        current.gui_urls.push(current_gui_url.clone());
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    projects
}

/// Parse `<cc_status>` from a `get_cc_status` response.
pub fn parse_cc_status(xml: &str) -> CcStatus {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut status = CcStatus::default();
    let mut in_status = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "cc_status" => {
                        in_status = true;
                    }
                    _ if in_status => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "task_mode" => {
                                status.task_mode = text.parse().unwrap_or(0);
                            }
                            "task_mode_perm" => {
                                status.task_mode_perm = text.parse().unwrap_or(0);
                            }
                            "task_mode_delay" => {
                                status.task_mode_delay =
                                    text.parse().unwrap_or(0.0);
                            }
                            "gpu_mode" => {
                                status.gpu_mode = text.parse().unwrap_or(0);
                            }
                            "gpu_mode_perm" => {
                                status.gpu_mode_perm = text.parse().unwrap_or(0);
                            }
                            "gpu_mode_delay" => {
                                status.gpu_mode_delay =
                                    text.parse().unwrap_or(0.0);
                            }
                            "network_mode" => {
                                status.network_mode = text.parse().unwrap_or(0);
                            }
                            "network_mode_perm" => {
                                status.network_mode_perm =
                                    text.parse().unwrap_or(0);
                            }
                            "network_mode_delay" => {
                                status.network_mode_delay =
                                    text.parse().unwrap_or(0.0);
                            }
                            "network_status" => {
                                status.network_status = text.parse().unwrap_or(0);
                            }
                            "task_suspend_reason" => {
                                status.task_suspend_reason =
                                    text.parse().unwrap_or(0);
                            }
                            "gpu_suspend_reason" => {
                                status.gpu_suspend_reason =
                                    text.parse().unwrap_or(0);
                            }
                            "network_suspend_reason" => {
                                status.network_suspend_reason =
                                    text.parse().unwrap_or(0);
                            }
                            "max_event_log_lines" => {
                                status.max_event_log_lines =
                                    text.parse().unwrap_or(0);
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_status => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "ams_password_error" => status.ams_password_error = true,
                    "manager_must_quit" => status.manager_must_quit = true,
                    "disallow_attach" => status.disallow_attach = true,
                    "simple_gui_only" => status.simple_gui_only = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "cc_status" {
                    in_status = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    status
}

/// Check whether a response contains `<success/>`, returning an error if not.
pub fn parse_success(xml: &str) -> Result<(), String> {
    if xml.contains("<success/>") {
        Ok(())
    } else if xml.contains("<error>") {
        let mut reader = Reader::from_str(xml);
        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    if tag == "error" {
                        let text = read_text(&mut reader);
                        return Err(text);
                    }
                }
                Ok(Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
        Err("Unknown error".to_string())
    } else {
        Err("Unexpected response".to_string())
    }
}

/// Parse `<file_transfers>` from a `get_file_transfers` response.
pub fn parse_file_transfers(xml: &str) -> Vec<FileTransfer> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut transfers = Vec::new();
    let mut in_transfer = false;
    let mut in_file_xfer = false;
    let mut current = FileTransfer::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "file_transfer" => {
                        in_transfer = true;
                        current = FileTransfer::default();
                    }
                    "file_xfer" if in_transfer => {
                        in_file_xfer = true;
                    }
                    _ if in_transfer => {
                        let text = read_text(&mut reader);
                        if in_file_xfer {
                            match tag.as_str() {
                                "bytes_xferred" => {
                                    current.bytes_xferred =
                                        text.parse().unwrap_or(0.0);
                                }
                                "xfer_speed" => {
                                    current.xfer_speed =
                                        text.parse().unwrap_or(0.0);
                                }
                                "file_offset" => {
                                    current.file_offset =
                                        text.parse().unwrap_or(0.0);
                                }
                                "hostname" => current.hostname = text,
                                _ => {}
                            }
                        } else {
                            match tag.as_str() {
                                "project_url" => current.project_url = text,
                                "project_name" => current.project_name = text,
                                "name" => current.name = text,
                                "nbytes" => {
                                    current.nbytes =
                                        text.parse().unwrap_or(0.0);
                                }
                                "status" => {
                                    current.status =
                                        text.parse().unwrap_or(0);
                                }
                                "is_upload" => {
                                    current.is_upload = true;
                                }
                                "num_retries" => {
                                    current.num_retries =
                                        text.parse().unwrap_or(0);
                                }
                                "first_request_time" => {
                                    current.first_request_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "next_request_time" => {
                                    current.next_request_time =
                                        text.parse().unwrap_or(0.0);
                                }
                                "time_so_far" => {
                                    current.time_so_far =
                                        text.parse().unwrap_or(0.0);
                                }
                                "estimated_xfer_time_remaining" => {
                                    current.estimated_xfer_time_remaining =
                                        text.parse().unwrap_or(0.0);
                                }
                                "project_backoff" => {
                                    current.project_backoff =
                                        text.parse().unwrap_or(0.0);
                                }
                                _ => {}
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_transfer => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "is_upload" {
                    current.is_upload = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "file_transfer" => {
                        in_transfer = false;
                        in_file_xfer = false;
                        transfers.push(current.clone());
                    }
                    "file_xfer" => {
                        in_file_xfer = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    transfers
}

/// Parse `<statistics>` from a `get_statistics` response.
pub fn parse_statistics(xml: &str) -> Vec<ProjectStatistics> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut result = Vec::new();
    let mut in_project_statistics = false;
    let mut in_daily_statistics = false;
    let mut current_project = ProjectStatistics::default();
    let mut current_day = DailyStats::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project_statistics" => {
                        in_project_statistics = true;
                        current_project = ProjectStatistics::default();
                    }
                    "daily_statistics" if in_project_statistics => {
                        in_daily_statistics = true;
                        current_day = DailyStats::default();
                    }
                    _ if in_daily_statistics => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "day" => current_day.day = text.parse().unwrap_or(0.0),
                            "user_total_credit" => {
                                current_day.user_total_credit = text.parse().unwrap_or(0.0)
                            }
                            "user_expavg_credit" => {
                                current_day.user_expavg_credit = text.parse().unwrap_or(0.0)
                            }
                            "host_total_credit" => {
                                current_day.host_total_credit = text.parse().unwrap_or(0.0)
                            }
                            "host_expavg_credit" => {
                                current_day.host_expavg_credit = text.parse().unwrap_or(0.0)
                            }
                            _ => {}
                        }
                    }
                    _ if in_project_statistics => {
                        let text = read_text(&mut reader);
                        if tag == "master_url" {
                            current_project.master_url = text;
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project_statistics" => {
                        in_project_statistics = false;
                        result.push(current_project.clone());
                    }
                    "daily_statistics" => {
                        in_daily_statistics = false;
                        current_project.daily_statistics.push(current_day.clone());
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    result
}

/// Parse `<msgs>` from a `get_messages` response.
pub fn parse_messages(xml: &str) -> Vec<Message> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut messages = Vec::new();
    let mut in_msg = false;
    let mut current = Message::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "msg" => {
                        in_msg = true;
                        current = Message::default();
                    }
                    _ if in_msg => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "project" => current.project = text,
                            "pri" => current.priority = text.parse().unwrap_or(0),
                            "seqno" => current.seqno = text.parse().unwrap_or(0),
                            "body" => current.body = text.trim().to_string(),
                            "time" => current.timestamp = text.parse().unwrap_or(0.0),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "msg" {
                    in_msg = false;
                    messages.push(current.clone());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    messages
}

/// Parse `<notices>` from a `get_notices` response.
pub fn parse_notices(xml: &str) -> Vec<Notice> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut notices = Vec::new();
    let mut in_notice = false;
    let mut current = Notice::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "notice" => {
                        in_notice = true;
                        current = Notice::default();
                    }
                    _ if in_notice => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "seqno" => current.seqno = text.parse().unwrap_or(0),
                            "title" => current.title = text,
                            "description" => current.description = text,
                            "create_time" => {
                                current.create_time = text.parse().unwrap_or(0.0)
                            }
                            "project_name" => current.project_name = text,
                            "link" => current.link = text,
                            "category" => current.category = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_notice => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "is_private" {
                    current.is_private = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "notice" {
                    in_notice = false;
                    notices.push(current.clone());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    notices
}

/// Parse `<disk_usage_summary>` from a `get_disk_usage` response.
pub fn parse_disk_usage(xml: &str) -> DiskUsage {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut usage = DiskUsage::default();
    let mut in_summary = false;
    let mut in_project = false;
    let mut current_project = DiskUsageProject::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "disk_usage_summary" => {
                        in_summary = true;
                    }
                    "project" if in_summary => {
                        in_project = true;
                        current_project = DiskUsageProject::default();
                    }
                    _ if in_project => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "master_url" => current_project.master_url = text,
                            "disk_usage" => {
                                current_project.disk_usage = text.parse().unwrap_or(0.0)
                            }
                            _ => {}
                        }
                    }
                    _ if in_summary => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "d_total" => usage.d_total = text.parse().unwrap_or(0.0),
                            "d_free" => usage.d_free = text.parse().unwrap_or(0.0),
                            "d_boinc" => usage.d_boinc = text.parse().unwrap_or(0.0),
                            "d_allowed" => usage.d_allowed = text.parse().unwrap_or(0.0),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project" if in_summary => {
                        in_project = false;
                        usage.projects.push(current_project.clone());
                    }
                    "disk_usage_summary" => {
                        in_summary = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    usage
}

/// Parse `<global_preferences>` from a `get_global_prefs_override` response.
pub fn parse_global_preferences(xml: &str) -> GlobalPreferences {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut prefs = GlobalPreferences::default();
    let mut in_prefs = false;
    let mut in_day_prefs = false;
    let mut current_day = DayOfWeekPrefs::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "global_preferences" => {
                        in_prefs = true;
                    }
                    "day_prefs" if in_prefs => {
                        in_day_prefs = true;
                        current_day = DayOfWeekPrefs::default();
                    }
                    _ if in_day_prefs => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "day_of_week" => {
                                current_day.day_of_week = text.parse().unwrap_or(0)
                            }
                            "start_hour" => {
                                current_day.start_hour = text.parse().unwrap_or(0.0)
                            }
                            "end_hour" => {
                                current_day.end_hour = text.parse().unwrap_or(0.0)
                            }
                            "net_start_hour" => {
                                current_day.net_start_hour = text.parse().unwrap_or(0.0)
                            }
                            "net_end_hour" => {
                                current_day.net_end_hour = text.parse().unwrap_or(0.0)
                            }
                            _ => {}
                        }
                    }
                    _ if in_prefs => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "run_on_batteries" => {
                                prefs.run_on_batteries = text.parse::<i32>().unwrap_or(0) != 0
                            }
                            "run_if_user_active" => {
                                prefs.run_if_user_active = text.parse::<i32>().unwrap_or(0) != 0
                            }
                            "idle_time_to_run" => {
                                prefs.idle_time_to_run = text.parse().unwrap_or(0.0)
                            }
                            "max_ncpus_pct" => {
                                prefs.max_ncpus_pct = text.parse().unwrap_or(0.0)
                            }
                            "cpu_usage_limit" => {
                                prefs.cpu_usage_limit = text.parse().unwrap_or(0.0)
                            }
                            "ram_max_used_busy_frac" => {
                                prefs.ram_max_used_busy_frac = text.parse().unwrap_or(0.0)
                            }
                            "ram_max_used_idle_frac" => {
                                prefs.ram_max_used_idle_frac = text.parse().unwrap_or(0.0)
                            }
                            "max_bytes_sec_down" => {
                                prefs.max_bytes_sec_down = text.parse().unwrap_or(0.0)
                            }
                            "max_bytes_sec_up" => {
                                prefs.max_bytes_sec_up = text.parse().unwrap_or(0.0)
                            }
                            "daily_xfer_limit_mb" => {
                                prefs.daily_xfer_limit_mb = text.parse().unwrap_or(0.0)
                            }
                            "disk_max_used_gb" => {
                                prefs.disk_max_used_gb = text.parse().unwrap_or(0.0)
                            }
                            "disk_max_used_pct" => {
                                prefs.disk_max_used_pct = text.parse().unwrap_or(0.0)
                            }
                            "disk_min_free_gb" => {
                                prefs.disk_min_free_gb = text.parse().unwrap_or(0.0)
                            }
                            "work_buf_min_days" => {
                                prefs.work_buf_min_days = text.parse().unwrap_or(0.0)
                            }
                            "cpu_scheduling_period_minutes" => {
                                prefs.cpu_scheduling_period_minutes =
                                    text.parse().unwrap_or(0.0)
                            }
                            "start_hour" => {
                                prefs.start_hour = text.parse().unwrap_or(0.0)
                            }
                            "end_hour" => {
                                prefs.end_hour = text.parse().unwrap_or(0.0)
                            }
                            "net_start_hour" => {
                                prefs.net_start_hour = text.parse().unwrap_or(0.0)
                            }
                            "net_end_hour" => {
                                prefs.net_end_hour = text.parse().unwrap_or(0.0)
                            }
                            "suspend_if_no_recent_input" => {
                                prefs.suspend_if_no_recent_input =
                                    text.parse().unwrap_or(0.0)
                            }
                            "suspend_cpu_usage" => {
                                prefs.suspend_cpu_usage = text.parse().unwrap_or(0.0)
                            }
                            "leave_apps_in_memory" => {
                                prefs.leave_apps_in_memory =
                                    text.parse::<i32>().unwrap_or(0) != 0
                            }
                            "work_buf_additional_days" => {
                                prefs.work_buf_additional_days =
                                    text.parse().unwrap_or(0.0)
                            }
                            "run_gpu_if_user_active" => {
                                prefs.run_gpu_if_user_active =
                                    text.parse::<i32>().unwrap_or(0) != 0
                            }
                            "daily_xfer_period_days" => {
                                prefs.daily_xfer_period_days =
                                    text.parse().unwrap_or(0)
                            }
                            "disk_interval" => {
                                prefs.disk_interval = text.parse().unwrap_or(0.0)
                            }
                            "niu_suspend_cpu_usage" => {
                                prefs.niu_suspend_cpu_usage =
                                    text.parse().unwrap_or(0.0)
                            }
                            "niu_cpu_usage_limit" => {
                                prefs.niu_cpu_usage_limit =
                                    text.parse().unwrap_or(0.0)
                            }
                            "niu_max_ncpus_pct" => {
                                prefs.niu_max_ncpus_pct =
                                    text.parse().unwrap_or(0.0)
                            }
                            "max_ncpus" => {
                                prefs.max_ncpus = text.parse().unwrap_or(0)
                            }
                            "battery_charge_min_pct" => {
                                prefs.battery_charge_min_pct =
                                    text.parse().unwrap_or(0.0)
                            }
                            "battery_max_temperature" => {
                                prefs.battery_max_temperature =
                                    text.parse().unwrap_or(0.0)
                            }
                            "vm_max_used_frac" => {
                                prefs.vm_max_used_frac =
                                    text.parse().unwrap_or(0.0)
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_prefs => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "run_on_batteries" => prefs.run_on_batteries = true,
                    "run_if_user_active" => prefs.run_if_user_active = true,
                    "run_gpu_if_user_active" => prefs.run_gpu_if_user_active = true,
                    "leave_apps_in_memory" => prefs.leave_apps_in_memory = true,
                    "dont_verify_images" => prefs.dont_verify_images = true,
                    "confirm_before_connecting" => prefs.confirm_before_connecting = true,
                    "hangup_if_dialed" => prefs.hangup_if_dialed = true,
                    "network_wifi_only" => prefs.network_wifi_only = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "global_preferences" => {
                        in_prefs = false;
                    }
                    "day_prefs" => {
                        in_day_prefs = false;
                        prefs.day_prefs.push(current_day.clone());
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    prefs
}

/// Serialize global preferences to XML for `set_global_prefs_override`.
pub fn serialize_global_preferences(prefs: &GlobalPreferences) -> String {
    let mut xml = format!(
        "<global_preferences>\n\
         <run_on_batteries>{}</run_on_batteries>\n\
         <run_if_user_active>{}</run_if_user_active>\n\
         <run_gpu_if_user_active>{}</run_gpu_if_user_active>\n\
         <idle_time_to_run>{}</idle_time_to_run>\n\
         <max_ncpus_pct>{}</max_ncpus_pct>\n\
         <cpu_usage_limit>{}</cpu_usage_limit>\n\
         <ram_max_used_busy_frac>{}</ram_max_used_busy_frac>\n\
         <ram_max_used_idle_frac>{}</ram_max_used_idle_frac>\n\
         <max_bytes_sec_down>{}</max_bytes_sec_down>\n\
         <max_bytes_sec_up>{}</max_bytes_sec_up>\n\
         <daily_xfer_limit_mb>{}</daily_xfer_limit_mb>\n\
         <daily_xfer_period_days>{}</daily_xfer_period_days>\n\
         <disk_max_used_gb>{}</disk_max_used_gb>\n\
         <disk_max_used_pct>{}</disk_max_used_pct>\n\
         <disk_min_free_gb>{}</disk_min_free_gb>\n\
         <disk_interval>{}</disk_interval>\n\
         <work_buf_min_days>{}</work_buf_min_days>\n\
         <cpu_scheduling_period_minutes>{}</cpu_scheduling_period_minutes>\n\
         <start_hour>{}</start_hour>\n\
         <end_hour>{}</end_hour>\n\
         <net_start_hour>{}</net_start_hour>\n\
         <net_end_hour>{}</net_end_hour>\n\
         <suspend_if_no_recent_input>{}</suspend_if_no_recent_input>\n\
         <suspend_cpu_usage>{}</suspend_cpu_usage>\n\
         <niu_suspend_cpu_usage>{}</niu_suspend_cpu_usage>\n\
         <niu_cpu_usage_limit>{}</niu_cpu_usage_limit>\n\
         <niu_max_ncpus_pct>{}</niu_max_ncpus_pct>\n\
         <leave_apps_in_memory>{}</leave_apps_in_memory>\n\
         <work_buf_additional_days>{}</work_buf_additional_days>\n\
         <max_ncpus>{}</max_ncpus>\n\
         <battery_charge_min_pct>{}</battery_charge_min_pct>\n\
         <battery_max_temperature>{}</battery_max_temperature>\n\
         <vm_max_used_frac>{}</vm_max_used_frac>\n",
        if prefs.run_on_batteries { 1 } else { 0 },
        if prefs.run_if_user_active { 1 } else { 0 },
        if prefs.run_gpu_if_user_active { 1 } else { 0 },
        prefs.idle_time_to_run,
        prefs.max_ncpus_pct,
        prefs.cpu_usage_limit,
        prefs.ram_max_used_busy_frac,
        prefs.ram_max_used_idle_frac,
        prefs.max_bytes_sec_down,
        prefs.max_bytes_sec_up,
        prefs.daily_xfer_limit_mb,
        prefs.daily_xfer_period_days,
        prefs.disk_max_used_gb,
        prefs.disk_max_used_pct,
        prefs.disk_min_free_gb,
        prefs.disk_interval,
        prefs.work_buf_min_days,
        prefs.cpu_scheduling_period_minutes,
        prefs.start_hour,
        prefs.end_hour,
        prefs.net_start_hour,
        prefs.net_end_hour,
        prefs.suspend_if_no_recent_input,
        prefs.suspend_cpu_usage,
        prefs.niu_suspend_cpu_usage,
        prefs.niu_cpu_usage_limit,
        prefs.niu_max_ncpus_pct,
        if prefs.leave_apps_in_memory { 1 } else { 0 },
        prefs.work_buf_additional_days,
        prefs.max_ncpus,
        prefs.battery_charge_min_pct,
        prefs.battery_max_temperature,
        prefs.vm_max_used_frac,
    );
    if prefs.dont_verify_images {
        xml.push_str("<dont_verify_images/>\n");
    }
    if prefs.confirm_before_connecting {
        xml.push_str("<confirm_before_connecting/>\n");
    }
    if prefs.hangup_if_dialed {
        xml.push_str("<hangup_if_dialed/>\n");
    }
    if prefs.network_wifi_only {
        xml.push_str("<network_wifi_only/>\n");
    }
    for dp in &prefs.day_prefs {
        xml.push_str(&format!(
            "<day_prefs>\n\
             <day_of_week>{}</day_of_week>\n\
             <start_hour>{}</start_hour>\n\
             <end_hour>{}</end_hour>\n\
             <net_start_hour>{}</net_start_hour>\n\
             <net_end_hour>{}</net_end_hour>\n\
             </day_prefs>\n",
            dp.day_of_week, dp.start_hour, dp.end_hour, dp.net_start_hour, dp.net_end_hour
        ));
    }
    xml.push_str("</global_preferences>");
    xml
}

/// Parse `<host_info>` from a `get_host_info` response.
pub fn parse_host_info(xml: &str) -> HostInfo {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut info = HostInfo::default();
    let mut in_host_info = false;
    let mut in_coproc = false;
    let mut in_wsl = false;
    let mut in_distro = false;
    let mut current_coproc = Coproc::default();
    let mut current_distro = WslDistro::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "host_info" => {
                        in_host_info = true;
                    }
                    "coproc_cuda" if in_host_info => {
                        in_coproc = true;
                        current_coproc = Coproc::default();
                        current_coproc.coproc_type = "CUDA".to_string();
                    }
                    "coproc_opencl" if in_host_info => {
                        in_coproc = true;
                        current_coproc = Coproc::default();
                        current_coproc.coproc_type = "OpenCL".to_string();
                    }
                    "wsl" if in_host_info => {
                        in_wsl = true;
                    }
                    "distro" if in_wsl => {
                        in_distro = true;
                        current_distro = WslDistro::default();
                    }
                    _ if in_coproc => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "name" => current_coproc.name = text,
                            "count" => current_coproc.count = text.parse().unwrap_or(0),
                            // CUDA uses available_ram + totalGlobalMem; OpenCL uses global_mem_size
                            "available_ram" | "totalGlobalMem" | "global_mem_size" => {
                                let v: f64 = text.parse().unwrap_or(0.0);
                                if v > current_coproc.available_ram {
                                    current_coproc.available_ram = v;
                                }
                            }
                            // CUDA: drvVersion (int); also accept driver_version string
                            "drvVersion" => {
                                let v: i32 = text.parse().unwrap_or(0);
                                if v > 0 {
                                    // NVIDIA int format: major*100 + minor, e.g. 56070 → 560.70
                                    let major = v / 100;
                                    let minor = v % 100;
                                    current_coproc.driver_version = format!("{major}.{minor:02}");
                                }
                            }
                            "driver_version" | "display_driver_version" => {
                                if current_coproc.driver_version.is_empty() {
                                    current_coproc.driver_version = text;
                                }
                            }
                            // CUDA XML uses cudaVersion
                            "cudaVersion" | "cuda_version" => {
                                current_coproc.cuda_version = text.parse().unwrap_or(0);
                            }
                            // CUDA: major/minor; OpenCL: nv_compute_capability_major/minor
                            "major" | "nv_compute_capability_major" => {
                                current_coproc.compute_cap_major = text.parse().unwrap_or(0);
                            }
                            "minor" | "nv_compute_capability_minor" => {
                                current_coproc.compute_cap_minor = text.parse().unwrap_or(0);
                            }
                            "clockRate" | "max_clock_frequency" => {
                                current_coproc.clock_rate = text.parse().unwrap_or(0.0);
                            }
                            "multiProcessorCount" | "max_compute_units" => {
                                current_coproc.multiprocessor_count = text.parse().unwrap_or(0);
                            }
                            "peak_flops" => current_coproc.peak_flops = text.parse().unwrap_or(0.0),
                            "opencl_device_version" => current_coproc.opencl_device_version = text,
                            "opencl_driver_version" => current_coproc.opencl_driver_version = text,
                            "vendor" => current_coproc.vendor = text,
                            _ => {}
                        }
                    }
                    _ if in_distro => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "distro_name" => {
                                current_distro.distro_name = text.clone();
                                current_distro.is_buda_runner = text == "boinc-buda-runner";
                            }
                            "os_name" => current_distro.os_name = text,
                            "os_version" => current_distro.os_version = text,
                            "wsl_version" => current_distro.wsl_version = text,
                            "distro_version" => {
                                current_distro.buda_runner_version = text.parse().unwrap_or(0);
                            }
                            "docker_version" => current_distro.docker_version = text,
                            "docker_type" => current_distro.docker_type = text,
                            _ => {}
                        }
                    }
                    _ if in_host_info => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "domain_name" => info.domain_name = text,
                            "ip_addr" => info.ip_addr = text,
                            "p_ncpus" => info.p_ncpus = text.parse().unwrap_or(0),
                            "p_vendor" => info.p_vendor = text,
                            "p_model" => info.p_model = text,
                            "p_fpops" => info.p_fpops = text.parse().unwrap_or(0.0),
                            "p_iops" => info.p_iops = text.parse().unwrap_or(0.0),
                            "m_nbytes" => info.m_nbytes = text.parse().unwrap_or(0.0),
                            "m_cache" => info.m_cache = text.parse().unwrap_or(0.0),
                            "m_swap" => info.m_swap = text.parse().unwrap_or(0.0),
                            "d_total" => info.d_total = text.parse().unwrap_or(0.0),
                            "d_free" => info.d_free = text.parse().unwrap_or(0.0),
                            "os_name" => info.os_name = text,
                            "os_version" => info.os_version = text,
                            "product_name" => info.product_name = text,
                            "virtualbox_version" => info.virtualbox_version = text,
                            "timezone" => info.timezone = text.parse().unwrap_or(0),
                            "host_cpid" => info.host_cpid = text,
                            "p_features" => info.p_features = text,
                            "p_membw" => info.p_membw = text.parse().unwrap_or(0.0),
                            "p_calculated" => info.p_calculated = text.parse().unwrap_or(0.0),
                            "mac_address" => info.mac_address = text,
                            "docker_version" => info.docker_version = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_host_info => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "p_vm_extensions_disabled" {
                    info.p_vm_extensions_disabled = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "coproc_cuda" | "coproc_opencl" => {
                        if in_coproc {
                            info.coprocs.push(current_coproc.clone());
                            in_coproc = false;
                        }
                    }
                    "distro" => {
                        if in_distro {
                            info.wsl_distros.push(current_distro.clone());
                            in_distro = false;
                        }
                    }
                    "wsl" => {
                        in_wsl = false;
                    }
                    "host_info" => {
                        in_host_info = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    info
}

/// Parse `<projects>` from a `get_all_projects_list` response.
pub fn parse_all_projects_list(xml: &str) -> Vec<ProjectListEntry> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut entries = Vec::new();
    let mut in_project = false;
    let mut in_platforms = false;
    let mut current = ProjectListEntry::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project" => {
                        in_project = true;
                        current = ProjectListEntry::default();
                    }
                    "platforms" if in_project => {
                        in_platforms = true;
                    }
                    "name" if in_platforms => {
                        let text = read_text(&mut reader);
                        current.platforms.push(text);
                    }
                    _ if in_project && !in_platforms => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "name" => current.name = text,
                            "url" => current.url = text,
                            "general_area" => current.general_area = text,
                            "specific_area" => current.specific_area = text,
                            "description" => current.description = text,
                            "home" => current.home = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project" => {
                        in_project = false;
                        in_platforms = false;
                        entries.push(current.clone());
                    }
                    "platforms" => {
                        in_platforms = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    entries
}

/// Parse account lookup poll result.
pub fn parse_account_out(xml: &str) -> AccountOut {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut out = AccountOut::default();
    let mut in_account_out = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "account_out" => {
                        in_account_out = true;
                    }
                    _ if in_account_out => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "error_num" => out.error_num = text.parse().unwrap_or(0),
                            "authenticator" => out.authenticator = text,
                            "error_msg" => out.error_msg = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "account_out" {
                    in_account_out = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    out
}

/// Parse project attach poll result.
pub fn parse_project_attach_reply(xml: &str) -> ProjectAttachReply {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut reply = ProjectAttachReply::default();
    let mut in_reply = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project_attach_reply" => {
                        in_reply = true;
                    }
                    _ if in_reply => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "error_num" => reply.error_num = text.parse().unwrap_or(0),
                            "message" => reply.messages.push(text),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "project_attach_reply" {
                    in_reply = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    reply
}

/// Parse `<project_config>` from a `get_project_config_poll` response (Phase 4).
pub fn parse_project_config(xml: &str) -> ProjectConfig {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut config = ProjectConfig::default();
    let mut in_config = false;
    let mut in_platforms = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project_config" => {
                        in_config = true;
                    }
                    "platforms" if in_config => {
                        in_platforms = true;
                    }
                    "platform_name" if in_platforms => {
                        let text = read_text(&mut reader);
                        config.platforms.push(text);
                    }
                    _ if in_config && !in_platforms => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "error_num" => config.error_num = text.parse().unwrap_or(0),
                            "name" => config.name = text,
                            "master_url" => config.master_url = text,
                            "min_passwd_length" => {
                                config.min_passwd_length = text.parse().unwrap_or(0)
                            }
                            "terms_of_use" => config.terms_of_use = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_config => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "account_creation_disabled" => config.account_creation_disabled = true,
                    "client_account_creation_disabled" => {
                        config.client_account_creation_disabled = true
                    }
                    "uses_username" => config.uses_username = true,
                    "terms_of_use_is_html" => config.terms_of_use_is_html = true,
                    "ldap_auth" => config.ldap_auth = true,
                    "sched_stopped" => config.sched_stopped = true,
                    "web_stopped" => config.web_stopped = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "project_config" => in_config = false,
                    "platforms" => in_platforms = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    config
}

/// Parse `<acct_mgr_info>` response (Phase 4).
pub fn parse_acct_mgr_info(xml: &str) -> AcctMgrInfo {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut info = AcctMgrInfo::default();
    let mut in_info = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "acct_mgr_info" => in_info = true,
                    _ if in_info => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "acct_mgr_name" => info.acct_mgr_name = text,
                            "acct_mgr_url" => info.acct_mgr_url = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_info => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "have_credentials" {
                    info.have_credentials = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "acct_mgr_info" {
                    in_info = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    info
}

/// Parse `<acct_mgr_rpc_reply>` response (Phase 4).
pub fn parse_acct_mgr_rpc_reply(xml: &str) -> AcctMgrRpcReply {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut reply = AcctMgrRpcReply::default();
    let mut in_reply = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "acct_mgr_rpc_reply" => in_reply = true,
                    _ if in_reply => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "error_num" => reply.error_num = text.parse().unwrap_or(0),
                            "message" => reply.messages.push(text),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "acct_mgr_rpc_reply" {
                    in_reply = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    reply
}

/// Parse `<proxy_info>` from `get_proxy_settings` response (Phase 5).
pub fn parse_proxy_info(xml: &str) -> ProxyInfo {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut info = ProxyInfo::default();
    let mut in_proxy = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "proxy_info" => in_proxy = true,
                    _ if in_proxy => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "http_server_name" => info.http_server_name = text,
                            "http_server_port" => {
                                info.http_server_port = text.parse().unwrap_or(0)
                            }
                            "http_user_name" => info.http_user_name = text,
                            "http_user_passwd" => info.http_user_passwd = text,
                            "socks_server_name" => info.socks_server_name = text,
                            "socks_server_port" => {
                                info.socks_server_port = text.parse().unwrap_or(0)
                            }
                            "socks5_user_name" => info.socks5_user_name = text,
                            "socks5_user_passwd" => info.socks5_user_passwd = text,
                            "noproxy_hosts" => info.noproxy_hosts = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_proxy => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "use_http_proxy" => info.use_http_proxy = true,
                    "use_http_auth" => info.use_http_auth = true,
                    "use_socks_proxy" => info.use_socks_proxy = true,
                    "socks5_remote_dns" => info.socks5_remote_dns = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "proxy_info" {
                    in_proxy = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    info
}

/// Serialize proxy info to XML (Phase 5).
pub fn serialize_proxy_info(info: &ProxyInfo) -> String {
    let mut xml = String::from("<proxy_info>\n");
    if info.use_http_proxy {
        xml.push_str("<use_http_proxy/>\n");
    }
    xml.push_str(&format!(
        "<http_server_name>{}</http_server_name>\n\
         <http_server_port>{}</http_server_port>\n\
         <http_user_name>{}</http_user_name>\n\
         <http_user_passwd>{}</http_user_passwd>\n",
        info.http_server_name, info.http_server_port, info.http_user_name, info.http_user_passwd,
    ));
    if info.use_http_auth {
        xml.push_str("<use_http_auth/>\n");
    }
    if info.use_socks_proxy {
        xml.push_str("<use_socks_proxy/>\n");
    }
    xml.push_str(&format!(
        "<socks_server_name>{}</socks_server_name>\n\
         <socks_server_port>{}</socks_server_port>\n\
         <socks5_user_name>{}</socks5_user_name>\n\
         <socks5_user_passwd>{}</socks5_user_passwd>\n",
        info.socks_server_name, info.socks_server_port, info.socks5_user_name,
        info.socks5_user_passwd,
    ));
    if info.socks5_remote_dns {
        xml.push_str("<socks5_remote_dns/>\n");
    }
    xml.push_str(&format!(
        "<noproxy_hosts>{}</noproxy_hosts>\n</proxy_info>",
        info.noproxy_hosts
    ));
    xml
}

/// Parse `<cc_config>` from `get_cc_config` response (Phase 5).
pub fn parse_cc_config(xml: &str) -> CcConfig {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut config = CcConfig::default();
    let mut in_config = false;
    let mut in_log_flags = false;
    let mut in_exclusive_apps = false;
    let mut in_exclusive_gpu_apps = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "cc_config" | "config" => in_config = true,
                    "log_flags" if in_config => in_log_flags = true,
                    "options" if in_config => {} // container tag, just enter it
                    "exclusive_app" if in_config && !in_exclusive_gpu_apps => {
                        let text = read_text(&mut reader);
                        config.exclusive_apps.push(text);
                    }
                    "exclusive_gpu_app" if in_config => {
                        let text = read_text(&mut reader);
                        config.exclusive_gpu_apps.push(text);
                    }
                    _ if in_log_flags => {
                        let text = read_text(&mut reader);
                        let val = text.parse::<i32>().unwrap_or(0) != 0;
                        set_log_flag(&mut config.log_flags, &tag, val);
                    }
                    _ if in_config && !in_log_flags => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "max_file_xfers" => {
                                config.max_file_xfers = text.parse().unwrap_or(0)
                            }
                            "max_file_xfers_per_project" => {
                                config.max_file_xfers_per_project = text.parse().unwrap_or(0)
                            }
                            "max_ncpus" => {
                                config.max_ncpus = text.parse().unwrap_or(0)
                            }
                            "report_results_immediately" => {
                                config.report_results_immediately =
                                    text.parse::<i32>().unwrap_or(0) != 0
                            }
                            "http_transfer_timeout" => {
                                config.http_transfer_timeout = text.parse().unwrap_or(0)
                            }
                            "max_stderr_file_size" => {
                                config.max_stderr_file_size = text.parse().unwrap_or(0)
                            }
                            "max_stdout_file_size" => {
                                config.max_stdout_file_size = text.parse().unwrap_or(0)
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_config => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "report_results_immediately" => config.report_results_immediately = true,
                    "fetch_minimal_work" => config.fetch_minimal_work = true,
                    _ if in_log_flags => {
                        set_log_flag(&mut config.log_flags, &tag, true);
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "cc_config" | "config" => in_config = false,
                    "log_flags" => in_log_flags = false,
                    "exclusive_apps" => in_exclusive_apps = false,
                    "exclusive_gpu_apps" => in_exclusive_gpu_apps = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    let _ = (in_exclusive_apps, in_exclusive_gpu_apps); // suppress unused warnings
    config
}

/// Helper to set a log flag by name.
fn set_log_flag(flags: &mut LogFlags, name: &str, val: bool) {
    match name {
        "task" => flags.task = val,
        "file_xfer" => flags.file_xfer = val,
        "sched_ops" => flags.sched_ops = val,
        "cpu_sched" => flags.cpu_sched = val,
        "network_xfer" => flags.network_xfer = val,
        "mem_usage" => flags.mem_usage = val,
        "disk_usage" => flags.disk_usage = val,
        "http_debug" => flags.http_debug = val,
        "state_debug" => flags.state_debug = val,
        "statefile_debug" => flags.statefile_debug = val,
        "android_debug" => flags.android_debug = val,
        "app_msg_receive" => flags.app_msg_receive = val,
        "app_msg_send" => flags.app_msg_send = val,
        "benchmark_debug" => flags.benchmark_debug = val,
        "checkpoint_debug" => flags.checkpoint_debug = val,
        "coproc_debug" => flags.coproc_debug = val,
        "cpu_sched_debug" => flags.cpu_sched_debug = val,
        "cpu_sched_status" => flags.cpu_sched_status = val,
        "file_xfer_debug" => flags.file_xfer_debug = val,
        "gui_rpc_debug" => flags.gui_rpc_debug = val,
        "http_xfer_debug" => flags.http_xfer_debug = val,
        "network_status_debug" => flags.network_status_debug = val,
        "notice_debug" => flags.notice_debug = val,
        "proxy_debug" => flags.proxy_debug = val,
        "rr_simulation" => flags.rr_simulation = val,
        "suspend_debug" => flags.suspend_debug = val,
        "work_fetch_debug" => flags.work_fetch_debug = val,
        _ => {}
    }
}

/// Get all log flags as (name, value) pairs for serialization.
fn log_flag_list(flags: &LogFlags) -> Vec<(&'static str, bool)> {
    vec![
        ("task", flags.task),
        ("file_xfer", flags.file_xfer),
        ("sched_ops", flags.sched_ops),
        ("cpu_sched", flags.cpu_sched),
        ("network_xfer", flags.network_xfer),
        ("mem_usage", flags.mem_usage),
        ("disk_usage", flags.disk_usage),
        ("http_debug", flags.http_debug),
        ("state_debug", flags.state_debug),
        ("statefile_debug", flags.statefile_debug),
        ("android_debug", flags.android_debug),
        ("app_msg_receive", flags.app_msg_receive),
        ("app_msg_send", flags.app_msg_send),
        ("benchmark_debug", flags.benchmark_debug),
        ("checkpoint_debug", flags.checkpoint_debug),
        ("coproc_debug", flags.coproc_debug),
        ("cpu_sched_debug", flags.cpu_sched_debug),
        ("cpu_sched_status", flags.cpu_sched_status),
        ("file_xfer_debug", flags.file_xfer_debug),
        ("gui_rpc_debug", flags.gui_rpc_debug),
        ("http_xfer_debug", flags.http_xfer_debug),
        ("network_status_debug", flags.network_status_debug),
        ("notice_debug", flags.notice_debug),
        ("proxy_debug", flags.proxy_debug),
        ("rr_simulation", flags.rr_simulation),
        ("suspend_debug", flags.suspend_debug),
        ("work_fetch_debug", flags.work_fetch_debug),
    ]
}

/// Serialize cc_config to XML.
pub fn serialize_cc_config(config: &CcConfig) -> String {
    let mut xml = String::from("<cc_config>\n<options>\n");
    for app in &config.exclusive_apps {
        xml.push_str(&format!("<exclusive_app>{app}</exclusive_app>\n"));
    }
    for app in &config.exclusive_gpu_apps {
        xml.push_str(&format!("<exclusive_gpu_app>{app}</exclusive_gpu_app>\n"));
    }
    if config.max_file_xfers > 0 {
        xml.push_str(&format!(
            "<max_file_xfers>{}</max_file_xfers>\n",
            config.max_file_xfers
        ));
    }
    if config.max_file_xfers_per_project > 0 {
        xml.push_str(&format!(
            "<max_file_xfers_per_project>{}</max_file_xfers_per_project>\n",
            config.max_file_xfers_per_project
        ));
    }
    if config.max_ncpus > 0 {
        xml.push_str(&format!("<max_ncpus>{}</max_ncpus>\n", config.max_ncpus));
    }
    if config.report_results_immediately {
        xml.push_str("<report_results_immediately/>\n");
    }
    if config.fetch_minimal_work {
        xml.push_str("<fetch_minimal_work/>\n");
    }
    if config.http_transfer_timeout > 0 {
        xml.push_str(&format!(
            "<http_transfer_timeout>{}</http_transfer_timeout>\n",
            config.http_transfer_timeout
        ));
    }
    if config.max_stderr_file_size > 0 {
        xml.push_str(&format!(
            "<max_stderr_file_size>{}</max_stderr_file_size>\n",
            config.max_stderr_file_size
        ));
    }
    if config.max_stdout_file_size > 0 {
        xml.push_str(&format!(
            "<max_stdout_file_size>{}</max_stdout_file_size>\n",
            config.max_stdout_file_size
        ));
    }
    xml.push_str("</options>\n<log_flags>\n");
    for (name, val) in log_flag_list(&config.log_flags) {
        xml.push_str(&format!(
            "<{name}>{}</{name}>\n",
            if val { 1 } else { 0 }
        ));
    }
    xml.push_str("</log_flags>\n</cc_config>");
    xml
}

/// Parse `<exchange_versions>` response to get version info.
pub fn parse_version_info(xml: &str) -> VersionInfo {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut info = VersionInfo::default();
    let mut in_version = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "server_version" => in_version = true,
                    _ if in_version => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "major" => info.major = text.parse().unwrap_or(0),
                            "minor" => info.minor = text.parse().unwrap_or(0),
                            "release" => info.release = text.parse().unwrap_or(0),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "server_version" {
                    in_version = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    info
}

/// Parse `<client_state>` from a `get_state` response.
pub fn parse_cc_state(xml: &str) -> CcState {
    let mut state = CcState {
        results: parse_results(xml),
        projects: parse_projects(xml),
        host_info: parse_host_info(xml),
        ..Default::default()
    };

    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut in_client_state = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "client_state" => in_client_state = true,
                    "core_client_major_version" if in_client_state => {
                        let text = read_text(&mut reader);
                        state.version_info.major = text.parse().unwrap_or(0);
                    }
                    "core_client_minor_version" if in_client_state => {
                        let text = read_text(&mut reader);
                        state.version_info.minor = text.parse().unwrap_or(0);
                    }
                    "core_client_release" if in_client_state => {
                        let text = read_text(&mut reader);
                        state.version_info.release = text.parse().unwrap_or(0);
                    }
                    "platform_name" if in_client_state => {
                        let text = read_text(&mut reader);
                        state.platforms.push(text);
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_client_state => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "executing_as_daemon" {
                    state.executing_as_daemon = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "client_state" {
                    in_client_state = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    state
}

/// Parse `<project_init_status>` response.
pub fn parse_project_init_status(xml: &str) -> ProjectInitStatus {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut status = ProjectInitStatus::default();
    let mut in_status = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "get_project_init_status" | "project_init_status" => in_status = true,
                    _ if in_status => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "url" => status.url = text,
                            "name" => status.name = text,
                            "team_name" => status.team_name = text,
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) if in_status => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "has_account_key" => status.has_account_key = true,
                    "embedded" => status.embedded = true,
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "get_project_init_status" || tag == "project_init_status" {
                    in_status = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    status
}

/// Parse daily transfer history response.
pub fn parse_daily_xfer_history(xml: &str) -> DailyXferHistory {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut history = DailyXferHistory::default();
    let mut in_dx = false;
    let mut current = DailyXfer::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "dx" => {
                        in_dx = true;
                        current = DailyXfer::default();
                    }
                    _ if in_dx => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "when" => current.when = text.parse().unwrap_or(0),
                            "up" => current.up = text.parse().unwrap_or(0.0),
                            "down" => current.down = text.parse().unwrap_or(0.0),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "dx" {
                    in_dx = false;
                    history.daily_xfers.push(current.clone());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    history
}

/// Parse old results response.
pub fn parse_old_results(xml: &str) -> Vec<OldResult> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut results = Vec::new();
    let mut in_old_result = false;
    let mut current = OldResult::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "old_result" => {
                        in_old_result = true;
                        current = OldResult::default();
                    }
                    _ if in_old_result => {
                        let text = read_text(&mut reader);
                        match tag.as_str() {
                            "project_url" => current.project_url = text,
                            "result_name" => current.result_name = text,
                            "app_name" => current.app_name = text,
                            "exit_status" => current.exit_status = text.parse().unwrap_or(0),
                            "elapsed_time" => {
                                current.elapsed_time = text.parse().unwrap_or(0.0)
                            }
                            "cpu_time" => current.cpu_time = text.parse().unwrap_or(0.0),
                            "completed_time" => {
                                current.completed_time = text.parse().unwrap_or(0.0)
                            }
                            "create_time" => {
                                current.create_time = text.parse().unwrap_or(0.0)
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "old_result" {
                    in_old_result = false;
                    results.push(current.clone());
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    results
}

/// Parse message count from `get_message_count` response.
pub fn parse_message_count(xml: &str) -> i32 {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "seqno" {
                    let text = read_text(&mut reader);
                    return text.parse().unwrap_or(0);
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    0
}

/// Parse `<newer_version>` from `get_newer_version` response.
pub fn parse_newer_version(xml: &str) -> NewerVersionInfo {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();
    let mut info = NewerVersionInfo::default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "newer_version" => info.newer_version = read_text(&mut reader),
                    "download_url" => info.download_url = read_text(&mut reader),
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    info
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_results() {
        let xml = r#"
<boinc_gui_rpc_reply>
<results>
<result>
    <name>task_12345_0</name>
    <wu_name>task_12345</wu_name>
    <project_url>https://example.com/project/</project_url>
    <report_deadline>1700000000.000000</report_deadline>
    <received_time>1699900000.000000</received_time>
    <estimated_cpu_time_remaining>3600.500000</estimated_cpu_time_remaining>
    <state>2</state>
    <plan_class>sse2</plan_class>
    <resources>1 CPU</resources>
    <version_num>710</version_num>
    <active_task>
        <active_task_state>1</active_task_state>
        <scheduler_state>2</scheduler_state>
        <elapsed_time>1200.300000</elapsed_time>
        <fraction_done>0.456000</fraction_done>
        <checkpoint_cpu_time>1100.000000</checkpoint_cpu_time>
        <current_cpu_time>1200.000000</current_cpu_time>
        <slot>0</slot>
        <pid>12345</pid>
        <working_set_size_smoothed>104857600.000000</working_set_size_smoothed>
        <graphics_exec_path>/path/to/graphics</graphics_exec_path>
    </active_task>
</result>
<result>
    <name>task_67890_0</name>
    <wu_name>task_67890</wu_name>
    <project_url>https://example.com/project2/</project_url>
    <state>5</state>
    <ready_to_report/>
</result>
</results>
</boinc_gui_rpc_reply>"#;

        let results = parse_results(xml);
        assert_eq!(results.len(), 2);

        let r0 = &results[0];
        assert_eq!(r0.name, "task_12345_0");
        assert_eq!(r0.wu_name, "task_12345");
        assert_eq!(r0.project_url, "https://example.com/project/");
        assert!((r0.report_deadline - 1700000000.0).abs() < 1.0);
        assert!((r0.estimated_cpu_time_remaining - 3600.5).abs() < 0.1);
        assert_eq!(r0.state, 2);
        assert_eq!(r0.scheduler_state, 2);
        assert_eq!(r0.plan_class, "sse2");
        assert_eq!(r0.resources, "1 CPU");
        assert!(r0.active_task);
        assert_eq!(r0.active_task_state, 1);
        assert!((r0.elapsed_time - 1200.3).abs() < 0.1);
        assert!((r0.fraction_done - 0.456).abs() < 0.001);
        assert_eq!(r0.version_num, 710);
        assert!((r0.checkpoint_cpu_time - 1100.0).abs() < 0.1);
        assert!((r0.current_cpu_time - 1200.0).abs() < 0.1);
        assert_eq!(r0.slot, 0);
        assert_eq!(r0.pid, 12345);
        assert!((r0.working_set_size_smoothed - 104857600.0).abs() < 1.0);
        assert_eq!(r0.graphics_exec_path, "/path/to/graphics");

        let r1 = &results[1];
        assert_eq!(r1.name, "task_67890_0");
        assert_eq!(r1.state, 5);
        assert!(r1.ready_to_report);
        assert!(!r1.active_task);
    }

    #[test]
    fn test_parse_projects_with_gui_urls() {
        let xml = r#"
<boinc_gui_rpc_reply>
<projects>
<project>
    <master_url>https://example.com/project/</master_url>
    <project_name>Example Project</project_name>
    <user_name>testuser</user_name>
    <team_name>Test Team</team_name>
    <user_total_credit>12345.670000</user_total_credit>
    <user_expavg_credit>100.500000</user_expavg_credit>
    <host_total_credit>5000.000000</host_total_credit>
    <host_expavg_credit>50.250000</host_expavg_credit>
    <resource_share>100.000000</resource_share>
    <njobs_success>42</njobs_success>
    <njobs_error>3</njobs_error>
    <venue>home</venue>
    <suspended_via_gui/>
    <attached_via_acct_mgr/>
    <gui_urls>
        <gui_url>
            <name>Home Page</name>
            <description>Project home page</description>
            <url>https://example.com/</url>
        </gui_url>
        <gui_url>
            <name>Your Account</name>
            <description>View your account</description>
            <url>https://example.com/account</url>
        </gui_url>
    </gui_urls>
</project>
</projects>
</boinc_gui_rpc_reply>"#;

        let projects = parse_projects(xml);
        assert_eq!(projects.len(), 1);

        let p = &projects[0];
        assert_eq!(p.project_name, "Example Project");
        assert_eq!(p.user_name, "testuser");
        assert!((p.user_total_credit - 12345.67).abs() < 0.01);
        assert!(p.suspended_via_gui);
        assert!(!p.dont_request_more_work);
        assert!(p.attached_via_acct_mgr);
        assert!((p.resource_share - 100.0).abs() < 0.01);
        assert_eq!(p.njobs_success, 42);
        assert_eq!(p.njobs_error, 3);
        assert_eq!(p.venue, "home");
        assert_eq!(p.gui_urls.len(), 2);
        assert_eq!(p.gui_urls[0].name, "Home Page");
        assert_eq!(p.gui_urls[1].url, "https://example.com/account");
    }

    #[test]
    fn test_parse_project_attached_via_acct_mgr_absent() {
        let xml = r#"
<boinc_gui_rpc_reply>
<projects>
<project>
    <master_url>https://example.com/manual/</master_url>
    <project_name>Manual Project</project_name>
    <user_name>user1</user_name>
    <team_name></team_name>
    <user_total_credit>0.000000</user_total_credit>
    <user_expavg_credit>0.000000</user_expavg_credit>
    <host_total_credit>0.000000</host_total_credit>
    <host_expavg_credit>0.000000</host_expavg_credit>
</project>
</projects>
</boinc_gui_rpc_reply>"#;

        let projects = parse_projects(xml);
        assert_eq!(projects.len(), 1);
        let p = &projects[0];
        assert_eq!(p.project_name, "Manual Project");
        assert!(!p.attached_via_acct_mgr);
        assert!(!p.suspended_via_gui);
        assert!(!p.dont_request_more_work);
    }

    #[test]
    fn test_parse_cc_status_with_suspend_reasons() {
        let xml = r#"
<boinc_gui_rpc_reply>
<cc_status>
    <task_mode>2</task_mode>
    <task_mode_perm>2</task_mode_perm>
    <task_mode_delay>0.000000</task_mode_delay>
    <gpu_mode>2</gpu_mode>
    <gpu_mode_perm>2</gpu_mode_perm>
    <gpu_mode_delay>0.000000</gpu_mode_delay>
    <network_mode>2</network_mode>
    <network_mode_perm>2</network_mode_perm>
    <network_mode_delay>0.000000</network_mode_delay>
    <network_status>0</network_status>
    <task_suspend_reason>4</task_suspend_reason>
    <gpu_suspend_reason>2</gpu_suspend_reason>
    <network_suspend_reason>0</network_suspend_reason>
</cc_status>
</boinc_gui_rpc_reply>"#;

        let status = parse_cc_status(xml);
        assert_eq!(status.task_mode, 2);
        assert_eq!(status.gpu_mode, 2);
        assert_eq!(status.network_mode, 2);
        assert_eq!(status.network_status, 0);
        assert_eq!(status.task_suspend_reason, 4);
        assert_eq!(status.gpu_suspend_reason, 2);
        assert_eq!(status.network_suspend_reason, 0);
    }

    #[test]
    fn test_parse_scheduler_state_inside_active_task() {
        let xml = r#"
<boinc_gui_rpc_reply>
<results>
<result>
    <name>running_task_0</name>
    <wu_name>running_task</wu_name>
    <project_url>https://example.com/</project_url>
    <state>2</state>
    <active_task>
        <active_task_state>1</active_task_state>
        <scheduler_state>2</scheduler_state>
        <elapsed_time>500.000000</elapsed_time>
        <fraction_done>0.500000</fraction_done>
    </active_task>
</result>
</results>
</boinc_gui_rpc_reply>"#;

        let results = parse_results(xml);
        assert_eq!(results.len(), 1);

        let r = &results[0];
        assert!(r.active_task);
        assert_eq!(r.active_task_state, 1);
        assert_eq!(r.scheduler_state, 2);
    }

    #[test]
    fn test_parse_empty_results() {
        let xml = r#"
<boinc_gui_rpc_reply>
<results>
</results>
</boinc_gui_rpc_reply>"#;
        let results = parse_results(xml);
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_success() {
        let xml = "<boinc_gui_rpc_reply>\n<success/>\n</boinc_gui_rpc_reply>";
        assert!(parse_success(xml).is_ok());
    }

    #[test]
    fn test_parse_success_error() {
        let xml = "<boinc_gui_rpc_reply>\n<error>not found</error>\n</boinc_gui_rpc_reply>";
        let err = parse_success(xml).unwrap_err();
        assert_eq!(err, "not found");
    }

    #[test]
    fn test_parse_success_unexpected() {
        let xml = "<boinc_gui_rpc_reply>\n<something_else/>\n</boinc_gui_rpc_reply>";
        assert!(parse_success(xml).is_err());
    }

    #[test]
    fn test_parse_file_transfers() {
        let xml = r#"
<boinc_gui_rpc_reply>
<file_transfers>
<file_transfer>
    <project_url>https://example.com/project/</project_url>
    <project_name>Example Project</project_name>
    <name>input_data_001.zip</name>
    <nbytes>1048576.000000</nbytes>
    <status>0</status>
    <file_xfer>
        <bytes_xferred>524288.000000</bytes_xferred>
        <xfer_speed>65536.000000</xfer_speed>
    </file_xfer>
</file_transfer>
<file_transfer>
    <project_url>https://example.com/project/</project_url>
    <project_name>Example Project</project_name>
    <name>output_result_001.zip</name>
    <nbytes>2097152.000000</nbytes>
    <status>0</status>
    <is_upload/>
    <file_xfer>
        <bytes_xferred>1048576.000000</bytes_xferred>
        <xfer_speed>131072.000000</xfer_speed>
    </file_xfer>
</file_transfer>
</file_transfers>
</boinc_gui_rpc_reply>"#;

        let transfers = parse_file_transfers(xml);
        assert_eq!(transfers.len(), 2);

        let t0 = &transfers[0];
        assert_eq!(t0.name, "input_data_001.zip");
        assert!(!t0.is_upload);

        let t1 = &transfers[1];
        assert!(t1.is_upload);
    }

    #[test]
    fn test_parse_empty_file_transfers() {
        let xml = r#"
<boinc_gui_rpc_reply>
<file_transfers>
</file_transfers>
</boinc_gui_rpc_reply>"#;
        let transfers = parse_file_transfers(xml);
        assert!(transfers.is_empty());
    }

    #[test]
    fn test_parse_statistics() {
        let xml = r#"
<boinc_gui_rpc_reply>
<statistics>
<project_statistics>
    <master_url>https://example.com/</master_url>
    <daily_statistics>
        <day>1710720000.000000</day>
        <user_total_credit>1000.000000</user_total_credit>
        <user_expavg_credit>50.000000</user_expavg_credit>
        <host_total_credit>500.000000</host_total_credit>
        <host_expavg_credit>25.000000</host_expavg_credit>
    </daily_statistics>
</project_statistics>
</statistics>
</boinc_gui_rpc_reply>"#;

        let stats = parse_statistics(xml);
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].daily_statistics.len(), 1);
    }

    #[test]
    fn test_parse_messages() {
        let xml = r#"
<boinc_gui_rpc_reply>
<msgs>
<msg>
    <project>Example Project</project>
    <pri>1</pri>
    <seqno>42</seqno>
    <body>
Computation started
</body>
    <time>1700000000</time>
</msg>
</msgs>
</boinc_gui_rpc_reply>"#;

        let messages = parse_messages(xml);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].project, "Example Project");
        assert_eq!(messages[0].seqno, 42);
    }

    #[test]
    fn test_parse_notices() {
        let xml = r#"
<boinc_gui_rpc_reply>
<notices>
<notice>
    <seqno>1</seqno>
    <title>Welcome</title>
    <description><![CDATA[<b>Hello</b> world]]></description>
    <create_time>1700000000</create_time>
    <project_name>Example</project_name>
    <link>https://example.com</link>
    <category>client</category>
    <is_private/>
</notice>
</notices>
</boinc_gui_rpc_reply>"#;

        let notices = parse_notices(xml);
        assert_eq!(notices.len(), 1);
        assert_eq!(notices[0].description, "<b>Hello</b> world");
        assert!(notices[0].is_private);
    }

    #[test]
    fn test_parse_disk_usage() {
        let xml = r#"
<boinc_gui_rpc_reply>
<disk_usage_summary>
    <project>
        <master_url>https://example.com/</master_url>
        <disk_usage>1073741824.000000</disk_usage>
    </project>
    <d_total>500000000000.000000</d_total>
    <d_free>250000000000.000000</d_free>
    <d_boinc>2147483648.000000</d_boinc>
    <d_allowed>50000000000.000000</d_allowed>
</disk_usage_summary>
</boinc_gui_rpc_reply>"#;

        let usage = parse_disk_usage(xml);
        assert_eq!(usage.projects.len(), 1);
    }

    #[test]
    fn test_parse_global_preferences() {
        let xml = r#"
<boinc_gui_rpc_reply>
<global_preferences>
    <run_on_batteries>0</run_on_batteries>
    <run_if_user_active>1</run_if_user_active>
    <idle_time_to_run>3.000000</idle_time_to_run>
    <max_ncpus_pct>100.000000</max_ncpus_pct>
    <cpu_usage_limit>100.000000</cpu_usage_limit>
    <ram_max_used_busy_frac>0.500000</ram_max_used_busy_frac>
    <ram_max_used_idle_frac>0.900000</ram_max_used_idle_frac>
    <disk_max_used_pct>90.000000</disk_max_used_pct>
    <disk_min_free_gb>0.100000</disk_min_free_gb>
    <work_buf_min_days>0.100000</work_buf_min_days>
    <suspend_if_no_recent_input>60.000000</suspend_if_no_recent_input>
    <leave_apps_in_memory>1</leave_apps_in_memory>
    <day_prefs>
        <day_of_week>0</day_of_week>
        <start_hour>8.000000</start_hour>
        <end_hour>22.000000</end_hour>
        <net_start_hour>0.000000</net_start_hour>
        <net_end_hour>0.000000</net_end_hour>
    </day_prefs>
</global_preferences>
</boinc_gui_rpc_reply>"#;

        let prefs = parse_global_preferences(xml);
        assert!(!prefs.run_on_batteries);
        assert!(prefs.run_if_user_active);
        assert!((prefs.suspend_if_no_recent_input - 60.0).abs() < 0.01);
        assert!(prefs.leave_apps_in_memory);
        assert_eq!(prefs.day_prefs.len(), 1);
        assert_eq!(prefs.day_prefs[0].day_of_week, 0);
        assert!((prefs.day_prefs[0].start_hour - 8.0).abs() < 0.01);
    }

    #[test]
    fn test_serialize_global_preferences() {
        let prefs = GlobalPreferences {
            run_on_batteries: false,
            run_if_user_active: true,
            cpu_usage_limit: 80.0,
            ..Default::default()
        };
        let xml = serialize_global_preferences(&prefs);
        assert!(xml.contains("<run_on_batteries>0</run_on_batteries>"));
        assert!(xml.contains("<run_if_user_active>1</run_if_user_active>"));
        assert!(xml.contains("<cpu_usage_limit>80</cpu_usage_limit>"));
    }

    #[test]
    fn test_parse_host_info() {
        let xml = r#"
<boinc_gui_rpc_reply>
<host_info>
    <domain_name>myhost</domain_name>
    <ip_addr>192.168.1.100</ip_addr>
    <p_ncpus>8</p_ncpus>
    <os_name>Microsoft Windows</os_name>
</host_info>
</boinc_gui_rpc_reply>"#;

        let info = parse_host_info(xml);
        assert_eq!(info.domain_name, "myhost");
        assert_eq!(info.p_ncpus, 8);
    }

    #[test]
    fn test_parse_all_projects_list() {
        let xml = r#"
<boinc_gui_rpc_reply>
<projects>
<project>
    <name>SETI@home</name>
    <url>https://setiathome.berkeley.edu/</url>
    <general_area>Physical Science</general_area>
    <specific_area>Astronomy</specific_area>
    <description>Search for ET</description>
    <home>UC Berkeley</home>
    <platforms>
        <name>windows_x86_64</name>
        <name>x86_64-pc-linux-gnu</name>
    </platforms>
</project>
</projects>
</boinc_gui_rpc_reply>"#;

        let entries = parse_all_projects_list(xml);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "SETI@home");
        assert_eq!(entries[0].platforms.len(), 2);
    }

    #[test]
    fn test_parse_account_out() {
        let xml = r#"
<boinc_gui_rpc_reply>
<account_out>
    <error_num>0</error_num>
    <authenticator>abc123def456</authenticator>
</account_out>
</boinc_gui_rpc_reply>"#;

        let out = parse_account_out(xml);
        assert_eq!(out.error_num, 0);
        assert_eq!(out.authenticator, "abc123def456");
    }

    #[test]
    fn test_parse_project_attach_reply() {
        let xml = r#"
<boinc_gui_rpc_reply>
<project_attach_reply>
    <error_num>0</error_num>
    <message>Success</message>
</project_attach_reply>
</boinc_gui_rpc_reply>"#;

        let reply = parse_project_attach_reply(xml);
        assert_eq!(reply.error_num, 0);
        assert_eq!(reply.messages.len(), 1);
    }

    #[test]
    fn test_parse_project_config() {
        let xml = r#"
<boinc_gui_rpc_reply>
<project_config>
    <error_num>0</error_num>
    <name>Test Project</name>
    <master_url>https://example.com/</master_url>
    <min_passwd_length>8</min_passwd_length>
    <account_creation_disabled/>
    <uses_username/>
    <terms_of_use>You must agree to these terms.</terms_of_use>
</project_config>
</boinc_gui_rpc_reply>"#;

        let config = parse_project_config(xml);
        assert_eq!(config.error_num, 0);
        assert_eq!(config.name, "Test Project");
        assert_eq!(config.min_passwd_length, 8);
        assert!(config.account_creation_disabled);
        assert!(config.uses_username);
        assert_eq!(config.terms_of_use, "You must agree to these terms.");
    }

    #[test]
    fn test_parse_acct_mgr_info() {
        let xml = r#"
<boinc_gui_rpc_reply>
<acct_mgr_info>
    <acct_mgr_name>BAM!</acct_mgr_name>
    <acct_mgr_url>https://bam.boincstats.com/</acct_mgr_url>
    <have_credentials/>
</acct_mgr_info>
</boinc_gui_rpc_reply>"#;

        let info = parse_acct_mgr_info(xml);
        assert_eq!(info.acct_mgr_name, "BAM!");
        assert_eq!(info.acct_mgr_url, "https://bam.boincstats.com/");
        assert!(info.have_credentials);
    }

    #[test]
    fn test_parse_newer_version() {
        let xml = r#"
<boinc_gui_rpc_reply>
<newer_version>8.0.0</newer_version>
<download_url>https://boinc.berkeley.edu/download.php</download_url>
</boinc_gui_rpc_reply>"#;

        let info = parse_newer_version(xml);
        assert_eq!(info.newer_version, "8.0.0");
        assert_eq!(info.download_url, "https://boinc.berkeley.edu/download.php");
    }

    #[test]
    fn test_read_text_cdata() {
        let xml = "<desc><![CDATA[<b>Hello</b>]]></desc>";
        let mut reader = Reader::from_str(xml);
        let mut buf = Vec::new();
        let _ = reader.read_event_into(&mut buf);
        buf.clear();
        let text = read_text(&mut reader);
        assert_eq!(text, "<b>Hello</b>");
    }

    #[test]
    fn test_parse_acct_mgr_rpc_reply() {
        let xml = r#"
<boinc_gui_rpc_reply>
<acct_mgr_rpc_reply>
    <error_num>0</error_num>
    <message>Account manager attached</message>
    <message>Projects updated</message>
</acct_mgr_rpc_reply>
</boinc_gui_rpc_reply>"#;

        let reply = parse_acct_mgr_rpc_reply(xml);
        assert_eq!(reply.error_num, 0);
        assert_eq!(reply.messages.len(), 2);
        assert_eq!(reply.messages[0], "Account manager attached");
        assert_eq!(reply.messages[1], "Projects updated");
    }

    #[test]
    fn test_parse_acct_mgr_rpc_reply_error() {
        let xml = r#"
<boinc_gui_rpc_reply>
<acct_mgr_rpc_reply>
    <error_num>-1</error_num>
    <message>Invalid credentials</message>
</acct_mgr_rpc_reply>
</boinc_gui_rpc_reply>"#;

        let reply = parse_acct_mgr_rpc_reply(xml);
        assert_eq!(reply.error_num, -1);
        assert_eq!(reply.messages.len(), 1);
    }

    #[test]
    fn test_parse_proxy_info() {
        let xml = r#"
<boinc_gui_rpc_reply>
<proxy_info>
    <use_http_proxy/>
    <http_server_name>proxy.example.com</http_server_name>
    <http_server_port>8080</http_server_port>
    <http_user_name>user</http_user_name>
    <http_user_passwd>pass</http_user_passwd>
    <use_http_auth/>
    <use_socks_proxy/>
    <socks_server_name>socks.example.com</socks_server_name>
    <socks_server_port>1080</socks_server_port>
    <socks5_user_name>suser</socks5_user_name>
    <socks5_user_passwd>spass</socks5_user_passwd>
    <socks5_remote_dns/>
    <noproxy_hosts>localhost,127.0.0.1</noproxy_hosts>
</proxy_info>
</boinc_gui_rpc_reply>"#;

        let info = parse_proxy_info(xml);
        assert!(info.use_http_proxy);
        assert_eq!(info.http_server_name, "proxy.example.com");
        assert_eq!(info.http_server_port, 8080);
        assert_eq!(info.http_user_name, "user");
        assert!(info.use_http_auth);
        assert!(info.use_socks_proxy);
        assert_eq!(info.socks_server_name, "socks.example.com");
        assert_eq!(info.socks_server_port, 1080);
        assert!(info.socks5_remote_dns);
        assert_eq!(info.noproxy_hosts, "localhost,127.0.0.1");
    }

    #[test]
    fn test_serialize_proxy_info() {
        let info = ProxyInfo {
            use_http_proxy: true,
            http_server_name: "proxy.test".to_string(),
            http_server_port: 3128,
            ..Default::default()
        };
        let xml = serialize_proxy_info(&info);
        assert!(xml.contains("<use_http_proxy/>"));
        assert!(xml.contains("<http_server_name>proxy.test</http_server_name>"));
        assert!(xml.contains("<http_server_port>3128</http_server_port>"));
    }

    #[test]
    fn test_parse_cc_config() {
        let xml = r#"
<boinc_gui_rpc_reply>
<cc_config>
    <log_flags>
        <task>1</task>
        <file_xfer>1</file_xfer>
        <sched_ops>0</sched_ops>
        <http_debug>1</http_debug>
    </log_flags>
    <options>
        <max_file_xfers>8</max_file_xfers>
        <max_ncpus>4</max_ncpus>
        <report_results_immediately>1</report_results_immediately>
    </options>
    <exclusive_app>game.exe</exclusive_app>
    <exclusive_app>render.exe</exclusive_app>
    <exclusive_gpu_app>mining.exe</exclusive_gpu_app>
</cc_config>
</boinc_gui_rpc_reply>"#;

        let config = parse_cc_config(xml);
        assert!(config.log_flags.task);
        assert!(config.log_flags.file_xfer);
        assert!(!config.log_flags.sched_ops);
        assert!(config.log_flags.http_debug);
        assert_eq!(config.max_file_xfers, 8);
        assert_eq!(config.max_ncpus, 4);
        assert!(config.report_results_immediately);
        assert_eq!(config.exclusive_apps.len(), 2);
        assert_eq!(config.exclusive_apps[0], "game.exe");
        assert_eq!(config.exclusive_gpu_apps.len(), 1);
        assert_eq!(config.exclusive_gpu_apps[0], "mining.exe");
    }

    #[test]
    fn test_serialize_cc_config() {
        let config = CcConfig {
            exclusive_apps: vec!["app1.exe".to_string()],
            exclusive_gpu_apps: vec![],
            log_flags: LogFlags {
                task: true,
                file_xfer: false,
                ..Default::default()
            },
            max_file_xfers: 6,
            max_ncpus: 0,
            report_results_immediately: false,
            ..Default::default()
        };
        let xml = serialize_cc_config(&config);
        assert!(xml.contains("<exclusive_app>app1.exe</exclusive_app>"));
        assert!(xml.contains("<task>1</task>"));
        assert!(xml.contains("<file_xfer>0</file_xfer>"));
        assert!(xml.contains("<max_file_xfers>6</max_file_xfers>"));
    }

    #[test]
    fn test_parse_newer_version_empty() {
        let xml = r#"
<boinc_gui_rpc_reply>
</boinc_gui_rpc_reply>"#;

        let info = parse_newer_version(xml);
        assert_eq!(info.newer_version, "");
        assert_eq!(info.download_url, "");
    }

    #[test]
    fn test_parse_project_config_full() {
        let xml = r#"
<boinc_gui_rpc_reply>
<project_config>
    <error_num>0</error_num>
    <name>Full Project</name>
    <master_url>https://full.example.com/</master_url>
    <min_passwd_length>6</min_passwd_length>
    <client_account_creation_disabled/>
    <terms_of_use>By using this project you agree to the terms.</terms_of_use>
    <terms_of_use_is_html/>
    <ldap_auth/>
    <platforms>
        <platform>
            <name>windows_x86_64</name>
        </platform>
    </platforms>
    <sched_stopped/>
    <web_stopped/>
</project_config>
</boinc_gui_rpc_reply>"#;

        let config = parse_project_config(xml);
        assert_eq!(config.name, "Full Project");
        assert_eq!(config.min_passwd_length, 6);
        assert!(!config.account_creation_disabled);
        assert!(config.client_account_creation_disabled);
        assert!(config.terms_of_use_is_html);
        assert!(config.ldap_auth);
        assert!(config.sched_stopped);
        assert!(config.web_stopped);
        assert!(config.terms_of_use.contains("agree to the terms"));
    }

    #[test]
    fn test_parse_global_preferences_with_day_prefs() {
        let xml = r#"
<boinc_gui_rpc_reply>
<global_preferences>
    <run_on_batteries>0</run_on_batteries>
    <run_if_user_active>1</run_if_user_active>
    <work_buf_additional_days>0.500000</work_buf_additional_days>
    <suspend_cpu_usage>50.000000</suspend_cpu_usage>
    <day_prefs>
        <day_of_week>1</day_of_week>
        <start_hour>9.000000</start_hour>
        <end_hour>17.000000</end_hour>
        <net_start_hour>0.000000</net_start_hour>
        <net_end_hour>0.000000</net_end_hour>
    </day_prefs>
    <day_prefs>
        <day_of_week>6</day_of_week>
        <start_hour>0.000000</start_hour>
        <end_hour>24.000000</end_hour>
        <net_start_hour>0.000000</net_start_hour>
        <net_end_hour>0.000000</net_end_hour>
    </day_prefs>
</global_preferences>
</boinc_gui_rpc_reply>"#;

        let prefs = parse_global_preferences(xml);
        assert!((prefs.work_buf_additional_days - 0.5).abs() < 0.01);
        assert!((prefs.suspend_cpu_usage - 50.0).abs() < 0.01);
        assert_eq!(prefs.day_prefs.len(), 2);
        assert_eq!(prefs.day_prefs[0].day_of_week, 1);
        assert!((prefs.day_prefs[0].start_hour - 9.0).abs() < 0.01);
        assert!((prefs.day_prefs[0].end_hour - 17.0).abs() < 0.01);
        assert_eq!(prefs.day_prefs[1].day_of_week, 6);
    }
}
