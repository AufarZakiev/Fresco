import { invoke } from "../lib/typedInvoke";

export type OS = "windows" | "macos" | "linux";
export type Arch = "arm64" | "x86_64";

export function getOS(): Promise<OS> {
  return invoke("get_platform");
}

export function getArch(): Promise<Arch> {
  return invoke("get_arch");
}

export function defaultDataDir(os: OS): string {
  if (os === "windows") return "C:\\ProgramData\\BOINC";
  if (os === "macos") return "/Library/Application Support/BOINC Data";
  return "/var/lib/boinc-client";
}

export function defaultClientDir(os: OS): string {
  if (os === "windows") return "C:\\Program Files\\BOINC";
  if (os === "macos")
    return "/Applications/BOINCManager.app/Contents/Resources";
  return "/usr/bin";
}

export function detectClientDir(): Promise<string> {
  return invoke("detect_boinc_client_dir");
}

export function platformAssetPattern(os: OS, arch: Arch): string {
  const osLabel = { windows: "Windows", macos: "macOS", linux: "Linux" }[os];
  const archLabel = { arm64: "ARM64", x86_64: "x86_64" }[arch];
  return `${osLabel}_${archLabel}`;
}
