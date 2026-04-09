# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

**Dolphin Pod (DPP)** 는 스마트폰 사용 패턴을 AI 기반 인사이트로 이해할 수 있도록 돕는 Android 디지털 웰빙 앱입니다. 앱 사용을 차단하는 방식이 아닌, 사용자 스스로 패턴을 인식하고 자기 조절을 돕는 것이 목표입니다. 세 개의 서비스가 함께 동작합니다.

## 서비스 구성

| 서비스 | 디렉토리 | 포트 | 스택 |
|--------|----------|------|------|
| 백엔드 (DPP_BE) | `DPP/DPP_BE/` | 8000 | FastAPI + SQLAlchemy + PostgreSQL |
| AI 서버 (DPP_AI) | `DPP_AI/` | 8001 | FastAPI + OpenAI/Claude API |
| 프론트엔드 (DPP_FE) | `DPP_FE/` | — | React Native (Android) |

## 서비스 실행

### AI 서버 (DPP_AI)
```bash
cd DPP_AI
pip install -r requirements.txt
# .env 파일 필요: OPENAI_API_KEY, AI_TEST_ROOT=/path/to/DPP/ai-test
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 백엔드 (DPP_BE)
```bash
cd DPP/DPP_BE
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
PostgreSQL 없이도 동작합니다 (graceful fallback).

## 테스트

### AI 파이프라인 유닛 테스트 (HTTP 서버 불필요)
```bash
cd DPP_AI
python test_pipeline.py
```

### AI 테스트 프레임워크 (OpenAI 직접 호출)
```bash
cd ai-test
npm install
node run_test.mjs --direct --task pattern \
  --prompt prompts/pattern_list_v1.txt \
  --input inputs/pattern_case_strong.json \
  --model gpt-4o-mini --temp 0.6 --maxTokens 1400
```

### 프롬프트 회귀 테스트 (CI)
```bash
cd DPP_AI
npm install -g promptfoo
npx promptfoo eval --output .promptfoo/output.json --no-cache
node scripts/compare-regression.js  # exit 0 = 통과, exit 1 = 회귀 감지
```

## 아키텍처

### AI 체크인 파이프라인 (`POST /ai/checkin-pipeline`)
`qa_results` 테이블에 각 단계를 기록하는 3단계 파이프라인:
1. **checkin_writer** (GPT-4o-mini) — 일일 사용량 스냅샷으로부터 0~5개의 패턴 후보 생성. 패턴은 사실 관찰이며 조언이 아님. 출력: JSON `{date, pattern_candidates[]}`.
2. **deterministic_check** (Python/regex) — 스키마, 데이터 타입, 금지 표현 검증. 출력: PASS/FAIL.
3. **llm_judge** (GPT-4o-mini) — 정성적 품질 검토. 출력: PASS/RETRY/FAIL.

### AI 리포트 파이프라인 (`POST /ai/report-pipeline`)
1. **report_writer** (Claude Sonnet) — 선택된 패턴 + KPT 피드백을 기반으로 자연어 일일 리포트 생성.
2. **report_judge** (GPT-4o-mini) — 어조, 정확성, 길이 검증. 출력: PASS/REWRITE/FALLBACK.

### 체크인 질문 생성 (`POST /ai/checkin-question`)
3단계 문맥 인식 질문 생성. 프롬프트는 `DPP_AI/prompts/policy.txt` + `prompts/step{1,2,3}.txt`에서 로드.

### 백엔드 데이터 흐름
모바일 (UsageStatsManager) → `POST /logs` (DPP_BE:8000) → UsageLog ORM → PostgreSQL

### 주요 모델
- `DPP/DPP_BE/app/models/user.py` — Users: usage_logs, daily_checkins, daily_reports, weekly_reports, 게임화(achievements, characters, challenges), 소셜(friendships, alerts) 관계 포함
- `DPP/DPP_BE/app/models/usage_log.py` — package_name, usage_duration, timestamps, category
- `DPP_AI/app/models/qa_result.py` — 파이프라인 단계 실행 로그 (run_id, step, status, inputs, outputs, errors)

## CI/CD

GitHub Actions (`.github/workflows/prompt-regression.yml`)는 `DPP_AI/prompts/**`, `DPP_AI/services/**`, `DPP_AI/promptfooconfig.yaml`, `ai-test/prompts/**`를 수정하는 PR에서 트리거됩니다. promptfoo로 v2 vs v1 프롬프트 점수를 비교하고, 결과를 PR 코멘트로 게시하며, 회귀 감지 시 머지를 차단합니다.

## 주요 설계 결정

- **멀티 모델 전략**: GPT-4o-mini는 빠른 검증/판단에, Claude Sonnet은 리포트 작성에 사용
- **패턴은 가설이지 처방이 아님** — AI 언어는 반드시 관찰적 표현이어야 하며, 조언 표현 금지
- **선택적 데이터베이스** — `DATABASE_URL` 없이도 두 서비스 모두 정상 초기화됨
- **프롬프트 버전 관리** — `DPP_AI/prompts/`의 프롬프트는 v1, v2로 버전 관리; 회귀 테스트는 v2 ≥ v1 품질 강제
- **`AI_TEST_ROOT` 환경 변수** — AI 서버가 프롬프트/입력 파일을 위해 `ai-test/` 디렉토리를 찾는 데 사용
