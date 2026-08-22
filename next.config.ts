import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silences a Turbopack warning: it was walking up past this project looking
  // for a monorepo root and finding an unrelated package-lock.json elsewhere
  // on this machine. This project IS the root - nothing else here to detect.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
