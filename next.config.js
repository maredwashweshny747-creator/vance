/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'images.unsplash.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'api.qrserver.com',
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  eslint: {
    // Warnings never block production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors are caught in dev — never block CI/CD
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
