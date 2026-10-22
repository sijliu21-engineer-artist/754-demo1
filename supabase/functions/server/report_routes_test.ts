import { expandReportFiles, validateSections, validateObservations } from "./report_routes.tsx";
import type { MedicalRecord } from "./record_routes.tsx";

const source: MedicalRecord = {
  id: "record-a", username: "account_a", fileName: "lab.pdf", mimeType: "application/pdf",
  size: 100, storagePath: "account_a/lab.pdf", extractionStatus: "ready", createdAt: "2026-10-11",
  extractedText: "Hemoglobin 112 g/L. Suspected liver metastasis. No treatment recorded.",
};
const fact = { label: "Hemoglobin", value: "112 g/L", sourceId: "record-a", quote: "Hemoglobin 112 g/L." };
const assert = (value: unknown) => { if (!value) throw new Error("Assertion failed"); };

Deno.test("batch files retain separate evidence and source names", () => {
  const files = ["01.pdf", "02.pdf"].map((fileName) => ({ fileName, mimeType: "application/pdf", size: 100, storagePath: fileName }));
  const expanded = expandReportFiles([{ ...source, files, extractedText: "FILE 1: 01.pdf\nHemoglobin 92 g/L.\n\nFILE 2: 02.pdf\nHemoglobin 109 g/L." }]);
  assert(expanded.length === 2);
  assert(expanded[1].fileName === "02.pdf");
  assert(!expanded[0].extractedText.includes("109"));
  const result = validateSections({ results: [{ ...fact, value: "109 g/L", quote: "Hemoglobin 109 g/L.", sourceId: expanded[1].id }] }, expanded);
  assert(result.sections.results[0].sourceId === expanded[1].id);
  let failed = false;
  try { expandReportFiles([{ ...source, files }]); } catch { failed = true; }
  assert(failed);
});

Deno.test("concise summary caps results, removes duplicates and rejects long quotes", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ ...fact, label: `Test${i}`, value: `${i} g/L`, quote: `Test${i}: ${i} g/L.` }));
  const record = { ...source, extractedText: items.map((f) => f.quote).join(" ") + " " + source.extractedText };
  const result = validateSections({ results: [fact, fact, { ...fact, quote: "x".repeat(221) }, ...items] }, [record]);
  assert(result.sections.results.length === 8);
  assert(result.sections.results.filter((f) => f.label === "Hemoglobin").length === 1);
  assert(result.rejected === 1);
});

Deno.test("keeps exact sourced values and preserves suspected qualifiers", () => {
  const result = validateSections({ results: [fact], imaging: [{ label: "Liver", value: "Suspected liver metastasis", sourceId: "record-a", quote: "Suspected liver metastasis." }] }, [source]);
  assert(result.sections.results[0].value === "112 g/L");
  assert(result.sections.imaging[0].value.startsWith("Suspected"));
  assert(result.sections.treatment.length === 0);
});

Deno.test("rejects invented numbers, missing evidence and another account's source", () => {
  const result = validateSections({ results: [fact, { ...fact, value: "145 g/L" }, { ...fact, sourceId: "record-other-account" }, { ...fact, quote: "Hemoglobin 145 g/L." }, { ...fact, label: "Platelets" }] }, [source]);
  assert(result.sections.results.length === 1);
  assert(result.rejected === 4);
});

Deno.test("does not allow a completely unsupported generated report", () => {
  let failed = false;
  try { validateSections({ results: [{ ...fact, value: "999 g/L" }] }, [source]); } catch { failed = true; }
  assert(failed);
});

Deno.test("indicator index rejects invented values, units and cross-file evidence", () => {
  const record = { ...source, extractedText: "Patient A 2026-06-26\nHemoglobin 92 g/L Reference 80-120" };
  const row = { name: "Hemoglobin", valueText: "92", unit: "g/L", date: "2026-06-26", dateQuote: "Patient A 2026-06-26", patient: "Patient A", reference: "80-120", quote: "Hemoglobin 92 g/L Reference 80-120" };
  const result = validateObservations({ results: [row, row, { ...row, valueText: "109" }, { ...row, unit: "mg/L" }, { ...row, patient: "Patient B" }, { ...row, valueText: "2" }] }, record, "batch-a");
  assert(result.length === 1);
  assert(result[0].date === "2026-06-26");
  assert(result[0].recordId === "batch-a");
});
Deno.test("indicator index retains undated data without using upload dates", () => {
  const row = { name: "Hemoglobin", valueText: "112", unit: "g/L", date: "2026-10-11", dateQuote: "", patient: "", reference: "", quote: "Hemoglobin 112 g/L." };
  const result = validateObservations({ results: [row] }, source, source.id);
  assert(result.length === 1);
  assert(result[0].date === null);
});
