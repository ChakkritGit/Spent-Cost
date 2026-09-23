import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spent/Cost",
    short_name: "Spent/Cost",
    description: "บันทึกรายจ่าย ผ่อน และหนี้ — เดือนต่อเดือน",
    start_url: "/",
    display: "standalone",
    // Literal hex: the manifest takes no custom properties. Mirrors --paper in
    // globals.css and viewport.themeColor in layout.tsx.
    background_color: "#f8f9fa",
    theme_color: "#f8f9fa",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
