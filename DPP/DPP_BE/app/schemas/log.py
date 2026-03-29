from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import List, Optional, Dict

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
    user_id: int
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


# 8) 데일리 스냅샷 저장 API (v3) 스키마
class DailySnapshotCreateV3(BaseModel):
    date: date
    timezone: str = "Asia/Seoul"
    total_usage_check: int = Field(default=0, ge=0)
    unlock_count: int = Field(default=0, ge=0)
    time_of_day_buckets_sec: Dict[str, int]
    max_continuous_sec: int = Field(default=0, ge=0)
    app_launch_count: int = Field(default=0, ge=0)
    package_name: Optional[str] = None
    schema_version: str = "1.0.0"
    source_hash: Optional[str] = None


# 하위 호환용 alias (기존 import 깨짐 방지)
DailySnapshotCreateV2 = DailySnapshotCreateV3


class DailySnapshotResponse(BaseModel):
    snapshot_id: int
    status: str
    upserted: bool