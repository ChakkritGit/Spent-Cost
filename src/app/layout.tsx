import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "รายจ่าย",
  description: "บันทึกค่าใช้จ่าย หนี้ และรายการประจำเดือน",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "รายจ่าย" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
