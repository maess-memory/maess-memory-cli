#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import ast
import json
import os
import subprocess
import sys
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = REPO_ROOT / ".codex" / "hooks" / ".state"


@dataclass(frozen=True)
class MemoryServerConfig:
    url: str
    api_key: str
    system_name: str


class McpError(RuntimeError):
    pass


def read_hook_input() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    return json.loads(raw) if raw else {}


def compact_text(value: str, limit: int = 220) -> str:
    normalized = " ".join(value.split())
    return normalized if len(normalized) <= limit else normalized[: limit - 3].rstrip() + "..."


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def sha_tag(value: str) -> str:
    return hashlib.sha256(normalize_text(value).encode("utf-8")).hexdigest()[:16]


def safe_json_output(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def git_root_from_cwd(cwd: str | None) -> Path:
    if cwd:
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True,
            )
            return Path(result.stdout.strip())
        except Exception:
            pass
    return REPO_ROOT


def resolve_env_reference(value: str | None) -> str | None:
    if not value:
        return value
    if value.startswith("$") and len(value) > 1:
        return os.environ.get(value[1:])
    return value


def load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue

        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue

        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            try:
                value = ast.literal_eval(value)
            except Exception:
                value = value[1:-1]

        values[key] = str(value)

    return values


def resolve_codex_config_path() -> Path:
    codex_home = os.environ.get("CODEX_HOME", "").strip()
    if codex_home:
        return Path(codex_home) / ".codex" / "config.toml"
    return Path.home() / ".codex" / "config.toml"


def load_memory_server_config() -> MemoryServerConfig:
    config_path = resolve_codex_config_path()
    env_url = os.environ.get("MAESS_MEMORY_MCP_URL")
    env_api_key = os.environ.get("MAESS_MEMORY_MCP_API_KEY")
    project_env = load_env_file(REPO_ROOT / ".env")
    env_system_name = (
        os.environ.get("MAESS_MEMORY_SYSTEM_NAME")
        or project_env.get("MAESS_MEMORY_SYSTEM_NAME")
    )

    if config_path.exists():
        with config_path.open("rb") as handle:
            config = tomllib.load(handle)

        server = config.get("mcp_servers", {}).get("maess-memory", {})
        server_headers = server.get("http_headers", {})
        url = resolve_env_reference(server.get("url"))
        api_key = resolve_env_reference(server_headers.get("ApiKey"))
        system_name = env_system_name

        if url and api_key and system_name:
            return MemoryServerConfig(
                url=url,
                api_key=api_key,
                system_name=system_name,
            )

        raise McpError(
            f"Configuração do MCP maess-memory incompleta em {config_path}. "
            "Defina url, http_headers.ApiKey e MAESS_MEMORY_SYSTEM_NAME no .env do projeto."
        )

    if env_url and env_api_key:
        if not env_system_name:
            raise McpError(
                "MAESS_MEMORY_SYSTEM_NAME é obrigatório no .env do projeto quando "
                "MAESS_MEMORY_MCP_URL e MAESS_MEMORY_MCP_API_KEY são usados sem config.toml."
            )
        return MemoryServerConfig(
            url=env_url,
            api_key=env_api_key,
            system_name=env_system_name,
        )

    raise McpError(
        f"Configuração do MCP maess-memory ausente. Forneça {config_path} "
        "e defina MAESS_MEMORY_SYSTEM_NAME no .env do projeto, ou use variáveis de ambiente de fallback."
    )


def parse_sse_json(body: str) -> dict[str, Any]:
    for line in body.splitlines():
        if line.startswith("data: "):
            return json.loads(line[6:])
    raise McpError("Resposta MCP sem payload SSE reconhecível.")


class MaessMemoryMcpClient:
    def __init__(self, config: MemoryServerConfig) -> None:
        self.config = config
        self.base_headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "ApiKey": self.config.api_key,
            "Sistema": self.config.system_name,
        }

    def _post(self, payload: dict[str, Any], headers: dict[str, str] | None = None) -> requests.Response:
        response = requests.post(
            self.config.url,
            headers=headers or self.base_headers,
            data=json.dumps(payload),
            timeout=20,
        )
        response.raise_for_status()
        return response

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        init_payload = {
            "jsonrpc": "2.0",
            "id": "initialize",
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "maess-memory-codex-hooks", "version": "0.1"},
            },
        }

        init_response = self._post(init_payload)
        session_id = init_response.headers.get("Mcp-Session-Id")
        if not session_id:
            raise McpError("Mcp-Session-Id não retornado pelo servidor MCP.")

        session_headers = {**self.base_headers, "Mcp-Session-Id": session_id}
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=session_headers)

        call_payload = {
            "jsonrpc": "2.0",
            "id": f"tool-call-{name}",
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
        response = self._post(call_payload, headers=session_headers)
        payload = parse_sse_json(response.text)
        content = payload.get("result", {}).get("content", [])
        if not content:
            raise McpError(f"Resposta vazia da tool MCP {name}.")

        text_payload = next((item.get("text") for item in content if item.get("type") == "text"), None)
        if not text_payload:
            raise McpError(f"Tool MCP {name} não retornou conteúdo textual.")

        return json.loads(text_payload)

    def buscar_memorias(self, query: str, limit: int = 3, task_id: str | None = None) -> list[dict[str, Any]]:
        response = self.call_tool(
            "buscar_memorias",
            {
                "request": {
                    "query": query,
                    "taskId": task_id,
                    "limit": limit,
                    "incluirBuscaSemantica": True,
                }
            },
        )
        if not response.get("sucesso"):
            raise McpError(response.get("mensagem") or "Falha ao buscar memórias.")
        return response.get("memorias", [])

    def registrar_memoria(
        self,
        conteudo: str,
        tipo: str,
        origem: str,
        tags: list[str],
        categoria: str | None = None,
        task_id: str | None = None,
    ) -> dict[str, Any]:
        return self.call_tool(
            "registrar_memoria",
            {
                "request": {
                    "conteudo": conteudo,
                    "tipo": tipo,
                    "taskId": task_id,
                    "tags": tags,
                    "origem": origem,
                    "categoria": categoria,
                }
            },
        )


def load_session_state(session_id: str) -> dict[str, Any]:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    path = STATE_DIR / f"session_{session_id}.json"
    if not path.exists():
        return {"hashes": [], "pre_candidatos": [], "ultimo_input": "", "ultima_resposta": ""}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        return {
            "hashes": list(loaded.get("hashes", [])),
            "pre_candidatos": list(loaded.get("pre_candidatos", [])),
            "ultimo_input": str(loaded.get("ultimo_input", "")),
            "ultima_resposta": str(loaded.get("ultima_resposta", "")),
        }
    except Exception:
        return {"hashes": [], "pre_candidatos": [], "ultimo_input": "", "ultima_resposta": ""}


def save_session_state(session_id: str, state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    path = STATE_DIR / f"session_{session_id}.json"
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
