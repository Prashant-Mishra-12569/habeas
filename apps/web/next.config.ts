import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share images read their fonts and the logo from disk at request time.
  outputFileTracingIncludes: {
    "/**/opengraph-image*": ["./assets/fonts/*.woff", "./public/brand/habeas-mark.png"],
  },
};

export default nextConfig;
