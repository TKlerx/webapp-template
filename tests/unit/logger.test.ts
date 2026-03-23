import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive values", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const testLogger = createLogger({ level: "info", baseMeta: { component: "test" } });

    testLogger.info("user.login", {
      authorization: "Bearer secret-token",
      nested: {
        password: "super-secret",
      },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = String(infoSpy.mock.calls[0][0]);
    expect(payload).toContain("\"authorization\":\"[REDACTED]\"");
    expect(payload).toContain("\"password\":\"[REDACTED]\"");
  });

  it("filters logs below the configured level", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const testLogger = createLogger({ level: "warn" });

    testLogger.debug("debug.message");
    testLogger.warn("warn.message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
