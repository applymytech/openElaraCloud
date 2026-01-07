/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Output as static export for Firebase Hosting
  output: 'export',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'OpenElara Cloud',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  
  // Turbopack config (Next.js 16+)
  turbopack: {},
};

module.exports = nextConfig;
