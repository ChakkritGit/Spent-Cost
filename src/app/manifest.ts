import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "รายจ่าย",
    short_name: "รายจ่าย",
    description: "บันทึกค่าใช้จ่าย หนี้ และรายการประจำเดือน",
    start_url: "/",
    display: "standalone",
    // Literal hex required by the Web Manifest spec (no CSS custom properties
    // here). background_color mirrors --bg light; theme_color mirrors --accent
    // light. Keep in sync with src/app/globals.css and the viewport.themeColor
    // pair in src/app/layout.tsx if the palette moves again.
    background_color: "#f1f2f4",
    theme_color: "#6d28d9",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
