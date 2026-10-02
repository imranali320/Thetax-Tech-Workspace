from pydantic import BaseModel


class ChannelOut(BaseModel):
    id: str
    name: str
    type: str
    project_id: str | None
    topic: str
    members: list[str]
    unread: int


class ChannelCreate(BaseModel):
    name: str = ""
    type: str = "channel"
    project_id: str | None = None
    topic: str = ""
    member_ids: list[str]


class MessageOut(BaseModel):
    id: str
    channel_id: str
    sender_id: str | None
    text: str
    at: int
    parent_id: str | None
    edited: bool
    attachments: list[str]
    reactions: dict[str, list[str]]


class MessageCreate(BaseModel):
    text: str = ""
    parent_id: str | None = None
    attachment_file_id: str | None = None


class MessageUpdate(BaseModel):
    text: str


class ReactionToggle(BaseModel):
    emoji: str
