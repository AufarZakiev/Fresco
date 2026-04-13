# Архитектура

## Обзор

Fresco — десктопное приложение на **Tauri v2** (Rust backend + WebView frontend). Frontend: **Vue 3** + **Pinia** + **TypeScript**. Общение с BOINC-клиентом через XML RPC по TCP (порт 31416).

```
Vue Component → useRpc() → typedInvoke → Tauri IPC → Rust command → RpcClient → TCP → BOINC
```

## Контекст

Замена официального BOINC Manager. Один портативный бинарник, без установщика. Поддержка 6 платформ: Windows/macOS/Linux x86_64 + ARM64.

## Ключевые компоненты

### Frontend (`src/`)

| Слой | Расположение | Назначение |
|---|---|---|
| Views (9) | `src/views/` | Страницы: Connect, Tasks, Projects, Transfers, Statistics, Messages, Notices, DiskUsage, HostInfo |
| Components (31) | `src/components/` | DataTable, диалоги (About, Preferences, ProjectAttachWizard), ActivityControls, StatusBar, UpdateBanner |
| Stores (12) | `src/stores/` | Pinia stores: connection, client, tasks, projects, transfers, statistics, messages, notices, preferences, diskUsage, managerSettings, toast |
| Composables (7) | `src/composables/` | useRpc, usePlatform, useUpdateCheck, useWindowState, useTableState, useSuspendReasons, useNotifications |
| Types | `src/types/boinc.ts` | TypeScript-интерфейсы, зеркалящие Rust-типы |
| Type-safe IPC | `src/lib/typedInvoke.ts` | CommandMap — compile-time проверка вызовов Tauri |
| i18n | `src/i18n/` | 8 языков (en bundled, остальные lazy-load) |

### Backend (`src-tauri/src/`)

| Модуль | Файл | Назначение |
|---|---|---|
| App setup | `lib.rs` | 70 Tauri-команд, AppState, lifecycle, CLI-аргументы |
| RPC connection | `rpc/connection.rs` | TCP-клиент, auth (MD5 challenge-response), send/receive XML |
| RPC commands | `rpc/commands.rs` | Бизнес-логика: 50+ методов (get_results, set_run_mode и т.д.) |
| Auth | `rpc/auth.rs` | MD5-хэш, чтение `gui_rpc_auth.cfg` |
| Types | `rpc/types.rs` | Serde-структуры для BOINC-данных |
| XML parsing | `rpc/xml_parse.rs` | Парсинг XML-ответов через `quick_xml` |
| Tray | `tray.rs` | Системный трей: меню, иконки, snooze/resume |
| Updater | `updater.rs` | Self-update: скачивание, подмена бинарника, перезапуск |

## Потоки данных

### Polling

Все Pinia stores поллят BOINC-клиент с интервалом 5 сек. Каждый store управляет своим polling (startPolling/stopPolling).

### Подключение

1. `ConnectView` → `connect_local(dataDir)` или `connect(host, port, password)`
2. Rust: чтение `gui_rpc_auth.cfg` → TCP к `host:31416` → auth1/auth2 (MD5)
3. При успехе → навигация на `/tasks`, старт polling
4. При ошибке → exponential backoff (1s→30s, до 10 попыток)

### Обновление

1. Frontend поллит GitHub Releases API → сравнивает build_time
2. `download_update(url)` → сохраняет `.update` файл
3. `update_now()` → rename exe→.old, .update→exe, spawn new, exit
4. При следующем запуске `cleanup_old_binary()` удаляет `.old`

## Технологии и зависимости

### Frontend

- Vue 3.5, Vue Router 5, Pinia 3, vue-i18n 11
- TanStack Vue Table, VueUse
- Vite 6, TypeScript 5.6, Vitest 4
- Oxlint (линтинг), Prettier (форматирование)

### Backend

- Tauri 2 (tray-icon)
- tokio (async runtime), reqwest + rustls-tls (HTTP)
- quick-xml (XML parsing), serde/serde_json
- md-5 + hex (auth), thiserror (errors)
- Plugins: single-instance, cli, autostart, notification, opener, process

## Нефункциональные требования и ограничения

- Один бинарник, без установщика и внешних зависимостей
- BOINC GUI RPC — legacy XML-протокол, backward-compatible
- WebView2 (Windows) кеширует JS — dev-сборка чистит кеш (`scripts/build-dev.sh`)
- `prevent_close()` скрывает окно в трей вместо закрытия процесса
- `FRESCO_BUILD_TIME` env var: задаётся в CI, "dev" при локальной сборке (пропускает проверку обновлений)

## Roadmap

(Ведётся в GitHub Issues)
