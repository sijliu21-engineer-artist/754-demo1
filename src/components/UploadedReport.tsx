import { useEffect, useRef, useState } from "react";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { recognizeFile } from "../lib/recognition";

type Fact = { label: string; value: string; sourceId: string; quote: string };
type Report = {
  generatedAt: string;
  sections: Record<string, Fact[]>;
  sources: Array<{ id: string; fileName: string; extractionStatus: string }>;
  warnings: string[];
};
const sections = [
  ["basic", "1. Basic information"], ["treatment", "2. Treatment history (timeline)"],
  ["results", "3. Key result history"], ["imaging", "4. Imaging & assessment"],
  ["notes", "5. Follow-up questions & notes"],
] as const;

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/${path}`, {
    ...options, cache: "no-store", headers: {
      Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json",
      "X-CaseMate-Session": sessionStorage.getItem("casemate_session") || "",
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load the uploaded report.");
  return result;
}

export default function UploadedReport({ onUpload, onSources, recordId }: { onUpload: () => void; onSources: () => void; recordId?: string }) {
  const reportPath = recordId ? `report?recordId=${encodeURIComponent(recordId)}` : "report";
  const [report, setReport] = useState<Report | null>(null);
  const [pending, setPending] = useState<Array<{ id: string; fileName: string }>>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Loading your saved report…");
  const [busy, setBusy] = useState(true);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [reviewItem, setReviewItem] = useState<string | null>(null);
  const confirmationItems = report ? [...new Set([...report.warnings, ...(report.sections.notes || []).map((fact) => `${fact.label}: ${fact.value}`)])] : [];
  const active = useRef(true);

  const generate = async () => {
    setBusy(true); setError(""); setProgress("Generating a report from your uploaded records…");
    try {
      const result = await request(reportPath, { method: "POST" });
      if (active.current) setReport(result.report);
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : "Report generation failed.");
    } finally {
      if (active.current) { setBusy(false); setProgress(""); }
    }
  };

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await request(reportPath, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setPending(result.unreadable || []);
        if (result.report) { setReport(result.report); setBusy(false); setProgress(""); }
        else if (result.recordCount > 0 && result.unreadable?.length !== result.recordCount) await generate();
        else { setBusy(false); setProgress(""); }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Unable to load your report.");
          setBusy(false); setProgress("");
        }
      }
    };
    void load();
    return () => { active.current = false; controller.abort(); };
  }, []);

  const recognizeExisting = async () => {
    setBusy(true); setError("");
    try {
      for (const record of pending) {
        setProgress(`Opening ${record.fileName}…`);
        const original = await request(`records/${record.id}/recognition-url`, { method: "POST" });
        const texts = [];
        for (const fileSource of original.files || [original]) {
          const response = await fetch(fileSource.url);
          if (!response.ok) throw new Error(`Unable to download ${fileSource.fileName}.`);
          const file = new File([await response.blob()], fileSource.fileName, { type: fileSource.mimeType });
          const text = await recognizeFile(file, (message) => { if (active.current) setProgress(`${fileSource.fileName}: ${message}`); });
          if (!text.trim()) throw new Error(`No text was found in ${fileSource.fileName}. Try a clearer image.`);
          texts.push(`FILE: ${fileSource.fileName}\n${text}`);
        }
        const extractedText = texts.join("\n\n");
        await request(`records/${record.id}/text`, { method: "PUT", body: JSON.stringify({ extractedText }) });
      }
      if (active.current) setPending([]);
      await generate();
    } catch (error) {
      if (active.current) {
        setError(error instanceof Error ? error.message : "Recognition failed.");
        setBusy(false); setProgress("");
      }
    }
  };

  return <div className="content generated-report">
    <section className="card">
      <div className="report-heading">
        <svg className="generated-report-icon" width="34" height="40" viewBox="0 0 34 40" fill="none" aria-hidden="true"><path d="M6 2h15l9 9v27H6V2Z" stroke="currentColor" strokeWidth="3" /><path d="M21 2v10h9M11 20h13M11 27h13" stroke="currentColor" strokeWidth="3" /></svg>
        <div><h2>{report?.sources.length === 1 ? report.sources[0].fileName : "Your medical summary"}</h2>
          {report && <small>{new Date(report.generatedAt).toLocaleString()} · {report.sources.length} upload record(s)</small>}
        </div>
        {report && <button className="button compact" onClick={onSources}>Originals</button>}
      </div>
      <p className="caption">Key diagnoses, treatment and selected test results from your uploads. This summary does not list every result. View the complete originals in Uploaded files.</p>
      {report && <p className="notice">{report.warnings.length ? `${report.warnings.length} item(s) to confirm. Check them against the originals below.` : "Keep the original reports available when checking this summary."}</p>}
      {progress && <p role="status" aria-live="polite">{progress}</p>}
      {error && <p className="chat-error" role="alert">{error}</p>}
      {pending.length > 0 && <>
        <p className="notice">{pending.length} file(s) need text recognition before they can be included.</p>
        <button className="button primary" disabled={busy} onClick={recognizeExisting}>Recognize existing uploads & generate</button>
      </>}
      {!busy && !report && <>
        <p>No generated report yet. No example patient data is used on this page.</p>
        <button className="button" onClick={generate}>Generate / retry</button>
        <button className="button" onClick={onUpload}>Upload a report</button>
      </>}
    </section>
    {report && <section className="card confirm-card">
      <h2>{confirmationItems.length ? `${confirmationItems.length} ${confirmationItems.length === 1 ? "item" : "items"} to confirm` : "Review & confirmation"}</h2>
      <p className="subtle">Uncertain values are retained as recorded. Compare them with the original files before using this summary.</p>
      {!confirmationItems.length && <p className="uncertain">No specific uncertainty was flagged in the saved summary. This does not mean every field has been verified.</p>}
      {confirmationItems.slice(0, showAllWarnings ? undefined : 2).map((warning, i) => <div className="uncertain" key={i}>
        <p>{warning}</p><div className="two-buttons"><button className="button" onClick={onSources}>Check original</button><button className="button" onClick={() => setReviewItem(warning)}>Human review</button></div>
      </div>)}
      {confirmationItems.length > 2 && <button className="muted-link" aria-expanded={showAllWarnings} onClick={() => setShowAllWarnings(!showAllWarnings)}>{showAllWarnings ? "Show fewer items" : `Show ${confirmationItems.length - 2} more items`} ›</button>}
      <button className="button primary" onClick={() => setReviewItem("Review the complete generated report")}>Review all items · Human review</button>
    </section>}
    {reviewItem !== null && <section className="card" role="dialog" aria-modal="false" aria-labelledby="human-review-title">
      <h2 id="human-review-title">Human review</h2><p>{reviewItem}</p>
      <p className="caption">Human review is not connected to a reviewer or payment service yet. No request has been submitted and no payment is required.</p>
      <button autoFocus className="button" onClick={onSources}>View original files</button><button className="button" onClick={() => setReviewItem(null)}>Close</button>
    </section>}
    {report && sections.map(([key, title]) => <section className="card ai-generated-content" key={key}>
      <h2>{title}</h2>
      {key === "notes" && <p className="caption">Points from your records to discuss at your next appointment.</p>}
      {report.sections[key]?.length ? report.sections[key].map((fact, i) => <div className="report-metric" key={i}>
        <small>{fact.label}</small><p style={{ whiteSpace: "pre-wrap" }}>{fact.value}</p>
        <small>Source: {report.sources.find((source) => source.id === fact.sourceId)?.fileName || "Unknown source"}</small>
        <details><summary>View recognized source text</summary><p style={{ whiteSpace: "pre-wrap" }}>{fact.quote}</p></details>
      </div>) : <p className="subtle">Not provided in the uploaded reports.</p>}
    </section>)}
    {report && <section className="card ai-generated-content"><h2>Imaging & source files</h2><p className="caption">Original documents and imaging reports linked to this summary</p>{report.sources.map((source) => {
      const count = Object.values(report.sections).flat().filter((fact) => fact.sourceId === source.id).length;
      return <div className="generated-source-name" key={source.id}><p>{source.fileName}</p><small>{count ? `${count} cited item(s)` : "No cited items — check this original for omitted information"}</small></div>;
    })}<button className="button" onClick={onSources}>View original files →</button><button className="button" disabled={busy} onClick={generate}>Check / regenerate summary</button><button className="button" onClick={onUpload}>Upload additional records</button><p className="caption">AI-organized record extracts, not a new diagnosis. OCR can misread numbers and units.</p></section>}
  </div>;
}
