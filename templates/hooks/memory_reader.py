#!/usr/bin/env python3
from __future__ import annotations

import sys
from typing import Any

from shared import MaessMemoryMcpClient, compact_text, load_memory_server_config, read_hook_input, safe_json_output


def query_from_payload(payload: dict[str, Any]) -> tuple[str | None, int, str | None]:
    event_name = payload.get("hook_event_name")
    if event_name == "SessionStart":
        return "convenções do projeto preferências do usuário decisões arquiteturais padrões de código", 4, None

    if event_name == "UserPromptSubmit":
        prompt = " ".join(str(payload.get("prompt", "")).split())
        if len(prompt) < 12:
            return None, 0, None
        return prompt[:400], 3, None

    if event_name == "PreToolUse":
        command = " ".join(str(payload.get("tool_input", {}).get("command", "")).split())
        if len(command) < 8:
            return None, 0, None
        task_id = payload.get("turn_id")
        return f"bash command {command[:220]} convenções do projeto decisões anteriores", 3, task_id

    return None, 0, None


def build_context(memories: list[dict[str, Any]]) -> str:
    lines = []
    for memory in memories[:3]:
        score = memory.get("scoreRelevancia")
        score_suffix = f" | score {score:.2f}" if isinstance(score, (int, float)) else ""
        lines.append(f"- [{memory.get('tipo', 'Memória')}{score_suffix}] {compact_text(memory.get('conteudo', ''), 180)}")
    if not lines:
        return ""
    return "Memórias relevantes do maess-memory:\n" + "\n".join(lines)


def main() -> int:
    payload = read_hook_input()
    event_name = payload.get("hook_event_name")
    query, limit, task_id = query_from_payload(payload)
    if not query:
        return 0

    try:
        client = MaessMemoryMcpClient(load_memory_server_config())
        memories = client.buscar_memorias(query=query, limit=limit, task_id=task_id)
    except Exception:
        return 0

    context = build_context(memories)
    if not context:
        return 0

    if event_name in {"SessionStart", "UserPromptSubmit"}:
        safe_json_output(
            {
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "additionalContext": context,
                }
            }
        )
        return 0

    if event_name == "PreToolUse":
        safe_json_output({"systemMessage": context})
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
