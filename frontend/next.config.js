const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Monorepo: garante que o tracing do build standalone inclua os
    // node_modules hoisted na raiz do workspace (ver Dockerfile). Em
    // Next 15+ isso vira top-level estável — mover na hora do upgrade.
    outputFileTracingRoot: path.join(__dirname, ".."),
  },
};

module.exports = nextConfig;
