import fs from "node:fs/promises";
import crypto from "node:crypto";
const key = (await fs.readFile("utils/supabase/info.tsx", "utf8")).match(/publicAnonKey = "([^"]+)"/)[1];
const base = "https://cvsjenanqqmkepmcvdhu.supabase.co/functions/v1/make-server-ba71e98d/";
async function api(path, token, body) {
  const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: {
    Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(token ? { "X-CaseMate-Session": token } : {}),
  }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(115000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${result.error}`);
  return result;
}
const assert = (value, message) => { if (!value) throw new Error(message); };
const account = await api("auth/register", null, { username: `qa_library_${crypto.randomBytes(5).toString("hex")}`, password: `Qa${crypto.randomBytes(12).toString("hex")}`, displayName: "Originals and reports test" });
const bytes = await fs.readFile("tmp/pdfs/scan-clear-01.png");
const records = [];
for (const fileName of ["01_血常规.png", "02_血常规.png"]) {
  const result = await api("records", account.token, { fileName, mimeType: "image/png", size: bytes.length,
    base64: bytes.toString("base64"), extractedText: "模拟血常规报告，仅供测试。性别：男。年龄：38岁。血红蛋白：112 g/L，参考范围130-175 g/L，偏低。" });
  records.push(result.record);
}
const listed = await api("reports", account.token);
assert(listed.reports.length === 2 && listed.reports.every((report) => !report.generated), "Two uploads must create two report entries");
console.log("PASS: two originals correspond to two report entries");
const original = await api(`records/${records[0].id}/recognition-url`, account.token, {});
const downloaded = Buffer.from(await (await fetch(original.url)).arrayBuffer());
assert(downloaded.equals(bytes), "Original image bytes must not change");
console.log("PASS: original image is preserved byte-for-byte");
await fs.writeFile("tmp/qa-library-session.json", JSON.stringify({ token: account.token, recordId: records[0].id }));
console.log("Generating independent report...");
const generated = await api(`report?recordId=${records[0].id}`, account.token, {});
assert(generated.report.sources.length === 1 && generated.report.sources[0].id === records[0].id, "Report must use only selected file");
const saved = await api(`report?recordId=${records[0].id}`, account.token);
assert(saved.report.generatedAt === generated.report.generatedAt, "Independent report must persist");
const untouched = await api(`report?recordId=${records[1].id}`, account.token);
assert(untouched.report === null, "Second file must not reuse first file's report");
const final = await api("reports", account.token);
assert(final.reports.length === 2 && final.reports.filter((report) => report.generated).length === 1, "Generated status must match saved reports");
console.log("PASS: selected report is independently generated and saved; second report remains pending");
