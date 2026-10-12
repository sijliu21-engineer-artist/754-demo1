from pathlib import Path
s = Path('tmp/verify-batch.mjs').read_text(encoding='utf-8')
s = s.replace('const files = texts.map', '''texts.forEach((text, i) => { texts[i] = text + Array.from({ length: 60 }, (_, j) => `\n常规项目${j}：${j + 10} U/L，正常，参考范围0-100 U/L。`).join(""); });
const files = texts.map''')
s = s.replace('const facts = Object.values', '''assert(Object.values(generated.report.sections).flat().length <= 21, "Concise report exceeds limit");
assert(generated.report.summaryMode === "concise", "Concise service not deployed");
console.log("PASS: 180 routine results reduced to a bounded concise summary");
const facts = Object.values''')
Path('tmp/verify-concise.mjs').write_text(s,encoding='utf-8')
