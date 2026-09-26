import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderOrderEmail, type OrderEmailData } from "./order-template";

const base: OrderEmailData = {
  kind: "confirmed",
  storeName: "IMNY",
  contactEmail: "hello@imny.example",
  orderNumber: "IMNY-1014",
  trackUrl: "https://imny.example/order-confirmation?order=IMNY-1014&token=abc",
  shippingName: "Ama Mensah",
  address: ["12 Oxford Street", "Osu", "Accra, Greater Accra"],
  deliveryZone: "Accra",
  currency: "GHS",
  subtotalMinor: 240000,
  deliveryFeeMinor: 8000,
  discountMinor: 0,
  totalMinor: 248000,
  cashDue: false,
  itemCount: 2,
};

describe("order emails", () => {
  it("greets the customer by first name", () => {
    const { subject, html, text } = renderOrderEmail(base);
    expect(subject).toBe("Order IMNY-1014 confirmed");
    expect(html).toContain("you ate that, Ama");
    expect(text).toContain("you ate that, Ama");
    expect(text).toContain(base.trackUrl);
  });

  it("leaves out the individual items", () => {
    const { html } = renderOrderEmail(base);
    expect(html).not.toContain("<img");
    expect(html).toContain(">2<");
  });

  it("only mentions cash when payment is due on delivery", () => {
    expect(renderOrderEmail(base).html).not.toContain("pay on delivery");
    const cod = renderOrderEmail({ ...base, cashDue: true });
    expect(cod.html).toContain("pay on delivery");
    expect(cod.html).toContain("To pay on delivery");
    expect(cod.text).toContain("keep GHS");
  });

  it("uses the shipped wording for shipped emails", () => {
    const { subject, html } = renderOrderEmail({ ...base, kind: "shipped" });
    expect(subject).toBe("Order IMNY-1014 is on the way");
    expect(html).toContain("it&#39;s on the way, Ama");
  });

  it("escapes customer-provided text", () => {
    const { html } = renderOrderEmail({ ...base, shippingName: "<b>Ama</b>", address: ['"><script>x</script>'] });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Ama</b>");
  });

  // EMAIL_PREVIEW_DIR=... npx vitest run src/lib/email writes the emails as HTML files to look at.
  it.runIf(process.env.EMAIL_PREVIEW_DIR)("writes previews", () => {
    const dir = process.env.EMAIL_PREVIEW_DIR!;
    writeFileSync(join(dir, "email-confirmed.html"), renderOrderEmail(base).html);
    writeFileSync(join(dir, "email-cod.html"), renderOrderEmail({ ...base, cashDue: true, itemCount: 3 }).html);
    writeFileSync(join(dir, "email-shipped.html"), renderOrderEmail({ ...base, kind: "shipped" }).html);
  });
});
