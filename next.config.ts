import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  serverExternalPackages: ['ffmpeg-static'],
  // Only AI walkthrough routes need the ffmpeg binary in the serverless trace
  outputFileTracingIncludes: {
    '/api/ai/walkthrough': ['./node_modules/ffmpeg-static/**/*'],
    '/api/ai/walkthrough-transcribe': ['./node_modules/ffmpeg-static/**/*'],
  },
  experimental: {
    serverActions: {
      // Media uploads go browser→Supabase direct; keep actions small
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
