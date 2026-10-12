import { useEffect, useState } from "react";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

export default function OriginalFile({ record, close }: {
  record: { id: string; fileName: string; mimeType: string }; close: () => void;
}) {
  const [files, setFiles] = useState<Array<{ url: string; fileName: string; mimeType: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const objectUrls: string[] = [];
    const load = async () => {
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/records/${record.id}/recognition-url`, {
          method: "POST", signal: controller.signal,
          headers: { Authorization: `Bearer ${publicAnonKey}`, "X-CaseMate-Session": sessionStorage.getItem("casemate_session") || "" },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to open the original file.");
        const originals = [];
        for (const file of result.files || [result]) {
          const original = await fetch(file.url, { signal: controller.signal });
          if (!original.ok) throw new Error("Unable to download the original file.");
          const blob = await original.blob();
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          originals.push({ url, fileName: file.fileName, mimeType: file.mimeType });
        }
        setFiles(originals);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to open the original file.");
      }
    };
    void load();
    return () => { controller.abort(); objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [record.id]);
  return <div className="record-preview-backdrop" role="dialog" aria-modal="true" aria-label={`Original file: ${record.fileName}`}>
    <div className="record-preview-panel">
      <div className="report-heading"><h2>{record.fileName}</h2><button className="button" onClick={close}>Close</button></div>
      <p className="caption">Original files in this upload</p>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {!files.length && !error && <p role="status">Loading original files…</p>}
      {files.map((file, index) => <section key={file.url}>
        <h3>{index + 1}. {file.fileName}</h3>
        {file.mimeType.startsWith("image/") ? <img src={file.url} alt={file.fileName} style={{ width: "100%", height: "auto", objectFit: "contain" }} />
          : file.mimeType === "application/pdf" ? <iframe src={file.url} title={file.fileName} style={{ width: "100%", height: "65vh", border: 0 }} />
          : <p>Use the download button to view this file.</p>}
        <a className="button" href={file.url} download={file.fileName}>Download original</a>
      </section>)}
    </div>
  </div>;
}
