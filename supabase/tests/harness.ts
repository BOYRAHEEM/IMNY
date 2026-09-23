/**
 * In-memory Postgres (PGlite) with a minimal stand-in for the parts of
 * Supabase the migrations depend on (auth.users, auth.uid(), client roles,
 * storage schema). Lets us test schema, RLS and business functions without
 * Docker. Real-project verification still happens against Supabase.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

// Extensions not available in PGlite; covered by the Supabase deployment.
const SKIP = [/scheduled_jobs/];

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id), name text
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
`;

export type Db = PGlite;

export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !SKIP.some((re) => re.test(f)))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/** Run fn as a given client role. Always resets back to the superuser. */
export async function as<T>(
  db: Db,
  who: { role: "anon" | "authenticated" | "service_role"; uid?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(who.uid ? { sub: who.uid, role: who.role } : { role: who.role });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${who.role}`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

export async function createUser(
  db: Db,
  email: string,
  role: "customer" | "staff" | "admin" = "customer",
  confirmed = true,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id`,
    [email, confirmed ? new Date().toISOString() : null],
  );
  const id = rows[0].id;
  if (role !== "customer") {
    await db.query(`update public.profiles set role = $1 where id = $2`, [role, id]);
  }
  return id;
}

/** Expect a promise to reject with a message containing `code`. */
export async function rejects(p: Promise<unknown>, code: string | RegExp): Promise<void> {
  try {
    await p;
  } catch (err) {
    const msg = (err as Error).message;
    const ok = typeof code === "string" ? msg.includes(code) : code.test(msg);
    if (!ok) throw new Error(`Expected error matching ${code}, got: ${msg}`);
    return;
  }
  throw new Error(`Expected rejection matching ${code}, but it resolved`);
}
