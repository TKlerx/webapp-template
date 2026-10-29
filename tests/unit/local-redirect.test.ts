import { expect, it } from "vitest";
import { safeLocalRedirectPath } from "@/lib/local-redirect";

it("keeps application paths local and rejects URL-normalization ambiguities", () => {
  for (const value of ["/", "/dashboard", "/settings?tab=profile#details"]) {
    expect(safeLocalRedirectPath(value)).toBe(value);
    expect(new URL(value, "https://app.example.com").origin).toBe(
      "https://app.example.com",
    );
  }
  for (const value of [
    null,
    undefined,
    "",
    "dashboard",
    "https://example.com",
    "//example.com",
    "/path\\child",
    "/\t/invalid",
    "/\r/invalid",
    "/\n/invalid",
  ]) {
    expect(safeLocalRedirectPath(value)).toBeNull();
  }
});
