import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
const source = await fs.readFile("utils/supabase/info.tsx", "utf8");
const key = source.match(/publicAnonKey = "([^"]+)"/)[1];
const base = "https://cvsjenanqqmkepmcvdhu.supabase.co/functions/v1/make-server-ba71e98d/";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function api(path, token, method = "GET", payload) {
  const response = await fetch(base + path, { method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(token ? { "X-CaseMate-Session": token } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(115000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${data.error}`);
  return data;
}
const id = randomBytes(5).toString("hex");
const username = `qa_report_${id}`;
const password = `Qa${randomBytes(12).toString("hex")}`;
const account = await api("auth/register", null, "POST", { username, password, displayName: "Report feature test" });
assert((await api("records", account.token)).records.length === 0, "New test account must have 0 files");
console.log("PASS: new account has 0 uploads");
const pdf = await fs.readFile("output/pdf/模拟癌症患者_检查报告及诊断书_合并版.pdf");
const extractedText = await fs.readFile("tmp/pdfs/onco-text.txt", "utf8");
const upload = await api("records", account.token, "POST", { fileName: "QA_synthetic_cancer_reports.pdf", mimeType: "application/pdf", size: pdf.length, base64: pdf.toString("base64"), extractedText });
assert(upload.record.extractionStatus === "ready", "Uploaded PDF must have readable text");
console.log("PASS: synthetic PDF saved and indexed");
const login = await api("auth/login", null, "POST", { username, password });
assert((await api("records", login.token)).records.length === 1, "Upload must survive a new login");
console.log("PASS: upload persists after a new login");
const other = await api("auth/register", null, "POST", { username: `qa_other_${id}`, password, displayName: "Account isolation test" });
assert((await api("records", other.token)).records.length === 0, "Other account must not see uploads");
assert((await api("report", other.token)).report === null, "Other account must not see report");
console.log("PASS: account isolation");
await fs.writeFile("tmp/qa-report-session.json", JSON.stringify({ username, password, token: login.token }));
console.log("Generating source-based report...");
const generated = await api("report", login.token, "POST");
assert(generated.report.sources.length === 1, "Report must use the uploaded source");
assert(generated.report.sections.results.length > 0, "Report must have lab results");
assert(generated.report.sections.basic.length > 0, "Report must have basic information");
assert(JSON.stringify(generated.report.sections).includes("112"), "Report must reflect the synthetic hemoglobin result");
assert(!JSON.stringify(generated.report.sections).includes("Wang**"), "Template data must not leak into report");
console.log("PASS: AI report contains source-based facts, not template values");
const again = await api("auth/login", null, "POST", { username, password });
const saved = await api("report", again.token);
assert(saved.report.generatedAt === generated.report.generatedAt, "Report must be saved across logins");
console.log("PASS: generated report persists across logins without another AI call");
await fs.writeFile("tmp/qa-report-result.json", JSON.stringify(generated.report, null, 2));
