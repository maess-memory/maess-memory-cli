#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from typing import Any

from memory_filter import MemoryCandidate, decide
from shared import (
    MaessMemoryMcpClient,
    compact_text,
    load_memory_server_config,
    load_session_state,
    read_hook_input,
    safe_json_output,
    save_session_state,
    utc_now_iso,
)


TEST_FAILURE_PATTERNS = [
    re.compile(r"\bfailed\b", re.IGNORECASE),
    re.compile(r"\berror\b", re.IGNORECASE),
    re.compile(r"\bexception\b", re.IGNORECASE),
]

MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\([^)]+\)")
MARKDOWN_FENCE_PATTERN = re.compile(r"```(?:[a-zA-Z0-9_-]+)?")
HEADING_PATTERN = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
LIST_MARKER_PATTERN = re.compile(r"^\s*[-*]\s+", re.MULTILINE)
NUMBERED_LIST_PATTERN = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)


def clean_text(value: str) -> str:
    cleaned = MARKDOWN_LINK_PATTERN.sub(r"\1", value)
    cleaned = MARKDOWN_FENCE_PATTERN.sub("", cleaned)
    cleaned = HEADING_PATTERN.sub("", cleaned)
    cleaned = LIST_MARKER_PATTERN.sub("", cleaned)
    cleaned = NUMBERED_LIST_PATTERN.sub("", cleaned)
    return " ".join(cleaned.split())


def build_pre_candidate(origin: str, content: str) -> dict[str, str]:
    return {
        "origem": origin,
        "conteudo": compact_text(clean_text(content), 500),
        "timestamp": utc_now_iso(),
    }


def append_pre_candidate(state: dict[str, Any], origin: str, content: str) -> bool:
    cleaned = compact_text(clean_text(content), 500)
    if len(cleaned) < 12:
        return False

    pre_candidates = list(state.get("pre_candidatos", []))
    if pre_candidates and str(pre_candidates[-1].get("conteudo", "")) == cleaned and str(pre_candidates[-1].get("origem", "")) == origin:
        return False

    pre_candidates.append(build_pre_candidate(origin, cleaned))
    state["pre_candidatos"] = pre_candidates[-12:]
    return True


def update_transient_state(payload: dict[str, Any], state: dict[str, Any]) -> bool:
    event_name = payload.get("hook_event_name")
    updated = False

    if event_name == "UserPromptSubmit":
        prompt = " ".join(str(payload.get("prompt", "")).split())
        if len(prompt) >= 12:
            state["ultimo_input"] = compact_text(clean_text(prompt), 500)
            updated = append_pre_candidate(state, "user-prompt", prompt) or updated

    if event_name == "Stop":
        last_message = str(payload.get("last_assistant_message") or "").strip()
        if len(last_message) >= 40:
            state["ultima_resposta"] = compact_text(clean_text(last_message), 600)
            updated = append_pre_candidate(state, "assistant-response", last_message) or updated

    return updated


def infer_category(text: str) -> str:
    normalized = text.lower()
    if any(term in normalized for term in ["erro", "falha", "failed", "exception", "error", "fix", "correção"]):
        return "Erro"
    if any(term in normalized for term in ["prefer", "preferência", "usuario prefere", "o usuário prefere"]):
        return "Preferencia"
    if any(term in normalized for term in ["padrão", "pattern", "convenc", "deve ", "não usar", "usar "]):
        return "Padrao"
    return "DecisaoTecnica"


def infer_memory_type(category: str, text: str) -> str:
    normalized = text.lower()
    if category in {"DecisaoTecnica", "Padrao", "Preferencia"} and len(normalized) >= 180:
        return "Longa"
    return "Sessao"


def extract_text_response(tool_response: Any) -> str:
    if tool_response is None:
        return ""
    if isinstance(tool_response, str):
        try:
            decoded = json.loads(tool_response)
            if isinstance(decoded, dict):
                return json.dumps(decoded, ensure_ascii=False)
            return str(decoded)
        except Exception:
            return tool_response
    return json.dumps(tool_response, ensure_ascii=False)


def build_post_tool_candidates(payload: dict[str, Any]) -> list[MemoryCandidate]:
    command = " ".join(str(payload.get("tool_input", {}).get("command", "")).split())
    tool_response = extract_text_response(payload.get("tool_response"))
    lower_command = command.lower()

    interesting_command = any(marker in lower_command for marker in ["dotnet test", "pytest", "npm test", "go test", "cargo test"])
    interesting_failure = any(pattern.search(tool_response) for pattern in TEST_FAILURE_PATTERNS)
    if not interesting_command or not interesting_failure:
        return []

    summary = compact_text(tool_response, 260)
    content = (
        "Erro relevante observado em execução de testes. "
        f"Comando: {command}. "
        f"Resumo: {summary}"
    )
    return [
        MemoryCandidate(
            content=content,
            memory_type="Curto",
            tags=["codex-hook", "bash", "teste", "erro"],
            origin="codex-hook-post-tool-use",
            category="Erro",
            system="codex",
            task_id=payload.get("turn_id"),
        )
    ]


def build_stop_candidates(payload: dict[str, Any]) -> list[MemoryCandidate]:
    session_id = str(payload.get("session_id") or "unknown-session")
    state = load_session_state(session_id)
    pre_candidates = state.get("pre_candidatos", [])
    last_message = str(payload.get("last_assistant_message") or "").strip()

    collected_parts: list[str] = []
    seen_parts: set[str] = set()

    def add_part(part: str) -> None:
        normalized = " ".join(part.split()).strip()
        if not normalized or normalized in seen_parts:
            return
        seen_parts.add(normalized)
        collected_parts.append(normalized)

    if state.get("ultimo_input"):
        add_part(f"Último input do usuário: {state['ultimo_input']}")

    for pre_candidate in pre_candidates[-6:]:
        origin = str(pre_candidate.get("origem", "")).strip() or "evento"
        content = str(pre_candidate.get("conteudo", "")).strip()
        if content:
            add_part(f"{origin}: {content}")

    if last_message:
        add_part(f"Resposta final do assistente: {clean_text(last_message)}")

    if not collected_parts:
        return []

    content = compact_text(" | ".join(collected_parts), 600)
    category = infer_category(content)
    memory_type = infer_memory_type(category, content)

    return [
        MemoryCandidate(
            content=content,
            memory_type=memory_type,
            tags=["codex-hook", "session-summary", "consolidated-session"],
            origin="codex-hook-stop-consolidado",
            category=category,
            system="codex",
            task_id=payload.get("turn_id"),
        )
    ]


def candidates_from_payload(payload: dict[str, Any]) -> list[MemoryCandidate]:
    event_name = payload.get("hook_event_name")
    if event_name == "PostToolUse":
        return build_post_tool_candidates(payload)
    if event_name == "Stop":
        return build_stop_candidates(payload)
    return []


def persist_candidates(payload: dict[str, Any]) -> int:
    session_id = str(payload.get("session_id") or "unknown-session")
    state = load_session_state(session_id)
    update_transient_state(payload, state)
    seen_hashes = set(state.get("hashes", []))
    candidates = candidates_from_payload(payload)
    if not candidates:
        save_session_state(session_id, state)
        return 0

    client = MaessMemoryMcpClient(load_memory_server_config())
    persisted = 0

    for candidate in candidates:
        decision = decide(candidate)
        if decision.decision != "persist":
            continue

        if decision.content_hash in seen_hashes:
            continue

        if not bool(int(str(os.environ.get("MAESS_MEMORY_HOOKS_DRY_RUN", "0")))):
            response = client.registrar_memoria(
                conteudo=decision.content,
                tipo=decision.memory_type,
                origem=decision.origin,
                tags=[*decision.tags, f"memhash:{decision.content_hash}"],
                categoria=decision.category,
                task_id=decision.task_id,
            )
            if not response.get("sucesso"):
                continue

        seen_hashes.add(decision.content_hash)
        persisted += 1

    state["hashes"] = sorted(seen_hashes)
    if payload.get("hook_event_name") == "Stop":
        state["pre_candidatos"] = []
    save_session_state(session_id, state)
    return persisted


def main() -> int:
    payload = read_hook_input()
    event_name = payload.get("hook_event_name")

    try:
        persisted = persist_candidates(payload)
    except Exception:
        if event_name == "Stop":
            safe_json_output({})
        return 0

    if event_name == "Stop":
        safe_json_output({})
        return 0

    if persisted > 0:
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
