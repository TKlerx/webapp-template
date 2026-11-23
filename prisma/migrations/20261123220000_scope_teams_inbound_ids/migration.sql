DROP INDEX "TeamsInboundMessage_providerMessageId_key";

CREATE UNIQUE INDEX "teams_inbound_channel_message_key"
ON "TeamsInboundMessage" ("teamId", "channelId", "providerMessageId");
