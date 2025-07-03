/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Configure image domains for Next.js
    domains: [
      "localhost",
      "skribble-public-monorepo-backend-production.up.railway.app", // Update this!
      "api.dicebear.com",
      // Add your S3 bucket domain
      "skribble-files-2.s3.eu-north-1.amazonaws.com",
    ],
    remotePatterns: [
      // Local development
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
      // Railway backend (replace with your actual Railway backend URL)
      {
        protocol: "https",
        hostname: "skribble-public-monorepo-backend-production.up.railway.app", // Update this!
        pathname: "/uploads/**",
      },
      // Profile images
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      // S3 bucket for user profile images and audio files
      {
        protocol: "https",
        hostname: "skribble-files-2.s3.eu-north-1.amazonaws.com",
        pathname: "/**",
      },
      // Generic pattern for any S3 bucket (for flexibility)
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
        pathname: "/**",
      },
      // CloudFront distributions (if you add CDN later)
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
    ],
    // Optimize external images but with shorter cache for signed URLs
    minimumCacheTTL: 60, // Cache for 1 minute (shorter than your signed URL expiry)
  },
  eslint: {
    dirs: ["src"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
