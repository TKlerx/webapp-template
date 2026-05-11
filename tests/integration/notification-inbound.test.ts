import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { processInboundEmailRecord } from "@/services/notifications/inbound";

describe("notification inbound processing", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("marks bounced notifications when an inbound bounce references a notification", async () => {
    const inbound = {
      id: "inbound-1",
      subject:
        "Undeliverable: Your role has changed [notification:notification-1]",
      bodyPreview: "Delivery failed",
      bodyText:
        "Delivery failed for Notification reference: [notification:notification-1]",
      bodyHtml: null,
      inReplyTo: null,
      referenceIds: "[]",
      senderEmail: "postmaster@example.com",
    };

    const result = await processInboundEmailRecord(inbound);

    expect(result).toMatchObject({
      processingStatus: "PROCESSED",
      correlatedNotificationId: "notification-1",
    });
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: {
        status: "BOUNCED",
        lastError: "Bounce/NDR received for inbound email inbound-1",
      },
    });
    expect(prismaMock.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "inbound-1" },
      data: expect.objectContaining({
        processingStatus: "PROCESSED",
        correlatedNotificationId: "notification-1",
      }),
    });
  });

  it("links entity references when no bounce correlation is present", async () => {
    const inbound = {
      id: "inbound-2",
      subject: "Question about [ref:Scope:scope-7]",
      bodyPreview: "",
      bodyText: "Following up on [ref:Scope:scope-7]",
      bodyHtml: null,
      inReplyTo: null,
      referenceIds: "[]",
      senderEmail: "person@example.com",
    };

    const result = await processInboundEmailRecord(inbound);

    expect(result).toMatchObject({
      processingStatus: "PROCESSED",
      linkedEntityType: "Scope",
      linkedEntityId: "scope-7",
    });
    expect(prismaMock.inboundEmail.update).toHaveBeenCalledWith({
      where: { id: "inbound-2" },
      data: {
        processingStatus: "PROCESSED",
        processingNotes: "Entity reference marker detected.",
        linkedEntityType: "Scope",
        linkedEntityId: "scope-7",
      },
    });
  });
});
