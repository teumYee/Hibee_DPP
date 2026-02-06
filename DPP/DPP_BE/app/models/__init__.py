# 1. Base 클래스
# 2. 각 파일에 정의된 모델 클래스 import 

from .user import Users, User_App_Categories
from .usage_log import UsageLog
from .calendar import CalendarEvent, CheckIn, DailyReports, WeeklyReports
# 캐릭터, 업적 달성
from .gamification import UserAchievements,UserCharacters,Characters, Achievements 
# 챌린지
from .challenge import Challenge, ChallengeInstances, Condition, ProgressLogs, Rewards
# 친구, 그룹
from .social import Friendships, Alerts
# 대체 행동
from .recommendactions import Recommendactions, RecommendedActions, UserFeedback


# from models import * 로 사용할 때 모든 모델 클래스를 가져올 수 있도록 설정

__all__ = [
    "Users",
    "User_App_Categories",
    "UserCharacters",
    "UserAchievements",
    "UserChallenge",
    "UsageLog",
    "CalendarEvent",
    "CheckIn",
    "DailyReports",
    "WeeklyReports",
    "Characters",
    "Achievements",
    "Challenge",
    "ChallengeInstances",
    "Condition",
    "ProgressLogs",
    "Rewards",
    "Friendships",
    "Alerts",
    "Recommendactions", 
    "RecommendedActions", 
    "UserFeedback"
]