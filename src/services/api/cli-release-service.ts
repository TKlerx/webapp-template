import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type CliReleaseTarget =
  | "windows-amd64"
  | "windows-arm64"
  | "linux-amd64"
  | "linux-arm64"
  | "darwin-amd64"
  | "darwin-arm64";

export type CliReleaseAsset = {
  target: CliReleaseTarget;
  label: string;
  filename: string;
  size: number;
  available: boolean;
};

const targetDefinitions: Array<
  Omit<CliReleaseAsset, "filename" | "size" | "available"> & {
    goos: string;
    arch: string;
    extension: "zip" | "tar.gz";
  }
> = [
  {
    target: "windows-amd64",
    label: "Windows x64",
    goos: "windows",
    arch: "amd64",
    extension: "zip",
  },
  {
    target: "windows-arm64",
    label: "Windows ARM64",
    goos: "windows",
    arch: "arm64",
    extension: "zip",
  },
  {
    target: "linux-amd64",
    label: "Linux x64",
    goos: "linux",
    arch: "amd64",
    extension: "tar.gz",
  },
  {
    target: "linux-arm64",
    label: "Linux ARM64",
    goos: "linux",
    arch: "arm64",
    extension: "tar.gz",
  },
  {
    target: "darwin-amd64",
    label: "macOS Intel",
    goos: "darwin",
    arch: "amd64",
    extension: "tar.gz",
  },
  {
    target: "darwin-arm64",
    label: "macOS Apple Silicon",
    goos: "darwin",
    arch: "arm64",
    extension: "tar.gz",
  },
];

const cliReleaseTargets = targetDefinitions.map(({ target }) => target);

export function getCliReleasesDir() {
  return process.env.CLI_RELEASES_DIR ?? "data/cli-releases";
}

function isCliReleaseTarget(value: string): value is CliReleaseTarget {
  return cliReleaseTargets.includes(value as CliReleaseTarget);
}

async function findArchive(
  dir: string,
  goos: string,
  arch: string,
  extension: string,
) {
  let entries;
  try {
    entries = await readdir(/*turbopackIgnore: true*/ dir, {
      withFileTypes: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const suffix = `_${goos}_${arch}.${extension}`;
  const checksums = await readCliChecksums();
  const published =
    checksums === null
      ? null
      : new Set(
          checksums.split(/\r?\n/).flatMap((line) => {
            const match = line.match(/^[a-f0-9]{64}\s+\*?(\S+)$/i);
            return match ? [match[1]] : [];
          }),
        );
  return (
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("starterctl_") &&
          entry.name.endsWith(suffix) &&
          (!published || published.has(entry.name)),
      )
      .map((entry) => entry.name)
      .sort()
      .at(-1) ?? null
  );
}

export async function listCliReleaseAssets(): Promise<CliReleaseAsset[]> {
  const dir = getCliReleasesDir();

  return Promise.all(
    targetDefinitions.map(async (definition) => {
      const filename = await findArchive(
        dir,
        definition.goos,
        definition.arch,
        definition.extension,
      );
      if (filename) {
        const fileStat = await stat(
          /*turbopackIgnore: true*/ path.join(
            /*turbopackIgnore: true*/ dir,
            filename,
          ),
        ).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (fileStat?.isFile()) {
          return {
            ...definition,
            filename,
            size: fileStat.size,
            available: true,
          };
        }
      }
      return { ...definition, filename: "", size: 0, available: false };
    }),
  );
}

export async function readCliReleaseAsset(target: string) {
  if (!isCliReleaseTarget(target)) {
    return null;
  }

  const definition = targetDefinitions.find((item) => item.target === target);
  if (!definition) {
    return null;
  }

  const dir = getCliReleasesDir();
  const filename = await findArchive(
    dir,
    definition.goos,
    definition.arch,
    definition.extension,
  );
  if (!filename) {
    return null;
  }

  // The archive name is a single entry returned by readdir.
  const buffer = await readFile(
    /*turbopackIgnore: true*/ path.join(
      /*turbopackIgnore: true*/ dir,
      filename,
    ),
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "EISDIR") return null;
    throw error;
  });
  if (!buffer) return null;
  return {
    ...definition,
    filename,
    buffer,
    contentType:
      definition.extension === "zip" ? "application/zip" : "application/gzip",
  };
}

export async function readCliChecksums() {
  try {
    return await readFile(
      /*turbopackIgnore: true*/ path.join(
        /*turbopackIgnore: true*/ getCliReleasesDir(),
        "checksums.txt",
      ),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
