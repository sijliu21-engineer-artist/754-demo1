import fs from "node:fs/promises";
import crypto from "node:crypto";
const key = (await fs.readFile("utils/supabase/info.tsx", "utf8")).match(/publicAnonKey = "([^"]+)"/)[1];
const base = "https://cvsjenanqqmkepmcvdhu.supabase.co/functions/v1/make-server-ba71e98d/";
async function api(path, token, body) {
  const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(token ? { "X-CaseMate-Session": token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(115000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status}: ${result.error}`);
  return result;
}
const assert = (v, message) => { if (!v) throw new Error(message); };
const username = `qa_batch_${crypto.randomBytes(5).toString("hex")}`;
const password = `Qa${crypto.randomBytes(12).toString("hex")}`;
const account = await api("auth/register", null, { username, password, displayName: "Batch upload test" });
const bytes = await fs.readFile("tmp/pdfs/scan-clear-01.png");
const texts = ["模拟数据。血红蛋白：112 g/L。", "模拟数据。白细胞：7.80 ×10^9/L。", "模拟数据。血小板：220 ×10^9/L。"];
const files = texts.map((extractedText, i) => ({ fileName: `测试_${i + 1}.png`, mimeType: "image/png", size: bytes.length, base64: bytes.toString("base64"), extractedText }));
const uploaded = await api("records", account.token, { files });
assert(uploaded.record.files.length === 3, "Must preserve three originals");
const records = await api("records", account.token);
const reports = await api("reports", account.token);
assert(records.records.length === 1 && reports.reports.length === 1, "One batch must count as one upload and report");
console.log("PASS: 3 images -> 1 upload record + 1 report entry");
const originals = await api(`records/${uploaded.record.id}/recognition-url`, account.token, {});
assert(originals.files.length === 3, "Must expose all three originals");
for (const file of originals.files) assert(Buffer.from(await (await fetch(file.url)).arrayBuffer()).equals(bytes), "Original bytes changed");
console.log("PASS: all three original images preserved byte-for-byte");
const generated = await api(`report?recordId=${uploaded.record.id}`, account.token, {});
const facts = Object.values(generated.report.sections).flat().map(f => f.value).join(" ");
for (const expected of ["112", "7.80", "220"]) assert(facts.includes(expected), `Missing key data ${expected}`);
const login = await api("auth/login", null, { username, password });
const saved = await api(`report?recordId=${uploaded.record.id}`, login.token);
assert(saved.report.generatedAt === generated.report.generatedAt, "Report not persisted across login");
console.log("PASS: one report includes data from all three images and persists after login");
try { await api("records", login.token, { files: [files[0], { ...files[1], size: 1 }] }); throw new Error("Invalid upload accepted"); } catch (e) { if (!e.message.includes("incomplete")) throw e; }
assert((await api("records", login.token)).records.length === 1, "Failed batch created a partial record");
console.log("PASS: invalid batch creates no partial upload record");
