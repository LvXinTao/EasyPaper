import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // CLI entry point is CommonJS, not TypeScript
    "bin/**",
    // Tauri package scripts are CommonJS Node.js scripts
    "tauri-package-scripts/**",
    // Generated sidecar output (Next.js standalone build)
    "sidecar-dist/**",
    // Tauri Rust build artifacts
    "src-tauri/target/**",
    // Vendored minified files
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
