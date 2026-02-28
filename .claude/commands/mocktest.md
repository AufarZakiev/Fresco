---
description: Run visual verification of all Fresco pages via Playwright MCP with IPC mocks
user-invocable: true
disable-model-invocation: true
---

# Mock Test Runner

Run visual verification of all Fresco pages in browser mode using Playwright MCP. Works because `src/main.ts` auto-detects the absence of `window.__TAURI_INTERNALS__` and loads IPC mocks from `src/mocks/`, so all pages render with realistic data.

## Target

Page to test: $ARGUMENTS

If no target specified — test all pages.

## Prerequisites

- Playwright MCP server connected
- `pnpm` available

## Workflow

### 1. Start dev server

```bash
pnpm dev &
```

Wait for `localhost:1420` to respond:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:1420
```

If already running — skip this step.

### 2. Verify mocks loaded

Navigate to `http://localhost:1420` via `browser_navigate`.

Check `browser_console_messages` for `[fresco] IPC mocks installed`. If not present — stop and report that mocks are not loading.

### 3. Test pages

Navigate to each route and take a `browser_snapshot`. For each page verify:
- No JS errors in console
- Page renders meaningful content (not empty or error state)
- Key data elements are visible

| Route | Page | Key elements |
|-------|------|--------------|
| `/tasks` | Tasks | Task rows, status badges, progress bars |
| `/projects` | Projects | Project names, credit values, status |
| `/transfers` | Transfers | Transfer items with progress |
| `/statistics` | Statistics | Chart area, project selector |
| `/disk` | Disk Usage | Disk usage bars or chart |
| `/event-log` | Event Log | Message rows with timestamps |
| `/notices` | Notices | Notice cards |
| `/host` | Host Info | Host system information |

If `$ARGUMENTS` is set — test only the matching page from the table above.

### 4. Report results

```
| Page       | Status    | Notes |
|------------|-----------|-------|
| Tasks      | OK / FAIL | ...   |
| Projects   | OK / FAIL | ...   |
| ...        | ...       | ...   |
```

Include console errors for any failing page.

### 5. Cleanup

If dev server was started in step 1 — stop it after tests complete.
