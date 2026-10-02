from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Channel, ChannelMember, ChannelRead, Message, MessageReaction, User
from ..db.session import get_db
from ..schemas.chat import ChannelCreate, ChannelOut, MessageCreate, MessageOut, MessageUpdate, ReactionToggle
from .deps import get_current_user

router = APIRouter(tags=["chat"])

MODERATE_ROLES = {"owner", "admin"}


def to_epoch_ms(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)


def member_ids(channel: Channel) -> list[str]:
    return [m.user_id for m in channel.members]


def is_member(db: Session, channel_id: str, user_id: str) -> bool:
    return db.get(ChannelMember, (channel_id, user_id)) is not None


def ensure_general_channel(db: Session) -> Channel:
    ch = db.scalar(select(Channel).where(Channel.type == "channel", Channel.name == "general"))
    if not ch:
        ch = Channel(name="general", type="channel", topic="Company-wide announcements and chat")
        db.add(ch)
        db.flush()
    return ch


def ensure_joined(db: Session, channel: Channel, user_id: str):
    if not is_member(db, channel.id, user_id):
        db.add(ChannelMember(channel_id=channel.id, user_id=user_id))


def message_out(db: Session, m: Message) -> MessageOut:
    reactions: dict[str, list[str]] = defaultdict(list)
    for r in db.scalars(select(MessageReaction).where(MessageReaction.message_id == m.id)):
        reactions[r.emoji].append(r.user_id)
    return MessageOut(
        id=m.id, channel_id=m.channel_id, sender_id=m.sender_id, text=m.text, at=to_epoch_ms(m.at),
        parent_id=m.parent_id, edited=m.edited, attachments=[m.attachment_file_id] if m.attachment_file_id else [],
        reactions=dict(reactions),
    )


@router.get("/channels", response_model=list[ChannelOut])
def list_channels(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    memberships = db.scalars(select(ChannelMember).where(ChannelMember.user_id == user.id)).all()
    if not memberships:
        general = ensure_general_channel(db)
        ensure_joined(db, general, user.id)
        db.commit()
        memberships = db.scalars(select(ChannelMember).where(ChannelMember.user_id == user.id)).all()

    out = []
    for cm in memberships:
        channel = db.get(Channel, cm.channel_id)
        if not channel:
            continue
        read = db.get(ChannelRead, (channel.id, user.id))
        since = read.at if read else datetime(1970, 1, 1)
        unread_count = len(db.scalars(
            select(Message).where(Message.channel_id == channel.id, Message.sender_id != user.id, Message.at > since)
        ).all())
        out.append(ChannelOut(
            id=channel.id, name=channel.name, type=channel.type, project_id=channel.project_id,
            topic=channel.topic, members=member_ids(channel), unread=unread_count,
        ))
    return out


@router.post("/channels", response_model=ChannelOut)
def create_channel(body: ChannelCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    all_members = sorted(set(body.member_ids + [user.id]))

    if body.type == "dm":
        if len(all_members) != 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A direct message needs exactly 2 members")
        candidates = db.scalars(select(Channel).where(Channel.type == "dm")).all()
        for c in candidates:
            if sorted(member_ids(c)) == all_members:
                read = db.get(ChannelRead, (c.id, user.id))
                since = read.at if read else datetime(1970, 1, 1)
                unread_count = len(db.scalars(
                    select(Message).where(Message.channel_id == c.id, Message.sender_id != user.id, Message.at > since)
                ).all())
                return ChannelOut(id=c.id, name=c.name, type=c.type, project_id=c.project_id, topic=c.topic, members=member_ids(c), unread=unread_count)

    channel = Channel(name=body.name, type=body.type, project_id=body.project_id, topic=body.topic)
    db.add(channel)
    db.flush()
    for uid in all_members:
        db.add(ChannelMember(channel_id=channel.id, user_id=uid))
    db.commit()
    db.refresh(channel)
    return ChannelOut(id=channel.id, name=channel.name, type=channel.type, project_id=channel.project_id, topic=channel.topic, members=all_members, unread=0)


@router.get("/channels/{channel_id}/messages", response_model=list[MessageOut])
def list_messages(channel_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_member(db, channel_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this channel")
    msgs = db.scalars(select(Message).where(Message.channel_id == channel_id).order_by(Message.at)).all()
    return [message_out(db, m) for m in msgs]


@router.post("/channels/{channel_id}/messages", response_model=MessageOut)
def send_message(channel_id: str, body: MessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_member(db, channel_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this channel")
    if not body.text.strip() and not body.attachment_file_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message needs text or an attachment")
    m = Message(channel_id=channel_id, sender_id=user.id, text=body.text, parent_id=body.parent_id, attachment_file_id=body.attachment_file_id)
    db.add(m)
    read = db.get(ChannelRead, (channel_id, user.id))
    now = datetime.utcnow()
    if read:
        read.at = now
    else:
        db.add(ChannelRead(channel_id=channel_id, user_id=user.id, at=now))
    db.commit()
    db.refresh(m)
    return message_out(db, m)


@router.post("/channels/{channel_id}/read")
def mark_read(channel_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_member(db, channel_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this channel")
    read = db.get(ChannelRead, (channel_id, user.id))
    now = datetime.utcnow()
    if read:
        read.at = now
    else:
        db.add(ChannelRead(channel_id=channel_id, user_id=user.id, at=now))
    db.commit()
    return {"ok": True}


@router.patch("/messages/{message_id}", response_model=MessageOut)
def edit_message(message_id: str, body: MessageUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Message, message_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if m.sender_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own messages")
    m.text = body.text
    m.edited = True
    db.commit()
    db.refresh(m)
    return message_out(db, m)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(message_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Message, message_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if m.sender_id != user.id and user.role not in MODERATE_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to delete this message")
    db.query(Message).filter(Message.parent_id == message_id).delete()
    db.delete(m)
    db.commit()


@router.post("/messages/{message_id}/reactions", response_model=MessageOut)
def toggle_reaction(message_id: str, body: ReactionToggle, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.get(Message, message_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    if not is_member(db, m.channel_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this channel")
    existing = db.scalar(select(MessageReaction).where(
        MessageReaction.message_id == message_id, MessageReaction.emoji == body.emoji, MessageReaction.user_id == user.id
    ))
    if existing:
        db.delete(existing)
    else:
        db.add(MessageReaction(message_id=message_id, emoji=body.emoji, user_id=user.id))
    db.commit()
    return message_out(db, m)


@router.get("/messages/search", response_model=list[MessageOut])
def search_messages(q: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if len(q.strip()) < 2:
        return []
    my_channel_ids = [cm.channel_id for cm in db.scalars(select(ChannelMember).where(ChannelMember.user_id == user.id)).all()]
    msgs = db.scalars(
        select(Message).where(Message.channel_id.in_(my_channel_ids), Message.text.ilike(f"%{q}%")).order_by(Message.at.desc()).limit(30)
    ).all()
    return [message_out(db, m) for m in msgs]
