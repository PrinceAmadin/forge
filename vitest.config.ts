import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests only — pure functions, no DOM, no database. Integration coverage
// for the ranking SQL lives in supabase/tests and runs against a local stack.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
});
