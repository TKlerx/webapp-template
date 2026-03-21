const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const envDefault = path.join(root, ".env");

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envDefault)) {
  dotenv.config({ path: envDefault });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/prisma-run.js <prisma args>");
  process.exit(1);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(npxCommand, ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 0);
