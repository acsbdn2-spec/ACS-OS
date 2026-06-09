"""
Shared configuration helpers for the Busy sync tools.

The agent can be reused for another company by changing .env and profile files,
without editing sync_agent.py.
"""

from __future__ import annotations

import os
from pathlib import Path


AGENT_DIR = Path(__file__).resolve().parent
DEFAULT_BUSY_ROOTS = [
    Path(r"C:\BusyWin\Data"),
    Path(r"C:\Busy\Data"),
    Path(r"C:\Busy21\Data"),
]
SUPPORTED_DB_EXTENSIONS = (".bds", ".accdb", ".mdb", ".db")


def default_busy_root() -> Path:
    for path in DEFAULT_BUSY_ROOTS:
        if path.exists():
            return path
    return DEFAULT_BUSY_ROOTS[0]


def env_value(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def active_profile_name() -> str:
    return env_value("SYNC_PROFILE", "acs")


def find_busy_database_file(company_dir: Path) -> Path:
    if not company_dir.exists():
        raise FileNotFoundError(f"Busy company folder not found: {company_dir}")

    if company_dir.is_file():
        return company_dir

    candidates: list[Path] = []
    max_depth = 2
    base_depth = len(company_dir.parts)

    for root, dirs, files in os.walk(company_dir):
        root_path = Path(root)
        if len(root_path.parts) - base_depth >= max_depth:
            dirs[:] = []

        for filename in files:
            path = root_path / filename
            if path.suffix.lower() in SUPPORTED_DB_EXTENSIONS:
                candidates.append(path)

    if not candidates:
        extensions = ", ".join(SUPPORTED_DB_EXTENSIONS)
        raise FileNotFoundError(
            f"No Busy database file found in {company_dir}. Looked for: {extensions}"
        )

    def score(path: Path) -> tuple[int, float]:
        name = path.stem.lower()
        preferred = ["busy", "company", "data", "main", "accounts", "account"]
        name_score = sum(1 for word in preferred if word in name)
        try:
            modified = path.stat().st_mtime
        except OSError:
            modified = 0
        return (name_score, modified)

    return sorted(candidates, key=score, reverse=True)[0]


def resolve_busy_db_path() -> Path:
    direct = env_value("BUSY_DB_PATH")
    if direct:
        direct_path = Path(direct).expanduser()
        if not direct_path.exists():
            raise FileNotFoundError(f"Busy database path not found: {direct_path}")
        return find_busy_database_file(direct_path) if direct_path.is_dir() else direct_path

    company_dir = env_value("BUSY_COMPANY_DIR")
    if company_dir:
        return find_busy_database_file(Path(company_dir).expanduser())

    root = Path(env_value("BUSY_DATA_ROOT", str(default_busy_root()))).expanduser()
    company_code = env_value("BUSY_COMPANY_CODE", "comp0004")
    return find_busy_database_file(root / company_code)


def config_summary(resolved_db_path: Path | None = None) -> dict[str, str]:
    root = env_value("BUSY_DATA_ROOT", str(default_busy_root()))
    company_code = env_value("BUSY_COMPANY_CODE", "comp0004")
    company_dir = env_value("BUSY_COMPANY_DIR", str(Path(root) / company_code))

    return {
        "profile": active_profile_name(),
        "busy_data_root": root,
        "busy_company_code": company_code,
        "busy_company_dir": company_dir,
        "busy_db_path": str(resolved_db_path or env_value("BUSY_DB_PATH")),
        "poll_seconds": env_value("POLL_SECONDS", "180"),
    }


def quote_env(value: str) -> str:
    if value == "":
        return ""
    if any(char in value for char in " #\t"):
        return f'"{value}"'
    return value


def write_env_file(values: dict[str, str], env_path: Path | None = None) -> Path:
    env_path = env_path or AGENT_DIR / ".env"
    ordered_keys = [
        "SYNC_PROFILE",
        "BUSY_DATA_ROOT",
        "BUSY_COMPANY_CODE",
        "BUSY_COMPANY_DIR",
        "BUSY_DB_PATH",
        "BUSY_DB_PASSWORD",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "POLL_SECONDS",
    ]

    lines = [
        "# ACS OS Busy sync settings",
        "# Change these values per company; do not edit sync_agent.py.",
    ]
    for key in ordered_keys:
        if key in values:
            lines.append(f"{key}={quote_env(values.get(key, '').strip())}")

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return env_path
