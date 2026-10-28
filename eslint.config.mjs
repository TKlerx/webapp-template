import nextVitals from "eslint-config-next/core-web-vitals";
import sonarjs from "eslint-plugin-sonarjs";

const thresholdSeverity =
  process.env.QUALITY_THRESHOLDS_BYPASS === "1" ? "warn" : "error";
const maxCyclomaticComplexity = 56;
const maxCognitiveComplexity = 24;
const maxFunctionLines = 520;

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".artifacts/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "test-results/**",
      "playwright-report/**",
      "generated/**",
      "security-analysis/**",
      "public/vendor/**",
      ".agents/**",
      ".worktrees/**",
      ".claude/**",
      "**/*.min.js",
    ],
  },
  ...nextVitals,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
    },
  },
  {
    files: ["src/app/api/**/*.ts", "src/services/api/**/*.ts"],
    rules: {
      // ponytail: enforce shared body parsers in API routes/services; full taint analysis needs a dedicated analyzer.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][arguments.length=0]:matches([callee.property.name=/^(json|text|formData|arrayBuffer|blob|bytes)$/], [callee.property.value=/^(json|text|formData|arrayBuffer|blob|bytes)$/])",
          message:
            "Use parseJsonBody or parseFormBody from @/lib/validation to validate request bodies before use.",
        },
      ],
    },
  },
  {
    plugins: {
      sonarjs,
    },
    rules: {
      complexity: [thresholdSeverity, { max: maxCyclomaticComplexity }],
      "max-lines-per-function": [
        thresholdSeverity,
        {
          max: maxFunctionLines,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      "sonarjs/cognitive-complexity": [
        thresholdSeverity,
        maxCognitiveComplexity,
      ],
    },
  },
];

export default config;
