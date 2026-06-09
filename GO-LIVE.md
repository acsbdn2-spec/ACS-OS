# ACS·OS — Go Live in 4 Steps

Everything is built. You just need to connect the services.

---

## STEP 1 — Create Supabase project (10 min)

1. Go to https://supabase.com → Sign up (free)
2. Click "New Project" → name it "acs-os" → pick a strong password → region: South Asia
3. Wait ~2 min for it to spin up
4. Go to: Settings → API
   - Copy "Project URL"  → you'll need this
   - Copy "anon public" key → you'll need this
   - Copy "service_role" key → keep this SECRET (for sync agent only)

---

## STEP 2 — Apply the database schema (5 min)

1. In Supabase, go to: SQL Editor → New Query
2. Open this file on your PC:
   D:\MEDNIPORE-CUSTOM\ACS-OS\supabase\migrations\001_initial_schema.sql
3. Paste the entire contents into the SQL editor
4. Click "Run"
5. You should see: "Success. No rows returned"

Then create your owner user:
- Go to: Authentication → Users → Add User
- Enter your email + a strong password
- Click "Create User"

Then run this SQL to link your user to the owner profile
(replace the email with yours):

```sql
INSERT INTO profiles (user_id, role, store_id, name, lang)
SELECT id, 'owner', '11111111-1111-1111-1111-111111111111', 'Owner', 'en'
FROM auth.users WHERE email = 'your@email.com';
```

---

## STEP 3 — Run the app locally (2 min)

1. Copy the env file:
   - Open D:\MEDNIPORE-CUSTOM\ACS-OS\
   - Copy .env.local.example → rename to .env.local
   - Open .env.local and fill in:
     NEXT_PUBLIC_SUPABASE_URL=    (paste your Project URL)
     NEXT_PUBLIC_SUPABASE_ANON_KEY=  (paste your anon key)
     SUPABASE_SERVICE_ROLE_KEY=   (paste service role key)
     NEXT_PUBLIC_APP_URL=http://localhost:3000

2. Open a terminal in D:\MEDNIPORE-CUSTOM\ACS-OS\
   npm run dev

3. Open http://localhost:3000 in your browser
4. Log in with your owner email + password
5. You should land on the Dashboard

---

## STEP 4 — Deploy to Vercel (live on internet, any device) (10 min)

1. Go to https://github.com → create a new private repo called "acs-os"
2. In your terminal (D:\MEDNIPORE-CUSTOM\ACS-OS\):
   git init
   git add .
   git commit -m "Initial ACS·OS build"
   git remote add origin https://github.com/YOUR_USERNAME/acs-os.git
   git push -u origin main

3. Go to https://vercel.com → Sign up with GitHub
4. "Add New Project" → import your "acs-os" repo
5. Add Environment Variables (same as your .env.local):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_APP_URL = https://os.advancedcomputersystem.in
6. Click Deploy → wait ~2 min
7. Add your domain in Vercel → Domains → add "os.advancedcomputersystem.in"
8. Set DNS: in your domain registrar add CNAME  os  →  cname.vercel-dns.com

---

## TEST CHECKLIST (do these in order)

After going live, verify each of these:

[ ] Login with owner email → lands on Dashboard
[ ] Login as staff (create one via Supabase Auth) → lands on Catalog, NO cost/floor visible
[ ] Open Network tab in browser dev tools → confirm no cost/floor in API responses for staff
[ ] Add a product as owner → appears in catalog
[ ] Create a quote → quote number allocated correctly
[ ] Create a job card → job appears on Service board
[ ] Open /q/[token] from a quote → shows quote with no cost/floor, accept button works
[ ] Open /job/[token] from a job → shows repair status, progress steps
[ ] Open on iPhone Safari → Add to Home Screen → opens as full-screen app
[ ] Disconnect WiFi → offline banner appears, app still shows last data

---

## ADD YOUR UPI VPA (for UPI QR at checkout)

In .env.local (and in Vercel environment variables), add:
NEXT_PUBLIC_UPI_VPA=yourname@upi

(e.g. acsbdn@okaxis, or whatever your UPI ID is)

---

## PAGES LIVE RIGHT NOW

| URL | What |
|-----|------|
| /dashboard | Owner home — revenue, alerts, quick actions |
| /catalog | Product catalog with search + camera scan |
| /catalog/[id] | Product detail with serials + warranty |
| /quotes | Quote list |
| /quotes/new | Quote builder with UPI QR + counter-price |
| /service | Job board (kanban + list view) |
| /service/new | New job card intake |
| /serials | Serial number lookup with scan |
| /customers | Customer list |
| /q/[token] | Public quote link (no login, sell-side only) |
| /job/[token] | Public repair status (no login) |
| /login | Login + biometric |

---

## BUSY SYNC AGENT (do this after app is working)

On the shop PC (where Busy is installed):
1. Copy sync-agent/ folder to the shop PC
2. pip install -r requirements.txt
3. Run python setup_sync.py
4. For ACS now, choose BusyWin > Data > comp0004. Later choose the main server/shared folder.
5. python introspect_busy.py -> review schema_dump.json
6. Copy sync_profiles/acs.example.json to sync_profiles/acs.json and fill real table names there
7. python sync_agent.py -> confirm products + serials appear in app
