import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/teams/service", () => ({ deliverTeamsMessage: vi.fn() }));
import { deliverTeamsMessage } from "@/services/teams/service";
import { POST } from "@/app/api/internal/teams/deliver/route";

describe("internal Teams delivery boundary", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TEAMS_DELIVERY_SHARED_SECRET;
  });
  it("requires its dedicated secret and a job-only body, and never relays provider errors", async () => {
    const secret = "test-delivery-key-32-characters-long";
    const request = (body: object, key = secret) =>
      new Request("http://localhost/api/internal/teams/deliver", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect((await POST(request({ jobId: "job" }))).status).toBe(503);
    process.env.TEAMS_DELIVERY_SHARED_SECRET = secret;
    expect((await POST(request({ jobId: "job" }, "wrong"))).status).toBe(401);
    expect(
      (await POST(request({ jobId: "job", delegatedAccessToken: "forbidden" })))
        .status,
    ).toBe(400);
    expect(deliverTeamsMessage).not.toHaveBeenCalled();
    vi.mocked(deliverTeamsMessage).mockResolvedValue({ id: "graph-1" });
    expect(await (await POST(request({ jobId: "job" }))).json()).toEqual({
      id: "graph-1",
    });
    expect(deliverTeamsMessage).toHaveBeenCalledWith("job");
    vi.mocked(deliverTeamsMessage).mockRejectedValue(
      new Error("secret-provider-body"),
    );
    const failed = await POST(request({ jobId: "job" }));
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("secret-provider-body");
  });
});
