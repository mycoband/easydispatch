# Supabase SQL — run order

Run these in the **Supabase SQL Editor** top-to-bottom on a **new** project.  
All scripts are idempotent where possible (`if not exists`, `on conflict`).

| # | File | What it does |
|---|------|----------------|
| 1 | `schema.sql` | Core tables, tax rates, RLS starters, `equipment-photos` bucket |
| 2 | `fix-profiles.sql` | Only if signup/profile trigger issues |
| 3 | `fix-grants.sql` | Only if API gets permission errors |
| 4 | `add-equipment-name.sql` | Equipment display name (if not already in schema) |
| 5 | `add-filter-fields.sql` | Filter size/qty on equipment |
| 6 | `office-features.sql` | Pricebook, portal tokens |
| 7 | `tech-features.sql` | Job media, safety, `job-media` bucket |
| 8 | `competitive-features.sql` | Properties, company settings, part orders, `company-assets` |
| 9 | `company-modules.sql` | Feature module toggles (`modules` jsonb) |
| 10 | `multi-tenant-saas.sql` | Companies, `company_id`, tenant RLS, billing columns |
| 11 | `role-permissions.sql` | Per-role capability toggles |
| 12 | `seed-demo.sql` | **Optional** KC demo customers/jobs (after you have a signed-in owner) |
| 13 | `ai-receptionist.sql` | AI SMS/voice intake columns, sessions, events, receptionist settings |
| 14 | `jobs-number-per-company.sql` | Job numbers unique per company (fixes multi-tenant #1 collisions) |

## Fresh project (recommended path)

```
schema.sql
office-features.sql
tech-features.sql
competitive-features.sql
company-modules.sql
multi-tenant-saas.sql
role-permissions.sql
```

Then:

1. Create an owner account in the app (**Start a company**).
2. Sign out / sign in once.
3. Run `seed-demo.sql` for sample data.
4. Confirm Storage shows buckets: `equipment-photos`, `job-media`, `company-assets`.

## Already-running project

Only run scripts you have **not** applied yet. Safe to re-run most of them; `schema.sql` may error on existing tables — skip it if the DB already has core tables.

## Backups

Before major SQL on production: Supabase → **Database → Backups** (or export). Prefer a staging project for experiments.
