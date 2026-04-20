# История разработки

Правило: хранить только последние 10 записей. При добавлении новой переносить старые в
`agent_docs/development-history-archive.md`. Архив читать при необходимости.

---

Краткий журнал итераций проекта.

## Записи

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
