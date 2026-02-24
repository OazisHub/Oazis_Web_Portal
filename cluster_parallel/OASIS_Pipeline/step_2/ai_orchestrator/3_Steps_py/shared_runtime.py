from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List


def p(step_id: str, message: str) -> None:
    print(f"[{step_id}] {message}", flush=True)


def fatal(step_id: str, message: str) -> "None":
    raise RuntimeError(f"[{step_id}] ❌ FATAL: {message}")


def cluster_root(step_id: str) -> Path:
    raw = os.getenv("CLUSTER_ROOT", "").strip()
    if not raw:
        fatal(step_id, "CLUSTER_ROOT is missing in environment.")
    pth = Path(raw).expanduser()
    if not pth.is_absolute():
        fatal(step_id, f"CLUSTER_ROOT must be absolute: {pth}")
    return pth.resolve()


def get_path(paths: Dict[str, Any], step_id: str, key: str) -> Path:
    node = paths.get(key)
    if not isinstance(node, dict):
        fatal(step_id, f"missing paths node: {key}")
    raw = node.get("path")
    if not isinstance(raw, str) or not raw.strip():
        fatal(step_id, f"missing paths.{key}.path")
    return Path(raw).expanduser().resolve()


def resolve_cluster_relative(step_id: str, path_like: str) -> Path:
    pth = Path(path_like).expanduser()
    if pth.is_absolute():
        return pth.resolve()
    return (cluster_root(step_id) / pth).resolve()


def ensure_parent(file_path: Path) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)


def write_json(file_path: Path, payload: Any) -> None:
    ensure_parent(file_path)
    file_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(file_path: Path) -> Dict[str, Any]:
    if not file_path.exists():
        return {}
    raw = file_path.read_text(encoding="utf-8").strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if isinstance(parsed, dict):
        return parsed
    return {"value": parsed}


def write_jsonl(file_path: Path, records: Iterable[Any]) -> int:
    ensure_parent(file_path)
    count = 0
    with file_path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def read_jsonl(file_path: Path) -> List[Dict[str, Any]]:
    if not file_path.exists():
        return []
    out: List[Dict[str, Any]] = []
    for line in file_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        if isinstance(item, dict):
            out.append(item)
    return out
