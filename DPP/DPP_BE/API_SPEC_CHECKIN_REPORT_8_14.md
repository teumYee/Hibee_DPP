# API Spec (8-14): Snapshot, Check-in, Report

이 문서는 WF1~WF3 구현을 위한 8~14번 API 명세의 기준안이다.

## 공통 원칙

- Base URL: `/api/v1`
- 인증: `Authorization: Bearer <token>` (추후 auth 미들웨어 연동)
- 날짜 포맷: `YYYY-MM-DD` (로컬 timezone 기준)
- 생성 API는 비동기 처리 가능 (`job_id` 반환)
- 상태값 표준: `PENDING | RUNNING | DONE | FAILED | FALLBACK_DONE`

---

## 8) 데일리 스냅샷 저장

- **POST** `/api/v1/snapshots`
- 목적: 로컬 1차 가공된 snapshot 업로드
- 멱등키: `(user_id, date)` 기준 upsert

### Request Body

- `time_of_day_buckets_sec`는 `morning`, `afternoon`, `evening`, `night` 4개 키를 기준으로 전달한다.
- 기존 6구간(`새벽`, `아침`, `오전`, `오후`, `저녁`, `밤`) 데이터가 있으면 서버에서 4구간으로 합산 정규화한다.

```json
{
  "date": "2026-03-24",
  "timezone": "Asia/Seoul",
  "total_usage_sec": 12345,
  "unlock_count": 89,
  "time_of_day_buckets_sec": {
    "morning": 1200,
    "afternoon": 3400,
    "evening": 4200,
    "night": 3545
  },
  "max_continuous_sec": 1800,
  "app_launch_count": 72,
  "schema_version": "1.0.0",
  "source_hash": "sha256:xxxx"
}
```

### Response

```json
{
  "snapshot_id": 101,
  "status": "stored",
  "upserted": true
}
```

---

## 9) 패턴 후보 가져오기

- **GET** `/api/v1/checkins/candidates?date=YYYY-MM-DD`
- 목적: snapshot 기반 체크인 패턴 후보 조회 (없으면 생성 상태 반환)

### Response (생성 완료)

```json
{
  "date": "2026-03-24",
  "status": "DONE",
  "pattern_candidates": [
    {
      "candidate_id": "c1",
      "title": "아침 10분 목표 설정",
      "description": "아침 첫 사용 10분 내 오늘의 핵심 1가지를 적기",
      "evidence": {
        "unlock_count": 89,
        "morning_usage_sec": 1200
      }
    }
  ]
}
```

### Response (생성 중)

```json
{
  "date": "2026-03-24",
  "status": "RUNNING",
  "pattern_candidates": []
}
```

---

## 10) 체크인 저장 (선택 + KPT)

- **POST** `/api/v1/checkins`
- 목적: 유저 선택 패턴과 KPT 저장, 리포트 생성 입력 확정

### Request Body

```json
{
  "date": "2026-03-24",
  "selected_candidate_id": "c1",
  "kpt": {
    "keep": "점심 이후 앱 사용 줄임",
    "problem": "밤 시간대 쇼츠 소비 증가",
    "try": "23시 이후 앱 타이머 20분 제한"
  }
}
```

### Response

```json
{
  "checkin_id": 555,
  "status": "saved"
}
```

---

## 11) 데일리 리포트 생성 트리거

- **POST** `/api/v1/reports/daily/generate`
- 목적: 비동기 리포트 생성 시작

### Request Body

```json
{
  "date": "2026-03-24",
  "force_regenerate": false
}
```

### Response

```json
{
  "job_id": "job_daily_abc123",
  "status": "PENDING"
}
```

---

## 12) 데일리 리포트 조회

- **GET** `/api/v1/reports/daily?date=YYYY-MM-DD`
- 목적: 데일리 리포트 결과/상태 조회

### Response (완료)

```json
{
  "date": "2026-03-24",
  "status": "DONE",
  "report_text": "2026-03-24 기준 총 사용 지표는 12345 ...",
  "summary": "2026-03-24 기준 총 사용 지표는 12345 ...",
  "highlights": [
    "앱 실행 수는 72회입니다.",
    "선택한 패턴은 아침 10분 목표 설정입니다."
  ],
  "recommendations": [
    "23시 이후 앱 타이머 20분 제한"
  ],
  "chart_data": {
    "total_usage_check": 12345,
    "unlock_count": 89,
    "max_continuous_sec": 1800,
    "app_launch_count": 72,
    "time_of_day_buckets": {
      "morning": 1200,
      "afternoon": 3400,
      "evening": 4200,
      "night": 3545
    }
  },
  "evidence_refs": ["doc_11", "tpl_4"]
}
```

### Response (미완료)

```json
{
  "date": "2026-03-24",
  "status": "RUNNING",
  "report_text": null
}
```

---

## 13) 주간 리포트 생성 트리거

- **POST** `/api/v1/reports/weekly/generate`
- 목적: 비동기 주간 리포트 생성 시작

### Request Body

```json
{
  "week_start": "2026-03-23",
  "force_regenerate": false
}
```

### Response

```json
{
  "job_id": "job_weekly_xyz789",
  "status": "PENDING"
}
```

---

## 14) 주간 리포트 조회

- **GET** `/api/v1/reports/weekly?week_start=YYYY-MM-DD`
- 목적: 주간 리포트 결과/상태 조회

### Response

```json
{
  "week_start": "2026-03-23",
  "status": "DONE",
  "report_text": "이번 주 총 사용 지표는 53210 ...",
  "summary": "이번 주에는 6일의 스냅샷과 4회의 완료 체크인이 기록되었습니다.",
  "insights": [
    "AI 점수는 70.0점입니다.",
    "주요 활동 시간대는 저녁입니다."
  ],
  "next_actions": [
    "23시 이후 앱 타이머 20분 제한"
  ],
  "chart_data": {
    "ai_score": 70.0,
    "checkin_count": 4,
    "total_usage_check": 53210,
    "avg_daily_usage": 8868,
    "avg_daily_unlock_count": 81,
    "total_app_launch_count": 420,
    "max_continuous_sec": 2100,
    "time_of_day_buckets": {
      "morning": 4200,
      "afternoon": 15200,
      "evening": 21400,
      "night": 12410
    },
    "daily_usage": {
      "2026-03-23": 7120,
      "2026-03-24": 8450
    }
  },
  "evidence_refs": ["doc_31", "tpl_9"]
}
```

---

## 상태 코드 가이드

- `200`: 조회/저장 성공
- `202`: 생성 요청 접수 (비동기 시작)
- `400`: 날짜 포맷, 필수값 누락
- `401`: 인증 실패
- `404`: 해당 date/week 리소스 없음
- `409`: 이미 생성 중인 job 충돌
- `422`: 스키마 검증 실패
- `500`: 서버 내부 오류

---

## 구현 우선순위 메모

1. 이 문서 기준으로 `schemas`(Pydantic) 먼저 고정
2. `endpoints`는 우선 status 기반 mock 응답으로 연결
3. 이후 worker/queue를 붙여 `RUNNING -> DONE` 상태 전환 구현
