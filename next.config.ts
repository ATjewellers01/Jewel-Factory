import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    reactStrictMode: true,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
    // Skip the production build's own type-check/lint pass (2026-08-18) — this
    // is the slowest step of `docker build` on the small EC2 instance (5-10+
    // min), and it's redundant: CI/local dev already runs `tsc --noEmit` +
    // lint before anything is pushed to master. Does NOT disable typechecking
    // in the editor or `pnpm typecheck`/`pnpm lint` — only the build step.
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
    api: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'res.cloudinary.com' },
        { protocol: 'https', hostname: '*.cloudfront.net' },
        { protocol: 'https', hostname: '*.s3.ap-south-1.amazonaws.com' },
        { protocol: 'https', hostname: 'images.unsplash.com' },
      ],
    },
  };
}
