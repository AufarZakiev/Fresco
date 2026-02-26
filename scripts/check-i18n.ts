#!/usr/bin/env npx tsx
/**
 * i18n key validation script.
 *
 * Checks:
 *  - ERROR: $t('key') in .vue/.ts but key missing from en.json
 *  - WARN:  key in en.json but unused in any .vue/.ts
 *  - INFO:  key in en.json missing from locale X
 *
 * Usage: npx tsx scripts/check-i18n.ts
 * Exit code 1 on errors only.
 */

import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const LOCALES_DIR = join(ROOT, "src", "i18n", "locales");
const SRC_DIR = join(ROOT, "src");

// --- Helpers ---

function flatten(obj: Record<string, unknown>, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const [k, v] of flatten(value as Record<string, unknown>, fullKey)) {
        result.set(k, v);
      }
    } else {
      result.set(fullKey, String(value));
    }
  }
  return result;
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      files.push(...collectSourceFiles(fullPath));
    } else if (
      entry.isFile() &&
      (/\.vue$/.test(entry.name) || /\.ts$/.test(entry.name)) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractI18nKeys(filePath: string): Set<string> {
  const content = readFileSync(filePath, "utf-8");
  const keys = new Set<string>();
  // Match $t('key.path') and t('key.path') — require at least one dot
  // to avoid false positives from import(), emit(), etc.
  const regex = /\$?t\(\s*['"]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// --- Main ---

const enJson = JSON.parse(readFileSync(join(LOCALES_DIR, "en.json"), "utf-8"));
const enKeys = flatten(enJson);

const sourceFiles = collectSourceFiles(SRC_DIR);
const usedKeys = new Set<string>();
for (const file of sourceFiles) {
  for (const key of extractI18nKeys(file)) {
    usedKeys.add(key);
  }
}

let errors = 0;
let warnings = 0;

// Check 1: keys used in code but missing from en.json
const missingFromEn: string[] = [];
for (const key of usedKeys) {
  if (!enKeys.has(key)) {
    missingFromEn.push(key);
  }
}
if (missingFromEn.length > 0) {
  console.log(`\nERROR: ${missingFromEn.length} key(s) used in code but missing from en.json:`);
  for (const key of missingFromEn.sort()) {
    console.log(`  ${key}`);
  }
  errors += missingFromEn.length;
}

// Check 2: keys in en.json but unused in code
const unusedKeys: string[] = [];
for (const key of enKeys.keys()) {
  if (!usedKeys.has(key)) {
    unusedKeys.push(key);
  }
}
if (unusedKeys.length > 0) {
  console.log(`\nWARN: ${unusedKeys.length} key(s) in en.json but not found in source:`);
  for (const key of unusedKeys.sort()) {
    console.log(`  ${key}`);
  }
  warnings += unusedKeys.length;
}

// Check 3: keys missing from each locale
const localeFiles = readdirSync(LOCALES_DIR).filter(
  (f) => f.endsWith(".json") && f !== "en.json",
);

let totalMissing = 0;
for (const file of localeFiles.sort()) {
  const localeJson = JSON.parse(readFileSync(join(LOCALES_DIR, file), "utf-8"));
  const localeKeys = flatten(localeJson);
  const missing = [...enKeys.keys()].filter((k) => !localeKeys.has(k));
  if (missing.length > 0) {
    totalMissing += missing.length;
    console.log(`\nINFO: ${file} missing ${missing.length}/${enKeys.size} keys`);
  }
}

// Summary
console.log("\n---");
console.log(`Total: ${errors} error(s), ${warnings} warning(s), ${totalMissing} missing translation(s)`);

if (errors > 0) {
  process.exit(1);
}
