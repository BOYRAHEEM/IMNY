import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, rejects, type Db } from "./harness";

const HASH = "b".repeat(64);

describe("pay on delivery, lookbook, newsletter and messages", () => {
  let db: Db;
  let staff: string, customer: string;
  let variant: string, codZone: string, onlineZone: string;

  const stock = async () =>
    (await db.query<{ on_hand: number; reserved: number }>(`select on_hand, reserved from inventory where variant_id = $1`, [variant])).rows[0];

  const placeCod = (zone: string, qty = 1) =>
    as(db, { role: "service_role" }, async () =>
      (
        await db.query<{ r: any }>(`select place_cod_order($1, $2, $3, $4, null, $5, $6) as r`, [
          JSON.stringify([{ variant_id: variant, quantity: qty }]),
          JSON.stringify({ email: "ama@example.com", phone: "0241234567", name: "Ama" }),
          JSON.stringify({ line1: "1 Oxford St", city: "Accra", region: "Greater Accra" }),
          zone,
          `COD_${randomUUID().slice(0, 12)}`,
          HASH,
        ])
      ).rows[0].r,
    );

  beforeAll(async () => {
    db = await createDb();
    staff = await createUser(db, "staff@example.com", "staff");
    customer = await createUser(db, "c@example.com");
    const { rows: [p] } = await db.query<{ id: string }>(`insert into products (name, slug, status) values ('Tee', 'tee', 'active') returning id`);
    const { rows: [v] } = await db.query<{ id: string }>(`insert into product_variants (product_id, price_minor) values ($1, 90000) returning id`, [p.id]);
    variant = v.id;
    await db.query(`update inventory set on_hand = 5 where variant_id = $1`, [variant]);
    codZone = (await db.query<{ id: string }>(`insert into delivery_zones (name, fee_minor, allow_cod, regions) values ('Accra', 8000, true, '{Greater Accra}') returning id`)).rows[0].id;
    onlineZone = (await db.query<{ id: string }>(`insert into delivery_zones (name, fee_minor, regions) values ('Rest of Ghana', 8000, '{Ashanti,Volta}') returning id`)).rows[0].id;
  }, 60_000);

  it("resolves the delivery zone from the region", async () => {
    const zone = (region: string) =>
      as(db, { role: "anon" }, async () => (await db.query<{ z: string | null }>(`select delivery_zone_for_region($1) as z`, [region])).rows[0].z);
    expect(await zone("Greater Accra")).toBe(codZone);
    expect(await zone("Ashanti")).toBe(onlineZone);
    expect(await zone("Upper West")).toBeNull();
  });

  it("rejects an order whose zone doesn't cover the delivery region", async () => {
    // A Greater Accra address can't be charged the Rest of Ghana zone (or vice versa).
    await rejects(
      as(db, { role: "service_role" }, () =>
        db.query(`select place_order($1, $2, $3, $4, null, null, 'paystack', $5, $6)`, [
          JSON.stringify([{ variant_id: variant, quantity: 1 }]),
          JSON.stringify({ email: "x@example.com", phone: "0241234567", name: "X" }),
          JSON.stringify({ line1: "1 Oxford St", city: "Accra", region: "Greater Accra" }),
          onlineZone,
          `IM_${randomUUID().slice(0, 12)}`,
          HASH,
        ]),
      ),
      "ZONE_REGION_MISMATCH",
    );
  });

  it("refuses pay on delivery outside zones that allow it", async () => {
    await rejects(placeCod(onlineZone), "COD_NOT_AVAILABLE");
  });

  it("confirms the order and commits stock immediately, with payment pending", async () => {
    const r = await placeCod(codZone, 2);
    expect(r.ok).toBe(true);
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
    const o = (await db.query(`select status, payment_status, payment_method, stock_state, reservation_expires_at from orders where id = $1`, [r.order_id])).rows[0];
    expect(o).toEqual({ status: "confirmed", payment_status: "pending", payment_method: "cod", stock_state: "committed", reservation_expires_at: null });

    // The payment-timeout job never touches it.
    await as(db, { role: "service_role" }, () => db.query(`select release_expired_reservations()`));
    expect((await stock()).on_hand).toBe(3);
  });

  it("clients can't place cash orders directly", async () => {
    await rejects(
      as(db, { role: "authenticated", uid: customer }, () =>
        db.query(`select place_cod_order('[]', '{}', '{}', null, null, 'x', 'x')`),
      ),
      "permission denied",
    );
  });

  it("staff can fulfil before payment, then record the cash", async () => {
    const r = await placeCod(codZone);
    const asStaff = (sql: string) => as(db, { role: "authenticated", uid: staff }, () => db.query(sql, [r.order_id]));
    await asStaff(`select admin_update_order_status($1, 'shipped')`);
    await asStaff(`select admin_record_cod_payment($1, 'Rider collected GHS 980')`);
    const o = (await db.query(`select status, payment_status from orders where id = $1`, [r.order_id])).rows[0];
    expect(o).toEqual({ status: "shipped", payment_status: "paid" });
    await rejects(asStaff(`select admin_record_cod_payment($1)`), "INVALID_ARGUMENT");
    await rejects(
      as(db, { role: "authenticated", uid: customer }, () => db.query(`select admin_record_cod_payment($1)`, [r.order_id])),
      /FORBIDDEN|permission denied/,
    );
  });

  it("cancelling a cash order puts the stock back", async () => {
    const before = (await stock()).on_hand;
    const r = await placeCod(codZone);
    await as(db, { role: "authenticated", uid: staff }, () => db.query(`select admin_update_order_status($1, 'cancelled')`, [r.order_id]));
    expect((await stock()).on_hand).toBe(before);
  });

  it("order numbers can use a dashed prefix", async () => {
    await db.query(`update store_settings set order_prefix = 'IMNY-'`);
    const r = await placeCod(codZone);
    expect(r.order_number).toMatch(/^IMNY-\d+$/);
  });

  it("lookbook is public to read, staff-only to change", async () => {
    await as(db, { role: "authenticated", uid: staff }, () =>
      db.query(`insert into lookbook_images (storage_path, label) values ('site/lookbook/a.webp', 'LOOK 01')`),
    );
    const rows = await as(db, { role: "anon" }, async () => (await db.query(`select label from lookbook_images`)).rows);
    expect(rows).toEqual([{ label: "LOOK 01" }]);
    await rejects(
      as(db, { role: "authenticated", uid: customer }, () =>
        db.query(`insert into lookbook_images (storage_path) values ('site/lookbook/b.webp')`),
      ),
      "row-level security",
    );
  });

  it("newsletter and messages are hidden from the public and customers", async () => {
    await db.query(`insert into newsletter_subscribers (email) values ('fan@example.com')`);
    await db.query(`insert into contact_messages (email, message) values ('q@example.com', 'hi')`);
    for (const table of ["newsletter_subscribers", "contact_messages"]) {
      await rejects(as(db, { role: "anon" }, () => db.query(`select * from ${table}`)), "permission denied");
      const seen = await as(db, { role: "authenticated", uid: customer }, async () => (await db.query(`select * from ${table}`)).rows);
      expect(seen).toHaveLength(0);
      const staffSeen = await as(db, { role: "authenticated", uid: staff }, async () => (await db.query(`select * from ${table}`)).rows);
      expect(staffSeen).toHaveLength(1);
    }
    await rejects(
      as(db, { role: "anon" }, () => db.query(`insert into newsletter_subscribers (email) values ('x@example.com')`)),
      "permission denied",
    );
  });
});
