---
name: Schema-first rule
description: Always read shared/schema.ts and existing DB tables before starting any new feature, report, or modification. Reuse existing schemas where possible.
---

# Schema-First Rule

**Rule:** Before building any new entry screen, report, or modification — read `shared/schema.ts` completely and check the existing DB tables. Only then start designing the schema and code.

**Why:** Many tables already exist and can be reused or extended with a condition column (e.g. `entry_type`, `transaction_type`, `source`) rather than creating a brand-new table. Creating duplicate tables wastes time and causes data fragmentation.

**How to apply:**
1. Open `shared/schema.ts` and read the relevant sections.
2. Check if an existing table can serve the new use-case with an added column or filter condition.
3. If a new table is genuinely needed, model it consistently with the existing pattern (UUID PK, `created_at` defaultNow, matching insert schema + types).
4. Always use `executeSql` to check the live DB before writing migration SQL.
5. Reuse existing GL accounts, voucher_series, suppliers, customers, products tables — never duplicate them.
