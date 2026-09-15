/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/aggregation-layers",
    "@deck.gl/react",
    "@deck.gl/mapbox",
  ],
};

export default nextConfig;
