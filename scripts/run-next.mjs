import "dotenv/config";
import { spawn } from "node:child_process";

const command = process.argv[2];

if (!command || !["dev", "start"].includes(command)) {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

const port = process.env.PORT ?? "3270";
const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", command, "--port", port],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
