"""
introspect_busy.py — READ-ONLY schema discovery for Busy .db file
Run this ONCE to identify the correct tables before enabling sync.

Usage:
    python introspect_busy.py

Output:
    schema_dump.json  — all tables + columns + masked sample rows

IMPORTANT:
- This script NEVER writes to Busy. Read-only via pyodbc.
- We target Busy's SERIAL NUMBER feature tables (not parameterised-details).
- After running, open schema_dump.json and find:
    1. The Item/Product master table  (e.g. mst_items, item_master)
    2. The Stock/Inventory table      (e.g. trn_stock, stock_ledger)
    3. The Serial Number feature table (e.g. mst_serial_no, trn_serial_numbers,
       serial_master, serial_details — NOT parameterised_details)
  Then fill BUSY_SCHEMA_MAP in schema_map.py with the REAL names.
"""

import os, sys, json, re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from config import resolve_busy_db_path

try:
    BUSY_DB_PATH = str(resolve_busy_db_path())
except Exception as e:
    print(f"ERROR: Could not find Busy data file: {e}")
    sys.exit(1)
BUSY_DB_PASSWORD = os.environ.get("BUSY_DB_PASSWORD", "")

try:
    import pyodbc
except ImportError:
    print("ERROR: pyodbc not installed. Run: pip install pyodbc")
    sys.exit(1)

CONN_STR = (
    "DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    f"DBQ={BUSY_DB_PATH};"
    + (f"PWD={BUSY_DB_PASSWORD};" if BUSY_DB_PASSWORD else "")
)

SERIAL_KEYWORDS = [
    "serial", "srl", "srno", "serialno", "serial_no", "serial_num",
    "barcode", "imei",
]
ITEM_KEYWORDS   = ["item", "product", "goods", "article", "material", "stock_item"]
STOCK_KEYWORDS  = ["stock", "inventory", "qty", "quantity", "balance", "closing"]

# ── keyword classification helper ─────────────────────────────
def classify_table(table_name: str) -> list[str]:
    n = table_name.lower()
    tags = []
    if any(k in n for k in SERIAL_KEYWORDS):
        tags.append("🔑 SERIAL-NUMBER")
    if any(k in n for k in ITEM_KEYWORDS):
        tags.append("📦 ITEM-MASTER")
    if any(k in n for k in STOCK_KEYWORDS):
        tags.append("📊 STOCK")
    if "param" in n or "parameter" in n or "parameteris" in n:
        tags.append("⚠️  PARAMETERISED-DETAILS (NOT FOR SERIAL SYNC)")
    return tags

def mask_value(v):
    """Mask PII / sensitive values in sample rows."""
    if v is None:
        return None
    s = str(v)
    if len(s) > 4:
        return s[:2] + "*" * (len(s) - 4) + s[-2:]
    return "***"

def run():
    print(f"\nConnecting to: {BUSY_DB_PATH}")
    try:
        conn = pyodbc.connect(CONN_STR, timeout=10)
    except pyodbc.Error as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    cursor = conn.cursor()
    dump = {"tables": {}, "serial_table_candidates": [], "item_table_candidates": []}

    # List all tables
    all_tables = [row.table_name for row in cursor.tables(tableType="TABLE")]
    print(f"Found {len(all_tables)} tables.\n")

    for table in sorted(all_tables):
        tags = classify_table(table)
        print(f"  {table:<45} {' '.join(tags) if tags else ''}")

        # Columns
        cols = [(row.column_name, row.type_name) for row in cursor.columns(table=table)]

        # 3 masked sample rows
        samples = []
        try:
            cursor.execute(f"SELECT TOP 3 * FROM [{table}]")
            col_names = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                samples.append({col_names[i]: mask_value(v) for i, v in enumerate(row)})
        except Exception:
            samples = ["(could not read)"]

        entry = {
            "columns": [{"name": c, "type": t} for c, t in cols],
            "sample_rows": samples,
            "tags": tags,
        }
        dump["tables"][table] = entry

        if "🔑 SERIAL-NUMBER" in tags:
            dump["serial_table_candidates"].append(table)
        if "📦 ITEM-MASTER" in tags:
            dump["item_table_candidates"].append(table)

    conn.close()

    # Write output
    out_path = Path(__file__).parent / "schema_dump.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dump, f, indent=2, default=str)

    print(f"\n✅ Written to {out_path}")

    print("\n" + "=" * 60)
    print("NEXT STEP: Open schema_dump.json and find:")
    print("  1. Item/product master table")
    print("  2. Stock/closing balance table")
    print(f"  3. Serial Number table — candidates: {dump['serial_table_candidates'] or '(search manually for serial* tables)'}")
    print("\n  ⚠️  DO NOT use parameterised_details for serials.")
    print("  ACS·OS reads from Busy's Serial Number feature ONLY.")
    print("\n  Then fill BUSY_SCHEMA_MAP in schema_map.py and run sync_agent.py.")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    run()
