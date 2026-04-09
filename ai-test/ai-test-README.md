# 🧪 AI Test Guide (DolphinPod)

이 폴더는 **AI 기능을 실제 서비스에 붙이기 전에**,\
프롬프트와 AI 출력이 **의도대로 동작하는지 테스트하고 공유**하기 위한
공간입니다.

> 목적\
> - AI가 문제 없는 상황에서도 문제를 만들지 않는지\
> - 판단·훈계 없이 사용자에게 패턴 "후보"만 제시하는지\
> - 입력이 달라져도 태도와 형식이 안정적인지 확인

------------------------------------------------------------------------

## 📁 전체 구조

    ai-test/
    ├─ prompts/
    ├─ ai-test-data/
    │  └─ persona/
    ├─ suites/
    │  └─ pattern_v1/
    │     ├─ cases/
    │     ├─ runs/
    │     └─ eval/
    ├─ run_test.mjs
    └─ README.md

------------------------------------------------------------------------

## 🧩 strong / balanced / keep

-   **strong** : 패턴이 뚜렷한 날 (AI 기본 응답 기능 확인용) \
-   **balanced** : 애매한 날 (억지로 패턴 만들지 않는지 확인용)\
-   **keep** : 굳이 문제 삼을 게 없는 날 (개선 필요 없는데 굳이 개선 제안하지 않는지 확인용)

상황에 따라 AI 태도가 유지되는지 확인하기 위한 분류입니다.

------------------------------------------------------------------------

## 🏷️ 파일 네이밍 규칙

### 기본 형식

    {persona}_{type}_d{day}_{variant}.json

-   persona: A / B / C\
-   type: strong / balanced / keep\
-   day: d01, d02, d03 ...\
-   variant: base (기본), 필요 시 변경

### 예시

    A_strong_d01_base.json
    A_balanced_d01_base.json
    A_keep_d01_base.json
    C_balanced_d07_edge.json

------------------------------------------------------------------------

## ▶️ 테스트 실행

``` bash
cd ~/Desktop/DPP/ai-test

node run_test.mjs --direct --task pattern   --prompt prompts/pattern_list_v1.txt   --input suites/pattern_v1/cases/A_strong_d01_base.json   --model gpt-5.2 --temp 0.6 --maxTokens 1400
```

------------------------------------------------------------------------

## 📦 결과 관리

### runs/

-   AI 출력 결과(JSON)
-   용량 문제로 **git에 올리지 않음**

### eval/

-   팀원 공유용 평가 요약
-   git에 커밋

#### labels.jsonl 예시

``` json
{"case":"A_strong_d01_base.json","label":"OK","issues":[]}
{"case":"A_balanced_d01_base.json","label":"SUS","issues":["패턴중복"]}
{"case":"A_keep_d01_base.json","label":"FAIL","issues":["훈계느낌"]}
```

------------------------------------------------------------------------

## ✅ 테스트 규칙 요약

1.  cases/ 와 eval/ 은 git에 커밋\
2.  runs/ 는 git에 올리지 않음\
3.  평가는 labels.jsonl 로 공유

------------------------------------------------------------------------

## 🎯 테스트 목표

AI가
우리가 의도한 대로 답변을 하는지,
확인하는 테스트입니다.
