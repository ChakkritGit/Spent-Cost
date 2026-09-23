import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans, Noto_Sans_Thai } from "next/font/google";
import { Providers } from "@/components/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/sw-register";
import "./globals.css";

// Both Noto faces carry a `wdth` axis, so the condensed headline cut is the
// same family as the body rather than a second typeface. Latin first, so
// "Netflix" and "ผ่อนรถ" in one row share letterforms.
const latin = Noto_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans-latin", display: "swap" });
const thai = Noto_Sans_Thai({ subsets: ["thai"], axes: ["wdth"], variable: "--font-sans-thai", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Spent/Cost",
  description: "บันทึกรายจ่าย ผ่อน และหนี้ — เดือนต่อเดือน",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Spent/Cost" },
  // From /public under the icon-*.png names the proxy's matcher already lets
  // through, so the login page (signed out) gets its favicon too.
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

// Literal hex: the Viewport API takes no custom properties. Mirrors --paper in
// globals.css and background_color in manifest.ts.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={`${latin.variable} ${thai.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>
          {children}
          <ServiceWorkerRegistrar />
        </Providers>
      </body>
    </html>
  );
}
