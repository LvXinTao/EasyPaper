import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mupdf", "pdfjs-dist", "react-pdf"],
};

export default nextConfig;
