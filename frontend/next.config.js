const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Monorepo: garante que o tracing do build standalone inclua os
  // node_modules hoisted na raiz do workspace (ver Dockerfile).
  outputFileTracingRoot: path.join(__dirname, ".."),
};

module.exports = nextConfig;
