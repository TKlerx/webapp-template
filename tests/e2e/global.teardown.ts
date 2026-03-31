export default async function globalTeardown() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./e2e.db";
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const databasePath = databaseUrl.replace(/^file:/, "");
  const fs = await import("node:fs");
  if (databasePath && fs.existsSync(databasePath)) {
    try {
      fs.rmSync(databasePath, { force: true });
    } catch {
      // Windows can briefly keep SQLite files locked while the app server shuts down.
    }
  }
}
