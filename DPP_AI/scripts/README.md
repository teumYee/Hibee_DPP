# Scripts

## compare-regression.js

promptfoo eval 결과(`.promptfoo/output.json`)를 읽어 v1 vs v2 회귀 판정을 합니다.

- **v2 >= v1** → exit 0 (통과)
- **v2 < v1** → exit 1 (차단)

로컬 실행:

```bash
cd DPP_AI
PROMPTFOO_OUTPUT=.promptfoo/output.json node scripts/compare-regression.js
```

GitHub Actions에서는 `promptfoo eval` 후 자동 실행되며, 결과를 PR 코멘트로 남깁니다.
