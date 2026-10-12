import { validateSections } from "./report_routes.tsx";
import type { MedicalRecord } from "./record_routes.tsx";

const source: MedicalRecord = {
  id: "record-a", username: "account_a", fileName: "lab.pdf", mimeType: "application/pdf",
  size: 100, storagePath: "account_a/lab.pdf", extractionStatus: "ready", createdAt: "2026-10-11",
  extractedText: "Hemoglobin 112 g/L. Suspected liver metastasis. No treatment recorded.",
};
const fact = { label: "Hemoglobin", value: "112 g/L", sourceId: "record-a", quote: "Hemoglobin 112 g/L." };
const assert = (value: unknown) => { if (!value) throw new Error("Assertion failed"); };

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
