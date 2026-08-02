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
  // Include ffmpeg binary in serverless traces (Whisper needs MP3 extract from phone video)
  outputFileTracingIncludes: {
    '/*': ['./node_modules/ffmpeg-static/**/*'],
  },
  experimental: {
    serverActions: {
      // Walkthrough video uploads can be large (phone camera clips)
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
