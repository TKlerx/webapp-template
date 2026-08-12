import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const basePath = normalizeBasePath(process.env.BASE_PATH ?? "");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "node_modules/.pnpm/@prisma+adapter-better-sqlite3@*/**/*",
      "node_modules/.pnpm/better-sqlite3@*/**/*",
      "node_modules/@prisma/adapter-better-sqlite3/**/*",
      "node_modules/better-sqlite3/**/*",
    ],
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default withNextIntl(nextConfig);

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}
