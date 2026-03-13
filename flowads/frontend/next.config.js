/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [],
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://backend:4000/:path*',
      },
    ]
  },
}

module.exports = nextConfig
