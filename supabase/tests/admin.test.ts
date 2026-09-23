import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, rejects, type Db } from "./harness";

type Payload = Record<string, any>;

function teePayload(): Payload {
  const id = randomUUID();
  const colour = { id: randomUUID(), name: "Colour", values: [
    { id: randomUUID(), value: "Black", swatch_hex: "#000000" },
    { id: randomUUID(), value: "White", swatch_hex: "#FFFFFF" },
  ] };
  const size = { id: randomUUID(), name: "Size", values: [
    { id: randomUUID(), value: "S" },
    { id: randomUUID(), value: "M" },
  ] };
  const variants = colour.values.flatMap((c) =>
    size.values.map((s) => ({
      id: randomUUID(),
      option_value_ids: [c.id, s.id],
      sku: `tee-${id.slice(0, 4)}-${c.value}-${s.value}`,
      price_minor: 15000,
      is_active: true,
      on_hand: 4,
    })),
  );
  const images = [0, 1].map((n) => ({
    id: randomUUID(),
    storage_path: `products/${id}/${n}.webp`,
    alt_text: `Tee ${n}`,
    width: 1600,
    height: 2000,
  }));
  return {
    id,
    name: "Oversized Tee",
    slug: `oversized-tee-${id.slice(0, 6)}`,
    description: "Heavy cotton.",
    status: "active",
    featured: true,
    options: [colour, size],
    variants,
    images,
    primary_image_id: images[1].id,
  };
}

describe("admin functions", () => {
  let db: Db;
  let staff: string, customer: string;

  const save = (uid: string, p: Payload) =>
    as(db, { role: "authenticated", uid }, () =>
      db.query<{ id: string }>(`select admin_save_product($1) as id`, [JSON.stringify(p)]),
    );

  beforeAll(async () => {
    db = await createDb();
    staff = await createUser(db, "staff@example.com", "staff");
    customer = await createUser(db, "c@example.com");
  }, 60_000);

  it("creates a product with options, variants, stock and images in one call", async () => {
    const p = teePayload();
    const res = await save(staff, p);
    expect(res.rows[0].id).toBe(p.id);

    const variants = await db.query<{ title: string; sku: string; on_hand: number }>(
      `select public.variant_title(v) as title, split_part(v.sku, '-', 1) || '-' || split_part(v.sku, '-', 3) || '-' || split_part(v.sku, '-', 4) as sku, i.on_hand
       from product_variants v join inventory i on i.variant_id = v.id
       where v.product_id = $1 order by v.position`,
      [p.id],
    );
    expect(variants.rows).toEqual([
      { title: "Black / S", sku: "TEE-BLACK-S", on_hand: 4 },
      { title: "Black / M", sku: "TEE-BLACK-M", on_hand: 4 },
      { title: "White / S", sku: "TEE-WHITE-S", on_hand: 4 },
      { title: "White / M", sku: "TEE-WHITE-M", on_hand: 4 },
    ]);

    const images = await db.query<{ id: string; is_primary: boolean; position: number }>(
      `select id, is_primary, position from product_images where product_id = $1 order by position`,
      [p.id],
    );
    expect(images.rows.map((r) => r.is_primary)).toEqual([false, true]);

    const log = await db.query(`select count(*)::int as n from inventory_movements where actor_id = $1`, [staff]);
    expect(log.rows[0]).toEqual({ n: 4 });
  });

  it("restructures options: rename a value, drop an option, keep variant stock", async () => {
    const p = teePayload();
    await save(staff, p);

    // Rename Black -> Onyx, remove the Size option, keep one variant per colour.
    const [colour] = p.options;
    colour.values[0].value = "Onyx";
    const keep = [p.variants[0], p.variants[2]].map((v: Payload) => ({
      ...v,
      option_value_ids: [v.option_value_ids[0]],
      on_hand: undefined,
    }));
    p.options = [colour];
    p.variants = keep;
    p.images = [p.images[0]];
    p.primary_image_id = null;
    await save(staff, p);

    const variants = await db.query<{ title: string; on_hand: number }>(
      `select public.variant_title(v) as title, i.on_hand from product_variants v
       join inventory i on i.variant_id = v.id where v.product_id = $1 order by v.position`,
      [p.id],
    );
    expect(variants.rows).toEqual([
      { title: "Onyx", on_hand: 4 },
      { title: "White", on_hand: 4 },
    ]);
    const counts = await db.query(
      `select (select count(*)::int from product_options where product_id = $1) as options,
              (select count(*)::int from product_images where product_id = $1 and is_primary) as primaries`,
      [p.id],
    );
    expect(counts.rows[0]).toEqual({ options: 1, primaries: 1 });
  });

  it("supports one-size products with no options", async () => {
    const p = teePayload();
    p.options = [];
    p.variants = [{ id: randomUUID(), option_value_ids: [], price_minor: 5000, on_hand: 10 }];
    await save(staff, p);
    const v = await db.query(`select public.variant_title(v) as title from product_variants v where product_id = $1`, [p.id]);
    expect(v.rows).toEqual([{ title: null }]);
  });

  it("rejects variants that do not match the options", async () => {
    const p = teePayload();
    p.variants[0].option_value_ids = [p.options[0].values[0].id];
    await rejects(save(staff, p), "VARIANT_OPTIONS_MISMATCH");

    const q = teePayload();
    // Size value in the Colour slot
    q.variants[0].option_value_ids = [q.options[1].values[0].id, q.options[1].values[1].id];
    await rejects(save(staff, q), "VARIANT_OPTION_INVALID");

    const r = teePayload();
    r.variants[1].option_value_ids = r.variants[0].option_value_ids;
    await rejects(save(staff, r), "product_variants_combination_unique");
  });

  it("cannot publish a product without an active variant, but can save it as a draft", async () => {
    const p = teePayload();
    p.variants = p.variants.map((v: Payload) => ({ ...v, is_active: false }));
    await rejects(save(staff, p), "PRODUCT_NEEDS_VARIANT");
    p.status = "draft";
    await save(staff, p);
  });

  it("rejects ids and image paths that belong to another product", async () => {
    const a = teePayload();
    await save(staff, a);

    const b = teePayload();
    b.options[0].id = a.options[0].id;
    await rejects(save(staff, b), "INVALID_ARGUMENT");

    const c = teePayload();
    c.variants[0].id = a.variants[0].id;
    await rejects(save(staff, c), "INVALID_ARGUMENT");

    const d = teePayload();
    d.images[0].storage_path = `products/${a.id}/0.webp`;
    await rejects(save(staff, d), "INVALID_IMAGE_PATH");

    // Nothing from the failed saves leaked into a's data
    const opt = await db.query(`select product_id from product_options where id = $1`, [a.options[0].id]);
    expect(opt.rows[0]).toEqual({ product_id: a.id });
  });

  it("customers cannot save products", async () => {
    await rejects(save(customer, teePayload()), "FORBIDDEN");
  });

  it("variant_title is readable by shoppers for active products", async () => {
    const p = teePayload();
    await save(staff, p);
    const rows = await as(db, { role: "anon" }, async () =>
      (await db.query(`select public.variant_title(v) as t from product_variants v where product_id = $1`, [p.id])).rows,
    );
    expect(rows).toHaveLength(4);
  });

  it("reports are staff-only", async () => {
    for (const sql of [
      `select * from admin_inventory()`,
      `select * from admin_low_stock()`,
      `select * from admin_customers()`,
    ]) {
      await as(db, { role: "authenticated", uid: staff }, () => db.query(sql));
      await rejects(as(db, { role: "authenticated", uid: customer }, () => db.query(sql)), "FORBIDDEN");
    }
    await rejects(as(db, { role: "authenticated", uid: staff }, () => db.query(`select * from admin_team()`)), "FORBIDDEN");
  });

  it("storefront listing shows only published products with prices, stock and swatches", async () => {
    const live = teePayload();
    live.name = "Storefront Listed Tee";
    live.variants[0].price_minor = 12000;
    live.variants.forEach((v: Payload) => (v.on_hand = 0));
    await save(staff, live);
    const draft = teePayload();
    draft.name = "Storefront Draft Tee";
    draft.status = "draft";
    await save(staff, draft);

    const rows = await as(db, { role: "anon" }, async () =>
      (await db.query<any>(`select * from storefront_products(p_search => 'Storefront', p_sort => 'price_asc')`)).rows,
    );
    expect(rows.map((r) => r.name)).toEqual(["Storefront Listed Tee"]);
    expect(rows[0]).toMatchObject({ price_min: 12000, price_max: 15000, available: 0 });
    expect(rows[0].swatches).toEqual([
      { value: "Black", hex: "#000000" },
      { value: "White", hex: "#FFFFFF" },
    ]);
    expect(rows[0].image_path).toBe(live.images[1].storage_path); // the primary image
    expect(rows[0].hover_image_path).toBe(live.images[0].storage_path);
  });

  it("inventory report filters low and out-of-stock variants", async () => {
    const p = teePayload();
    p.name = "Filter Test Hoodie";
    p.variants[0].on_hand = 0;
    p.variants[1].on_hand = 2;
    await save(staff, p);
    const rows = (filter: string) =>
      as(db, { role: "authenticated", uid: staff }, async () =>
        (await db.query<{ available: number }>(`select available from admin_inventory('Filter Test', $1)`, [filter])).rows,
      );
    expect((await rows("all")).length).toBe(4);
    expect((await rows("low")).map((r) => r.available).sort()).toEqual([0, 2]);
    expect((await rows("out")).map((r) => r.available)).toEqual([0]);
  });
});
