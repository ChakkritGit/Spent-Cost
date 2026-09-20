import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { Providers } from "@/components/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/sw-register";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "รายจ่าย",
  description: "บันทึกค่าใช้จ่าย หนี้ และรายการประจำเดือน",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "รายจ่าย" },
};

// Literal hex required by the Viewport API (no CSS custom properties here).
// Mirrors --bg light/dark in src/app/globals.css; keep the manifest's
// background_color/theme_color (src/app/manifest.ts) in sync if this moves.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2f4" },
    { media: "(prefers-color-scheme: dark)", color: "#15161b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={sans.variable}>
      <body className="min-h-dvh antialiased">
        <Providers>
          {children}
          <ServiceWorkerRegistrar />
        </Providers>
      </body>
    </html>
  );
}
