
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Friendships(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    
    # 친구 신청한 사람 (Requester)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 친구 신청 받은 사람 
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 상태 ('PENDING', 'ACCEPTED')
    # 차단한 경우는 제외. 복잡함. 
    status = Column(String(20), default="PENDING", nullable=False)

    # 생성 시간
    created_at = Column(DateTime(timezone=True), server_default= func.now())

    # 관계 설정 : 같은 users 테이블을 2번 참조하기 때문에, foreign_keys 옵션 명시 - 누가 신청자이고, 수신자인지 구분
    requester = relationship("Users", foreign_keys=[requester_id], back_populates="sent_friend_requests")
    receiver = relationship("Users", foreign_keys=[receiver_id], back_populates="received_friend_requests")

class Alerts(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key = True, index=True)

    receiver_id = Column(Integer, ForeignKey("users.id"),nullable=False)
    sender_id = Column(Integer,ForeignKey("users.id"),nullable=False)

    alerts_type = Column(String(20),default="NUDGE")

    # 서버에 저장돼 있는 고정된 멘트 중 랜덤 발송
    message = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계 설정

    receiver = relationship("Users", foreign_keys=[receiver_id], back_populates="received_alerts")
    sender = relationship("Users", foreign_keys=[sender_id], back_populates="sent_alerts")