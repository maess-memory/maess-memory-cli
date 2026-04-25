#!/usr/bin/env python3
from __future__ import annotations

import re
from dataclasses import dataclass

from shared import compact_text, normalize_text, sha_tag


SECRET_PATTERNS = [
    re.compile(r"\bsk-[a-zA-Z0-9]{20,}\b"),
    re.compile(r"\beyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b"),
    re.compile(r"\b[A-Fa-f0-9]{48,}\b"),
    re.compile(r"authorization:\s*bearer", re.IGNORECASE),
    re.compile(r"api[_ -]?key", re.IGNORECASE),
    re.compile(r"password|senha", re.IGNORECASE),
]

HIGH_VALUE_HINTS = [
    "implement",
    "implementei",
    "prefer",
    "preferência",
    "convenc",
    "padrão",
    "pattern",
    "decis",
    "adot",
    "usar ",
    "não usar",
    "must",
    "deve ",
    "erro",
    "falha",
    "correção",
    "fix",
    "configur",
    "arquitet",
]

TRANSIENT_HINTS = [
    "localhost",
    "127.0.0.1",
    "pid ",
    "processo ",
    "container ",
    "porta ",
    "port ",
    "timestamp",
    "wall time",
]


@dataclass(frozen=True)
class MemoryCandidate:
    content: str
    memory_type: str
    tags: list[str]
    origin: str
    category: str | None = None
    system: str | None = None
    task_id: str | None = None


@dataclass(frozen=True)
class FilterDecision:
    decision: str
    reason: str
    memory_type: str
    content_hash: str
    content: str
    tags: list[str]
    origin: str
    category: str | None
    system: str | None
    task_id: str | None


def decide(candidate: MemoryCandidate) -> FilterDecision:
    normalized = normalize_text(candidate.content)
    content_hash = sha_tag(candidate.content)
    compacted = compact_text(candidate.content, 600)

    if len(normalized) < 40:
        return FilterDecision("discard", "Muito curto para memória útil.", candidate.memory_type, content_hash, compacted, candidate.tags, candidate.origin, candidate.category, candidate.system, candidate.task_id)

    if any(pattern.search(candidate.content) for pattern in SECRET_PATTERNS):
        return FilterDecision("discard", "Possível segredo ou credencial sensível.", candidate.memory_type, content_hash, compacted, candidate.tags, candidate.origin, candidate.category, candidate.system, candidate.task_id)

    has_high_value_hint = any(hint in normalized for hint in HIGH_VALUE_HINTS)
    has_transient_hint = any(hint in normalized for hint in TRANSIENT_HINTS)

    if has_transient_hint and not has_high_value_hint:
        return FilterDecision("discard", "Conteúdo operacional e temporário.", candidate.memory_type, content_hash, compacted, candidate.tags, candidate.origin, candidate.category, candidate.system, candidate.task_id)

    if not has_high_value_hint:
        return FilterDecision("discard", "Sem sinal claro de reutilização futura.", candidate.memory_type, content_hash, compacted, candidate.tags, candidate.origin, candidate.category, candidate.system, candidate.task_id)

    return FilterDecision("persist", "Conteúdo parece útil para reutilização futura.", candidate.memory_type, content_hash, compacted, candidate.tags, candidate.origin, candidate.category, candidate.system, candidate.task_id)
