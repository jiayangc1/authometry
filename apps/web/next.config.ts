import type { NextConfig } from "next";

const apiOrigin = process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  reactStrictMode: true,
  transpilePackages: ["@authometry/domain", "@authometry/ui"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/oauth/:path*", destination: `${apiOrigin}/oauth/:path*` },
      { source: "/.well-known/:path*", destination: `${apiOrigin}/.well-known/:path*` },
      { source: "/w/:path*", destination: `${apiOrigin}/w/:path*` },
      { source: "/development/:path*", destination: `${apiOrigin}/development/:path*` },
      { source: "/staging/:path*", destination: `${apiOrigin}/staging/:path*` },
    ];
  },
};

export default nextConfig;
