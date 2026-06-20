import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // `/` serves the animated landing page (static, in public/); the studio lives at /app behind
      // the Google auth gate. beforeFiles so it intercepts the root before the app router.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
