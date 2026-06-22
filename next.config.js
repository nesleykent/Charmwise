/** @type {import('next').NextConfig} */
// GitHub Pages serves project sites from /<repo-name>/, so the base path must
// be injected at build time (see .github/workflows/deploy.yml). Locally it is
// empty so `next dev` keeps working at the domain root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
