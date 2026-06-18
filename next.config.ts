import type { NextConfig } from "next";

// restart trigger
const nextConfig: NextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  },
  serverExternalPackages: ['@anthropic-ai/sdk', '@mediapipe/tasks-vision'],
};

export default nextConfig;
