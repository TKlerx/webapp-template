import nextVitals from "eslint-config-next/core-web-vitals";
import sonarjs from "eslint-plugin-sonarjs";

const thresholdSeverity =
  process.env.QUALITY_THRESHOLDS_BYPASS === "1" ? "warn" : "error";
const maxCyclomaticComplexity = 56;
const maxCognitiveComplexity = 24;

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
      ".claude/**",
      "**/*.min.js",
    ],
  },
  ...nextVitals,
  {
    plugins: {
      sonarjs,
    },
    rules: {
      complexity: [thresholdSeverity, { max: maxCyclomaticComplexity }],
      "sonarjs/cognitive-complexity": [
        thresholdSeverity,
        maxCognitiveComplexity,
      ],
    },
  },
];

export default config;
