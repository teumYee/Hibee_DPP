from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, VARCHAR, TIMESTAMP, DateTime, JSON
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
    # 레거시 호환용 잔액 컬럼. 실제 잔액은 user_stats.coin을 기준으로 사용한다.
    coin = Column(Integer, default=0)
    Night_time = Column(Integer, default=0)
    night_mode_start = Column(String, default="23:00")
    night_mode_end = Column(String, default="07:00")
    
    created_at = Column(DateTime, default=datetime.now())
    updated_at = Column(DateTime, default=datetime.now(), onupdate=datetime.now)

    # 관계 설정
    stats = relationship("User_Stats", back_populates="user", uselist=False)
    configs = relationship("User_Configs", back_populates="user", uselist=False)

    # 내가 보유한 캐릭터들
    user_characters = relationship("UserCharacters", back_populates="user")

    # 내가 달성한 업적들 
    user_achievements = relationship("UserAchievements", back_populates="user")

    # 내가 참여한 챌린지 기록들
    challenge_instances = relationship("ChallengeInstances", back_populates="user")
    stroll_groups_created = relationship(
        "StrollGroups",
        foreign_keys="StrollGroups.created_by_user_id",
        back_populates="creator",
    )
    stroll_group_memberships = relationship("StrollGroupMembers", back_populates="user")

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
    daily_snap_shots = relationship("Daily_SnapShots", back_populates="user")
    # 캘린더 이벤트 기록
    calendar_events = relationship("CalendarEvent", back_populates="user")
    # 데일리 체크 기록
    daily_checkins = relationship("CheckIn", back_populates="user")
    # KPT 패턴 후보 (일별)
    pattern_candidates_daily = relationship(
        "PatternCandidatesDaily", back_populates="user"
    )
    # 데일리 보고서 기록
    daily_reports = relationship("DailyReports", back_populates="user")
    # 주간 보고서 기록
    weekly_reports = relationship("WeeklyReports", back_populates="user")
    # 리포트 초안·검수
    report_drafts = relationship("ReportDraft", back_populates="user")
    report_review_logs = relationship("ReportReviewLog", back_populates="user")
    # 피드백 관련
    # user_feedbacks = relationship("UserFeedback", back_populates="user")
    # 아이템 보유 기록
    user_items = relationship("UserItems", back_populates="user")

    user_config = relationship("User_Configs", back_populates="user", uselist=False)


class User_Configs(Base):
    """온보딩·목표 등 사용자별 설정 (user_id당 1행)"""
    __tablename__ = "user_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)

    goals = Column(JSON, nullable=True)
    active_times = Column(JSON, nullable=True)
    night_mode_start = Column(String(255), nullable=True)
    night_mode_end = Column(String(255), nullable=True)
    struggles = Column(JSON, nullable=True)
    focus_categories = Column(JSON, nullable=True)
    checkin_time = Column(String(255), nullable=True)
    checkin_window_minutes = Column(Integer, nullable=False, default=120)
    day_rollover_time = Column(String(5), nullable=False, default="04:00")

    user = relationship("Users", back_populates="user_config")


# 사용자 앱 카테고리 설정
class User_App_Categories(Base):
    __tablename__ = "user_app_categories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    package_name = VARCHAR(255),
    custom_category = Column(String(100))
    # updated_at = TIMESTAMP DEFAULT CURRENT_TIMESTAMP

class User_Stats(Base):
    __tablename__ = "user_stats"
    id = Column(Integer, primary_key=True, index=True)
    # 키 참조
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    current_title_id = Column(Integer, ForeignKey("titles_master.id"))
    equipped_character = Column(Integer, ForeignKey("characters.id"))
    social_representative_character_id = Column(
        Integer, ForeignKey("user_characters.id"), nullable=True
    )
    
    # 체크인
    total_checkin_count = Column(Integer, default=0)
    last_chekin_date = Column(DateTime, nullable=True)
    last_login_date = Column(DateTime, nullable=True)

    # 게이미피케이션
    # 코인 잔액의 단일 진실 공급원(SSOT)
    coin = Column(Integer, default=0)
    continuous_days = Column(Integer, default=0)
    friend_count = Column(Integer, default=0)
    cheer_count = Column(Integer,default=0)

    user = relationship("Users", back_populates="stats")

# 기존 코드 호환용 별칭
UserConfigs = User_Configs


