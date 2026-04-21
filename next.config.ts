import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The platform's entire control plane lives in markdown + YAML files at
  // the repo root. Next.js's build tracer needs an explicit list so those
  // files are bundled into the deployed function runtime (Firebase App
  // Hosting, Vercel, Cloud Run — all use Next's tracer output).
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./handbook/**/*",
      "./blueprints/**/*",
      "./platform/**/*",
    ],
    "/skills/**/*": [
      "./handbook/**/*",
      "./blueprints/**/*",
      "./platform/**/*",
    ],
    "/platform/**/*": ["./platform/**/*"],
    "/audit/**/*": ["./platform/**/*"],
    "/connectors/**/*": ["./platform/**/*"],
  },
};

export default nextConfig;
