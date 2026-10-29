export type TeamsMessageContentType = "text" | "html";

export type TeamsMessageInput = {
  teamId: string;
  channelId: string;
  content: string;
  contentType?: TeamsMessageContentType;
};

export type TeamsChannelMessage = {
  id: string;
  teamId: string;
  channelId: string;
  content: string;
  contentType: TeamsMessageContentType;
  createdAt: string | null;
  senderDisplayName: string | null;
  senderUserId: string | null;
};

export type TeamsMessageListInput = {
  teamId: string;
  channelId: string;
  top?: number;
};

export type TeamsMessagePageInput = {
  teamId: string;
  channelId: string;
  nextLink?: string | null;
  top?: number;
};

export type TeamsMessagePageResult = {
  messages: TeamsChannelMessage[];
  nextLink: string | null;
};

export interface TeamsClient {
  sendChannelMessage(
    input: TeamsMessageInput,
  ): Promise<{ messageId: string | null }>;
  listChannelMessages(
    input: TeamsMessageListInput,
  ): Promise<TeamsChannelMessage[]>;
  getChannelMessagesPage(
    input: TeamsMessagePageInput,
  ): Promise<TeamsMessagePageResult>;
}
