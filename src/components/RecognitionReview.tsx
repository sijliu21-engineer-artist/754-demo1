import { useEffect, useRef, useState } from "react";
import "./RecognitionReview.css";
import { applyFixes, canConfirmRecognition, isFixComplete, type IssueFix, type IssueKind, type RecognitionIssue, type RecognitionResult } from "../lib/recognition-review";

export type RecognizedUpload = { file: File; recognition: RecognitionResult };
type Request = { items: RecognizedUpload[]; resolve: (texts: string[]) => void; reject: (error: Error) => void };

export function useRecognitionReview() {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.reject(new Error("Recognition review cancelled. No unconfirmed text was saved."));
      pending.current = null;
    };
  }, []);
  // Reports where every value passed the checks go straight on to report generation.
  const reviewRecognitions = (items: RecognizedUpload[]): Promise<string[]> => {
    if (!mounted.current) return Promise.reject(new Error("Upload cancelled because you left the page. No unconfirmed text was saved."));
    if (!items.some((item) => item.recognition.needsReview)) return Promise.resolve(items.map((item) => item.recognition.text));
    return new Promise((resolve, reject) => {
      if (pending.current) { reject(new Error("Finish the current report review first.")); return; }
      const next = { items, resolve, reject };
      pending.current = next; setRequest(next);
    });
  };
  const finish = (texts?: string[]) => {
    const current = pending.current;
    pending.current = null; setRequest(null);
    if (texts) current?.resolve(texts);
    else current?.reject(new Error("Review cancelled. No unconfirmed text was saved."));
  };
  return { reviewRecognitions, reviewDialog: request ? <RecognitionReview items={request.items} confirm={(texts) => finish(texts)} cancel={() => finish()} /> : null };
}

const KIND_LABEL: Record<IssueKind, string> = {
  blurred: "Blurred in photo",
  faded: "Faded digit",
  unreadable: "Partly covered",
  missing: "Result not found",
  implausible: "Impossible value",
  inconsistent: "Doesn't fit other results",
  lowConfidence: "Hard to read",
  unit: "Unit unclear",
  range: "Reference range unclear",
  date: "Date unclear",
  text: "Hard to read",
};

type FileState = { fixes: Record<string, IssueFix | undefined>; manualText?: string; manualChecked: boolean };
const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

// Leaving a result out also settles every other question about that row.
const settled = (issue: RecognitionIssue, issues: RecognitionIssue[], fixes: FileState["fixes"]) =>
  isFixComplete(issue, fixes[issue.id]) || issues.some((other) => other.line === issue.line && fixes[other.id]?.mode === "remove");
function fileDone(item: RecognizedUpload, state: FileState) {
  if (state.manualText !== undefined) return canConfirmRecognition(state.manualText, state.manualChecked);
  return item.recognition.issues.every((issue) => settled(issue, item.recognition.issues, state.fixes));
}
function remaining(item: RecognizedUpload, state: FileState) {
  if (state.manualText !== undefined) return state.manualChecked ? 0 : 1;
  return new Set(item.recognition.issues.filter((issue) => !settled(issue, item.recognition.issues, state.fixes)).map((issue) => issue.line)).size;
}

function FixControls({ issue, fix, done, onFix }: { issue: RecognitionIssue; fix?: IssueFix; done: boolean; onFix: (fix: IssueFix | undefined) => void }) {
  const [draft, setDraft] = useState(fix?.mode === "value" ? fix.value : "");
  const value = draft;
  const [draftUnit, setDraftUnit] = useState(fix?.mode === "value" ? fix.unit ?? issue.unit : issue.unitOptions.length ? "" : issue.unit);
  const unit = draftUnit;
  const isRange = issue.field === "range";
  const inputId = `${issue.id}-value`;
  return <>
    {issue.field === "text"
      ? <label className="rr-field">Text as shown on the original<textarea rows={3} value={fix?.mode === "value" ? fix.value : issue.recognized} onChange={(event) => onFix({ mode: "value", value: event.target.value })} /></label>
      : <div className="rr-field">
        <label htmlFor={inputId}>{issue.field === "date" ? "Date on the original" : isRange ? "Reference range on the original" : `${issue.test.split(" / ")[0]} on the original`}</label>
        <div className="rr-input-row">
          <input id={inputId} inputMode={issue.field === "value" ? "decimal" : "text"} placeholder={issue.field === "date" ? "YYYY-MM-DD" : isRange ? "e.g. 1.1-3.2" : "Type the number you see"} value={value} aria-label={isRange ? `Correct reference range for ${issue.test}` : `Correct value for ${issue.test}`} onChange={(event) => { setDraft(event.target.value); onFix(undefined); }} />
          {issue.unitOptions.length
            ? <select aria-label={`Unit for ${issue.test}`} value={unit} onChange={(event) => { setDraftUnit(event.target.value); onFix(undefined); }}><option value="">Unit…</option>{issue.unitOptions.map((option) => <option key={option}>{option}</option>)}</select>
            : issue.unit && <span className="rr-unit">{issue.unit}</span>}
        </div>
        {fix?.mode === "value" && value && !done && issue.field === "value" && <small className="rr-hint">Enter digits only, e.g. 112 or 35.3{issue.unitOptions.length ? ", and pick the unit" : ""}.</small>}
        {fix?.mode === "value" && value && !done && isRange && <small className="rr-hint">Enter it like 1.1-3.2.</small>}
      </div>}
    <div className="rr-actions">
      {issue.field !== "text" && <button type="button" className={`rr-action${fix?.mode === "value" ? " is-selected" : ""}`} disabled={!isFixComplete(issue, { mode: "value", value: draft, unit: unit || undefined })} onClick={() => onFix({ mode: "value", value: draft, unit: unit || undefined })}>Confirm entered value</button>}
      {!isRange && <button type="button" className={`rr-action rr-remove${fix?.mode === "remove" ? " is-selected" : ""}`} aria-pressed={fix?.mode === "remove"} onClick={() => onFix(fix?.mode === "remove" ? undefined : { mode: "remove" })}>Unreadable — exclude value</button>}
    </div>
  </>;
}

type CardProps = {
  issue: RecognitionIssue; range?: RecognitionIssue; number: number; fixes: FileState["fixes"]; active: boolean; showPage: boolean; rowRemoved: boolean;
  onFix: (id: string, fix: IssueFix | undefined) => void; onFocus: () => void;
};
// One card per test row: the result, and (when it also looks wrong) its reference range.
function IssueCard({ issue, range, number, fixes, active, showPage, rowRemoved, onFix, onFocus }: CardProps) {
  const mainDone = isFixComplete(issue, fixes[issue.id]) || rowRemoved;
  const rangeDone = !range || isFixComplete(range, fixes[range.id]) || rowRemoved || fixes[issue.id]?.mode === "remove";
  const done = mainDone && rangeDone;
  const isRange = issue.field === "range";
  const kinds = [...issue.kinds, ...(range?.kinds || [])];
  return <article className={`rr-issue${done ? " is-done" : ""}${active ? " is-active" : ""}`} onFocus={onFocus} onMouseEnter={onFocus} aria-label={`${issue.test}: ${done ? "checked" : "needs checking"}`}>
    <header className="rr-issue-head">
      <span className="rr-marker" aria-hidden="true">{done ? "✓" : number}</span>
      <div>
        <h4>{issue.test}{isRange && <span className="caption"> · reference range</span>}{showPage && <span className="caption"> · page {issue.page}</span>}</h4>
        <div className="rr-chips">{kinds.map((kind) => <span key={kind} className={`rr-chip rr-chip-${kind}`}>{KIND_LABEL[kind]}</span>)}</div>
      </div>
    </header>
    {issue.crop && <img className="rr-crop" src={issue.crop} alt={`This row in the original: ${issue.test}`} />}
    <p className="rr-read">We read: <strong>{issue.field === "text" ? (issue.recognized || "(nothing)") : issue.recognized ? `${issue.recognized}${issue.unit && issue.field !== "date" ? ` ${issue.unit}` : ""}` : "(no number)"}</strong></p>
    <ul className="rr-reasons">{issue.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    {issue.expected && <p className="rr-expected">Expected from the other results: <strong>{issue.expected}</strong></p>}
    <FixControls issue={issue} fix={fixes[issue.id]} done={mainDone} onFix={(fix) => onFix(issue.id, fix)} />
    {range && fixes[issue.id]?.mode !== "remove" && <div className={`rr-sub${isFixComplete(range, fixes[range.id]) ? " is-done" : ""}`}>
      <p className="rr-read">Reference range — we read: <strong>{range.recognized}</strong></p>
      <ul className="rr-reasons">{range.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      <FixControls issue={range} fix={fixes[range.id]} done={isFixComplete(range, fixes[range.id])} onFix={(fix) => onFix(range.id, fix)} />
    </div>}
  </article>;
}

export default function RecognitionReview({ items, confirm, cancel }: { items: RecognizedUpload[]; confirm: (texts: string[]) => void; cancel: () => void }) {
  const [states, setStates] = useState<FileState[]>(() => items.map(() => ({ fixes: {}, manualChecked: false })));
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((item) => item.recognition.needsReview)));
  const [activeIssue, setActiveIssue] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const item = items[index];
  const state = states[index];
  const left = items.reduce((n, entry, i) => n + remaining(entry, states[i]), 0);
  const ready = items.every((entry, i) => fileDone(entry, states[i]));
  useEffect(() => {
    const url = URL.createObjectURL(item.file); setPreviewUrl(url); setActiveIssue("");
    return () => URL.revokeObjectURL(url);
  }, [item.file]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const update = (change: (current: FileState) => FileState) => setStates((all) => all.map((value, i) => i === index ? change(value) : value));
  const finalTexts = () => items.map((entry, i) => states[i].manualText ?? applyFixes(entry.recognition.text, entry.recognition.issues, states[i].fixes));
  const issues = item.recognition.issues;
  const frame = issues.find((issue) => issue.frame)?.frame;
  // A reference-range question is shown inside the card of its test result.
  const cards = issues.filter((issue) => !(issue.field === "range" && issues.some((other) => other.line === issue.line && other.field === "value")));
  const rowRemovedFor = (issue: RecognitionIssue) => issues.some((other) => other.id !== issue.id && other.line === issue.line && state.fixes[other.id]?.mode === "remove");

  return <div className="recognition-review-backdrop">
    <div ref={dialog} className="recognition-review-dialog" role="dialog" aria-modal="true" aria-labelledby="recognition-review-title" tabIndex={-1} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href], summary')).filter((element) => element.offsetParent !== null);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="recognition-review-scroll"><header className="recognition-review-header">
        <div><p className="caption">CHECK UNCLEAR VALUES</p><h2 id="recognition-review-title">{left ? `Review ${left} unclear result${left === 1 ? "" : "s"}` : "All results checked"}</h2></div>
        <button className="button compact" onClick={cancel}>Cancel</button>
      </header>
      <p className="recognition-review-notice">We compared each result with the photo and with other results on the same report. Type what the original shows; never guess a hidden number.</p>

      <nav className="rr-files" aria-label="Uploaded reports">
        {items.map((entry, i) => {
          const count = remaining(entry, states[i]);
          const clean = !entry.recognition.needsReview;
          return <button key={i} type="button" className={`rr-file${i === index ? " is-current" : ""}${clean || !count ? " is-clear" : ""}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}>
            <span className="rr-file-name">{i + 1}. {entry.file.name}</span>
            <span className="rr-file-status">{clean ? "✓ All clear" : count ? `${count} to check` : "✓ Checked"}</span>
          </button>;
        })}
      </nav>

      <div className="recognition-review-columns" key={index}>
        <section className="recognition-review-original">
          <h3>Original report</h3>
          <p className="caption">{item.file.name}</p>
          {previewUrl && (isPdf(item.file)
            ? <object data={previewUrl} type="application/pdf" aria-label="Original PDF"><a href={previewUrl} target="_blank" rel="noreferrer">Open original PDF</a></object>
            : <div className="rr-original-frame">
              <a href={previewUrl} target="_blank" rel="noreferrer" aria-label="Open original image at full size"><img src={previewUrl} alt={`Original report: ${item.file.name}`} /></a>
              {frame && state.manualText === undefined && cards.map((issue, n) => issue.box && <span key={issue.id} aria-hidden="true" className={`rr-highlight${activeIssue === issue.id ? " is-active" : ""}${settled(issue, issues, state.fixes) ? " is-done" : ""}`} style={{ left: `${(issue.box.x0 / frame.width) * 100}%`, top: `${(issue.box.y0 / frame.height) * 100}%`, width: `${((issue.box.x1 - issue.box.x0) / frame.width) * 100}%`, height: `${((issue.box.y1 - issue.box.y0) / frame.height) * 100}%` }}><b>{n + 1}</b></span>)}
            </div>)}
          <p className="caption">Tap the image to open it full size and zoom in.</p>
        </section>

        <section className="recognition-review-editor">
          {!item.recognition.needsReview
            ? <p className="rr-clear">✓ Every value in this report passed the checks. Nothing to do here.</p>
            : state.manualText === undefined
              ? <>
                <h3>{cards.length} result{cards.length === 1 ? "" : "s"} to check in this report</h3>
                {cards.map((issue, n) => <IssueCard key={issue.id} issue={issue} range={issue.field === "value" ? issues.find((other) => other.line === issue.line && other.field === "range") : undefined} number={n + 1} fixes={state.fixes} active={activeIssue === issue.id} showPage={item.recognition.scannedPages.length > 1} rowRemoved={rowRemovedFor(issue)} onFocus={() => setActiveIssue(issue.id)} onFix={(id, fix) => update((current) => ({ ...current, fixes: { ...current.fixes, [id]: fix } }))} />)}
              </>
              : <p className="recognition-review-notice">You are editing the full text of this report, so the value-by-value checks above are switched off for it.</p>}

          {(item.recognition.needsReview || state.manualText !== undefined) && <details className="rr-advanced" open={state.manualText !== undefined}>
            <summary>Something else is wrong? Edit all recognized text</summary>
            <textarea rows={12} maxLength={100000} spellCheck={false} aria-label="Correct recognized report text"
              value={state.manualText ?? applyFixes(item.recognition.text, issues, state.fixes)}
              onChange={(event) => update((current) => ({ ...current, manualText: event.target.value, manualChecked: false }))} />
            {state.manualText !== undefined && <>
              <label className="recognition-review-check"><input type="checkbox" checked={state.manualChecked} onChange={(event) => update((current) => ({ ...current, manualChecked: event.target.checked }))} />I compared this text with the original and removed results I cannot read.</label>
              <button type="button" className="button compact" onClick={() => update((current) => ({ ...current, manualText: undefined, manualChecked: false }))}>Undo text edits and go back to value checks</button>
            </>}
          </details>}
        </section>
      </div>

      </div><footer className="recognition-review-footer">
        <button className="button" onClick={cancel}>Cancel — keep originals unchanged</button>
        <button className="button primary" disabled={!ready} onClick={() => { if (ready) confirm(finalTexts()); }}>{ready ? "Confirm & generate report" : `${left} left to check`}</button>
      </footer>
    </div>
  </div>;
}
