from sqlalchemy import Column, Integer, String, Text, ForeignKey, VARCHAR, TIMESTAMP
from app.core.database import Base
from sqlalchemy.orm import relationship
class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    profile_image = Column(Text, nullable=True)
    nickname = Column(String,unique=True, index=True)
    email = Column(String, unique=True, index=True)
    target_time = Column(Integer, nullable=True)
    current_xp = Column(Integer, nullable=True)
    equipped_character = Column(String(100), nullable=True)
    coin = Column(Integer, default=0)
    Night_time = Column(Integer, default=False)
    night_mode_start = Column(String, default="23:00")
    night_mode_end = Column(String, default="07:00")
    
    # created_at = Column(DateTime, default=datetime.now())
    # updated_at = Column(DateTime, default=datetime.now())

    # 내가 보유한 캐릭터들
    user_characters = relationship("UserCharacters", back_populates="user")

    # 내가 달성한 업적들 
    user_achievements = relationship("UserAchievements", back_populates="user")

    # 내가 참여한 챌린지 기록들
    challenge_instances = relationship("ChallengeInstances", back_populates="user")

    # 소셜 
    # 내가 보낸 신청들
    sent_friend_requests = relationship("Friendships", foreign_keys="Friendships.requester_id", back_populates="requester")
    # 내가 받은 신청들
    received_friend_requests = relationship("Friendships", foreign_keys="Friendships.receiver_id", back_populates="receiver")
    # 내가 보낸 독촉
    sent_alerts = relationship("Alerts", foreign_keys="Alerts.sender_id", back_populates="sender")
    # 내가 받은 독촉
    received_alerts = relationship("Alerts", foreign_keys="Alerts.receiver_id", back_populates="receiver")


    # 추천 기록
    recommendations = relationship("Recommendactions", back_populates="user")
    # 스마트폰 사용 기록
    usage_logs = relationship("UsageLog", back_populates="user")
    # 캘린더 이벤트 기록
    calendar_events = relationship("CalendarEvent", back_populates="user")
    # 데일리 체크 기록
    daily_checkins = relationship("CheckIn", back_populates="user")
    # 데일리 보고서 기록
    daily_reports = relationship("DailyReports", back_populates="user")
    # 주간 보고서 기록
    weekly_reports = relationship("WeeklyReports", back_populates="user")
    # 피드백 관련
    # user_feedbacks = relationship("UserFeedback", back_populates="user")
    # 아이템 보유 기록
    user_items = relationship("UserItems", back_populates="user")

# 사용자 앱 카테고리 설정
class User_App_Categories(Base):
    __tablename__ = "user_app_categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    package_name = VARCHAR(255),
    custom_category = Column(String(100))
    # updated_at = TIMESTAMP DEFAULT CURRENT_TIMESTAMP
