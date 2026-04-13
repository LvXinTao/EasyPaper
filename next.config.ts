import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["mupdf", "pdfjs-dist", "react-pdf", "better-sqlite3"],
};

export default nextConfig;
