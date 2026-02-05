from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# 1. 안드로이드에서 보낼 데이터 형식 정의
class AppUsageLogBase(BaseModel):
    package_name: str
    app_name: str
    usage_duration: int
    date: Optional[datetime] = None
    start_time: Optional[datetime] = None 
    end_time: Optional[datetime] = None
    unlock_count: int=0
    app_launch_count: int = 0
    max_continuous_duration: int = 0
    category_id: Optional[int] = -1
    is_night_mode: Optional[bool] = False

# 2. 안드로이드 -> 서버 
class AppUsageLogCreate(BaseModel):
    logs : List[AppUsageLogBase]
    unlock_count : int=0

# 3. 서버 -> 클라이언트
# 상속 기능
class AppUsageLogResponse(BaseModel):
    id: int
    user_id: int
    package_name: str     
    app_name: str
    usage_duration: int  
    date: datetime        
    first_time_stamp: int
    last_time_stamp: int
    unlock_count: int
    app_launch_count: int 
    max_continuous_duration: int
    is_night_mode: bool=False
    category_id: Optional[int]=-1
    category_name: Optional[str] = "기타"
    
    class Config: 
        from_attributes = True