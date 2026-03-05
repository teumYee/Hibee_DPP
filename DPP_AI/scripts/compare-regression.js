#!/usr/bin/env node
/**
 * promptfoo eval 결과에서 v1 vs v2 회귀 판정.
 * v2 >= v1 이면 통과(exit 0), 미만이면 차단(exit 1).
 * PR 코멘트용 메시지 출력.
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = process.env.PROMPTFOO_OUTPUT || path.join(__dirname, '..', '.promptfoo', 'output.json');

function loadResults() {
  const p = path.resolve(OUTPUT_PATH);
  if (!fs.existsSync(p)) {
    console.error('Missing promptfoo output:', p);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getPassRateByPrompt(results) {
  const byPrompt = {};
  const data = results.results || results;
  const prompts = data.prompts || [];
  const promptLabels = prompts.map((p) => (typeof p === 'string' ? p : (p.label || p.id || String(p))));

  // Format 1: results.results[] with prompt label and success
  if (Array.isArray(data.results)) {
    data.results.forEach((r) => {
      const label = r.prompt?.label ?? r.prompt?.id ?? promptLabels[r.promptIndex ?? r.promptIdx ?? 0] ?? 'unknown';
      if (!byPrompt[label]) byPrompt[label] = { pass: 0, total: 0 };
      byPrompt[label].total += 1;
      if (r.success !== false && r.pass !== false) byPrompt[label].pass += 1;
    });
  }
  // Format 2: table / outputs array
  const table = data.table || data.outputs || [];
  if (Object.keys(byPrompt).length === 0 && table.length > 0) {
    table.forEach((row, idx) => {
      const promptIdx = row.promptIndex ?? row.promptIdx ?? idx % Math.max(promptLabels.length, 1);
      const label = promptLabels[promptIdx] ?? row.prompt?.label ?? `prompt_${promptIdx}`;
      if (!byPrompt[label]) byPrompt[label] = { pass: 0, total: 0 };
      byPrompt[label].total += 1;
      if (row.pass === true || row.success === true) byPrompt[label].pass += 1;
    });
  }
  return byPrompt;
}

function main() {
  const results = loadResults();
  const byPrompt = getPassRateByPrompt(results);

  const writerV1 = byPrompt.checkin_writer_v1 || { pass: 0, total: 0 };
  const writerV2 = byPrompt.checkin_writer_v2 || { pass: 0, total: 0 };
  const judgeV1 = byPrompt.llm_judge_v1 || { pass: 0, total: 0 };
  const judgeV2 = byPrompt.llm_judge_v2 || { pass: 0, total: 0 };

  const rate = (p) => (p.total ? (p.pass / p.total) : 0);
  const writerV1Rate = rate(writerV1);
  const writerV2Rate = rate(writerV2);
  const judgeV1Rate = rate(judgeV1);
  const judgeV2Rate = rate(judgeV2);

  const writerOk = writerV2Rate >= writerV1Rate;
  const judgeOk = judgeV2Rate >= judgeV1Rate;
  const allOk = writerOk && judgeOk;

  const lines = [
    '## Prompt regression (v2 vs v1)',
    '',
    '| Prompt | v1 pass rate | v2 pass rate | v2 >= v1 |',
    '|--------|--------------|--------------|----------|',
    `| checkin_writer | ${writerV1.pass}/${writerV1.total} (${(writerV1Rate * 100).toFixed(0)}%) | ${writerV2.pass}/${writerV2.total} (${(writerV2Rate * 100).toFixed(0)}%) | ${writerOk ? '✅' : '❌'} |`,
    `| llm_judge | ${judgeV1.pass}/${judgeV1.total} (${(judgeV1Rate * 100).toFixed(0)}%) | ${judgeV2.pass}/${judgeV2.total} (${(judgeV2Rate * 100).toFixed(0)}%) | ${judgeOk ? '✅' : '❌'} |`,
    '',
  ];

  if (!allOk) {
    lines.push('**v2가 v1보다 낮으면 머지 차단.**');
    lines.push('');
    if (!writerOk) lines.push('- checkin_writer: v2 < v1');
    if (!judgeOk) lines.push('- llm_judge: v2 < v1');
  }

  console.log(lines.join('\n'));

  if (!allOk) {
    process.exit(1);
  }
}

main();
