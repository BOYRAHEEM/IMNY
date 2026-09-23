import { Badge } from "@/components/ui/badge";

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const ORDER: Record<OrderStatus, { label: string; tone: "neutral" | "good" | "warn" | "bad" | "info" | "dark" }> = {
  pending: { label: "Pending", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  ready: { label: "Ready", tone: "info" },
  shipped: { label: "Shipped", tone: "dark" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const PAYMENT: Record<PaymentStatus, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  pending: { label: "Awaiting payment", tone: "warn" },
  paid: { label: "Paid", tone: "good" },
  failed: { label: "Payment failed", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export function orderStatusLabel(s: string) {
  return ORDER[s as OrderStatus]?.label ?? s;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER[status as OrderStatus] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = PAYMENT[status as PaymentStatus] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ProductStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="good">Published</Badge>;
  if (status === "archived") return <Badge tone="neutral">Archived</Badge>;
  return <Badge tone="warn">Draft</Badge>;
}
