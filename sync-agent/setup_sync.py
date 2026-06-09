"""
Small Windows setup window for ACS OS Busy sync.

Run:
    python setup_sync.py

It writes sync-agent/.env so operators can point the sync at a local Busy
company folder today, or a server/shared folder later, without editing code.
"""

from __future__ import annotations

import os
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

from dotenv import load_dotenv

from config import default_busy_root, resolve_busy_db_path, write_env_file


AGENT_DIR = Path(__file__).resolve().parent
ENV_PATH = AGENT_DIR / ".env"


class SetupApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("ACS OS Busy Sync Setup")
        self.geometry("760x520")
        self.minsize(720, 500)

        load_dotenv(ENV_PATH)

        self.values = {
            "SYNC_PROFILE": tk.StringVar(value=os.environ.get("SYNC_PROFILE", "acs")),
            "BUSY_DATA_ROOT": tk.StringVar(
                value=os.environ.get("BUSY_DATA_ROOT", str(default_busy_root()))
            ),
            "BUSY_COMPANY_CODE": tk.StringVar(
                value=os.environ.get("BUSY_COMPANY_CODE", "comp0004")
            ),
            "BUSY_COMPANY_DIR": tk.StringVar(value=os.environ.get("BUSY_COMPANY_DIR", "")),
            "BUSY_DB_PATH": tk.StringVar(value=os.environ.get("BUSY_DB_PATH", "")),
            "BUSY_DB_PASSWORD": tk.StringVar(value=os.environ.get("BUSY_DB_PASSWORD", "")),
            "SUPABASE_URL": tk.StringVar(value=os.environ.get("SUPABASE_URL", "")),
            "SUPABASE_SERVICE_KEY": tk.StringVar(value=os.environ.get("SUPABASE_SERVICE_KEY", "")),
            "POLL_SECONDS": tk.StringVar(value=os.environ.get("POLL_SECONDS", "180")),
        }

        self.status = tk.StringVar(
            value="Choose the Busy company folder, then click Test Busy Path."
        )

        self._build()

    def _build(self) -> None:
        wrapper = tk.Frame(self, padx=18, pady=16)
        wrapper.pack(fill="both", expand=True)

        title = tk.Label(
            wrapper,
            text="Busy Sync Setup",
            font=("Segoe UI", 16, "bold"),
            anchor="w",
        )
        title.grid(row=0, column=0, columnspan=3, sticky="ew", pady=(0, 6))

        subtitle = tk.Label(
            wrapper,
            text=(
                "For ACS now use BusyWin > Data > comp0004. "
                "Later you can point this to the main server folder."
            ),
            font=("Segoe UI", 10),
            fg="#555555",
            anchor="w",
            wraplength=700,
        )
        subtitle.grid(row=1, column=0, columnspan=3, sticky="ew", pady=(0, 16))

        row = 2
        row = self._field(wrapper, row, "Company profile", "SYNC_PROFILE")
        row = self._field(wrapper, row, "Busy data root", "BUSY_DATA_ROOT", self._browse_root)
        row = self._field(wrapper, row, "Company code", "BUSY_COMPANY_CODE")
        row = self._field(wrapper, row, "Company folder override", "BUSY_COMPANY_DIR", self._browse_company)
        row = self._field(wrapper, row, "Direct database file", "BUSY_DB_PATH", self._browse_db_file)
        row = self._field(wrapper, row, "Busy DB password", "BUSY_DB_PASSWORD", secret=True)
        row = self._field(wrapper, row, "Supabase URL", "SUPABASE_URL")
        row = self._field(wrapper, row, "Supabase service key", "SUPABASE_SERVICE_KEY", secret=True)
        row = self._field(wrapper, row, "Sync every seconds", "POLL_SECONDS")

        buttons = tk.Frame(wrapper)
        buttons.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(16, 10))
        tk.Button(buttons, text="Test Busy Path", command=self.test_path, width=18).pack(
            side="left", padx=(0, 8)
        )
        tk.Button(buttons, text="Save Settings", command=self.save, width=18).pack(
            side="left", padx=(0, 8)
        )
        tk.Button(buttons, text="Save + Test", command=self.save_and_test, width=18).pack(
            side="left"
        )

        status = tk.Label(
            wrapper,
            textvariable=self.status,
            anchor="w",
            justify="left",
            fg="#1f6f43",
            wraplength=700,
        )
        status.grid(row=row + 1, column=0, columnspan=3, sticky="ew", pady=(6, 0))

        wrapper.columnconfigure(1, weight=1)

    def _field(
        self,
        parent: tk.Widget,
        row: int,
        label: str,
        key: str,
        browse_command=None,
        secret: bool = False,
    ) -> int:
        tk.Label(parent, text=label, anchor="w").grid(
            row=row, column=0, sticky="w", padx=(0, 10), pady=5
        )
        entry = tk.Entry(parent, textvariable=self.values[key], show="*" if secret else "")
        entry.grid(row=row, column=1, sticky="ew", pady=5)
        if browse_command:
            tk.Button(parent, text="Browse", command=browse_command, width=10).grid(
                row=row, column=2, padx=(8, 0), pady=5
            )
        return row + 1

    def _browse_root(self) -> None:
        path = filedialog.askdirectory(title="Select Busy Data folder")
        if path:
            self.values["BUSY_DATA_ROOT"].set(path)

    def _browse_company(self) -> None:
        path = filedialog.askdirectory(title="Select Busy company folder")
        if path:
            self.values["BUSY_COMPANY_DIR"].set(path)

    def _browse_db_file(self) -> None:
        path = filedialog.askopenfilename(
            title="Select Busy database file",
            filetypes=[
                ("Busy/Access database", "*.accdb *.mdb *.db"),
                ("All files", "*.*"),
            ],
        )
        if path:
            self.values["BUSY_DB_PATH"].set(path)

    def _collect(self) -> dict[str, str]:
        values = {key: value.get().strip() for key, value in self.values.items()}
        if not values["BUSY_COMPANY_DIR"]:
            values["BUSY_COMPANY_DIR"] = str(
                Path(values["BUSY_DATA_ROOT"]) / values["BUSY_COMPANY_CODE"]
            )
        return values

    def _apply_to_process(self, values: dict[str, str]) -> None:
        for key, value in values.items():
            os.environ[key] = value

    def save(self) -> None:
        values = self._collect()
        try:
            write_env_file(values, ENV_PATH)
        except Exception as e:
            messagebox.showerror("Could not save", str(e))
            return

        self._apply_to_process(values)
        self.status.set(f"Saved settings to {ENV_PATH}")

    def test_path(self) -> None:
        values = self._collect()
        self._apply_to_process(values)
        try:
            resolved = resolve_busy_db_path()
        except Exception as e:
            self.status.set(f"Could not find Busy database: {e}")
            messagebox.showerror("Busy path test failed", str(e))
            return

        self.status.set(f"Busy database found:\n{resolved}")
        messagebox.showinfo("Busy path test passed", f"Busy database found:\n{resolved}")

    def save_and_test(self) -> None:
        self.save()
        self.test_path()


if __name__ == "__main__":
    SetupApp().mainloop()
