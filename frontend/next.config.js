/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        port: "5000",
        pathname: "/images/**",
      },
    ],
    domains: ["localhost", "api.dicebear.com"], // ✅ Combined into one array
  },
  eslint: {
    dirs: ["src"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
