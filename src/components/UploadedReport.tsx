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
  ["results", "3. Key results"], ["imaging", "4. Imaging & assessment"],
  ["notes", "5. Notes to verify"],
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

export default function UploadedReport({ onUpload, recordId }: { onUpload: () => void; recordId?: string }) {
  const reportPath = recordId ? `report?recordId=${encodeURIComponent(recordId)}` : "report";
  const [report, setReport] = useState<Report | null>(null);
  const [pending, setPending] = useState<Array<{ id: string; fileName: string }>>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("Loading your saved report…");
  const [busy, setBusy] = useState(true);
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

  return <div className="content">
    <section className="card">
      <h2>Your medical summary</h2>
      <p className="caption">Key diagnoses, treatment and selected test results from your uploads. This summary does not list every result. View the complete originals in Uploaded files.</p>
      {report && <p className="caption">{report.sources.length} upload record(s) · Generated {new Date(report.generatedAt).toLocaleString()}</p>}
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
    {report?.warnings.length ? <section className="card confirm-card"><h2>Items to verify</h2>{report.warnings.map((warning, i) => <p className="notice" key={i}>{warning}</p>)}</section> : null}
    {report && sections.map(([key, title]) => <section className="card ai-generated-content" key={key}>
      <h2>{title}</h2>
      {report.sections[key]?.length ? report.sections[key].map((fact, i) => <div className="report-metric" key={i}>
        <small>{fact.label}</small><p style={{ whiteSpace: "pre-wrap" }}>{fact.value}</p>
        {key === "results" && <p className="caption">{fact.quote.replace(/\s*\r?\n\s*/g, " · ")}</p>}
        <small>Source: {report.sources.find((source) => source.id === fact.sourceId)?.fileName || "Unknown source"}</small>
        <details><summary>View recognized source text</summary><p style={{ whiteSpace: "pre-wrap" }}>{fact.quote}</p></details>
      </div>) : <p className="subtle">Not provided in the uploaded reports.</p>}
    </section>)}
    {report && <section className="card"><h2>Source files</h2>{report.sources.map((source) => <p key={source.id}>{source.fileName}</p>)}<p className="caption ai-text">AI-organized record extracts, not a new diagnosis. OCR can misread numbers and units.</p></section>}
  </div>;
}
