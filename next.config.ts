import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for Docker (self-contained server + correct static serving).
  // Enabled only when DOCKER_BUILD=1 so local Windows builds don't hit the
  // symlink permission error that `output:'standalone'` triggers on Windows.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
