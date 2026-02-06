from .log import AppUsageLogBase, AppUsageLogCreate, AppUsageLogResponse
from pydantic import BaseModel
from datetime import datetime
from typing import List

# 1. 안드로이드에서 보낼 데이터 형식 정의
class AppUsageLogBase(BaseModel):
    package_name:str
    app_name: str
    usage_time: int  
    start_time: datetime
    end_time: datetime
    unlock_count: int = 0      # 페이로드 안에 있으니 추가
    category_id: int = -1      # 페이로드 안에 있으니 추가
    app_launch_count: int = 0  # 페이로드 안에 있으니 추가
    is_night_mode: bool = False # 페이로드 안에 있으니 추가
    max_continuous_duration: int = 0

# 2. 안드로이드 -> 서버 
class AppUsageLogCreate(BaseModel):
    logs : List[AppUsageLogBase]
    unlock_count : int = 0

# 3. 서버 -> 클라이언트
# 상속 기능
class AppUsageLogResponse(AppUsageLogBase):
    id : int
    user_id : int