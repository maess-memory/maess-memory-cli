# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Node.js CLI package (`@maess-systems/memory-cli`). The main entry point is [`bin/index.js`](bin/index.js), which configures the local project by creating `.env` entries and installing Codex hooks under `.codex/`.

Template assets live in [`templates/`](templates/):
- [`templates/hooks/`](templates/hooks/) contains the hook scripts copied into the target project.
- [`templates/codex/hooks.json`](templates/codex/hooks.json) is the canonical hook configuration.

There is currently no dedicated `src/` or `tests/` tree.

## Build, Test, and Development Commands
There are no npm scripts defined in [`package.json`](package.json). Use Node.js directly:

- `node bin/index.js` - runs the CLI locally and applies the setup to the current working directory.
- `chmod +x templates/hooks/hook_probe.sh` - only needed if you add or replace shell hooks manually.

When changing the CLI, validate by running it in a throwaway project directory and checking that `.env` and `.codex/` are created as expected.

## Coding Style & Naming Conventions
The codebase uses modern ECMAScript modules (`"type": "module"`). Follow the existing style:

- Use 2-space indentation.
- Prefer `const` unless reassignment is required.
- Keep filenames lowercase with underscores for hook helpers, such as `memory_reader.py` and `hook_probe.sh`.
- Use clear, descriptive function names like `createEnv()` and `setupCodex()`.

## Testing Guidelines
No automated test framework is configured yet. If you add tests, place them in a dedicated `tests/` or `test/` directory and prefer deterministic checks around file creation and template copying. For shell and Python hooks, validate execution paths with the target project layout rather than relying on the repo root alone.

## Commit & Pull Request Guidelines
Git history uses short conventional prefixes such as `feat:` and version tags like `0.1.2`. Follow that pattern for future commits, for example: `feat: add env override for system name`.

Pull requests should include:
- a concise summary of the behavior change,
- notes on affected files under `bin/` or `templates/`,
- verification steps, especially the command used to run the CLI.

## Configuration Notes
The CLI writes project-specific state to `.env` and `.codex/`. Avoid committing generated files unless the change explicitly updates the shipped templates or default configuration.
