import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ορίζει το web/ ως workspace root -> σταματά το multi-lockfile warning στο Vercel
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
