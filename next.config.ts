import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  },
  serverExternalPackages: ['@anthropic-ai/sdk', '@mediapipe/tasks-vision'],
};

export default nextConfig;
