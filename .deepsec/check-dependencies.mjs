import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(
  realpathSync(new URL("./node_modules/deepsec/package.json", import.meta.url)),
);
const { Sandbox } = require("@vercel/sandbox");
for (const method of ["create", "get"]) {
  assert.equal(typeof Sandbox[method], "function");
}
for (const method of ["runCommand", "writeFiles", "stop"]) {
  assert.equal(typeof Sandbox.prototype[method], "function");
}
const { InjectionRuleValidator } = require(
  path.join(
    path.dirname(require.resolve("@vercel/sandbox")),
    "api-client/validators.cjs",
  ),
);
assert.equal(
  InjectionRuleValidator.safeParse({
    domain: "api.example.com",
    headers: { "X-Request-Id": "smoke" },
  }).success,
  true,
);
assert.equal(
  InjectionRuleValidator.safeParse({
    domain: "api.example.com",
    headers: { "X-Request-Id": 123 },
  }).success,
  false,
);
console.log("PASS: DeepSec sandbox API and Zod header validation remain compatible.");
