from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from openai import OpenAI, APIStatusError, APIConnectionError, APITimeoutError
import json
import logging

# ----- 환경 변수 로드 -----
load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY가 .env에 없습니다. AI 서버 실행 불가!")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="DPP AI Server")
logger = logging.getLogger("uvicorn.error")


# ----- Pydantic 모델들 -----

class UsageData(BaseModel):
    totalTime: int
    lateNightTime: int
    longSessions: int
    shortFormRatio: float
    snsRatio: float
    gameRatio: float


class NotificationData(BaseModel):
    importantCount: int
    lowPriorityCount: int
    hasOverload: bool


class CheckInData(BaseModel):
    mood: int
    satisfaction: int
    goalAchieved: bool
    memo: Optional[str] = None


class OnboardingData(BaseModel):
    targetScreenTime: int
    targetBedTime: str


class UserProfile(BaseModel):
    level: int
    experience: int
    experienceToNextLevel: int
    totalDays: int
    currentStreak: int
    onboarding: OnboardingData


class AiCommentRequest(BaseModel):
    totalScore: int
    usage: UsageData
    notifications: NotificationData
    checkIn: CheckInData
    profile: UserProfile


class AiCommentResponse(BaseModel):
    comment: str
    suggestion: str


# ----- AI 엔드포인트 -----

@app.post("/ai/daily-report", response_model=AiCommentResponse)
async def daily_report(body: AiCommentRequest):
    """
    BE에서 넘겨준 하루 사용 데이터를 기반으로
    OpenAI에게 코멘트 + 제안을 생성시키는 엔드포인트
    """

    user_summary = f"""
[오늘 점수]
- 총 점수: {body.totalScore}
- 연속 달성 일수: {body.profile.currentStreak}일

[사용 패턴]
- 총 사용 시간: {body.usage.totalTime}분
- 심야 사용 시간: {body.usage.lateNightTime}분
- 긴 세션 횟수: {body.usage.longSessions}회
- 숏폼 비율: {body.usage.shortFormRatio:.2f}
- SNS 비율: {body.usage.snsRatio:.2f}
- 게임 비율: {body.usage.gameRatio:.2f}

[알림]
- 중요한 알림 수: {body.notifications.importantCount}
- 저우선 알림 수: {body.notifications.lowPriorityCount}
- 알림 폭주 여부: {body.notifications.hasOverload}

[체크인]
- 기분: {body.checkIn.mood}/5
- 만족도: {body.checkIn.satisfaction}/5
- 목표 달성 여부: {body.checkIn.goalAchieved}
- 메모: {body.checkIn.memo}
"""

    system_prompt = (
        "너는 스마트폰 사용 패턴을 따뜻하게 되돌아보는 디지털 웰빙 코치야. "
        "사용자를 비난하지 말고, 공감과 구체적인 조언 중심으로 이야기해줘."
    )

    try:
        # ----- OpenAI 호출 -----
        completion = client.chat.completions.create(
            model="gpt-4o-mini",  # 필요하면 접근 가능한 모델로 수정
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"""
다음은 사용자의 오늘 스마트폰 사용 데이터야:

{user_summary}

1) 오늘 하루를 한두 문단으로 따뜻하게 되돌아보는 코멘트
2) 내일 시도해볼 수 있는 구체적인 행동 제안 1~2개

아래 JSON 형식으로만 답해줘:

{{
  "comment": "한글 코멘트...",
  "suggestion": "한글 제안..."
}}
""",
                },
            ],
            response_format={"type": "json_object"},
        )

        # ----- 응답 파싱 -----
        raw_text = completion.choices[0].message.content
        parsed = json.loads(raw_text)

        return AiCommentResponse(
            comment=parsed.get("comment", "오늘도 고생 많았어!"),
            suggestion=parsed.get("suggestion", "내일은 마음이 편해지는 작은 행동을 하나만 시도해보자."),
        )

    # ----- OpenAI 쪽에서 status code를 들고 온 에러 (401, 429, 500 등) -----
    except APIStatusError as e:
        logger.error(
            "OpenAI APIStatusError in /ai/daily-report",
            extra={
                "status_code": e.status_code,
                "response": str(e.response),
            },
        )
        # 클라이언트에는 깔끔한 문장 + 구분용 error_type만 전달
        raise HTTPException(
            status_code=502,
            detail={
                "message": "AI 서버에서 잠시 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
                "error_type": "openai_api_error",
            },
        )

    # ----- 네트워크/타임아웃 계열 에러 -----
    except (APIConnectionError, APITimeoutError) as e:
        logger.error(
            "OpenAI connection/timeout error in /ai/daily-report",
            extra={"error": str(e)},
        )
        raise HTTPException(
            status_code=504,
            detail={
                "message": "AI 서버와의 연결에 문제가 있어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
                "error_type": "openai_network_error",
            },
        )

    # ----- 그 외 모든 예기치 못한 에러 -----
    except Exception as e:
        logger.exception("Unexpected error in /ai/daily-report")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "서버 내부에서 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
                "error_type": "internal_server_error",
            },
        )
