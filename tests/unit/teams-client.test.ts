import { describe, expect, it, vi } from "vitest";
import { createGraphTeamsClient } from "@/lib/teams/client";

describe("teams client", () => {
  it("sends a channel message and returns id", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "graph-message-1" }), {
        status: 201,
      }),
    );

    const client = createGraphTeamsClient({
      delegatedAccessToken: "delegated-token",
      clientId: "cid",
      clientSecret: "secret",
      tenantId: "tenant",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sendChannelMessage({
      teamId: "team-1",
      channelId: "channel-1",
      content: "Hello team",
    });

    expect(result.messageId).toBe("graph-message-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/messages"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer delegated-token",
        }),
      }),
    );
  });

  it("throws for graph 4xx/5xx", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }));

    const client = createGraphTeamsClient({
      delegatedAccessToken: "delegated-token",
      clientId: "cid",
      clientSecret: "secret",
      tenantId: "tenant",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.sendChannelMessage({
        teamId: "team-1",
        channelId: "channel-1",
        content: "Hello team",
      }),
    ).rejects.toThrow(/Graph Teams request failed: 403/);
  });

  it("has no reply/update/delete methods (FR-011)", () => {
    const client = createGraphTeamsClient({
      clientId: "cid",
      clientSecret: "secret",
      tenantId: "tenant",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    }) as unknown as Record<string, unknown>;

    expect(client.sendChannelMessage).toBeTypeOf("function");
    expect(client.listChannelMessages).toBeTypeOf("function");
    expect(client.getChannelMessagesPage).toBeTypeOf("function");
    expect(client.replyMessage).toBeUndefined();
    expect(client.updateMessage).toBeUndefined();
    expect(client.deleteMessage).toBeUndefined();
  });

  it("fails closed for sending without consent while intake uses application credentials", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ access_token: "app-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(Response.json({ value: [] }));
    const client = createGraphTeamsClient({
      clientId: "cid",
      clientSecret: "secret",
      tenantId: "tenant",
      fetchImpl,
    });
    await expect(
      client.sendChannelMessage({ teamId: "t", channelId: "c", content: "hi" }),
    ).rejects.toThrow(/consent/);
    expect(fetchImpl).not.toHaveBeenCalled();
    await client.listChannelMessages({ teamId: "t", channelId: "c" });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining("/messages?"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer app-token" }),
      }),
    );
  });

  it("uses the supported channel listing and refuses paging outside the approved channel", async () => {
    const nextLink =
      "https://graph.microsoft.com/v1.0/teams/t/channels/c/messages?$skiptoken=next";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ access_token: "app-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        Response.json({ value: [{ id: "one" }], "@odata.nextLink": nextLink }),
      )
      .mockResolvedValueOnce(Response.json({ value: [{ id: "two" }] }));
    const client = createGraphTeamsClient({
      clientId: "cid",
      clientSecret: "secret",
      tenantId: "tenant",
      fetchImpl,
    });
    const page = await client.getChannelMessagesPage({
      teamId: "t",
      channelId: "c",
    });
    expect(page.nextLink).toBe(nextLink);
    expect(fetchImpl.mock.calls[1][0]).toBe(
      "https://graph.microsoft.com/v1.0/teams/t/channels/c/messages?$top=25",
    );
    const second = await client.getChannelMessagesPage({
      teamId: "t",
      channelId: "c",
      nextLink,
    });
    expect(second.messages[0].id).toBe("two");
    expect(second.nextLink).toBeNull();
    for (const unsafe of [
      nextLink.replace("graph.microsoft.com", "evil.example"),
      nextLink.replace("/channels/c/", "/channels/other/"),
    ]) {
      await expect(
        client.getChannelMessagesPage({
          teamId: "t",
          channelId: "c",
          nextLink: unsafe,
        }),
      ).rejects.toThrow(/approved channel/);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
