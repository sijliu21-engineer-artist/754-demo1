const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const Module = require("node:module");
const { JSDOM } = require(require.resolve("jsdom", { paths: [path.join(process.cwd(), "tmp/manual-review-tests"), process.cwd()] }));
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost:8443/" });
for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "Event", "MouseEvent", "File", "FileReader", "sessionStorage", "localStorage"]) global[name] = dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT = true;
global.URL.createObjectURL = () => "blob:review-test";
global.URL.revokeObjectURL = () => {};
let uploadCalls = [];
global.fetch = async (url, init) => { uploadCalls.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ record: { id: "saved-upload" } }) }; };

// ---------- synthetic OCR helpers ----------
const W = (text, confidence = 95, bbox) => ({ text, confidence, bbox });
const line = (...words) => ({ text: words.map((w) => w.text).join(" "), confidence: 95, words });
const row = (y, name, value, unit, range, valueConfidence = 95) => {
  const words = name.split(" ").map((part, i) => W(part, 95, { x0: 20 + i * 60, y0: y, x1: 70 + i * 60, y1: y + 20 }));
  if (value !== null) words.push(W(value, valueConfidence, { x0: 300, y0: y, x1: 340, y1: y + 20 }));
  words.push(W(unit, 90, { x0: 420, y0: y, x1: 480, y1: y + 20 }), W(range, 95, { x0: 560, y0: y, x1: 640, y1: y + 20 }));
  return line(...words);
};
const cbc = (hemoglobin, lymphocytes = "1.2") => [
  line(W("Report"), W("Date:"), W("2026-06-26")),
  row(100, "White blood cells", "4.6", "10^9/L", "3.5-9.5"),
  row(140, "Hemoglobin", hemoglobin, "g/L", "130-175"),
  row(180, "Platelets", "126", "10^9/L", "125-350"),
  row(220, "Red blood cells", "3.82", "1OA12A,", "4.3-5.8"),
  row(260, "Hematocrit", "34.2", "%", "40-50"),
  row(300, "MCV", "89.5", "fL", "82-100"),
  row(340, "Neutrophils", "2.8", "1049/L", "1.8-6.3"),
  row(380, "Lymphocytes", lymphocytes, "10^9/L", "1.1-3.2"),
];

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "./lib/recognition" || request === "../lib/recognition") return {
    recognizeFileDetailed: async (file) => {
      if (file.name.endsWith(".pdf")) return { text: "Hemoglobin 109 g/L", needsReview: false, issues: [], scannedPages: [] };
      if (file.name.startsWith("clear")) return helpers.assessRecognizedPage("", 1, 92, cbc("112"));
      return helpers.assessRecognizedPage("", 1, 92, cbc("142"));
    },
  };
  return originalLoad.call(this, request, parent, isMain);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) => {
  let source = fs.readFileSync(file, "utf8");
  if (file.endsWith(path.join("src", "App.tsx"))) source += "\nexport { Generate as TestGenerate };";
  module._compile(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
};
require.extensions[".css"] = () => {};
for (const extension of [".png", ".svg"]) require.extensions[extension] = (module) => { module.exports = "asset"; };
const helpers = require(path.join(process.cwd(), "src/lib/recognition-review.ts"));
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const { TestGenerate } = require(path.join(process.cwd(), "src/App.tsx"));
const button = (text) => [...document.querySelectorAll("button")].find((entry) => entry.textContent.includes(text));
const nativeInput = async (element, value) => { const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); };
async function mount() { const root = createRoot(document.getElementById("root")); await act(async () => root.render(React.createElement(TestGenerate, { nav() {}, onSend() {}, onUploaded() {} }))); return root; }
async function choose(names) { const input = document.querySelector('input[type="file"]'); Object.defineProperty(input, "files", { configurable: true, value: names.map((name) => new File(["synthetic"], name, { type: name.endsWith(".pdf") ? "application/pdf" : "image/png" })) }); await act(async () => input.dispatchEvent(new Event("change", { bubbles: true }))); await act(async () => button(`Upload ${names.length} file(s)`).click()); }
async function click(element) { assert(element, "Expected control was rendered"); await act(async () => element.click()); }
const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 25)));

(async () => {
  // --- the checker itself ---
  const clean = helpers.assessRecognizedPage("", 1, 92, cbc("112"));
  assert.equal(clean.needsReview, false, "A clean, self-consistent report must go straight through");
  assert.equal(clean.checkedValues, 8);
  assert(clean.text.includes("Red blood cells 3.82 10^12/L 4.3-5.8"), "Garbled units are normalised from the test name");
  assert(clean.text.includes("Neutrophils 2.8 10^9/L"), "Garbled units are normalised from the test name");

  const wrong = helpers.assessRecognizedPage("", 1, 92, cbc("142"));
  assert.equal(wrong.issues.length, 1, "Only the value that contradicts the rest is flagged");
  assert.equal(wrong.issues[0].test, "Hemoglobin / 血红蛋白", "The issue names the test, not a line number");
  assert.equal(wrong.issues[0].expected, "109–123 g/L", "Expected range comes from Hematocrit");
  assert(wrong.issues[0].reasons.join(" ").includes("Hematocrit 34.2"));

  const lymph = helpers.assessRecognizedPage("", 1, 92, cbc("112", "12"));
  assert.equal(lymph.issues.length, 1);
  assert.equal(lymph.issues[0].test, "Lymphocytes / 淋巴细胞", "A dropped decimal is blamed on the value that breaks the white-cell total");
  assert.equal(lymph.issues[0].suggestion, "1.2");

  const albumin = helpers.assessRecognizedPage("", 1, 92, [row(100, "Albumin", "353", "g/L", "40-55"), row(140, "Sodium", "139", "mmol/L", "137-147"), row(180, "Total bilirubin", "126", "umol/L", "0-21")]);
  assert.deepEqual(albumin.issues.map((issue) => issue.test), ["Albumin / 白蛋白"], "Impossible values are flagged; abnormal-but-possible ones are not");
  assert.equal(albumin.issues[0].suggestion, "35.3");

  const covered = helpers.assessRecognizedPage("", 1, 92, [row(100, "Platelets", "13¢", "109/L", "125-350", 40), row(140, "Creatinine", null, "umol/", "57-111"), row(180, "Urea", "6.1", "mmol/L", "3.1-8.0")]);
  assert.deepEqual(covered.issues.map((issue) => [issue.test, issue.kinds[0]]), [["Platelets / 血小板", "unreadable"], ["Creatinine / 肌酐", "missing"]]);
  assert(covered.text.includes("Creatinine umol/L 57-111"), "A partly erased unit is completed from the test name");

  const chinese = helpers.assessRecognizedPage("", 1, 92, ["血 红 蛋 白 172 g/L 130-175 偏 低", "红 细 胞 压 积 34.1 % 40.0-50.0 偏 低", "红 细 胞 3.92 10^12/L 4.30-5.80", "平 均 红 细 胞 体 积 87.0 fL 82.0-100.0"].map((text) => line(...text.split(" ").map((part) => W(part)))));
  assert.equal(chinese.issues.length, 1, "MCV confirms Hematocrit, so only Hemoglobin is blamed"); assert.equal(chinese.issues[0].test, "Hemoglobin / 血红蛋白");
  const undecided = helpers.assessRecognizedPage("", 1, 92, [row(100, "Hemoglobin", "172", "g/L", "130-175"), row(140, "Hematocrit", "34.1", "%", "40-50")]);
  assert.equal(undecided.issues.length, 2, "Without a third result to decide, both conflicting values are shown");
  assert(chinese.text.startsWith("血红蛋白 172 g/L"), "Chinese names are matched across OCR spaces");

  // Blur: three sharp numbers and one smeared one on a synthetic page.
  const width = 200, height = 220, data = new Uint8Array(width * height).fill(255);
  const ink = (y0, sharp) => { for (let y = y0; y < y0 + 20; y += 1) for (let x = 60; x < 100; x += 1) if ((x - 60) % 8 < 4) data[y * width + x] = 0; if (!sharp) for (let pass = 0; pass < 4; pass += 1) for (let y = y0 - 8; y < y0 + 28; y += 1) for (let x = 52; x < 108; x += 1) data[y * width + x] = Math.round((data[y * width + x - 1] + data[y * width + x + 1] + data[(y - 1) * width + x] + data[(y + 1) * width + x] + data[y * width + x]) / 5); };
  const tests = [["White blood cells", "4.6", 15], ["Neutrophils", "2.8", 65], ["Lymphocytes", "1.2", 115], ["Platelets", "126", 165]];
  tests.forEach(([, , y], i) => ink(y, i < 3));
  const blurred = helpers.assessRecognizedPage("", 1, 92, tests.map(([name, value, y]) => line(W(name, 95, { x0: 0, y0: y, x1: 40, y1: y + 20 }), W(value, 95, { x0: 60, y0: y, x1: 100, y1: y + 20 }), W("10^9/L", 95, { x0: 150, y0: y, x1: 199, y1: y + 20 }))), { width, height, data });
  assert.deepEqual(blurred.issues.map((issue) => [issue.test, issue.kinds.includes("blurred")]), [["Platelets / 血小板", true]], "Only the smeared number is reported as blurred");

  const fixed = helpers.applyFixes(wrong.text, wrong.issues, { [wrong.issues[0].id]: { mode: "value", value: "112" } });
  assert(fixed.includes("Hemoglobin 112 g/L 130-175") && !fixed.includes("142"));
  const removed = helpers.applyFixes(covered.text, covered.issues, { [covered.issues[0].id]: { mode: "remove" }, [covered.issues[1].id]: { mode: "value", value: "88" } });
  assert(!removed.includes("Platelets") && removed.includes("Creatinine 88 umol/L 57-111"));
  console.log("PASS context checks: clean report passes, wrong/blurred/faded/missing values are named with reasons");

  // --- the upload flow ---
  let root = await mount(); await choose(["clear.png"]); await settle();
  assert(!document.querySelector('[role="dialog"]'), "Clean scans skip the review dialog");
  assert.equal(uploadCalls.length, 1, "Clean scans upload and continue to report generation");
  console.log("PASS clean scan generates the report without manual review");
  await act(async () => root.unmount()); uploadCalls = [];

  root = await mount(); await choose(["blurred.png"]);
  assert(document.querySelector('[role="dialog"]'), "Flagged values open the review");
  assert.equal(uploadCalls.length, 0, "Nothing is uploaded before the flagged value is fixed");
  assert(document.querySelector(".rr-issue h4").textContent.includes("Hemoglobin"), "The card names the test");
  assert(document.body.textContent.includes("109–123 g/L"), "The card shows what the other results imply");
  assert(button("left to check").disabled);
  await nativeInput(document.querySelector('[aria-label="Correct value for Hemoglobin / 血红蛋白"]'), "112");
  assert(!button("Confirm & generate").disabled);
  await click(button("Confirm & generate")); await settle();
  assert.equal(uploadCalls.length, 1); const saved = uploadCalls[0].files[0].extractedText;
  assert(saved.includes("Hemoglobin 112 g/L") && !saved.includes("142"));
  console.log("PASS flagged value must be corrected; corrected text is what gets saved");
  await act(async () => root.unmount()); uploadCalls = [];

  root = await mount(); await choose(["clear.png", "blurred.png"]);
  assert(document.querySelector(".rr-file.is-current").textContent.includes("blurred.png"), "Review opens on the report that needs checking");
  await click([...document.querySelectorAll(".rr-file")][0]);
  assert(!document.querySelector(".rr-issue"), "Switching report switches the list of values to check");
  assert(document.querySelector(".rr-clear"), "Clean report shows nothing to do");
  await click([...document.querySelectorAll(".rr-file")][1]);
  assert.equal(document.querySelectorAll(".rr-issue").length, 1);
  await click(button("142 is correct"));
  assert(!button("Confirm & generate").disabled, "A value can be confirmed as matching the original");
  await click(button("Cancel —")); assert.equal(uploadCalls.length, 0); assert(!document.querySelector('[role="dialog"]'));
  console.log("PASS report switcher keeps issues per report; cancel writes nothing");
  await act(async () => root.unmount());

  root = await mount(); await choose(["leave-page.png"]);
  await act(async () => root.unmount()); assert.equal(uploadCalls.length, 0);
  console.log("PASS leaving the page cancels pending review without uploading");
  root = await mount(); await choose(["text-layer.pdf"]); await settle();
  assert(!document.querySelector('[role="dialog"]')); assert.equal(uploadCalls.length, 1);
  console.log("PASS native-text PDF keeps the existing upload flow");
  await act(async () => root.unmount()); dom.window.close();
})().catch((error) => { console.error(error); process.exit(1); });
