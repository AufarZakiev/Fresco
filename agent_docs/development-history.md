# История разработки

Правило: хранить только последние 10 записей. При добавлении новой переносить старые в
`agent_docs/development-history-archive.md`. Архив читать при необходимости.

---

Краткий журнал итераций проекта.

## Записи

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
