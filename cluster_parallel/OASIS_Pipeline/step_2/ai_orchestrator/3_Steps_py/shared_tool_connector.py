
from pathlib import Path
import sys
import yaml
from typing import Any, Dict, List, Optional


def _find_shared_root(current_file: str) -> Path:
    """
    Walks up the directory tree until it finds the shared_tools root
    (folder containing '1_Scripts_Box').
    """
    p = Path(current_file).resolve()

    for parent in p.parents:
        # canonical shared_tools layout:
        # 1_Cluster_Assets/2_TOOLS/1_Shared_Tools/1_Scripts_Box
        candidate = parent / "1_Cluster_Assets" / "2_TOOLS" / "1_Shared_Tools"
        if (candidate / "1_Scripts_Box").exists():
            return candidate

        # fallback: direct 1_Shared_Tools in ancestry
        if parent.name == "1_Shared_Tools" and (parent / "1_Scripts_Box").exists():
            return parent

    raise RuntimeError(
        "[phase0] shared_tools root not found (expected 1_Cluster_Assets/2_TOOLS/1_Shared_Tools/1_Scripts_Box)"
    )

def run_connector(
    step_id: str,
    cli_panel: Optional[str] = None,
    argv: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Canonical Phase-0 execution connector.
    Executes infrastructure chain and returns prepared context bundle.
    """

    print("[phase0] ▶ START")

    # --- Normalize cli_panel ---
    if cli_panel is not None:
        s = str(cli_panel).strip().lower()
        if s in {"", "0", "none", "null"}:
            cli_panel = None

    shared_root = _find_shared_root(__file__)
    scripts_root = shared_root / "1_Scripts_Box"
    if str(scripts_root) not in sys.path:
        sys.path.insert(0, str(scripts_root))
    print(f"[phase0] 🧷 ANCHOR_FOUND {shared_root}")

    # --- Infrastructure imports (after seed) ---
    from scripts_py.a_bootstrap import bootstrap
    from scripts_py.b_panel_locator import locate_panel_path
    from scripts_py.c_job_descriptor import JobDescriptor
    from scripts_py.d_job_path_resolver import resolve_panel_for_job

    ctx = bootstrap()
    print("[phase0] 🔑 BOOTSTRAP_OK")

    panel_path = locate_panel_path(step_id, cli_panel=cli_panel)
    print(f"[phase0] 🧭 PANEL_LOCATED {panel_path}")

    panel_raw = yaml.safe_load(panel_path.read_text(encoding="utf-8"))
    if not isinstance(panel_raw, dict):
        raise RuntimeError(f"[phase0] panel must be a dict: {panel_path}")

    # -------------------------------------------------
    # Canonical job resolution via active_job.json
    # -------------------------------------------------
    job = JobDescriptor.from_active_job(ctx.cluster_root)
    print(f"[phase0] 🧾 JOB_ID {job.job_id}")

    panel_resolved, _tokens = resolve_panel_for_job(
        panel_raw,
        step_id=step_id,
        job=job,
        job_ctx=ctx,
    )

    paths = panel_resolved.get("paths")
    if not isinstance(paths, dict):
        paths = {}

    print("[phase0] 🧩 PATHS_RESOLVED")

    bundle = {
        "ctx": ctx,
        "panel_path": panel_path,
        "panel_raw": panel_raw,
        "panel_resolved": panel_resolved,
        "job": job,
        "paths": paths,
    }

    print("[phase0] ✅ DONE")
    return bundle
