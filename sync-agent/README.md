# ACS OS Busy Sync Agent

Runs on the PC that can read Busy data. It only reads Busy and pushes to
Supabase over HTTPS. It never writes to Busy.

## Easiest Setup

1. Install requirements:

   ```powershell
   pip install -r requirements.txt
   ```

2. Open the setup window:

   ```powershell
   py -3 setup_sync.py
   ```

   You can also double-click `Open Setup.bat`.

3. For ACS right now, set:

   ```text
   Busy data root: C:\BusyWin\Data
   Company code:   comp0004
   ```

   Or choose the company folder directly. This is the exact current path:

   ```text
   C:\BusyWin\Data\comp0004
   ```

4. Later, when data comes from the main server machine, point the same field to
   the shared server folder, for example:

   ```text
   \\MAIN-SERVER\BusyWin\Data\comp0004
   ```

5. Click **Test Busy Path**, then **Save Settings**.

The setup window writes `.env`. Future companies should change only `.env` and
their profile JSON, not `sync_agent.py`.

## Company Profiles

Each company can have its own profile file:

```text
sync_profiles\acs.json
sync_profiles\adi-shree-hari.json
sync_profiles\client-name.json
```

Copy `sync_profiles\acs.example.json` to the real profile name, then fill in the
Busy table and column names after schema discovery. Select the profile with:

```env
SYNC_PROFILE=acs
```

This keeps the sync code reusable across companies.

## Discover Busy Tables

After saving the Busy path:

Double-click `Discover Busy Tables.bat`, or run:

```powershell
py -3 introspect_busy.py
```

It creates `schema_dump.json`. Find:

- Item/product master table
- Stock/closing balance table
- Serial Number feature table

Use Busy Serial Number tables only. Do not use parameterised details for serial
numbers.

## Test Sync

Double-click `Start Sync Agent.bat`, or run:

```powershell
py -3 sync_agent.py
```

Check `sync.log`. Confirm products and serials appear in ACS OS.

## Install Always-On Service

Using NSSM:

```powershell
nssm install ACS-Sync "C:\Python312\python.exe" "sync_agent.py"
nssm set ACS-Sync AppDirectory "C:\path\to\sync-agent"
nssm start ACS-Sync
```

## Architecture

```text
Busy PC or main server share
  -> sync_agent.py reads Busy data read-only
  -> Supabase receives products, stock, serials
  -> ACS OS app reads Supabase only
```

No inbound ports are required.
