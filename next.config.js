/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'nft-cdn.alchemy.com',
      'cloudflare-ipfs.com',
      'ipfs.io',
      'i.seadn.io',
      'metadata.goonzworld.com'
    ],
    // Support for SVG files in Images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.alchemy.com',
      },
      {
        protocol: 'https',
        hostname: '**.seadn.io',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflare-ipfs.com',
      },
      {
        protocol: 'https',
        hostname: '**.ipfs.io',
      },
    ],
  },
  async headers() {
    return [
      {
        // This applies to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept',
          },
        ],
      },
    ];
  },
  output: 'standalone',
};

module.exports = nextConfig; 