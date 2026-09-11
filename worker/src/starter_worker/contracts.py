from pydantic import BaseModel, ConfigDict, Field


class NotificationDeliveryPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    notificationId: str = Field(min_length=1)
    recipientEmail: str = Field(min_length=1)
    recipientName: str = Field(min_length=1)
    subject: str
    bodyText: str
    bodyHtml: str | None = None


class TeamsMessageDeliveryPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    teamsOutboundMessageId: str = Field(min_length=1)
    teamId: str = Field(min_length=1)
    channelId: str = Field(min_length=1)
    content: str
    contentType: str = "html"
