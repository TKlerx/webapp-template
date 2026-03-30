import { execFileSync } from "node:child_process";
import packageInfo from "../../package.json";

let cachedVersionLabel: string | null = null;

function getShortGitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function getAppVersionLabel() {
  if (cachedVersionLabel) {
    return cachedVersionLabel;
  }

  const baseVersion = `v${packageInfo.version}`;
  const configuredHash = process.env.APP_GIT_SHA?.trim();

  if (process.env.NODE_ENV !== "production") {
    const gitHash = configuredHash || getShortGitHash();
    cachedVersionLabel = gitHash ? `${baseVersion}+${gitHash}-dev` : `${baseVersion}-dev`;
    return cachedVersionLabel;
  }

  cachedVersionLabel = configuredHash ? `${baseVersion}+${configuredHash}` : baseVersion;
  return cachedVersionLabel;
}
