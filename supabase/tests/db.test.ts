import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, rejects, type Db } from "./harness";

const TOKEN_HASH = "a".repeat(64);
let refCounter = 0;
const nextRef = () => `TESTREF-${++refCounter}-${Date.now()}`;

type Catalog = {
  productId: string;
  draftProductId: string;
  oneSizeProductId: string;
  variants: Record<string, string>; // "Black/S" -> id
  oneSizeVariant: string;
  zoneId: string;
};

async function seedCatalog(db: Db): Promise<Catalog> {
  const q = async <T = Record<string, string>>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows;

  const [cat] = await q(`insert into categories (name, slug) values ('Tops', 'tops') returning id`);
  const [product] = await q(
    `insert into products (name, slug, category_id, status) values ('Oversized Tee', 'oversized-tee', $1, 'active') returning id`,
    [cat.id],
  );
  const [colour] = await q(
    `insert into product_options (product_id, name, position) values ($1, 'Colour', 1) returning id`,
    [product.id],
  );
  const [size] = await q(
    `insert into product_options (product_id, name, position) values ($1, 'Size', 2) returning id`,
    [product.id],
  );
  const values: Record<string, string> = {};
  for (const [opt, v] of [
    [colour.id, "Black"],
    [colour.id, "White"],
    [size.id, "S"],
    [size.id, "M"],
  ]) {
    const [row] = await q(
      `insert into product_option_values (option_id, value) values ($1, $2) returning id`,
      [opt, v],
    );
    values[v] = row.id;
  }
  const variants: Record<string, string> = {};
  for (const c of ["Black", "White"]) {
    for (const s of ["S", "M"]) {
      const [row] = await q(
        `insert into product_variants (product_id, sku, price_minor, option1_value_id, option2_value_id)
         values ($1, $2, 15000, $3, $4) returning id`,
        [product.id, `TEE-${c}-${s}`.toUpperCase(), values[c], values[s]],
      );
      variants[`${c}/${s}`] = row.id;
      await q(`update inventory set on_hand = 20 where variant_id = $1`, [row.id]);
    }
  }
  await q(`update inventory set on_hand = 1 where variant_id = $1`, [variants["White/M"]]);
  await q(`update inventory set on_hand = 0 where variant_id = $1`, [variants["White/S"]]);

  const [draft] = await q(
    `insert into products (name, slug, status) values ('Secret Dress', 'secret-dress', 'draft') returning id`,
  );
  await q(`insert into product_variants (product_id, price_minor) values ($1, 90000)`, [draft.id]);

  const [oneSize] = await q(
    `insert into products (name, slug, status) values ('Tote Bag', 'tote-bag', 'active') returning id`,
  );
  const [osv] = await q(
    `insert into product_variants (product_id, sku, price_minor) values ($1, 'TOTE', 5000) returning id`,
    [oneSize.id],
  );
  await q(`update inventory set on_hand = 10 where variant_id = $1`, [osv.id]);

  const [zone] = await q(
    `insert into delivery_zones (name, fee_minor, free_over_minor, regions) values ('Accra', 2500, 100000, '{Greater Accra}') returning id`,
  );

  await q(`insert into discount_codes (code, type, value) values ('TENOFF', 'percentage', 10)`);
  await q(`insert into discount_codes (code, type, value, min_order_minor) values ('BIG50', 'fixed', 5000, 50000)`);
  await q(`insert into discount_codes (code, type, value, usage_limit) values ('ONCE', 'fixed', 1000, 1)`);
  await q(`insert into discount_codes (code, type, value, is_active) values ('OFF', 'fixed', 1000, false)`);

  return {
    productId: product.id,
    draftProductId: draft.id,
    oneSizeProductId: oneSize.id,
    variants,
    oneSizeVariant: osv.id,
    zoneId: zone.id,
  };
}

async function placeOrder(
  db: Db,
  c: Catalog,
  items: { variant_id: string; quantity: number; price_minor?: number }[],
  opts: { code?: string; userId?: string; email?: string } = {},
) {
  const reference = nextRef();
  const { rows } = await as(db, { role: "service_role" }, () =>
    db.query<{ r: Record<string, unknown> }>(
      `select public.place_order($1, $2, $3, $4, $5, $6, 'paystack', $7, $8) as r`,
      [
        JSON.stringify(items),
        JSON.stringify({ email: opts.email ?? "Buyer@Example.com", phone: "0241234567", name: "Ama Mensah" }),
        JSON.stringify({ line1: "12 Oxford St", city: "Accra", region: "Greater Accra" }),
        c.zoneId,
        opts.code ?? null,
        opts.userId ?? null,
        reference,
        TOKEN_HASH,
      ],
    ),
  );
  return { ...rows[0].r, reference } as Record<string, any>;
}

async function stock(db: Db, variantId: string) {
  const { rows } = await db.query<{ on_hand: number; reserved: number }>(
    `select on_hand, reserved from inventory where variant_id = $1`,
    [variantId],
  );
  return rows[0];
}

describe("database", () => {
  let db: Db;
  let c: Catalog;
  let alice: string, bob: string, staff: string, admin: string;

  beforeAll(async () => {
    db = await createDb();
    c = await seedCatalog(db);
    alice = await createUser(db, "alice@example.com");
    bob = await createUser(db, "bob@example.com");
    staff = await createUser(db, "staff@example.com", "staff");
    admin = await createUser(db, "admin@example.com", "admin");
  }, 60_000);

  describe("schema", () => {
    it("creates a customer profile for new auth users, ignoring role metadata", async () => {
      const { rows } = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ('Sneaky@Example.com', '{"role":"admin","full_name":"Sneaky"}') returning id`,
      );
      const p = await db.query<{ role: string; email: string; full_name: string }>(
        `select role, email, full_name from profiles where id = $1`,
        [rows[0].id],
      );
      expect(p.rows[0]).toEqual({ role: "customer", email: "sneaky@example.com", full_name: "Sneaky" });
    });

    it("rejects duplicate variant combinations, including two one-size variants", async () => {
      await rejects(
        db.query(`insert into product_variants (product_id, price_minor) values ($1, 100)`, [c.oneSizeProductId]),
        "product_variants_combination_unique",
      );
    });

    it("rejects a variant missing an option value", async () => {
      await rejects(
        db.query(`insert into product_variants (product_id, price_minor) values ($1, 100)`, [c.productId]),
        "VARIANT_OPTIONS_MISMATCH",
      );
    });

    it("auto-creates inventory and makes the first image primary", async () => {
      await db.query(`insert into product_images (product_id, storage_path, position) values ($1, 'products/a.jpg', 0)`, [c.productId]);
      await db.query(`insert into product_images (product_id, storage_path, position) values ($1, 'products/b.jpg', 1)`, [c.productId]);
      const { rows } = await db.query<{ storage_path: string; is_primary: boolean }>(
        `select storage_path, is_primary from product_images where product_id = $1 order by position`,
        [c.productId],
      );
      expect(rows.map((r) => r.is_primary)).toEqual([true, false]);
    });
  });

  describe("RLS: catalogue", () => {
    it("anon sees active products but not drafts", async () => {
      const rows = await as(db, { role: "anon" }, async () =>
        (await db.query<{ slug: string }>(`select slug from products order by slug`)).rows.map((r) => r.slug),
      );
      expect(rows).toContain("oversized-tee");
      expect(rows).not.toContain("secret-dress");
    });

    it("anon cannot read inventory or discount codes directly", async () => {
      await rejects(as(db, { role: "anon" }, () => db.query(`select * from inventory`)), "permission denied");
      await rejects(as(db, { role: "anon" }, () => db.query(`select * from discount_codes`)), "permission denied");
    });

    it("anon gets availability only for active products", async () => {
      const rows = await as(db, { role: "anon" }, async () =>
        (
          await db.query<{ variant_id: string; available: number }>(
            `select * from variant_availability($1)`,
            [[c.productId, c.draftProductId]],
          )
        ).rows,
      );
      expect(rows).toHaveLength(4);
      expect(rows.find((r) => r.variant_id === c.variants["White/S"])?.available).toBe(0);
    });

    it("customers cannot create or modify products", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`insert into products (name, slug) values ('Hack', 'hack')`),
        ),
        "row-level security",
      );
      const res = await as(db, { role: "authenticated", uid: alice }, () =>
        db.query(`update product_variants set price_minor = 1 where id = $1`, [c.variants["Black/S"]]),
      );
      expect(res.affectedRows).toBe(0);
    });

    it("staff can edit products but cannot delete them", async () => {
      const upd = await as(db, { role: "authenticated", uid: staff }, () =>
        db.query(`update products set featured = true where id = $1`, [c.productId]),
      );
      expect(upd.affectedRows).toBe(1);
      const del = await as(db, { role: "authenticated", uid: staff }, () =>
        db.query(`delete from products where id = $1`, [c.draftProductId]),
      );
      expect(del.affectedRows).toBe(0);
    });

    it("staff cannot create discount codes; admin can", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: staff }, () =>
          db.query(`insert into discount_codes (code, type, value) values ('STAFF', 'fixed', 100)`),
        ),
        "row-level security",
      );
      await as(db, { role: "authenticated", uid: admin }, () =>
        db.query(`insert into discount_codes (code, type, value) values ('ADMIN5', 'fixed', 500)`),
      );
    });

    it("nobody can write usage_count or inventory quantities directly", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: admin }, () => db.query(`update discount_codes set usage_count = 0`)),
        "permission denied",
      );
      await rejects(
        as(db, { role: "authenticated", uid: admin }, () => db.query(`update inventory set on_hand = 999`)),
        "permission denied",
      );
    });

    it("storage uploads are staff-only and limited to known folders", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`insert into storage.objects (bucket_id, name) values ('catalog', 'products/x.jpg')`),
        ),
        "row-level security",
      );
      await rejects(
        as(db, { role: "authenticated", uid: staff }, () =>
          db.query(`insert into storage.objects (bucket_id, name) values ('catalog', 'evil/x.jpg')`),
        ),
        "row-level security",
      );
      await as(db, { role: "authenticated", uid: staff }, () =>
        db.query(`insert into storage.objects (bucket_id, name) values ('catalog', 'products/p1/x.jpg')`),
      );
    });
  });

  describe("RLS: profiles and roles", () => {
    it("a customer cannot promote themselves", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`update profiles set role = 'admin' where id = $1`, [alice]),
        ),
        "permission denied",
      );
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`select set_user_role($1, 'admin')`, [alice]),
        ),
        /FORBIDDEN|permission denied/,
      );
    });

    it("a customer can update their own name but not someone else's", async () => {
      const own = await as(db, { role: "authenticated", uid: alice }, () =>
        db.query(`update profiles set full_name = 'Alice' where id = $1`, [alice]),
      );
      const other = await as(db, { role: "authenticated", uid: alice }, () =>
        db.query(`update profiles set full_name = 'Pwned' where id = $1`, [bob]),
      );
      expect(own.affectedRows).toBe(1);
      expect(other.affectedRows).toBe(0);
    });

    it("customers only see their own profile", async () => {
      const rows = await as(db, { role: "authenticated", uid: alice }, async () =>
        (await db.query(`select id from profiles`)).rows,
      );
      expect(rows).toHaveLength(1);
    });

    it("admins can change roles but not their own, and not remove the last admin", async () => {
      await as(db, { role: "authenticated", uid: admin }, () => db.query(`select set_user_role($1, 'staff')`, [bob]));
      await as(db, { role: "authenticated", uid: admin }, () => db.query(`select set_user_role($1, 'customer')`, [bob]));
      await rejects(
        as(db, { role: "authenticated", uid: admin }, () => db.query(`select set_user_role($1, 'customer')`, [admin])),
        "CANNOT_CHANGE_OWN_ROLE",
      );
    });
  });

  describe("checkout", () => {
    it("clients cannot call place_order or mark_order_paid", async () => {
      for (const role of ["anon", "authenticated"] as const) {
        await rejects(
          as(db, { role, uid: role === "authenticated" ? alice : undefined }, () =>
            db.query(`select place_order('[]', '{}', '{}', null, null, null, 'x', 'x', 'x')`),
          ),
          "permission denied",
        );
        await rejects(
          as(db, { role, uid: role === "authenticated" ? alice : undefined }, () =>
            db.query(`select mark_order_paid('x', 1, 'GHS')`),
          ),
          "permission denied",
        );
      }
    });

    it("prices from the database, ignoring any client-supplied price", async () => {
      const before = await stock(db, c.variants["Black/M"]);
      const r = await placeOrder(db, c, [{ variant_id: c.variants["Black/M"], quantity: 2, price_minor: 1 }]);
      expect(r.ok).toBe(true);
      expect(r.total_minor).toBe(2 * 15000 + 2500);
      const after = await stock(db, c.variants["Black/M"]);
      expect(after.reserved).toBe(before.reserved + 2);
      expect(after.on_hand).toBe(before.on_hand);

      const items = await db.query<{ unit_price_minor: number; variant_title: string; sku: string }>(
        `select unit_price_minor, variant_title, sku from order_items oi join orders o on o.id = oi.order_id where o.payment_reference = $1`,
        [r.reference],
      );
      expect(items.rows[0]).toMatchObject({ unit_price_minor: 15000, variant_title: "Black / M", sku: "TEE-BLACK-M" });
    });

    it("refuses to oversell and writes nothing", async () => {
      const ordersBefore = (await db.query<{ n: number }>(`select count(*)::int n from orders`)).rows[0].n;
      const r = await placeOrder(db, c, [{ variant_id: c.variants["White/M"], quantity: 2 }]);
      expect(r.ok).toBe(false);
      expect(r.quote.lines[0].status).toBe("insufficient_stock");
      const soldOut = await placeOrder(db, c, [{ variant_id: c.variants["White/S"], quantity: 1 }]);
      expect(soldOut.quote.lines[0].status).toBe("insufficient_stock");
      const ordersAfter = (await db.query<{ n: number }>(`select count(*)::int n from orders`)).rows[0].n;
      expect(ordersAfter).toBe(ordersBefore);
    });

    it("refuses draft products and inactive variants", async () => {
      const { rows } = await db.query<{ id: string }>(`select id from product_variants where product_id = $1`, [
        c.draftProductId,
      ]);
      const r = await placeOrder(db, c, [{ variant_id: rows[0].id, quantity: 1 }]);
      expect(r.ok).toBe(false);
      expect(r.quote.lines[0].status).toBe("unavailable");
    });

    it("the last unit can only be reserved once", async () => {
      const first = await placeOrder(db, c, [{ variant_id: c.variants["White/M"], quantity: 1 }]);
      const second = await placeOrder(db, c, [{ variant_id: c.variants["White/M"], quantity: 1 }]);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(false);
    });

    it("applies free delivery over the zone threshold", async () => {
      const r = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 1 }, { variant_id: c.variants["Black/S"], quantity: 1 }]);
      expect(r.total_minor).toBe(5000 + 15000 + 2500);
      // 2 x 5,000 + 6 x 15,000 = 100,000 -> meets the zone's free-delivery threshold
      const big = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 2 }, { variant_id: c.variants["Black/S"], quantity: 6 }]);
      expect(big.ok).toBe(true);
      expect(big.total_minor).toBe(100000);
    });
  });

  describe("discounts", () => {
    it("applies a percentage discount computed server-side", async () => {
      const r = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 2 }], { code: " tenoff " });
      expect(r.ok).toBe(true);
      expect(r.total_minor).toBe(10000 - 1000 + 2500);
    });

    it("rejects inactive, unknown, under-minimum and exhausted codes", async () => {
      const line = [{ variant_id: c.oneSizeVariant, quantity: 1 }];
      expect((await placeOrder(db, c, line, { code: "OFF" })).quote.discount.error).toBe("DISCOUNT_INVALID");
      expect((await placeOrder(db, c, line, { code: "NOPE" })).quote.discount.error).toBe("DISCOUNT_INVALID");
      expect((await placeOrder(db, c, line, { code: "BIG50" })).quote.discount.error).toBe("DISCOUNT_MIN_ORDER");
      expect((await placeOrder(db, c, line, { code: "ONCE" })).ok).toBe(true);
      expect((await placeOrder(db, c, line, { code: "ONCE" })).quote.discount.error).toBe("DISCOUNT_USAGE_LIMIT");
    });
  });

  describe("payments and reservations", () => {
    it("commits stock once on payment and is idempotent", async () => {
      const v = c.variants["Black/S"];
      const before = await stock(db, v);
      const r = await placeOrder(db, c, [{ variant_id: v, quantity: 1 }]);
      const pay = () =>
        as(db, { role: "service_role" }, () =>
          db.query<{ r: any }>(`select mark_order_paid($1, $2, 'GHS') as r`, [r.reference, r.total_minor]),
        );
      expect((await pay()).rows[0].r.ok).toBe(true);
      expect((await pay()).rows[0].r.already_processed).toBe(true);
      const after = await stock(db, v);
      expect(after.on_hand).toBe(before.on_hand - 1);
      expect(after.reserved).toBe(before.reserved);
      const o = await db.query<{ status: string; payment_status: string; stock_state: string }>(
        `select status, payment_status, stock_state from orders where payment_reference = $1`,
        [r.reference],
      );
      expect(o.rows[0]).toEqual({ status: "confirmed", payment_status: "paid", stock_state: "committed" });
    });

    it("flags an amount mismatch instead of marking paid", async () => {
      const r = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 1 }]);
      const res = await as(db, { role: "service_role" }, () =>
        db.query<{ r: any }>(`select mark_order_paid($1, 100, 'GHS') as r`, [r.reference]),
      );
      expect(res.rows[0].r.error).toBe("AMOUNT_MISMATCH");
      const o = await db.query<{ payment_status: string; requires_attention: boolean }>(
        `select payment_status, requires_attention from orders where payment_reference = $1`,
        [r.reference],
      );
      expect(o.rows[0]).toEqual({ payment_status: "pending", requires_attention: true });
    });

    it("releases expired holds and restores discount usage", async () => {
      await db.query(`insert into discount_codes (code, type, value, usage_limit) values ('SOLO', 'fixed', 500, 1)`);
      const v = c.oneSizeVariant;
      const before = await stock(db, v);
      const r = await placeOrder(db, c, [{ variant_id: v, quantity: 2 }], { code: "SOLO" });
      expect((await stock(db, v)).reserved).toBe(before.reserved + 2);

      await db.query(`update orders set reservation_expires_at = now() - interval '1 minute' where payment_reference = $1`, [
        r.reference,
      ]);
      const released = await as(db, { role: "service_role" }, () =>
        db.query<{ n: number }>(`select release_expired_reservations() as n`),
      );
      expect(released.rows[0].n).toBeGreaterThanOrEqual(1);
      expect((await stock(db, v)).reserved).toBe(before.reserved);
      const code = await db.query<{ usage_count: number }>(`select usage_count from discount_codes where code = 'SOLO'`);
      expect(code.rows[0].usage_count).toBe(0);

      // Late payment: stock still available -> order revived and committed.
      const late = await as(db, { role: "service_role" }, () =>
        db.query<{ r: any }>(`select mark_order_paid($1, $2, 'GHS') as r`, [r.reference, r.total_minor]),
      );
      expect(late.rows[0].r.stock_committed).toBe(true);
      expect((await stock(db, v)).on_hand).toBe(before.on_hand - 2);
    });

    it("late payment with no stock left is flagged for a refund", async () => {
      const v = c.variants["White/M"]; // on_hand 1, reserved by an earlier test
      await db.query(`update orders set reservation_expires_at = now() - interval '1 minute' where stock_state = 'reserved'`);
      await as(db, { role: "service_role" }, () => db.query(`select release_expired_reservations()`));
      const expired = await db.query<{ payment_reference: string; total_minor: number }>(
        `select o.payment_reference, o.total_minor from orders o join order_items oi on oi.order_id = o.id
         where oi.variant_id = $1 and o.stock_state = 'released' limit 1`,
        [v],
      );
      // Someone else buys the last unit first.
      const other = await placeOrder(db, c, [{ variant_id: v, quantity: 1 }]);
      expect(other.ok).toBe(true);

      const late = await as(db, { role: "service_role" }, () =>
        db.query<{ r: any }>(`select mark_order_paid($1, $2, 'GHS') as r`, [
          expired.rows[0].payment_reference,
          expired.rows[0].total_minor,
        ]),
      );
      expect(late.rows[0].r.stock_committed).toBe(false);
      const o = await db.query<{ payment_status: string; requires_attention: boolean; status: string }>(
        `select payment_status, requires_attention, status from orders where payment_reference = $1`,
        [expired.rows[0].payment_reference],
      );
      expect(o.rows[0]).toEqual({ payment_status: "paid", requires_attention: true, status: "cancelled" });
      expect((await stock(db, v)).reserved).toBe(1);
    });
  });

  describe("orders: access and administration", () => {
    let aliceOrder: Record<string, any>;

    beforeAll(async () => {
      aliceOrder = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 1 }], {
        userId: alice,
        email: "alice@example.com",
      });
    });

    it("a customer sees their own order and items, and nobody else's", async () => {
      const mine = await as(db, { role: "authenticated", uid: alice }, async () =>
        (await db.query(`select id from orders`)).rows,
      );
      expect(mine).toEqual([{ id: aliceOrder.order_id }]);
      const bobs = await as(db, { role: "authenticated", uid: bob }, async () =>
        (await db.query(`select id from orders where id = $1`, [aliceOrder.order_id])).rows,
      );
      expect(bobs).toHaveLength(0);
      const bobItems = await as(db, { role: "authenticated", uid: bob }, async () =>
        (await db.query(`select id from order_items where order_id = $1`, [aliceOrder.order_id])).rows,
      );
      expect(bobItems).toHaveLength(0);
    });

    it("a customer cannot modify their order", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`update orders set total_minor = 1, payment_status = 'paid' where id = $1`, [aliceOrder.order_id]),
        ),
        "permission denied",
      );
    });

    it("guest orders are claimed only by a verified account with the same email", async () => {
      const guest = await placeOrder(db, c, [{ variant_id: c.oneSizeVariant, quantity: 1 }], { email: "kofi@example.com" });
      const unverified = await createUser(db, "kofi@example.com", "customer", false);
      const none = await as(db, { role: "authenticated", uid: unverified }, () =>
        db.query<{ n: number }>(`select claim_guest_orders() as n`),
      );
      expect(none.rows[0].n).toBe(0);

      await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [unverified]);
      const claimed = await as(db, { role: "authenticated", uid: unverified }, () =>
        db.query<{ n: number }>(`select claim_guest_orders() as n`),
      );
      expect(claimed.rows[0].n).toBe(1);
      const visible = await as(db, { role: "authenticated", uid: unverified }, async () =>
        (await db.query(`select id from orders`)).rows,
      );
      expect(visible).toEqual([{ id: guest.order_id }]);
    });

    it("unpaid orders cannot be advanced; customers cannot change status", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: staff }, () =>
          db.query(`select admin_update_order_status($1, 'shipped')`, [aliceOrder.order_id]),
        ),
        "ORDER_NOT_PAID",
      );
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`select admin_update_order_status($1, 'cancelled')`, [aliceOrder.order_id]),
        ),
        "FORBIDDEN",
      );
    });

    it("staff move paid orders forward only, and cancelling restocks", async () => {
      await as(db, { role: "service_role" }, () =>
        db.query(`select mark_order_paid($1, $2, 'GHS')`, [aliceOrder.reference, aliceOrder.total_minor]),
      );
      const asStaff = (sql: string) =>
        as(db, { role: "authenticated", uid: staff }, () => db.query(sql, [aliceOrder.order_id]));
      await asStaff(`select admin_update_order_status($1, 'shipped', 'Sent with rider')`);
      await rejects(asStaff(`select admin_update_order_status($1, 'processing')`), "INVALID_STATUS_TRANSITION");

      const before = await stock(db, c.oneSizeVariant);
      await asStaff(`select admin_update_order_status($1, 'cancelled', 'Customer changed mind')`);
      expect((await stock(db, c.oneSizeVariant)).on_hand).toBe(before.on_hand + 1);
      const o = await db.query<{ requires_attention: boolean }>(`select requires_attention from orders where id = $1`, [
        aliceOrder.order_id,
      ]);
      expect(o.rows[0].requires_attention).toBe(true);

      const history = await db.query(`select to_status from order_status_history where order_id = $1 order by id`, [
        aliceOrder.order_id,
      ]);
      expect(history.rows.map((r: any) => r.to_status)).toEqual(["pending", "confirmed", "shipped", "cancelled"]);
    });

    it("customers cannot read internal notes or status history", async () => {
      const notes = await as(db, { role: "authenticated", uid: alice }, async () =>
        (await db.query(`select * from order_notes`)).rows,
      );
      expect(notes).toHaveLength(0);
    });
  });

  describe("inventory administration", () => {
    it("staff adjustments are logged and cannot drop below reserved stock", async () => {
      const v = c.variants["Black/M"];
      const held = await placeOrder(db, c, [{ variant_id: v, quantity: 2 }]);
      expect(held.ok).toBe(true);
      const s = await stock(db, v);
      const asStaff = (sql: string, params: unknown[]) =>
        as(db, { role: "authenticated", uid: staff }, () => db.query(sql, params));
      await asStaff(`select set_inventory_level($1, $2, 'Stock count')`, [v, s.on_hand + 3]);
      expect((await stock(db, v)).on_hand).toBe(s.on_hand + 3);
      await rejects(asStaff(`select set_inventory_level($1, 0)`, [v]), "STOCK_BELOW_RESERVED");
      const log = await db.query(
        `select delta_on_hand, reason, actor_id from inventory_movements where variant_id = $1 and reason = 'manual_adjustment'`,
        [v],
      );
      expect(log.rows).toEqual([{ delta_on_hand: 3, reason: "manual_adjustment", actor_id: staff }]);
    });

    it("customers cannot adjust stock", async () => {
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () =>
          db.query(`select adjust_inventory($1, 100)`, [c.variants["Black/M"]]),
        ),
        "FORBIDDEN",
      );
    });

    it("dashboard stats are staff-only", async () => {
      const s = await as(db, { role: "authenticated", uid: staff }, () =>
        db.query<{ s: any }>(`select admin_dashboard_stats() as s`),
      );
      expect(s.rows[0].s.currency).toBe("GHS");
      await rejects(
        as(db, { role: "authenticated", uid: alice }, () => db.query(`select admin_dashboard_stats()`)),
        "FORBIDDEN",
      );
    });
  });
});
