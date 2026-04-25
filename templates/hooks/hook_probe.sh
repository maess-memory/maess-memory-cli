#!/usr/bin/env bash
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
state_dir="$repo_root/.codex/hooks/.state"
log_file="$state_dir/hook_probe.log"

mkdir -p "$state_dir"

event_name="${CODEX_HOOK_EVENT_NAME:-unknown}"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cwd="${PWD:-}"

printf '%s event=%s cwd=%s\n' "$timestamp" "$event_name" "$cwd" >> "$log_file"
