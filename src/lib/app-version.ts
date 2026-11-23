import packageInfo from "../../package.json";

export type AppVersionInfo = {
  environment: string;
  version: string;
  revision: string;
  shortRevision: string;
  buildId: string;
  builtAt: string;
  label: string;
  deployedEnvironment?: string;
  deployedVersion?: string;
};

const UNKNOWN = "unknown";
const LOCAL_ENVIRONMENT = "local";

let cachedVersionInfo: AppVersionInfo | null = null;

export function getAppVersionInfo() {
  if (cachedVersionInfo) {
    return cachedVersionInfo;
  }

  const deployedEnvironment = readMetadata("APP_ENVIRONMENT");
  const deployedVersion = readMetadata("APP_VERSION");
  const environment = deployedEnvironment || LOCAL_ENVIRONMENT;
  const version = deployedVersion || `v${packageInfo.version}`;
  const revision =
    readMetadata("APP_REVISION") || readMetadata("APP_GIT_SHA") || UNKNOWN;
  const shortRevision = revision === UNKNOWN ? UNKNOWN : revision.slice(0, 12);
  const buildId = readMetadata("APP_BUILD_ID") || UNKNOWN;
  const builtAt = readMetadata("APP_BUILT_AT") || UNKNOWN;

  cachedVersionInfo = {
    deployedEnvironment,
    deployedVersion,
    environment,
    version,
    revision,
    shortRevision,
    buildId,
    builtAt,
    label: formatAppVersionLabel({
      environment,
      version,
      shortRevision,
      buildId,
    }),
  };

  return cachedVersionInfo;
}

export function getAppVersionLabel() {
  return getAppVersionInfo().label;
}

export function resetAppVersionInfoForTests() {
  cachedVersionInfo = null;
}

function readMetadata(name: string) {
  return process.env[name]?.trim() ?? "";
}

function formatAppVersionLabel({
  environment,
  version,
  shortRevision,
  buildId,
}: Pick<
  AppVersionInfo,
  "environment" | "version" | "shortRevision" | "buildId"
>) {
  const parts = [environment, version];

  if (shortRevision !== UNKNOWN) {
    parts.push(shortRevision);
  }

  if (buildId !== UNKNOWN) {
    parts.push(`run ${buildId}`);
  }

  return parts.join(" | ");
}
