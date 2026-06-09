"""
schema_map.py — Fill this AFTER running introspect_busy.py and reviewing schema_dump.json.

SOURCE FOR SERIAL NUMBERS:
  Use Busy's SERIAL NUMBER feature tables — NOT parameterised_details.
  Busy has two separate tracking systems:
    - "Serial Number" feature  → what we want (tracks individual unit serial nos)
    - "Parameterised Details"  → batch/lot/size tracking — DO NOT use for serials

HOW TO FIND THE RIGHT TABLE:
  1. Run introspect_busy.py → opens schema_dump.json
  2. Look for tables tagged 🔑 SERIAL-NUMBER (not ⚠️ PARAMETERISED-DETAILS)
  3. Common names: mst_serial_no, trn_serial_numbers, serial_master,
     serial_details, serial_ledger, srno_master
  4. Check that table's columns for: serial_no / srno, item_id, status, in_date

HARD STOP:
  The sync agent checks BUSY_SCHEMA_MAP at startup.
  If any value still contains "FILL_IN_", it REFUSES to run the sync loop.
  This protects against syncing garbage data into Supabase.
"""

import json
import os
from pathlib import Path

BUSY_SCHEMA_MAP = {

    # ── ITEM MASTER ─────────────────────────────────────────────────────────────
    # Table that holds product / item definitions
    "item_table": "FILL_IN_TABLE_NAME",        # e.g. "Mst_Items", "Item_Master"
    "item_id_col": "FILL_IN_COLUMN",           # e.g. "ItemCode", "Item_Id"
    "item_name_col": "FILL_IN_COLUMN",         # e.g. "ItemName", "Description"
    "item_unit_col": "FILL_IN_COLUMN",         # e.g. "Unit", "UOM"
    "item_group_col": "FILL_IN_COLUMN",        # e.g. "Group", "Category" (can be None)

    # ── STOCK / CLOSING BALANCE ──────────────────────────────────────────────────
    # Table / view with current stock qty per item
    "stock_table": "FILL_IN_TABLE_NAME",       # e.g. "Trn_Stock", "Closing_Stock"
    "stock_item_id_col": "FILL_IN_COLUMN",     # FK to item_table
    "stock_qty_col": "FILL_IN_COLUMN",         # e.g. "ClosingQty", "Balance"
    "stock_godown_col": "FILL_IN_COLUMN",      # e.g. "Godown" — filter by your store

    # ── SERIAL NUMBER FEATURE ────────────────────────────────────────────────────
    #
    # ⚠️  USE BUSY'S SERIAL NUMBER FEATURE TABLE — NOT PARAMETERISED DETAILS
    #
    # The Serial Number feature records individual unit serial numbers at
    # purchase/sale time. It is different from parameterised_details which
    # tracks batch parameters (colour, size, lot) and must NOT be used here.
    #
    # After running introspect_busy.py, look for a table tagged 🔑 SERIAL-NUMBER
    # Common real names: Mst_SerialNo, Trn_SerialNumbers, Serial_Master,
    #   SerialNo_Details, Mst_Srno, SrNo_Details, TrnSerialNo
    #
    "serial_table": "FILL_IN_TABLE_NAME",      # e.g. "Mst_SerialNo", "Trn_SerialNumbers"
    "serial_item_id_col": "FILL_IN_COLUMN",    # FK linking to item_table
    "serial_no_col": "FILL_IN_COLUMN",         # the actual serial number string
    "serial_status_col": "FILL_IN_COLUMN",     # e.g. "Status", "Flag" (may be int: 0=in, 1=out)
    "serial_date_col": "FILL_IN_COLUMN",       # purchase / entry date

    # Status values inside Busy for "in stock" vs "sold"
    "serial_status_available": "FILL_IN",      # e.g. "In", 0, "Available", "P" (Purchased)
    "serial_status_sold": "FILL_IN",           # e.g. "Out", 1, "Sold", "S" (Sold)

    # ── STORE / GODOWN FILTER ────────────────────────────────────────────────────
    # If Busy tracks multiple godowns, specify which one is THIS store.
    # Set to None if Busy is single-godown.
    "godown_filter": None,                     # e.g. "Burdwan Main", None

    # ── SYNC OPTIONS ────────────────────────────────────────────────────────────
    "supabase_store_id": "11111111-1111-1111-1111-111111111111",  # ACS store UUID
}


def load_schema_map() -> dict:
    """
    Load the Busy table map for the active company.

    Preferred:
      sync_profiles/<SYNC_PROFILE>.json

    Fallback:
      BUSY_SCHEMA_MAP in this file, kept only as a developer template.
    """
    agent_dir = Path(__file__).resolve().parent
    explicit = os.environ.get("BUSY_SCHEMA_MAP_FILE", "").strip()
    profile = os.environ.get("SYNC_PROFILE", "acs").strip() or "acs"
    candidates = []

    if explicit:
        candidates.append(Path(explicit))
    candidates.append(agent_dir / "sync_profiles" / f"{profile}.json")

    for path in candidates:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)

    return BUSY_SCHEMA_MAP


def validate_schema_map(schema: dict | None = None) -> bool:
    """Returns True only if all FILL_IN placeholders are replaced."""
    schema = schema or BUSY_SCHEMA_MAP
    for key, value in schema.items():
        if isinstance(value, str) and value.startswith("FILL_IN"):
            print(f"❌ BUSY_SCHEMA_MAP['{key}'] is still a placeholder: {value!r}")
            print("   Run introspect_busy.py first, then fill the active sync profile JSON.")
            return False
    return True
