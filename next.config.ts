import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function nextConfig(phase: string): NextConfig {
  return {
    reactStrictMode: true,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
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
