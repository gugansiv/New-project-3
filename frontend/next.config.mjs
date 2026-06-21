/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output is used for Docker self-hosting (DOCKER=true env var set in Dockerfile)
  // Vercel manages its own build so we omit standalone there
  ...(process.env.DOCKER === 'true' ? { output: 'standalone' } : {}),
};

export default nextConfig;
