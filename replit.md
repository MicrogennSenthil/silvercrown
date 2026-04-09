# Silver Crown Metals - Element ERP

## Project Overview
A full-stack **Progressive Web App (PWA)** ERP system for **Silver Crown Metals**, branded as **"Element"**. Features Google Gemini AI-powered invoice scanning, Tally integration, and full business management capabilities.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Tailwind CSS, Radix UI (shadcn), TanStack Query, wouter
- **Backend**: Express.js (v5), Node.js, Passport.js (local auth)
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini 1.5 Flash for purchase invoice scanning
- **Auth**: Passport.js local strategy + express-session + pg-session store
- **Build**: Vite (frontend), tsx (dev), ESBuild (prod)
- **PWA**: Service worker + Web App Manifest

## Design Tokens
- **Primary Blue**: `#027fa5`
- **Button Orange**: `#d74700`
- **Accent Orange**: `#f96a0b`
- **Header Teal**: `#b8d2da`
- **Tonal Blue**: `#d2f1fa`
- **App Background**: `#f5f0ed`
- **Font**: Source Sans Pro

## Project Structure
```
client/
  src/
    pages/
      ElementLogInScreen.tsx   — Login page (viewport-scaled 1920×1080 design)
      Dashboard.tsx            — Overview with stats and recent activity
      PurchaseInvoices.tsx     — AI-powered invoice scanning + CRUD
      Sales.tsx                — Sales invoices management
      Inventory.tsx            — Items & categories management
      Accounts.tsx             — Chart of accounts + journal entries
      Tasks.tsx                — Tasks & reminders
      TallyIntegration.tsx     — Tally ERP sync interface
      Reports.tsx              — Business analytics & reports
      Suppliers.tsx            — Supplier directory
      Customers.tsx            — Customer directory
    components/
      Layout.tsx               — Responsive sidebar layout
    hooks/
      useAuth.ts               — Auth state + login/logout mutations
    App.tsx                    — Router with protected routes
server/
  index.ts                     — Server entry point
  auth.ts                      — Passport.js + session setup
  routes.ts                    — All API endpoints
  storage.ts                   — DatabaseStorage abstraction
  db.ts                        — Drizzle + pg pool connection
shared/
  schema.ts                    — Full Drizzle schema + Zod types
client/public/
  manifest.json                — PWA manifest
  sw.js                        — Service worker
```

## Database Tables
- `users` — ERP users with roles
- `suppliers` — Supplier directory
- `customers` — Customer directory  
- `inventory_categories` — Item categories
- `inventory_items` — Stock items with HSN, pricing, levels
- `purchase_invoices` + `purchase_invoice_items` — Purchase management
- `sales_invoices` + `sales_invoice_items` — Sales management
- `accounts` — Chart of accounts
- `journal_entries` + `journal_entry_lines` — Double-entry bookkeeping
- `tasks` — Tasks & reminders
- `tally_sync_logs` — Tally integration history

## Default Login
- **Username**: `Admin`
- **Password**: `admin123`

## Key Features
1. **AI Invoice Scanning** — Upload purchase invoice image → Gemini extracts all fields automatically
2. **Tally Integration** — Simulate sync of purchases/sales/inventory/accounts to Tally ERP
3. **Full CRUD** — All modules with create/edit/delete and search
4. **Responsive** — Mobile sidebar overlay, tablet + desktop layouts
5. **PWA** — Installable, works offline (non-API routes cached)
6. **Low Stock Alerts** — Dashboard highlights items below minimum level

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `GEMINI_API_KEY` — Google Gemini API key for invoice scanning
- `SESSION_SECRET` — Express session secret (optional, has default)

## Running
- Development: `npm run dev` (Express + Vite on port 5000)
- Production build: `npm run build` → `node ./dist/index.cjs`

## Notes
- Login screen scales to viewport using CSS transform from 1920×1080 base — do NOT change this approach
- Figma assets served from `/figmaAssets/`
- `uploads/` directory is auto-created on startup for Gemini invoice processing
