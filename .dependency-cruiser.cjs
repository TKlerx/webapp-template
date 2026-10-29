module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular runtime dependencies make route and service changes harder to reason about.",
      from: {},
      to: {
        circular: true,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-server-to-ui",
      severity: "error",
      from: { path: "^src/(lib|services)/" },
      to: { path: "^src/(app|components)/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-components-to-services",
      severity: "error",
      from: { path: "^src/components/" },
      to: { path: "^src/services/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-ui-to-database",
      severity: "error",
      from: { path: "^src/components/" },
      to: {
        path: "^src/lib/db\\.ts$|^generated/prisma/(client\\.ts$|internal/)|^node_modules/@prisma/client",
        dependencyTypesNot: ["type-only"],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "^(node_modules|generated)/",
    },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"],
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
  },
};
