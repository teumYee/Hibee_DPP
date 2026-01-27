import fs from "fs";
import path from "path";

function usage() {
  console.log(`
Usage:
  node run_test.mjs --input inputs/checkin_A_day1_step1.json

Options:
  --input <path>        Step1 input JSON file path (required)
  --server <url>        AI server base URL (default: http://localhost:8000)
  --endpoint <path>     Endpoint path (default: /ai/checkin-question)
  --mode <name>         chain | coverage (default: chain)
                        - chain: step1 -> step2 -> step3 (1회 경로)
                        - coverage: step1 options 각각을 step1 답변으로 넣어 step2를 5회 호출
  --outDir <dir>        Output directory (default: reviews)
`);
}

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function requireArg(name) {
  const v = getArg(name);
  if (!v) {
    console.error(`Missing required arg: ${name}`);
    usage();
    process.exit(1);
  }
  return v;
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error(`Failed to read file: ${filePath}`);
    console.error(e.message);
    process.exit(1);
  }
}

function safeReadJson(filePath) {
  const raw = safeReadText(filePath);
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON in file: ${filePath}`);
    console.error(e.message);
    process.exit(1);
  }
}

function safeWriteJson(filePath, obj) {
  const absOut = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(obj, null, 2), "utf-8");
  console.error(`Saved: ${absOut}`);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Server error: ${res.status} ${res.statusText}`);
    console.error(text);
    process.exit(1);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Server returned non-JSON:");
    console.error(text);
    process.exit(1);
  }
}

// ---- 선택 규칙 (B모드에서 사용): deterministic ----
function pickStep1ValueByMetrics(step1Response, step1Input) {
  const opts = step1Response?.options ?? [];
  const byValue = new Map(opts.map(o => [o.value, o]));

  const m = step1Input?.context?.today_metrics ?? {};
  const late = Number(m?.late_night_minutes ?? 0);
  const maxSession = Number(m?.session_features?.max_session_minutes ?? 0);
  const topSwitch = Number(m?.session_features?.top_switch_pairs?.[0]?.count ?? 0);

  // 규칙: 지표 기반으로 “가장 관련 있어 보이는 value가 존재하면 그걸 선택”
  const candidates = [
    late >= 120 ? "late_night_focus" : null,
    maxSession >= 60 ? "long_immersion" : null,
    topSwitch >= 5 ? "sns_game_alt" : null,
    "mixed_pace",
  ].filter(Boolean);

  for (const v of candidates) {
    if (byValue.has(v)) return v;
  }

  // 혹시 value 이름이 다를 수 있으니 fallback: 첫 option
  return opts[0]?.value ?? null;
}

function makeNextInput(prevInput, nextStep, previousAnswers) {
  return {
    ...prevInput,
    step: nextStep,
    previous_answers: previousAnswers,
  };
}

async function main() {
  const inputPath = requireArg("--input");
  const server = getArg("--server", "http://localhost:8000");
  const endpoint = getArg("--endpoint", "/ai/checkin-question");
  const mode = getArg("--mode", "chain"); // chain | coverage
  const outDir = getArg("--outDir", "reviews");

  const step1Input = safeReadJson(inputPath);
  const url = `${server}${endpoint}`;

  // 0) Step1 call
  console.error(`POST ${url}`);
  const step1 = await postJson(url, step1Input);
  console.log("\n=== STEP1 OUTPUT ===");
  console.log(JSON.stringify(step1, null, 2));

  // 저장
  const baseName = path.basename(inputPath).replace(".json", "");
  safeWriteJson(`${outDir}/${baseName}_step1_output.json`, step1);

  // ---- MODE: coverage (step1 옵션 각각을 선택해 step2 5회) ----
  if (mode === "coverage") {
    const opts = step1?.options ?? [];
    if (!opts.length) {
      console.error("No options returned from step1; cannot run coverage mode.");
      process.exit(1);
    }

    for (const opt of opts) {
      const prev = [{
        step: 1,
        selected_values: [opt.value],
        free_text: ""
      }];

      const step2Input = makeNextInput(step1Input, 2, prev);
      const step2 = await postJson(url, step2Input);

      console.log(`\n=== STEP2 OUTPUT (selected: ${opt.value}) ===`);
      console.log(JSON.stringify(step2, null, 2));

      safeWriteJson(`${outDir}/${baseName}_step2_selected_${opt.value}.json`, step2);
    }

    return;
  }

  // ---- MODE: chain (step1 -> step2 -> step3 1회 경로) ----
  // 1) choose step1 selected value deterministically
  const picked = pickStep1ValueByMetrics(step1, step1Input);
  if (!picked) {
    console.error("Could not pick a step1 option value.");
    process.exit(1);
  }
  console.error(`Picked step1 value by rule: ${picked}`);

  const prev1 = [{
    step: 1,
    selected_values: [picked],
    free_text: ""
  }];

  // 2) Step2 call
  const step2Input = makeNextInput(step1Input, 2, prev1);
  const step2 = await postJson(url, step2Input);
  console.log("\n=== STEP2 OUTPUT ===");
  console.log(JSON.stringify(step2, null, 2));
  safeWriteJson(`${outDir}/${baseName}_step2_output.json`, step2);

  // 3) choose step2 first option (deterministic + 최소)
  const step2Picked = step2?.options?.[0]?.value ?? null;
  if (!step2Picked) {
    console.error("No options returned from step2; cannot proceed to step3.");
    process.exit(1);
  }
  console.error(`Picked step2 value (first option): ${step2Picked}`);

  const prev2 = [
    ...prev1,
    { step: 2, selected_values: [step2Picked], free_text: "" }
  ];

  // 4) Step3 call
  const step3Input = makeNextInput(step1Input, 3, prev2);
  const step3 = await postJson(url, step3Input);
  console.log("\n=== STEP3 OUTPUT ===");
  console.log(JSON.stringify(step3, null, 2));
  safeWriteJson(`${outDir}/${baseName}_step3_output.json`, step3);
}

main().catch((e) => {
  console.error("Unexpected error:");
  console.error(e);
  process.exit(1);
});
