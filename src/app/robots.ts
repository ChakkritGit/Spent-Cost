import type { MetadataRoute } from "next";

// Only the sign-in page is public; everything else is one person's ledger behind RLS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/login", "/og.jpg", "/llms.txt"], disallow: "/" },
    sitemap: "https://expenses.chakkritton.com/sitemap.xml",
  };
}
