from pydantic import BaseModel
from typing import List, Optional

class OnboardingRequest(BaseModel):
    nickname: str
    
    # 마스터 테이블 - id list
    goals: List[int]
    active_times: List[int]
    struggles: List[int]

    # 심야 모드 설정
    night_mode_start: str = "23:00"
    night_mode_end: str = "7:00"
    checkin_time: str = "21:00"

class CustomCategoryItem(BaseModel):
    package_name:str
    custom_category_id:int

class CategorySetupUpdate(BaseModel):
    custom_categories: List[CustomCategoryItem]

