import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "test-results/**",
      "playwright-report/**",
      "generated/**",
      ".agents/**",
      "**/*.min.js",
    ],
  },
  ...nextVitals,
];

export default config;
