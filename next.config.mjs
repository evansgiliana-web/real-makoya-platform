/** @type {import('next').NextConfig} */
import { SpeedInsights } from "@vercel/speed-insights/next"
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
