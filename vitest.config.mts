import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" throws unless resolved under the "react-server" export
      // condition, which only Next's own build sets. Point it at its own
      // no-op sibling so lib/data.ts can be unit-tested outside Next.
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
