import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mupdf", "pdfjs-dist", "react-pdf", "better-sqlite3"],
};

export default nextConfig;
