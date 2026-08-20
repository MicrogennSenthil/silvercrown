# Tally Connector

A production-grade Windows / local-office connector that bridges your ERP server with a locally-running **Tally Prime** instance.

```
  [ERP Server]  ←—HTTPS—→  [Tally Connector (this process)]  —HTTP→  [Tally Prime on localhost]
```

The connector:
- Polls the ERP for connector jobs (no inbound ports opened).
- Sends authenticated heartbeats so the ERP knows the connector is alive.
- Speaks Tally's native HTTP/XML protocol for masters and vouchers.
- Handles offline Tally with exponential back-off.
- Uses ERP job IDs as idempotency keys for safe replay.

---

## Requirements

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 LTS | [nodejs.org/en/download](https://nodejs.org/en/download) |
| Tally Prime | Running on the same PC with HTTP server enabled |
| ERP Connector Token | Issued by your ERP admin |
| Windows 10/11 or any OS with Node.js | PowerShell script targets Windows |

---

## Quick Start (Windows)

```powershell
# 1. Clone / copy the tally-connector/ directory to the office PC

# 2. Run the setup script (elevated PowerShell)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup.ps1

# 3. Edit .env (created by setup.ps1 from .env.example)
notepad .env

# 4. Start the connector
npm start
#  — or double-click start.cmd
```

---

## Configuration

All configuration is supplied via **environment variables** or a local `connector-config.json` file (gitignored — never committed). The token is stored **only on the office PC**.

### Option A — `.env` file (recommended)

Copy `.env.example` to `.env` and fill in values:

```dotenv
ERP_BASE_URL=https://your-erp-server.example.com
ERP_CONNECTOR_TOKEN=token-from-erp-admin
TALLY_HOST=localhost
TALLY_PORT=9000
TALLY_COMPANY=Your Company Name in Tally
```

### Option B — `connector-config.json`

Copy `connector-config.example.json` to `connector-config.json` and fill in values. This file is gitignored.

### All Configuration Keys

| Key (env var) | JSON key | Default | Description |
|---|---|---|---|
| `ERP_BASE_URL` | `erpBaseUrl` | *(required)* | ERP server base URL. Must be `https://` in prod; `http://localhost` allowed for dev. |
| `ERP_CONNECTOR_TOKEN` | `erpConnectorToken` | *(required)* | Bearer token from ERP admin. Never share or commit. |
| `TALLY_HOST` | `tallyHost` | `localhost` | Hostname where Tally Prime is running. |
| `TALLY_PORT` | `tallyPort` | `9000` | Tally HTTP server port. |
| `TALLY_COMPANY` | `tallyCompany` | *(first active)* | Exact company name in Tally. Leave blank to use the first loaded company. |
| `POLL_INTERVAL_MS` | `pollIntervalMs` | `30000` | How often to poll ERP for jobs (ms). |
| `POLL_JOB_LIMIT` | `pollJobLimit` | `10` | Max jobs to fetch per poll cycle. |
| `HEARTBEAT_INTERVAL_MS` | `heartbeatIntervalMs` | `60000` | Heartbeat send interval (ms). |
| `BACKOFF_INITIAL_MS` | `backoffInitialMs` | `5000` | Initial back-off delay when Tally is offline (ms). |
| `BACKOFF_MAX_MS` | `backoffMaxMs` | `300000` | Maximum back-off delay (ms). |
| `LOG_LEVEL` | `logLevel` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `CONNECTOR_ID` | `connectorId` | hostname-tally-PORT | Stable ID sent with heartbeats. |

---

## Tally Prime HTTP Server Setup

The connector calls Tally's built-in HTTP/XML server. Enable it in Tally:

1. Open **Tally Prime** on this PC.
2. Navigate to:
   - **F1 (Help) → Settings → Connectivity** *(Tally Prime 2.x+)*
   - **OR** Gateway of Tally → **F12: Configure → Advanced Configuration**
3. Set **TallyPrime Server** (or **ODBC Server**) → **Yes**
4. Set **Port** → `9000` (match `TALLY_PORT` in your config)
5. Click **Accept / Save**.
6. Open the company you want to sync — Tally must have it active.

> **Note:** The connector only makes *outbound* requests to `http://localhost:9000`.  
> It never opens a listening socket. Tally's port is never exposed externally.

---

## Security

| Practice | Details |
|---|---|
| **Token storage** | ERP token stored only in `.env` or `connector-config.json` on the office PC — never in source code. |
| **HTTPS enforcement** | Config validation rejects non-HTTPS ERP URLs (exception: `http://localhost` for local dev). |
| **No inbound ports** | Connector opens zero listening sockets. All communication is outbound. |
| **Gitignored secrets** | `.env` and `connector-config.json` are listed in `.gitignore`. |
| **No hardcoded data** | Host, port, company, ledgers, voucher types, dates, tax codes, banks are all config-driven. |

---

## ERP Server API Contract

All requests use `Authorization: Bearer <token>` and `Content-Type: application/json`.  
The token is sent **only in the HTTP header** — never in any body or log line.

### Endpoints

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/tally/connector/heartbeat` | See below | Connector alive + Tally health |
| `GET` | `/api/tally/connector/jobs?limit=N` | — | Returns pending job array |
| `POST` | `/api/tally/connector/jobs/:id/complete` | `{ result }` | Marks job done |
| `POST` | `/api/tally/connector/import` | `{ jobId, vouchers }` | Tally→ERP voucher push |

### POST /api/tally/connector/heartbeat

```json
{
  "connectorId":  "hostname-tally-9000",
  "tallyHost":    "localhost",
  "tallyPort":    9000,
  "tallyCompany": "My Company",
  "tallyStatus":  "ok",
  "tallyError":   null,
  "companies":    [{ "name": "My Company", "booksFrom": "2023-04-01" }],
  "version":      "1.0.0",
  "ts":           "2024-04-15T10:00:00.000Z"
}
```

`tallyStatus`: `"ok"` | `"offline"` | `"error"` | `"unknown"`  
`companies`: empty array when Tally is offline.

### GET /api/tally/connector/jobs — Job Object Shape

```json
{
  "id":             "job-uuid-from-erp",
  "type":           "export_sales",
  "idempotencyKey": "optional-replay-key",
  "kind":           "scheduled",
  "params": {
    "fromDate":      "2024-04-01",
    "toDate":        "2024-04-30",
    "company":       "optional-params-override",
    "financialYear": "2024-25",
    "voucherTypes":  ["Sales", "Credit Note"]
  },
  "connectorConfig": {
    "tallyHost":  "192.168.1.50",
    "tallyPort":  9000,
    "company":    "Branch Company Name"
  }
}
```

`connectorConfig` is optional. When present, `tallyHost`, `tallyPort`, and `company` override the connector's local env/file values **for that job only**. The base config is never mutated.

Priority for Tally target: `params.company` > `connectorConfig.company` > env/file default.

### Job Types

| Type | Direction | Description |
|---|---|---|
| `test_connection` | — | Ping Tally; result includes discovered companies |
| `discover_masters` | Tally→ERP (via `/complete`) | Fetch all ledgers, voucher types, stock items for server upsert |
| `import_masters` | ERP→Tally | Acknowledge receipt (Tally ledger creation requires TDL) |
| `import_vouchers` | **ERP→Tally** | Push ERP vouchers into Tally; returns per-voucher Tally results |
| `export_voucher` | **Tally→ERP** | Pull all vouchers by date range → POST to `/import` → complete |
| `export_sales` | **Tally→ERP** | Pull sales vouchers → POST to `/import` → complete |
| `export_purchase` | **Tally→ERP** | Pull purchase vouchers → POST to `/import` → complete |

### POST /api/tally/connector/jobs/:id/complete — body: `{ result }`

`result` shape varies by job type:

**test_connection:**
```json
{ "ok": true, "companies": [{ "name": "My Co", "booksFrom": "2023-04-01" }] }
```

**discover_masters:**
```json
{
  "ok": true,
  "company": "My Co",
  "ledgers":      [{ "name": "Cash", "parent": "Cash-in-Hand", "closingBalance": 5000 }],
  "voucherTypes": [{ "name": "Sales", "parent": "Sales", "isBankRecon": false }],
  "stockItems":   [{ "name": "Item A", "hsnCode": "30049099" }],
  "counts": { "ledgers": 150, "voucherTypes": 12, "stockItems": 80 }
}
```

**export_sales / export_voucher / export_purchase** (after `/import` call succeeds):
```json
{ "ok": true, "count": 42, "importStatus": "ok", "imported": 42 }
```

If the `/import` call fails:
```json
{ "ok": false, "count": 42, "importStatus": "failed", "importError": "HTTP 500: ...", "imported": 0 }
```

**import_vouchers (ERP→Tally):**
```json
{
  "ok": true,
  "totalCreated": 3, "totalAltered": 1, "totalErrors": 0,
  "results": [
    { "remoteId": "ERP-001", "voucherNumber": "PUR/001", "created": 1, "altered": 0, "errors": [] }
  ]
}
```

### POST /api/tally/connector/import — body: `{ jobId, vouchers }`

Called automatically by the connector after each export job. The ERP should upsert these vouchers.

```json
{
  "jobId": "job-uuid-from-erp",
  "vouchers": [
    {
      "externalId":    "tally-guid-here",
      "alterationId":  "42",
      "voucherType":   "Sales",
      "voucherNumber": "SAL/2024/001",
      "date":          "2024-04-15",
      "effectiveDate": "2024-04-15",
      "narration":     "Sale of goods",
      "partyName":     "Customer ABC",
      "placeOfSupply": "Maharashtra",
      "isOptional":    false,
      "isInvoice":     true,
      "remoteId":      "ERP-SALE-101",
      "company":       "My Company",
      "financialYear": "2024-25",
      "ledgerEntries": [
        {
          "ledgerName": "Customer ABC", "isDeemed": true, "isPartyLedger": true,
          "amount": 11800,
          "billAllocations": [{ "name": "SAL/2024/001", "billType": "New Ref", "amount": -11800 }]
        },
        { "ledgerName": "Sales Account", "isDeemed": false, "amount": -10000 },
        { "ledgerName": "CGST @ 9%", "gstClass": "Central Tax", "amount": -900 },
        { "ledgerName": "SGST @ 9%", "gstClass": "State Tax",   "amount": -900 }
      ],
      "bankAllocations": []
    }
  ]
}
```

### ERP→Tally import_vouchers — params.vouchers shape

```json
{
  "vouchers": [
    {
      "remoteId":      "ERP-UNIQUE-ID",
      "voucherType":   "Purchase",
      "voucherNumber": "PUR/001",
      "date":          "2024-04-15",
      "narration":     "Purchase from supplier",
      "partyLedger":   "Supplier Ledger Name",
      "company":       "optional-per-voucher-override",
      "ledgerEntries": [
        { "ledgerName": "Supplier Ledger Name", "amount": -10000, "isParty": true,
          "billAllocations": [{ "name": "PUR/001", "billType": "New Ref", "amount": 10000 }] },
        { "ledgerName": "Purchase Account", "amount": 10000 }
      ]
    }
  ]
}
```

---

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `npm start` | `node src/index.js` | Start connector (production) |
| `npm run dev` | `node --watch src/index.js` | Start with auto-restart on file change |
| `npm test` | `node --test tests/` | Run all 123 unit tests (no ERP/Tally needed) |
| `npm run test:xml` | `node --test tests/xml.test.js` | Test XML generation (36 tests) |
| `npm run test:parse` | `node --test tests/parse.test.js` | Test XML parsing (46 tests) |
| `npm run setup` | `node scripts/setup-check.js` | Run pre-flight checks |

---

## Architecture

```
tally-connector/
├── src/
│   ├── index.js           Main entry: poll loop, heartbeat+health, export orchestration, shutdown
│   ├── config.js          Load & validate config from env / connector-config.json; re-exports makeTallyConfig
│   ├── runtime-config.js  Pure makeTallyConfig() — merges job.connectorConfig over base; no side-effects
│   ├── logger.js          Structured JSON logger (no external dep, never logs token)
│   ├── tally-client.js    Outbound HTTP to Tally Prime + exponential back-off + health probe
│   ├── erp-client.js      Authenticated HTTPS to ERP: heartbeat, fetchJobs, completeJob, importToErp
│   ├── job-handlers.js    Dispatcher + all job handlers; EXPORT_JOB_TYPES set for index.js routing
│   ├── xml-builder.js     Tally XML request builders (escapeXml, company, ledgers, vouchers)
│   └── xml-parser.js      Tally XML response parsers using fast-xml-parser
├── tests/
│   ├── xml.test.js        36 tests — XML generation (escapeXml, builders)
│   ├── parse.test.js      46 tests — XML parsing (dates, masters, vouchers, import response)
│   └── contract.test.js   41 tests — job contract, per-job config, completion payload, directions
├── scripts/
│   └── setup-check.js     Pre-flight validation (Node version, deps, config, HTTPS)
├── .env.example           Template — copy to .env, fill in secrets
├── .gitignore             Ensures .env and connector-config.json are never committed
├── connector-config.example.json  JSON config alternative to .env
├── package.json
├── setup.ps1              Windows PowerShell setup + optional Task Scheduler registration
├── start.cmd              Windows CMD double-click launcher
└── README.md
```

### Data Flow: Tally → ERP (export_sales)

```
ERP queues job { id, type:"export_sales", params:{fromDate,toDate,financialYear}, connectorConfig:{...} }
    ↓
Connector polls GET /api/tally/connector/jobs
    ↓
index.js: makeTallyConfig(base, job.connectorConfig)  ← per-job, base not mutated
    ↓
dispatchJob → handleExportSales → pullVouchersFromTally
    → buildVoucherExportXml (with job company + date range)
    → POST http://localhost:9000  →  Tally Prime
    → parseVoucherExport  →  normalised vouchers stamped with company + financialYear
    ↓
orchestrateExport:
    → POST /api/tally/connector/import  { jobId, vouchers }   ← ERP upserts
    → on success: result = { ok:true, count, importStatus:"ok", imported }
    → on failure: result = { ok:false, importStatus:"failed", importError }
    ↓
POST /api/tally/connector/jobs/:id/complete  { result }    ← no vouchers here
```

### Data Flow: ERP → Tally (import_vouchers)

```
ERP queues job { id, type:"import_vouchers", params:{ vouchers:[...] } }
    ↓
dispatchJob → handleImportVouchers
    → for each voucher: buildVoucherImportXml (with remoteId for idempotency)
    → POST http://localhost:9000  →  Tally Prime
    → parseVoucherImportResponse  →  { created, altered, errors }
    ↓
POST /api/tally/connector/jobs/:id/complete  { result: { totalCreated, totalAltered, results } }
  (does NOT call /api/tally/connector/import)
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `ERP_BASE_URL must use HTTPS` | Change `ERP_BASE_URL` to use `https://`. |
| `ECONNREFUSED 127.0.0.1:9000` | Tally is not running or HTTP server is not enabled. Enable it in Tally settings and ensure the company is open. |
| `ERP returned 401` | Token is wrong or expired. Get a new token from your ERP admin. |
| `No pending jobs` shown in logs | Normal — ERP has nothing queued. Use the ERP UI to trigger a sync. |
| High memory / CPU | Increase `POLL_INTERVAL_MS` to poll less frequently. |
| Connector exits immediately | Check `.env` for missing `ERP_BASE_URL` or `ERP_CONNECTOR_TOKEN`. |

---

## Data Flow: Voucher Export

```
ERP queues job { type: "export_sales", fromDate, toDate }
    ↓
Connector polls GET /api/tally/connector/jobs
    ↓
Builds Tally XML request (buildVoucherExportXml)
    ↓
POST http://localhost:9000  →  Tally Prime
    ↓
Parses XML response (parseVoucherExport)
    → Normalised vouchers: externalId(GUID), alterationId, voucherType, date,
      ledgerEntries, billAllocations, bankAllocations
    ↓
POST /api/tally/connector/jobs/:id/complete  with voucher data
    ↓
POST /api/tally/connector/import  (optional, ERP-side import)
```
