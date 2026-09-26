import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, rejects, type Db } from "./harness";

const HASH = "c".repeat(64);

describe("idempotent checkout and emails", () => {
  let db: Db;
  let variant: string, zone: string;

  const stock = async () =>
    (await db.query<{ on_hand: number; reserved: number }>(`select on_hand, reserved from inventory where variant_id = $1`, [variant])).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await db.query<{ n: string }>(sql, params)).rows[0].n);
  const usage = async () => (await db.query<{ usage_count: number }>(`select usage_count from discount_codes where code = 'KEYTEST'`)).rows[0].usage_count;

  const args = (email: string, code: string | null) => [
    JSON.stringify([{ variant_id: variant, quantity: 1 }]),
    JSON.stringify({ email, phone: "0241234567", name: "Ama" }),
    JSON.stringify({ line1: "1 Oxford St", city: "Accra", region: "Greater Accra" }),
    zone,
    code,
  ];

  const place = (key: string | null, email = "ama@example.com", code: string | null = null) =>
    as(db, { role: "service_role" }, async () =>
      (
        await db.query<{ r: any }>(`select place_order($1, $2, $3, $4, $5, null, 'paystack', $6, $7, $8) as r`, [
          ...args(email, code),
          `IM_${randomUUID().slice(0, 12)}`,
          HASH,
          key,
        ])
      ).rows[0].r,
    );

  const placeCod = (key: string | null) =>
    as(db, { role: "service_role" }, async () =>
      (
        await db.query<{ r: any }>(`select place_cod_order($1, $2, $3, $4, $5, $6, $7, $8) as r`, [
          ...args("kofi@example.com", null),
          `COD_${randomUUID().slice(0, 12)}`,
          HASH,
          key,
        ])
      ).rows[0].r,
    );

  beforeAll(async () => {
    db = await createDb();
    const { rows: [p] } = await db.query<{ id: string }>(`insert into products (name, slug, status) values ('Tee', 'tee', 'active') returning id`);
    const { rows: [v] } = await db.query<{ id: string }>(`insert into product_variants (product_id, price_minor) values ($1, 90000) returning id`, [p.id]);
    variant = v.id;
    await db.query(`update inventory set on_hand = 20 where variant_id = $1`, [variant]);
    zone = (await db.query<{ id: string }>(`insert into delivery_zones (name, fee_minor, allow_cod, regions) values ('Accra', 8000, true, '{Greater Accra}') returning id`)).rows[0].id;
    await db.query(`insert into discount_codes (code, type, value) values ('KEYTEST', 'fixed', 1000)`);
  }, 60_000);

  it("returns the same order for a repeated key, reserving stock and the discount once", async () => {
    const key = randomUUID();
    const before = await stock();
    const first = await place(key, "ama@example.com", "KEYTEST");
    const second = await place(key, "Ama@Example.com ", "KEYTEST");

    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(second).toMatchObject({ ok: true, replayed: true, order_id: first.order_id, order_number: first.order_number, payment_status: "pending" });
    expect(await count(`select count(*) n from orders where idempotency_key = $1`, [key])).toBe(1);
    expect(await stock()).toEqual({ on_hand: before.on_hand, reserved: before.reserved + 1 });
    expect(await usage()).toBe(1);
  });

  it("commits pay-on-delivery stock once for a repeated key", async () => {
    const key = randomUUID();
    const before = await stock();
    const first = await placeCod(key);
    const second = await placeCod(key);

    expect(first).toMatchObject({ ok: true, replayed: false, payment_method: "cod" });
    expect(second).toMatchObject({ ok: true, replayed: true, order_id: first.order_id, payment_method: "cod", status: "confirmed" });
    expect(await stock()).toEqual({ on_hand: before.on_hand - 1, reserved: before.reserved });
  });

  it("refuses a key reused for a different customer", async () => {
    const key = randomUUID();
    await place(key);
    await rejects(place(key, "someone-else@example.com"), "IDEMPOTENCY_KEY_REUSED");
  });

  it("rejects a malformed key", async () => {
    await rejects(place("short"), "INVALID_ARGUMENT");
  });

  it("still creates a new order every time when no key is given", async () => {
    const a = await place(null);
    const b = await place(null);
    expect(a.order_id).not.toBe(b.order_id);
  });

  it("records each order email once", async () => {
    const { order_id } = await place(randomUUID());
    const claim = () =>
      as(db, { role: "service_role" }, async () =>
        (await db.query(`insert into order_emails (order_id, kind) values ($1, 'confirmed') on conflict do nothing returning order_id`, [order_id])).rows.length,
      );
    expect(await claim()).toBe(1);
    expect(await claim()).toBe(0);
    await rejects(as(db, { role: "anon" }, () => db.query(`select * from order_emails`)), "permission denied");
  });
});
