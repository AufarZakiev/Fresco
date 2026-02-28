# Error Reporting & Usage Analytics

Research into free telemetry/analytics options for the Fresco desktop app (Tauri).

## Requirements

- Collect debug and usage info from users automatically
- Visualize data in a Grafana-like UI
- No paid server — free tier only (hobby project)

## Options

### Aptabase

- **Purpose-built** for desktop/mobile apps (Tauri, Electron, Flutter)
- Has a native Tauri plugin: `tauri-plugin-aptabase`
- Privacy-focused, GDPR-friendly
- Simple event tracking with a clean dashboard
- Free tier is generous for hobby projects
- https://aptabase.com

### PostHog

- **1M events/month free** — most generous free tier
- Analytics, dashboards, session replay, feature flags
- Very Grafana-like UI with custom dashboards
- Open source, works via HTTP API from any app
- Best option if rich dashboards are a priority
- https://posthog.com

### Sentry

- **5K errors/month + 10K sessions free**
- Best-in-class crash/error reporting with stack traces, breadcrumbs, device info
- Has Tauri/Rust SDK support
- Focused on errors rather than general usage analytics
- https://sentry.io

### Grafana Cloud

- **Free tier**: 10K metrics, 50GB logs, 50GB traces
- Literally Grafana with no server to manage
- Push data via their API
- Most flexible but requires more manual setup
- https://grafana.com/products/cloud/

## Recommendation

| Need | Service |
|------|---------|
| Crash/error reporting | Sentry (free) |
| Usage analytics | Aptabase (free, Tauri-native) |
| Both + dashboards | PostHog (free, most Grafana-like) |

Aptabase is the lowest-friction option since `tauri-plugin-aptabase` requires only a few lines of setup. PostHog gives the richest Grafana-style dashboards for deeper analysis.
