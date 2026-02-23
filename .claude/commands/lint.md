# Linter Runner

Run linters on files to ensure code quality. Auto-detects file type and available linters.

## Target

Lint: $ARGUMENTS

If no target specified, ask the user what files to lint.

## Workflow

1. **Detect file type** from extension
2. **Check for existing linter setup** (config files, installed packages)
3. **Run linter** if available, or **propose installation** if not

## Linters by File Type

| Extension | Linter | Config file |
|-----------|--------|-------------|
| `.js`, `.jsx`, `.ts`, `.tsx` | oxlint | `oxlintrc.json` |
| `.py` | Ruff | `ruff.toml`, `pyproject.toml` |
| `.css`, `.scss` | Stylelint | `.stylelintrc.*` |
| `.json` | oxlint | `oxlintrc.json` |
| `.md` | markdownlint | `.markdownlint.*` |
| `.go` | golangci-lint | `.golangci.yml` |
| `.rs` | Clippy | `clippy.toml` |
| `.cpp`, `.c`, `.h` | clang-tidy | `.clang-tidy` |
| `.yaml`, `.yml` | yamllint | `.yamllint` |
| `.sh`, `.bash` | ShellCheck | - |

## Check Linter Availability

**JS/TS:**
```bash
npx oxlint --version 2>/dev/null || echo "NOT_FOUND"
```

**Python:**
```bash
ruff --version 2>/dev/null || python -m ruff --version 2>/dev/null || echo "NOT_FOUND"
```

**Other languages:** Check if the tool exists in PATH or project dependencies.

## Run Linter

**oxlint (JS/TS/JSON):**
```bash
npx oxlint "path/to/file"
```

**Ruff (Python):**
```bash
ruff check --fix "path/to/file"
ruff format "path/to/file"
```

**Stylelint (CSS):**
```bash
npx stylelint --fix "path/to/file"
```

**golangci-lint (Go):**
```bash
golangci-lint run "path/to/file"
```

**Clippy (Rust):**
```bash
cargo clippy -- -D warnings
```

**markdownlint (Markdown):**
```bash
npx markdownlint-cli2 "path/to/file"
```

**yamllint (YAML):**
```bash
yamllint "path/to/file"
```

**ShellCheck (Shell):**
```bash
shellcheck "path/to/file"
```

## No Linter Found - Propose Installation

### JavaScript/TypeScript

**oxlint** - Extremely fast, written in Rust, zero config needed.

```bash
npm install --save-dev oxlint
```

Optional config `oxlintrc.json`:
```json
{
  "rules": {}
}
```

### Python

**Ruff** - Extremely fast, replaces Flake8/isort/pyupgrade.

```bash
pip install ruff
# or with uv
uv add --dev ruff
```

Minimal config in `pyproject.toml`:
```toml
[tool.ruff]
line-length = 88
select = ["E", "F", "I", "UP"]
```

### CSS/SCSS

**Stylelint**

```bash
npm install --save-dev stylelint stylelint-config-standard
```

Create `.stylelintrc.json`:
```json
{
  "extends": "stylelint-config-standard"
}
```

### Markdown

**markdownlint-cli2**

```bash
npm install --save-dev markdownlint-cli2
```

### YAML

**yamllint**

```bash
pip install yamllint
```

### Shell Scripts

**ShellCheck**

```bash
# macOS
brew install shellcheck

# Ubuntu/Debian
apt-get install shellcheck

# Windows (scoop)
scoop install shellcheck
```

### Go

**golangci-lint**

```bash
# macOS
brew install golangci-lint

# Linux/Windows
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

### Rust

**Clippy** - Included with Rust toolchain.

```bash
rustup component add clippy
```

## Package Manager Detection

| File exists | Use |
|-------------|-----|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` | bun |
| `package-lock.json` | npm |
| `uv.lock` | uv |
| `poetry.lock` | poetry |
| `requirements.txt` | pip |

Default to npm (JS) or pip (Python) if no lock file found.

## Output Format

After running linter:

```
Linting complete: [filename]
   - X issues fixed automatically
   - Y issues require manual attention

Remaining issues:
   [list specific issues with line numbers]
```

If proposing installation:

```
No linter configured for [file type]

Recommended: [linter name]

Install with:
[installation command]
```

## Quick Reference

| Tool | Lint | Lint + Fix |
|------|------|------------|
| oxlint | `npx oxlint .` | `npx oxlint --fix .` |
| Ruff | `ruff check .` | `ruff check --fix . && ruff format .` |
| Stylelint | `npx stylelint "**/*.css"` | `npx stylelint --fix "**/*.css"` |
| Clippy | `cargo clippy` | `cargo clippy --fix` |
| golangci-lint | `golangci-lint run` | `golangci-lint run --fix` |
