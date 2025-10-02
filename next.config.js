/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost', 'hwqdwfwyumbvunbgqcyj.supabase.co'],
  },
};

module.exports = nextConfig;
