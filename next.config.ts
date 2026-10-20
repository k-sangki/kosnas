import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // www는 kosnas.com 같은 경로로 영구 이동시킨다
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.kosnas\\.com" }],
        destination: "https://kosnas.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
