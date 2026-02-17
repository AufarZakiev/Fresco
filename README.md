# Fresco

[![Build](https://github.com/AufarZakiev/Fresco/actions/workflows/build.yml/badge.svg)](https://github.com/AufarZakiev/Fresco/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-x86__64%20%7C%20ARM64-0078D4?logo=windows)](https://github.com/AufarZakiev/Fresco/releases)
[![macOS](https://img.shields.io/badge/macOS-ARM64%20%7C%20x86__64-000000?logo=apple)](https://github.com/AufarZakiev/Fresco/releases)
[![Linux](https://img.shields.io/badge/Linux-x86__64%20%7C%20ARM64-FCC624?logo=linux&logoColor=black)](https://github.com/AufarZakiev/Fresco/releases)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)](https://v2.tauri.app)

A modern alternative to the official BOINC Manager, built with Tauri.

Connects to the BOINC client over the standard GUI RPC protocol. Starts the BOINC client automatically and works out of the box if BOINC is installed in the default location.

The goal is to reach full functional parity with the standard BOINC Manager.

## Features

- Tasks, projects, transfers, messages, notices, disk usage, and host info views
- Project attach wizard and account manager support
- Activity controls for CPU, GPU, and network modes
- Global preferences editor
- Remote client connections
- System tray with status indicator
- Cross-platform (Windows, macOS, Linux)

## Prerequisites

Fresco is a manager UI only — it requires the **standard BOINC client** to be installed on your system. Install it from [boinc.berkeley.edu](https://boinc.berkeley.edu/download.php) if you haven't already.

Fresco will automatically find and start the BOINC client if it is installed in the default location. No additional configuration is needed.

## Installation

Download the latest release from the [Releases](https://github.com/AufarZakiev/Fresco/releases) page. Fresco is a single portable binary — no installer required.

## License

MIT
