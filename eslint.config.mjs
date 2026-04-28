import nextVitals from "eslint-config-next/core-web-vitals";
import sonarjs from "eslint-plugin-sonarjs";

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
  {
    plugins: {
      sonarjs,
    },
    rules: {
      complexity: ["warn", { max: 20 }],
      "sonarjs/cognitive-complexity": ["warn", 20],
    },
  },
];

export default config;
