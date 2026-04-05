# 1. Base 클래스
# 2. 각 파일에 정의된 모델 클래스 import

from .user import Users, User_App_Categories, User_Stats, User_Configs
from .usage_log import UsageLog, Daily_SnapShots
from .calendar import (
    CalendarEvent,
    CheckIn,
    PatternCandidatesDaily,
    PatternCandidatesLog,
)
from .reports import (
    DailyReports,
    WeeklyReports,
    ExpertKnowledge,
    ReportDraft,
    ReportEvidenceTrace,
    ReportReviewLog,
)
from .gamification import (
    Achievements,
    CharacterAcquisitionLogs,
    Characters,
    Items,
    UserAchievements,
    UserCharacters,
    UserItems,
)
from .challenge import (
    Challenge,
    ChallengeInstances,
    Condition,
    ProgressLogs,
    Rewards,
    StrollGroups,
    StrollGroupMembers,
    StrollGroupCheckinContributions,
)
from .social import Friendships, Alerts
from .recommendactions import Recommendactions, RecommendedActions, UserFeedback
from .master import OnboardingOptionsMaster, CategoryMaster, TitlesMaster

__all__ = [
    "OnboardingOptionsMaster",
    "CategoryMaster",
    "TitlesMaster",
    "Users",
    "User_Stats",
    "User_Configs",
    "User_App_Categories",
    "UserCharacters",
    "UserAchievements",
    "UserItems",
    "Items",
    "CharacterAcquisitionLogs",
    "ChallengeInstances",
    "Daily_SnapShots",
    "UsageLog",
    "CalendarEvent",
    "CheckIn",
    "PatternCandidatesDaily",
    "PatternCandidatesLog",
    "DailyReports",
    "WeeklyReports",
    "ExpertKnowledge",
    "ReportDraft",
    "ReportEvidenceTrace",
    "ReportReviewLog",
    "Characters",
    "Achievements",
    "Challenge",
    "ChallengeInstances",
    "Condition",
    "ProgressLogs",
    "Rewards",
    "StrollGroups",
    "StrollGroupMembers",
    "StrollGroupCheckinContributions",
    "Friendships",
    "Alerts",
    "Recommendactions",
    "RecommendedActions",
    "UserFeedback",
]
