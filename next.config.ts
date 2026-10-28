import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.7"],
  // sharp uses native binaries; @react-pdf/renderer uses yoga-wasm — both must not be bundled by webpack
  serverExternalPackages: ["sharp", "@react-pdf/renderer"],
  // sharp's native libvips .so files (loaded via dlopen, not require()) aren't reliably
  // picked up by Next.js's file tracer for a dynamically-imported package — force-include
  // them so the serverless function actually has them at runtime (was failing with
  // ERR_DLOPEN_FAILED: libvips-cpp.so.*: cannot open shared object file).
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/sharp/**/*",
      "node_modules/@img/**/*",
      // lib/pdf/fondateur-report.tsx reads this via fs.readFileSync(path.join(process.cwd(), ...))
      // at runtime — a dynamically-built path the file tracer can't follow statically.
      "public/logoodcavdes.png",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // unsafe-eval requis par html5-qrcode (scanner QR) et certains modules Supabase
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;