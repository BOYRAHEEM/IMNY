import { z } from "zod";

export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Central",
  "Eastern",
  "Western",
  "Western North",
  "Volta",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
] as const;

const trimmed = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max, message);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const checkoutSchema = z.object({
  name: trimmed(2, 120, "Enter your full name."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{9,15}$/, "Enter a valid phone number, e.g. 024 123 4567.")),
  line1: trimmed(3, 200, "Enter your street address or house number."),
  city: trimmed(2, 80, "Enter your town or city."),
  region: z.enum(GHANA_REGIONS, { error: "Choose your region." }),
  instructions: optional(500),
  payment_method: z.enum(["momo", "card", "cod"], { error: "Choose how you'd like to pay." }),
  discount_code: z
    .string()
    .trim()
    .toUpperCase()
    .max(32)
    .transform((v) => v || null),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
