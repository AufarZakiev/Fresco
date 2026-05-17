# История разработки

Правило: хранить только последние 10 записей. При добавлении новой переносить старые в
`agent_docs/development-history-archive.md`. Архив читать при необходимости.

---

Краткий журнал итераций проекта.

## Записи

## [2026-05-11] - CI: fail unsigned macOS releases

### Что сделано
- Подтверждена причина Gatekeeper "Move to Trash" для `Fresco_macOS_ARM64.dmg`: опубликованный app bundle был ad-hoc signed (`TeamIdentifier=not set`) и без stapled notarization ticket.
- Release-сборки macOS на `master` теперь требуют Apple Developer ID/notarization secrets, импортируют `Developer ID Application` certificate и передают notarization env в отдельный release-only `tauri-action`; ad-hoc `signingIdentity` fallback удалён из Tauri config.
- Apple signing/notarization secrets не передаются в pull request/non-release builds, чтобы Tauri не пытался импортировать пустые `APPLE_CERTIFICATE*` значения и чтобы Linux/Windows release builds не получали лишние секреты.
- Release-сборка macOS теперь дополнительно notarize/staple сам `.dmg`, а CI проверяет Gatekeeper/notarization и для app bundle внутри образа, и для скачиваемого DMG-контейнера.
- Добавлена CI-проверка macOS DMG presentation metadata: `.DS_Store`, background image, `Applications` symlink и ожидаемый background size, чтобы не публиковать DMG без Finder layout.
- Подключён `Entitlements.plist` для hardened runtime WebKit/JSC и сетевых возможностей.
- Release notes больше не описывают ручной Gatekeeper workaround для новых macOS релизов.

### Зачем
Silent fallback на ad-hoc подпись создавал успешный GitHub release, который чистая macOS блокировала как повреждённый. Теперь релиз не должен публиковаться, если macOS артефакт не Developer ID signed и notarized.

### Обновлено
- [x] Root cause подтверждён на опубликованном ARM DMG.
- [x] Проверки: `git diff --check`, JSON/YAML parse, `pnpm lint`, `pnpm test` (620).
- [x] `agent_docs/development-history.md`
- [ ] CI release signing требует Apple secrets в GitHub; локально notarized build без них не воспроизводится.
- [ ] `agent_docs/adr.md` — не требуется, это release pipeline guard.

## [2026-05-10] - CI: allow pnpm build script for @parcel/watcher

### Что сделано
- Исправлен падение последнего Build workflow на шаге `pnpm install --frozen-lockfile`.
- Перенесён build-script allowlist в `pnpm-workspace.yaml`: `allowBuilds` для актуального pnpm и `onlyBuiltDependencies` для v10-совместимости.

### Зачем
GitHub Actions использует `pnpm/action-setup@v4` с `version: latest`; свежий pnpm завершал install с `ERR_PNPM_IGNORED_BUILDS`, если dependency с build script не была разрешена в ожидаемой для этой версии конфигурации.

### Обновлено
- [x] Проверки: `pnpm install --frozen-lockfile`.
- [x] `agent_docs/development-history.md`
- [ ] `agent_docs/adr.md` — не требуется, это CI/dependency policy fix.

## [2026-05-09] - Issue #106: statistics separate chart project names

### Что сделано
- Исправлен режим Statistics / All separated: заголовки отдельных графиков теперь используют `project_name` из текущего списка проектов по `master_url`, как уже делал unique project dropdown.
- Fallback на URL сохранён для случаев, когда данные проекта ещё не загружены.
- Добавлен unit-тест, который проверяет, что separate chart titles показывают имя проекта, а не URL.

### Зачем
Issue #106 описывал расхождение UX: unique project view показывал человекочитаемое имя проекта, а all separated view показывал URL.

### Обновлено
- [x] Тесты: frontend unit 620/620, `i18n:check` 0/0/0.
- [x] `agent_docs/development-history.md`
- [ ] `agent_docs/adr.md` — не требуется, изменение следует существующей модели сопоставления статистики с проектами по `master_url`.

### Следующие шаги
- Визуально проверить Statistics / All separated в desktop dev app.

## [2026-05-09] - Issue #105: project scheduler RPC status

### Что сделано
- Реализовано отображение scheduler RPC состояния в существующей колонке `Status` на странице Projects:
  - `Scheduler request in progress` по полю `scheduler_rpc_in_progress` с приоритетом над pending-состоянием.
  - `Scheduler request pending: <reason>` по `sched_rpc_pending`.
  - `Communication deferred HH:MM:SS` по `min_rpc_time` с секундным countdown.
- Расширены Rust/TypeScript модели `Project` и парсер `get_project_status`.
- Добавлены i18n-ключи для статусов и причин RPC во все locale-файлы.
- Убран накопившийся шум `i18n:check`: валидатор теперь учитывает динамические ключи, отсутствующие переводы заполнены, неиспользуемые ключи удалены.
- Обновлены моки и тесты.

### Зачем
Issue #105 просил показывать пользователю реальный статус pull/scheduler request и задержку до следующей возможной связи с сервером проекта без отдельной колонки.

### Обновлено
- [x] Тесты: frontend unit 619/619, Rust unit 72/72, production build ok, `i18n:check` 0/0/0.
- [x] `agent_docs/development-history.md`
- [ ] `agent_docs/adr.md` — не требуется, изменение следует существующей BOINC RPC-модели.

### Следующие шаги
- Проверить визуально страницу Projects в dev server.

## [2026-04-19] - PR: BOINC first-run onboarding (takeover + install)

### Что сделано
- Объединённый upstream PR https://github.com/AufarZakiev/Fresco/pull/99 на ветке `feat/boinc-manager-takeover`.
- **Takeover**: `ManagerAutostartInfo` enum + команды `detect_boinc_manager_autostart`, `disable_boinc_manager_autostart`, `open_login_items_settings` в `src-tauri/src/lib.rs`. `OnboardingTakeoverDialog.vue`, хук в `App.vue` autoConnect, флаг `onboardingCompleted`, i18n `onboarding.takeover.*`.
- **Install** (первоначально планировался отдельным PR 2, влит сюда): команды `detect_boinc_install_options` + `install_boinc_via_brew`, расширен `resolve_boinc_exe` (Homebrew-пути на macOS). `BoincInstallDialog.vue` + тест, `runInstallOnboardingIfNeeded` в `App.vue`, флаг `installOnboardingCompleted`, i18n `onboarding.install.*`. brew-таймаут 900s.
- Codex review (takeover): 3 замечания исправлены.

### Зачем
На первом запуске пользователь мог получить два «лица BOINC» (Fresco рядом с официальным Manager) либо пустой ConnectView без подсказок, если BOINC не установлен. Оба онбординга живут в одном fallback-пути `autoConnect` и решают один сценарий первого запуска.

### Обновлено
- [x] Тесты: все фронт зелёные (593) + Rust unit (57)
- [x] agent_docs/development-history.md
- [ ] agent_docs/adr.md — не требуется
- [x] todo.md — устарел, PR 2 влит в #99

### Следующие шаги
- Ждать фидбек @AufarZakiev на объединённом #99.
