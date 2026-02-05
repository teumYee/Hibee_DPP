# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from datetime import datetime, date
# from typing import List, Optional, func

# from app import schemas
# from app.core.database import get_db
# from app.models.usage_log import UsageLog
# from app.models.user import Users, User_App_Categories

# router = APIRouter()


# # 데일리 리포트

# # 카테고리별 사용 비중 API
# # 제공 데이터 : 카테고리별 사용 시간 및 퍼센트
# # 카테고리 커스텀 API
# @router.get("/category_usage",response_model=dict)
# def category_usage(
#     user_id: int,
#     db: Session = Depends(get_db)
# ):
#     # 1. 유저별 카테고리 설정과 사용 기록을 join 해서 가져오기
#     # 2. 카테고리별로 그룹화해서 사용 시간 합산
#     usage_category_data = db.query(
#         User_App_Categories.custom_category,
#         func.sum(UsageLog.usage_duration).label("category_time")
#     ).join(
#         UsageLog, 
#         User_App_Categories.package_name == UsageLog.package_name
#     ).filter(
#         User_App_Categories.user_id == user_id,
#         UsageLog.user_id == user_id
#     ).group_by(
#         User_App_Categories.custom_category
#     ).all()

#     total_time = sum(item.category_time for item in usage_category_data)

#     return {
#         "categories": [
#             {
#                 "category_name": item.custom_category or "미분류",
#                 "category_time": item.category_time,
#                 "percentage": round((item.category_time / total_time * 100), 1) if total_time > 0 else 0
#             } for item in usage_category_data
#         ]
#     }

# # 시간대별 사용 흐름 API
# # 하루 시간대별 사용 시간 리스트
# # first_time_stamp 기준으로 시간대별로 데이터 묶음

# @router.get("/hourly_usage_flow", response_model=dict)
# def get_hourly_usage(
#     user_id: int, db:Session=Depends(get_db)
# ):
#     # 1. 기본값은 오늘로 날짜 설정
#     target_date = date.date() if date else datetime.now().date()

#     # 2. 쿼리 실행 : 유저 아이디와 날짜 기준으로 필터링
#     # 0~23 시간대별 사용 시간 그룹핑
#     hourly_data = db.query(
#         # 시간만 추출
#         func.extract('hour',UsageLog.timestamp).label("hour"),
#         func.sum(UsageLog.usage_duration).label("duration")
#     ).filter(
#         UsageLog.user_id == user_id,
#         # 하루 기준 필터링
#         func.date(UsageLog.timestamp) == target_date
#     ).group_by('hour').all()

#     # 3. 데이터 가공 : 0시부터 23시까지 빈 곳을 0으로 채우기
#     # 0~23시까지 값이 없으면 0으로 채운 리스트 생성
#     usage_dict = {int(item.hour): item.duration for item in hourly_data}
#     hourly_flow_list = [usage_dict.get(hour, 0) for hour in range(24)]

#     return {
#         "hourly_flow": hourly_flow_list,
#         "hourly_data": {str(int(item.hour)):item.duration for item in hourly_data}
#     }

# # 야간 사용량 분석 API 
# # 시스템 디폴트, 사용자 커스텀 기준 야간 시간대 사용 합계

# @router.get("/night_mode_usage", response_model=dict)
# def get_night_usage(
#     user_id: int, 
#     # 사용자가 커스텀한 야간 모드 시간대 추출
#     start_hour: int,
#     end_hour: int,
#     db:Session=Depends(get_db)
# ):

#     night_total = db.query(
#         func.sum(UsageLog.usage_duration).filter(
#             UsageLog.user_id == user_id,
#             (func.extract('hour', UsageLog.timestamp)>=start_hour) &
#             (func.extract('hour', UsageLog.timestamp)<end_hour)
#         ).scalar() or 0)
#     return {
#         "night_usage_duration": night_total
#     }

