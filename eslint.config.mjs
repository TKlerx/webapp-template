import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "generated/**",
      "**/*.min.js",
    ],
  },
  ...nextVitals,
];

export default config;
