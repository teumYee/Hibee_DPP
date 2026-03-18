const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = __dirname;

function loadSystemPrompt(filename) {
  const filepath = path.join(PROMPTS_DIR, filename);
  return fs.readFileSync(filepath, 'utf8').trim();
}

module.exports = {
  buildWriterV1({ vars }) {
    const system = loadSystemPrompt('checkin_writer_v1.txt');
    const payload = typeof vars.payload === 'string' ? vars.payload : JSON.stringify(vars.payload || {}, null, 2);
    return [
      { role: 'system', content: system },
      { role: 'user', content: payload },
    ];
  },
  buildWriterV2({ vars }) {
    const system = loadSystemPrompt('checkin_writer_v2.txt');
    const payload = typeof vars.payload === 'string' ? vars.payload : JSON.stringify(vars.payload || {}, null, 2);
    return [
      { role: 'system', content: system },
      { role: 'user', content: payload },
    ];
  },
  buildJudgeV1({ vars }) {
    const system = loadSystemPrompt('llm_judge_v1.txt');
    const payload = typeof vars.payload === 'string' ? vars.payload : JSON.stringify(vars.payload || {}, null, 2);
    return [
      { role: 'system', content: system },
      { role: 'user', content: payload },
    ];
  },
  buildJudgeV2({ vars }) {
    const system = loadSystemPrompt('llm_judge_v2.txt');
    const payload = typeof vars.payload === 'string' ? vars.payload : JSON.stringify(vars.payload || {}, null, 2);
    return [
      { role: 'system', content: system },
      { role: 'user', content: payload },
    ];
  },
};
