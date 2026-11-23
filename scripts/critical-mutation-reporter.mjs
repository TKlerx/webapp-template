import { writeFileSync } from "node:fs";

export default class CriticalMutationReporter {
  constructor({ outputFile }) {
    this.outputFile = outputFile;
  }

  onTestRunEnd(modules, unhandledErrors, reason) {
    const suiteErrors = modules.flatMap((module) =>
      [module, ...module.children.allSuites()].flatMap((suite) =>
        suite.errors(),
      ),
    );
    const failures = modules.flatMap((module) =>
      Array.from(module.children.allTests("failed"), (test) =>
        test.result().errors.map((error) => error.name),
      ),
    );
    writeFileSync(
      this.outputFile,
      JSON.stringify({
        reason,
        moduleCount: modules.length,
        infrastructureErrorCount: unhandledErrors.length + suiteErrors.length,
        failures,
      }),
    );
  }
}
