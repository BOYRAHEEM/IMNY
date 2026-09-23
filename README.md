# IMNY Store

Full-stack clothing e-commerce: customer storefront and admin dashboard.
Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS) + Paystack. Deployed on Vercel.

> Status: scaffold and database are complete and tested. The admin UI, storefront, checkout and payments are next.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (see the comments in the file).
3. Apply the database migrations to your Supabase project:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
4. Create the first admin: sign up through the site, then in the Supabase SQL editor run
   ```sql
   update public.profiles set role = 'admin' where email = 'owner@example.com';
   ```
   After that, admins manage roles from the dashboard.
5. `npm run dev`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | All tests |
| `npm run test:db` | Schema, RLS and checkout tests against in-memory Postgres (no Docker needed) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Architecture

**Money** is stored as integer minor units (pesewas), never floats.

**Products** have up to three generic options (e.g. Colour, Size). Each variant picks one value per option and has its own price, SKU and stock. Products with no options have a single variant (one-size).

**Stock** is `on_hand` and `reserved` per variant; `available = on_hand - reserved`.
- Checkout (`place_order`) locks the stock rows, prices the cart from the database and **reserves** stock for 30 minutes (configurable).
- A verified payment (`mark_order_paid`) turns the reservation into a permanent deduction.
- Unpaid orders are released automatically (pg_cron every minute, and before each checkout).
- Every change is recorded in `inventory_movements`.

**Security layers**
1. `src/proxy.ts` keeps signed-out users out of `/admin` and `/account`. This is a convenience, not the security boundary.
2. The admin layout and every server action check the role on the server (`src/lib/auth.ts`).
3. Row Level Security plus table and column grants in Postgres. Customers see only their own orders; roles cannot be self-assigned; orders, stock quantities and discount usage cannot be written by clients at all.
4. Money, stock, discounts and payment status are decided only in SECURITY DEFINER database functions called by the server.

**Keys:** the service-role key and Paystack secret live only in server modules (`import "server-only"`).

### Roles
| | admin | staff | customer |
| --- | --- | --- | --- |
| Products, categories, images, variants | full | create/edit (no delete) | view published |
| Inventory | full | full | availability only |
| Orders | full + refunds | view, update status | own orders only |
| Discounts, delivery zones, settings | full | view discounts | — |
| User roles | full | — | — |

## Database

Migrations live in `supabase/migrations`:
- `core_schema`: tables, constraints, triggers
- `auth_and_rls`: role helpers, grants, policies
- `commerce_functions`: pricing, checkout, payments, stock, admin operations
- `storage`: the `catalog` image bucket and its policies
- `scheduled_jobs`: pg_cron jobs
