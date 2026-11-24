import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Flat config. `next lint` is deprecated in Next 15.5, so package.json runs
// `eslint .` directly; FlatCompat bridges eslint-config-next's eslintrc shareable
// configs into the flat format.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.tsbuildinfo",
      "public/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Server actions legitimately return `{ ok, error }` unions that callers
      // narrow; the default rule flags the discarded branch as unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
