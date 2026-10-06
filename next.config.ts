import type { NextConfig } from "next";

const isExport = process.env.OUTPUT_EXPORT === 'true' || process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: isExport ? 'export' : 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
