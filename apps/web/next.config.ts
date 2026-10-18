import type { NextConfig } from "next";

// Static export is opt-in (NEXT_OUTPUT=export) so the documented Docker
// workflow (`next build` + `next start`) keeps working unchanged.
const staticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = staticExport
  ? { output: "export", images: { unoptimized: true } }
  : {};

export default nextConfig;
