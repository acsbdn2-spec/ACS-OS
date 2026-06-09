"""
sync_agent.py — Busy → Supabase one-way sync agent
Runs on the SHOP PC (client machine where Busy is installed).
Pushes to Supabase over HTTPS. Never modifies Busy.

Architecture:
    Client PC (this script)
        └── reads Busy .db locally via pyodbc
        └── pushes to Supabase (outbound HTTPS only)
        └── writes sync_log + reads sync_requests from Supabase

    Vercel app
        └── reads from Supabase only — never contacts Busy
        └── writes sync_requests to trigger on-demand sync
        └── reads sync_log to show last sync time + status

Modes:
    Automatic  — runs every POLL_SECONDS (default 180s)
    On-demand  — app inserts a row in sync_requests → agent picks it up within 5s

Install as Windows service:
    nssm install ACS-Sync "C:\\Python312\\python.exe" "C:\\path\\to\\sync_agent.py"
    nssm set ACS-Sync AppDirectory "C:\\path\\to\\sync-agent"
    nssm start ACS-Sync
"""

import os, sys, time, logging
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from config import config_summary, resolve_busy_db_path
from schema_map import load_schema_map, validate_schema_map

BUSY_SCHEMA_MAP = load_schema_map()

if not validate_schema_map(BUSY_SCHEMA_MAP):
    print("\n[STOP] Fill in schema_map.py before running the sync agent.")
    print("       Run introspect_busy.py first to discover table names.")
    sys.exit(1)

# ── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
try:
    BUSY_DB_PATH     = str(resolve_busy_db_path())
except Exception as e:
    print(f"ERROR: Could not find Busy data file: {e}")
    sys.exit(1)
BUSY_DB_PASSWORD     = os.environ.get("BUSY_DB_PASSWORD", "")
STORE_ID             = BUSY_SCHEMA_MAP["supabase_store_id"]
POLL_SECONDS         = int(os.environ.get("POLL_SECONDS", "180"))
CHECK_INTERVAL       = 5   # seconds between on-demand request checks

for var, val in [
    ("SUPABASE_URL",         SUPABASE_URL),
    ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY),
    ("BUSY_DB_PATH",         BUSY_DB_PATH),
    ("STORE_ID",             STORE_ID),
]:
    if not val:
        print(f"ERROR: {var} is not set in .env"); sys.exit(1)

# ── Logging ──────────────────────────────────────────────────────────────────
log_path = Path(__file__).parent / "sync.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_path, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("acs-sync")

# ── Imports ──────────────────────────────────────────────────────────────────
try:
    import pyodbc
except ImportError:
    log.error("pyodbc not installed. Run: pip install pyodbc"); sys.exit(1)

try:
    from supabase import create_client, Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
except ImportError:
    log.error("supabase-py not installed. Run: pip install supabase"); sys.exit(1)

# ── Busy connection ──────────────────────────────────────────────────────────
CONN_STR = (
    "DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
    f"DBQ={BUSY_DB_PATH};"
    + (f"PWD={BUSY_DB_PASSWORD};" if BUSY_DB_PASSWORD else "")
)

def get_busy_connection():
    return pyodbc.connect(CONN_STR, timeout=15, readonly=True)

S = BUSY_SCHEMA_MAP

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def normalize_name(name: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip()

# ── Supabase sync log helpers ─────────────────────────────────────────────────
def log_start() -> str:
    """Insert a 'running' entry and return its id."""
    result = supabase.table("sync_log").insert({
        "store_id":   STORE_ID,
        "started_at": now_iso(),
        "status":     "running",
    }).execute()
    return result.data[0]["id"] if result.data else None

def log_done(log_id: str, items: int, serials: int):
    if not log_id: return
    supabase.table("sync_log").update({
        "status":          "success",
        "completed_at":    now_iso(),
        "items_synced":    items,
        "serials_synced":  serials,
    }).eq("id", log_id).execute()

def log_error(log_id: str, error: str):
    if not log_id: return
    supabase.table("sync_log").update({
        "status":        "error",
        "completed_at":  now_iso(),
        "error_msg":     str(error)[:1000],
    }).eq("id", log_id).execute()

# ── On-demand request handler ─────────────────────────────────────────────────
def consume_pending_request() -> bool:
    """
    Check sync_requests for an unprocessed row.
    If found, mark it processed and return True (caller should run sync).
    """
    try:
        result = supabase.table("sync_requests") \
            .select("id, requested_by") \
            .eq("store_id", STORE_ID) \
            .is_("processed_at", "null") \
            .order("created_at") \
            .limit(1) \
            .execute()

        if not result.data:
            return False

        req = result.data[0]
        # Mark processed
        supabase.table("sync_requests").update({
            "processed_at": now_iso(),
        }).eq("id", req["id"]).execute()

        log.info(f"On-demand sync requested by: {req.get('requested_by', 'unknown')}")
        return True
    except Exception as e:
        log.warning(f"Could not check sync_requests: {e}")
        return False

# ── Sync functions ────────────────────────────────────────────────────────────
def sync_items(cursor) -> int:
    log.info("Syncing items (products)…")
    cursor.execute(f"""
        SELECT
            [{S['item_id_col']}]   AS item_id,
            [{S['item_name_col']}] AS item_name
            {f", [{S['item_group_col']}] AS item_group" if S.get('item_group_col') else ""}
        FROM [{S['item_table']}]
        WHERE [{S['item_name_col']}] IS NOT NULL
    """)
    rows = cursor.fetchall()
    count = 0
    for row in rows:
        item_id   = str(row.item_id).strip()
        item_name = str(row.item_name).strip()
        if not item_name: continue

        existing = supabase.table("products") \
            .select("id") \
            .eq("store_id", STORE_ID) \
            .eq("busy_item_id", item_id) \
            .execute()

        if existing.data:
            supabase.table("products").update({
                "name":        item_name,
                "norm_name":   normalize_name(item_name),
                "last_synced": now_iso(),
            }).eq("busy_item_id", item_id).eq("store_id", STORE_ID).execute()
        else:
            supabase.table("products").insert({
                "store_id":     STORE_ID,
                "name":         item_name,
                "norm_name":    normalize_name(item_name),
                "cat":          str(getattr(row, 'item_group', '') or '').strip() or None,
                "busy_item_id": item_id,
                "last_synced":  now_iso(),
                "sell": 0, "stock_qty": 0,
            }).execute()
        count += 1

    log.info(f"  Items: {count} processed")
    return count

def sync_stock(cursor):
    log.info("Syncing stock…")
    godown_clause = ""
    if S.get('godown_filter') and S.get('stock_godown_col'):
        godown_clause = f"WHERE [{S['stock_godown_col']}] = '{S['godown_filter']}'"

    cursor.execute(f"""
        SELECT [{S['stock_item_id_col']}] AS item_id, [{S['stock_qty_col']}] AS qty
        FROM [{S['stock_table']}] {godown_clause}
    """)
    for row in cursor.fetchall():
        supabase.table("products").update({
            "stock_qty":   int(row.qty or 0),
            "last_synced": now_iso(),
        }).eq("store_id", STORE_ID).eq("busy_item_id", str(row.item_id).strip()).execute()
    log.info("  Stock sync done")

def sync_serials(cursor) -> int:
    # SOURCE: Busy's Serial Number feature — NOT parameterised_details
    log.info("Syncing serials (Busy Serial Number feature)…")
    cursor.execute(f"""
        SELECT
            [{S['serial_item_id_col']}] AS item_id,
            [{S['serial_no_col']}]      AS serial_no,
            [{S['serial_status_col']}]  AS status,
            [{S['serial_date_col']}]    AS entry_date
        FROM [{S['serial_table']}]
        WHERE [{S['serial_no_col']}] IS NOT NULL
    """)
    rows = cursor.fetchall()
    count = 0
    for row in rows:
        item_id   = str(row.item_id).strip()
        serial_no = str(row.serial_no).strip()
        if not serial_no: continue

        our_status = (
            "available" if str(row.status) == str(S['serial_status_available'])
            else "sold"  if str(row.status) == str(S['serial_status_sold'])
            else "available"
        )
        entry_date = None
        if row.entry_date:
            try: entry_date = str(row.entry_date)[:10]
            except: pass

        prod = supabase.table("products") \
            .select("id").eq("store_id", STORE_ID).eq("busy_item_id", item_id).execute()
        if not prod.data: continue
        product_id = prod.data[0]["id"]

        existing = supabase.table("serials") \
            .select("id, status") \
            .eq("product_id", product_id).eq("serial_no", serial_no).execute()

        if existing.data:
            s = existing.data[0]
            if s["status"] not in ("sold", "rma", "loaner"):
                supabase.table("serials").update({
                    "status": our_status, "last_synced": now_iso(),
                }).eq("id", s["id"]).execute()
            else:
                supabase.table("serials").update({
                    "busy_serial_id": serial_no, "last_synced": now_iso(),
                }).eq("id", s["id"]).execute()
        else:
            supabase.table("serials").insert({
                "product_id":    product_id,
                "serial_no":     serial_no,
                "busy_serial_id": serial_no,
                "status":        our_status,
                "purchase_date": entry_date,
                "last_synced":   now_iso(),
            }).execute()
        count += 1

    log.info(f"  Serials: {count} processed")
    return count

# ── Single sync cycle ─────────────────────────────────────────────────────────
def run_once(reason: str = "scheduled") -> tuple[bool, int, int]:
    """Run a full sync. Returns (success, items_count, serials_count)."""
    log.info(f"=== Sync starting [{reason}] ===")
    log_id = log_start()
    try:
        conn   = get_busy_connection()
        cursor = conn.cursor()
        items   = sync_items(cursor)
        sync_stock(cursor)
        serials = sync_serials(cursor)
        conn.close()
        log_done(log_id, items, serials)
        log.info(f"=== Sync complete: {items} items, {serials} serials ===\n")
        return True, items, serials
    except pyodbc.Error as e:
        log.error(f"Busy DB error: {e}")
        log_error(log_id, str(e))
        return False, 0, 0
    except Exception as e:
        log.error(f"Sync error: {e}", exc_info=True)
        log_error(log_id, str(e))
        return False, 0, 0

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    summary = config_summary(Path(BUSY_DB_PATH))
    log.info(f"ACS·OS Sync Agent started.")
    log.info(f"  Profile:         {summary['profile']}")
    log.info(f"  Company folder:  {summary['busy_company_dir']}")
    log.info(f"  Busy DB:         {BUSY_DB_PATH}")
    log.info(f"  Store:           {STORE_ID}")
    log.info(f"  Scheduled every: {POLL_SECONDS}s")
    log.info(f"  On-demand check: every {CHECK_INTERVAL}s")
    log.info(f"  Serial source:   Busy Serial Number feature (NOT parameterised-details)")
    log.info("")

    next_scheduled = 0.0   # 0 = run immediately on first loop

    while True:
        now = time.time()

        # Scheduled sync
        if now >= next_scheduled:
            run_once("scheduled")
            next_scheduled = time.time() + POLL_SECONDS
            remaining = POLL_SECONDS
            log.info(f"Next scheduled sync in {POLL_SECONDS}s. Watching for on-demand requests…")
        else:
            # Check for on-demand request every CHECK_INTERVAL seconds
            if consume_pending_request():
                run_once("on-demand")
                # Don't reset next_scheduled — keep the normal schedule intact

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
