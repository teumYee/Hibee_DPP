
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Characters(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), nullable=False)
    image_url = Column(Text,nullable=True)
    description = Column(Text, nullable=True)
    species = Column(String(50), nullable=True, default="dolphin")
    unlock_type = Column(String(50),nullable= True)

    # 해금 조건 값
    unlock_value = Column(Integer,default=0)

    # 관계 설정 : 유저가 보유한 캐릭터 목록과 연결
    owners = relationship("UserCharacters", back_populates="character")

class UserCharacters(Base):
    __tablename__ = "user_characters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    character_id = Column(Integer, ForeignKey("characters.id"))
    display_name = Column(String(50), nullable=True)
    source_type = Column(String(50), nullable=True)
    source_key = Column(String(100), nullable=True)
    source_date = Column(Date, nullable=True)
    source_payload = Column(JSON, nullable=True)
    rarity = Column(String(20), nullable=False, default="common")
    is_special = Column(Boolean, nullable=False, default=False)
    room_slot = Column(Integer, nullable=True)
    room_position = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")

    acquired_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계 설정 : 유저와 캐릭터 양쪽에서 접근 가능하도록
    user = relationship("Users",back_populates = "user_characters")
    character = relationship("Characters", back_populates="owners")

    equipped_items = relationship("UserItems", back_populates="equipped_to")
    acquisition_logs = relationship(
        "CharacterAcquisitionLogs",
        back_populates="user_character",
        cascade="all, delete-orphan",
    )

class Achievements(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(100), nullable = True)
    description = Column(String(255), nullable=True)

    icon_url = Column(Text, nullable=True)
    # 관계 설정
    achievers = relationship("UserAchievements", back_populates="achievement")

class UserAchievements(Base):
    __tablename__ = "user_achievements"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer,ForeignKey("users.id"), nullable=False)

    achievement_id = Column(Integer, ForeignKey("achievements.id"))

    achieved_at = Column(DateTime(timezone=True),server_default=func.now())

    # 관계 설정
    user = relationship("Users", back_populates="user_achievements")
    achievement = relationship("Achievements", back_populates="achievers")


class Items(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    description = Column(Text,nullable=True)
    coin = Column(Integer, nullable=False, default=0)
    item_type = Column(String(50), nullable=True)  # 예: 'consumable', 'equipment'
    slot_type = Column(String(50), nullable=True)
    image_url = Column(Text, nullable=True)

    owners = relationship("UserItems", back_populates="item")

class UserItems(Base):
    __tablename__ = "user_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)

    # 이 아이템을 어떤 '보유 캐릭터'에게 입혔는지 연결
    user_character_id = Column(Integer, ForeignKey("user_characters.id"), nullable=True)

    purchased_at = Column(DateTime(timezone=True), server_default=func.now())

    # 현재 착용 중인지 여부
    is_equipped = Column(Boolean, default=False)
    equipped_slot = Column(String(50), nullable=True)

    user = relationship("Users", back_populates="user_items")
    item = relationship("Items", back_populates="owners")

    equipped_to = relationship("UserCharacters", back_populates="equipped_items")


class CharacterAcquisitionLogs(Base):
    __tablename__ = "character_acquisition_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "grant_type", "grant_key", name="uq_character_acquisition_user_grant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_character_id = Column(Integer, ForeignKey("user_characters.id"), nullable=False)
    grant_type = Column(String(50), nullable=False)
    grant_key = Column(String(100), nullable=False)
    grant_date = Column(Date, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_character = relationship("UserCharacters", back_populates="acquisition_logs")


