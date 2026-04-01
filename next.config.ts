import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mupdf", "pdfjs-dist", "react-pdf"],
};

export default nextConfig;
