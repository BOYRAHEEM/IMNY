import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Poppins } from "next/font/google";
import "./globals.css";

// The store and the dashboard both use these (per the IMNY design system).
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#fbfaf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: a tiny pre-paint script sets data-imny-entered
    // on <html> (hides the welcome screen for returning visitors).
    <html lang="en" className={`${poppins.variable} ${plexMono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
