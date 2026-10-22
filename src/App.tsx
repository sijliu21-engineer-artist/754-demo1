import { useEffect, useRef, useState, type ReactNode } from "react";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { recognizeFile } from "./lib/recognition";
import UploadedReport from "./components/UploadedReport";
import OriginalFile from "./components/OriginalFile";

const A = "/assets";
const icons = {
  camera: `${A}/160dc.svg`,
  user: `${A}/1f5da.svg`,
  shield: `${A}/e8cf9.svg`,
  doc: `${A}/86153.svg`,
  edit: `${A}/ca813.svg`,
  upload: `${A}/97a4b.svg`,
  image: `${A}/7dd0c.svg`,
  logo: `${A}/12ad7.svg`,
  sparkle: `${A}/36cf3.svg`,
  lock: `${A}/95bef.svg`,
  secure: `${A}/339d8.svg`,
  check: `${A}/5f0ce.svg`,
  crown: `${A}/9d545.svg`,
  hospital: `${A}/2082c.svg`,
  report: `${A}/1804f.svg`,
  chart: `${A}/e30bd.svg`,
  pdf: `${A}/a1b7a.svg`,
  qr: `${A}/c2702.png`,
};

type Page =
  | "welcome"
  | "signup"
  | "login"
  | "generate"
  | "conversation"
  | "human"
  | "profile"
  | "membership"
  | "consultation"
  | "request"
  | "review"
  | "completed"
  | "past"
  | "uploaded"
  | "privacy"
  | "sharing"
  | "orders"
  | "settings"
  | "medical"
  | "details"
  | "assistant"
  | "chart"
  | "table";

type Nav = (page: Page) => void;

type UploadedRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  files?: Array<{ fileName: string; mimeType: string; size: number }>;
  extractionStatus: "ready" | "needs_ocr" | "no_text";
  createdAt: string;
};

const apiHeaders = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  "Content-Type": "application/json",
  "X-CaseMate-Session": sessionStorage.getItem("casemate_session") || "",
});

const encodeFile = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

function Icon({ name, size = 24 }: { name: keyof typeof icons; size?: number }) {
  return <img className="icon" src={icons[name]} width={size} height={size} alt="" />;
}

function Button({
  children,
  onClick,
  primary = false,
  danger = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`button ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Header({ title, back, action }: { title: string; back?: () => void; action?: ReactNode }) {
  return (
    <header className="topbar">
      {back && (
        <button className="back" onClick={back}>
          ‹ Back
        </button>
      )}
      <h1 className={title === "Records assistant" ? "ai-title" : undefined}>{title}</h1>
      {action && <div className="header-action">{action}</div>}
    </header>
  );
}

function BottomNav({ active, nav }: { active: "reports" | "human" | "profile"; nav: Nav }) {
  const items = [
    ["reports", "doc", "Reports", "generate"],
    ["assistant", "sparkle", "Ask AI", "assistant"],
    ["compare", "chart", "Compare past results", "chart"],
    ["human", "shield", "Human review", "human"],
    ["profile", "user", "Profile", "profile"],
  ] as const;
  return (
    <nav className="bottom-nav">
      {items.map(([id, icon, label, page]) => (
        <button className={active === id ? "active" : ""} aria-label={label} aria-current={active === id ? "page" : undefined} onClick={() => nav(page)} key={id}>
          {id === "compare" ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 3v17h17M7 15l4-5 4 3 5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : <Icon name={icon} />}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function AppShell({
  title,
  children,
  back,
  action,
  nav,
  active,
  composer,
  fixedAction,
}: {
  title: string;
  children: ReactNode;
  back?: () => void;
  action?: ReactNode;
  nav?: Nav;
  active?: "reports" | "human" | "profile";
  composer?: ReactNode;
  fixedAction?: ReactNode;
}) {
  return (
    <main className={`app-shell ${nav ? "has-nav" : ""} ${composer ? "has-composer" : ""} ${fixedAction ? "has-fixed-action" : ""}`}>
      <Header title={title} back={back} action={action} />
      <div className="page-scroll">{children}</div>
      {composer}
      {fixedAction && <div className="fixed-action">{fixedAction}</div>}
      {nav && active && <BottomNav active={active} nav={nav} />}
    </main>
  );
}

function Row({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail?: string;
  onClick?: () => void;
}) {
  return (
    <button className="list-row" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <b>›</b>
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      className={`toggle ${value ? "on" : ""}`}
      aria-label={value ? "Turn off" : "Turn on"}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}

function Setting({
  title,
  detail,
  initial = true,
}: {
  title: string;
  detail?: string;
  initial?: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  return (
    <div className="setting">
      <span>
        {title}
        {detail && <small>{detail}</small>}
      </span>
      <Toggle value={enabled} onChange={setEnabled} />
    </div>
  );
}

function Stepper({ complete = false }: { complete?: boolean }) {
  return (
    <div className="stepper">
      {["Upload files", "OCR & privacy", "AI generation", "Edit & export"].map((label, i) => (
        <div key={label}>
          <b className={complete || i === 0 ? "filled" : ""}>{i + 1}</b>
          <span className={label === "AI generation" ? "ai-text" : undefined}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Composer({ onSend }: { onSend?: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  const sendMessage = () => {
    const value = message.trim();
    if (!value) return;
    setMessage("");
    if (onSend) {
      onSend(value);
      return;
    }
    setSentMessage(value);
  };

  return (
    <>
      {sentMessage && (
        <div className="composer-sent" role="status">
          <span>Sent</span>
          <p>{sentMessage}</p>
        </div>
      )}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <button className="composer-camera" type="button" aria-label="Add a photo">
          <Icon name="camera" />
        </button>
        <input
          aria-label="Health details"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (sentMessage) setSentMessage("");
          }}
          placeholder="Add health details (diagnosis date, medications)…"
        />
        <button className="button primary composer-send" type="submit" disabled={!message.trim()}>
          Send
        </button>
      </form>
    </>
  );
}

function AuthBrand() {
  return (
    <>
      <div className="brand">
        <div className="brand-logo">
          <Icon name="logo" size={40} />
        </div>
        <h1>CaseMate</h1>
        <p>Your cancer case records, organised and private.</p>
      </div>
      <div className="benefits">
        <div><Icon name="sparkle" size={17} />Turn record photos into a clear report</div>
        <div><Icon name="lock" size={17} />Personal info masked in one tap</div>
        <div><Icon name="secure" size={17} />Optional expert review</div>
      </div>
    </>
  );
}

function Agreement() {
  return (
    <div className="agreement">
      <Icon name="check" size={16} />
      <span>I have read and agree to the User Agreement and Privacy Policy</span>
    </div>
  );
}

function Welcome({ nav }: { nav: Nav }) {
  return (
    <main className="auth-page welcome">
      <AuthBrand />
      <div className="auth-actions">
        <Button primary onClick={() => nav("signup")}>Create account</Button>
        <Button onClick={() => nav("login")}>Log in</Button>
        <button className="wechat" onClick={() => nav("login")}>Continue with WeChat</button>
        <Agreement />
      </div>
    </main>
  );
}

function AuthForm({
  mode,
  nav,
  onAuthenticated,
}: {
  mode: "signup" | "login";
  nav: Nav;
  onAuthenticated: (token: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authenticate = async () => {
    if (!username.trim() || !password || loading) return;
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/auth/${mode === "signup" ? "register" : "login"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password, displayName }),
        },
      );
      const responseText = await response.text();
      let result: { token?: string; error?: string; user?: { username: string; displayName: string } } = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          response.status === 404
            ? "The account service has not been deployed yet."
            : "The account service returned an invalid response.",
        );
      }
      if (!response.ok || !result.token) {
        throw new Error(
          result.error ||
            (mode === "signup"
              ? "Unable to create account."
              : "Incorrect account or password."),
        );
      }
      sessionStorage.setItem("casemate_session", result.token);
      sessionStorage.setItem("casemate_user", JSON.stringify(result.user || {
        username: username.trim().toLowerCase(),
        displayName: mode === "signup" ? displayName.trim() || username.trim().toLowerCase() : username.trim().toLowerCase(),
      }));
      onAuthenticated(result.token);
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "The account service is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page form-page">
      <AuthBrand />
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          authenticate();
        }}
      >
        <div className="auth-tabs">
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => nav("signup")}>Sign up</button>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => nav("login")}>Log in</button>
        </div>
        {mode === "signup" && (
          <p className="auth-note">
            Create an account with a unique username and password.
          </p>
        )}
        {mode === "signup" && (
          <input
            aria-label="Display name"
            autoComplete="name"
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        )}
        <input
          aria-label="Account"
          autoComplete="username"
          placeholder="Account"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          aria-label="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === "signup" && (
          <input
            aria-label="Confirm password"
            autoComplete="new-password"
            placeholder="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button
          className="button primary"
          type="submit"
          disabled={
            loading ||
            !username.trim() ||
            !password ||
            (mode === "signup" && !confirmPassword)
          }
        >
          {loading
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>
        <button type="button" className="muted-link" onClick={() => nav("welcome")}>Back</button>
        <Agreement />
      </form>
    </main>
  );
}

function UploadConfirmation({
  files,
  remove,
  clear,
  submit,
  loading,
  error,
}: {
  files: File[];
  remove: (index: number) => void;
  clear: () => void;
  submit: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <div className="upload-confirm">
      <div className="upload-selection-heading">
        <strong>{files.length} file(s) selected</strong>
        <button onClick={clear} disabled={loading}>Clear all</button>
      </div>
      <ul className="upload-selection-list" aria-label="Selected files">
        {files.map((file, index) => (
          <li key={`${file.name}-${file.lastModified}-${index}`}>
            <Icon name={file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image"} size={20} />
            <div><span>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></div>
            <button onClick={() => remove(index)} disabled={loading} aria-label={`Remove ${file.name}`}>×</button>
          </li>
        ))}
      </ul>
      <p className="caption">Total: {(files.reduce((total, file) => total + file.size, 0) / (1024 * 1024)).toFixed(2)} MB · One combined report</p>
      <Button primary onClick={submit} disabled={loading}>
        {loading ? "Saving & extracting…" : `Upload ${files.length} file(s) & generate one report`}
      </Button>
      {error && <p className="upload-error" role="alert">{error}</p>}
    </div>
  );
}

function Generate({ nav, onSend, onUploaded }: { nav: Nav; onSend: (message: string) => void; onUploaded: (recordId: string) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");

  const upload = async () => {
    if (!files.length || uploading) return;
    if (files.length > 10 || files.reduce((n, f) => n + f.size, 0) > 24 * 1024 * 1024) { setUploadError("Select up to 10 files, totaling no more than 24 MB."); return; }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      setUploadError("Choose a file no larger than 8 MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const payloadFiles = [];
      for (const [index, file] of files.entries()) {
        const [base64, extractedText] = await Promise.all([
          encodeFile(file), recognizeFile(file, (message) => setUploadProgress(`${index + 1}/${files.length} · ${file.name}: ${message}`)),
        ]);
        payloadFiles.push({ fileName: file.name, mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png"), size: file.size, base64, extractedText });
      }
      setUploadProgress("Saving all originals as one upload…");
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/records`,
        {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ files: payloadFiles }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save this file.");
      onUploaded(result.record.id);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Unable to save this file.",
      );
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };
  return (
    <AppShell
      title="Generate report"
      action={<button onClick={() => nav("settings")}>Privacy</button>}
      nav={nav}
      active="reports"
      composer={<Composer onSend={onSend} />}
    >
      <div className="content">
        <Stepper />
        <Card>
          <p className="intro">
            Hi, I&apos;m your medical records assistant. Upload photos or PDFs of discharge
            summaries, lab results, or imaging reports, or enter details manually. I&apos;ll
            redact personal information and create a Word report.
          </p>
        </Card>
        <Card>
          <h2>Quick start</h2>
          <p className="subtle">Choose how to import your medical records</p>
          <div className="import-grid">
            <button onClick={() => picker.current?.click()}><Icon name="camera" />Take a photo</button>
            <button onClick={() => picker.current?.click()}><Icon name="upload" />Photos / PDF</button>
            <button onClick={() => nav("conversation")}><Icon name="edit" />Enter manually</button>
          </div>
          <Button onClick={() => picker.current?.click()}>Upload imaging files (CT / MRI)</Button>
          <input
            ref={picker}
            className="sr-only"
            type="file"
            accept="image/*,.pdf"
            multiple
            disabled={uploading}
            onChange={(e) => {
              setFiles(Array.from(e.target.files || []));
              setUploadError("");
            }}
          />
          {files.length > 0 && (
            <UploadConfirmation
              files={files}
              remove={(index) => {
                setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                setUploadError("");
                if (picker.current) picker.current.value = "";
              }}
              clear={() => { setFiles([]); if (picker.current) picker.current.value = ""; }}
              submit={upload}
              loading={uploading}
              error={uploadError}
            />
          )}
          {uploading && <p className="caption" role="status" aria-live="polite">{uploadProgress}</p>}
          <p className="caption">
            Enable automatic redaction in Privacy settings to mask names, ID numbers, and
            hospital IDs. You can also choose a privacy level.
          </p>
        </Card>
        <Card>
          <h2>Ask AI&nbsp; · &nbsp;Find test results</h2>
          <p>For example: Is hemoglobin in my records? What is the value?</p>
          <Button className="ai-text" onClick={() => nav("assistant")}>Ask AI / Find a result</Button>
          <Button onClick={() => nav("chart")}>Compare past results</Button>
        </Card>
      </div>
    </AppShell>
  );
}

function Conversation({
  nav,
  healthDetails,
  onSend,
}: {
  nav: Nav;
  healthDetails: string[];
  onSend: (message: string) => void;
}) {
  return (
    <AppShell title="Generate report" action={<button onClick={() => nav("privacy")}>Privacy</button>} nav={nav} active="reports" composer={<Composer onSend={onSend} />}>
      <Stepper complete />
      <div className="content conversation">
        <div className="bubble">Hi, I&apos;m your medical records assistant. Upload photos or PDFs of discharge summaries, lab results, or imaging reports, or enter details manually. I&apos;ll redact personal information and create a Word report.</div>
        {healthDetails.length > 0 ? (
          healthDetails.map((detail, index) => (
            <div className="bubble own" key={`${detail}-${index}`}>
              {detail}
            </div>
          ))
        ) : (
          <div className="bubble own"><span>1 file uploaded:</span><small>IXDS754_TeamBeta_Sprint1_ProductDefinition.pdf</small></div>
        )}
        <div className="bubble">◌ Applying Standard privacy and OCR (4 identifiers masked)…</div>
        <div className="bubble short">◌ Extracting result history and creating a structured report…</div>
        <div className="bubble">Report ready: 5 sections, 6 pages. Please verify 3 low-confidence fields.</div>
        <Card className="report-result">
          <div className="report-heading"><Icon name="report" size={38} /><div><h2>Lung adenocarcinoma · Follow-up.docx</h2><small>Word document · 6 pages · 3 items to verify</small></div></div>
          <div className="chips"><span>8 items to confirm</span><span>Other content is ready</span></div>
          <p className="warning">Some lab values may contain recognition errors (e.g., albumin 353 → 33.1, possibly a missed decimal point). Verify them before your visit.</p>
          <div className="two-buttons">
            <Button primary onClick={() => nav("details")}>Edit online</Button>
            <Button onClick={() => nav("details")}>Preview / Export PDF</Button>
          </div>
          <Button danger onClick={() => nav("request")}>Medical reviewer check (¥8)</Button>
        </Card>
      </div>
    </AppShell>
  );
}

function HumanReview({ nav }: { nav: Nav }) {
  return (
    <AppShell title="Human review" nav={nav} active="human">
      <div className="content">
        <Card>
          <h2>Professional review of each field</h2>
          <p className="subtle">A reviewer with medical training checks your uploaded originals for diagnoses, medications, doses, and lab values, and provides a correction log. Export is free; human review is charged per report.</p>
          <Button primary onClick={() => nav("request")}>Request human review · ¥8</Button>
        </Card>
        <Card>
          <h2>Other services</h2>
          <p className="caption">Optional services; report export remains free</p>
          <Row title="Membership (monthly / yearly)" detail="Unlimited reports + monthly reviews + result trend alerts" onClick={() => nav("membership")} />
          <Row title="Online consultation" detail="Send your structured report to a partner hospital doctor" onClick={() => nav("consultation")} />
        </Card>
        <Card>
          <h2>My review orders</h2>
          <Row title="Lung adenocarcinoma · Follow-up" detail="Human review · ¥8 · In progress" onClick={() => nav("review")} />
          <Row title="Lung adenocarcinoma · 6-month follow-up" detail="Human review · ¥8 · Completed" onClick={() => nav("completed")} />
        </Card>
      </div>
    </AppShell>
  );
}

function Profile({ nav }: { nav: Nav }) {
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);
  const [uploadCountError, setUploadCountError] = useState("");
  const [accountName, setAccountName] = useState(() => {
    try {
      const user = JSON.parse(sessionStorage.getItem("casemate_user") || "null");
      return user?.displayName || user?.username || "My account";
    } catch {
      return "My account";
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadUploadCount = async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/records`,
          { headers: apiHeaders(), signal: controller.signal, cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load uploaded file count.");
        if (!Array.isArray(result.records)) throw new Error("The records service returned an invalid response.");
        if (!controller.signal.aborted) {
          setUploadedCount(result.records.length);
          if (result.user?.displayName || result.user?.username) {
            setAccountName(result.user.displayName || result.user.username);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setUploadCountError(error instanceof Error ? error.message : "Unable to load uploaded file count.");
        }
      }
    };
    void loadUploadCount();
    return () => controller.abort();
  }, []);

  return (
    <AppShell title="Profile" nav={nav} active="profile">
      <div className="content">
        <Card>
          <h2>{accountName}&nbsp; · &nbsp;Patient</h2>
          <p className="subtle">Your personal medical records</p>
          <Button onClick={() => nav("membership")}>Join membership</Button>
          <div className="stats">
            <button onClick={() => nav("past")}><b>{uploadedCount ?? (uploadCountError ? "—" : "…")}</b><span>Reports</span></button>
            <button onClick={() => nav("uploaded")} aria-label={`Uploaded files: ${uploadedCount ?? (uploadCountError ? "unavailable" : "loading")}`}><b>{uploadedCount ?? (uploadCountError ? "—" : "…")}</b><span>Uploaded files</span></button>
            <button onClick={() => nav("human")}><b>2</b><span>Human review</span></button>
          </div>
          {uploadCountError && <p className="chat-error" role="alert">{uploadCountError}</p>}
        </Card>
        <Card>
          <h2>Medical records</h2>
          <Row title="Past reports" detail={uploadedCount === null ? "Loading your reports…" : `${uploadedCount} reports, one per upload`} onClick={() => nav("past")} />
          <Row title="Report from my uploads" detail="View your saved summary or generate one from your files" onClick={() => nav("details")} />
          <Row title="Privacy management" detail="View and update previous redactions" onClick={() => nav("privacy")} />
          <Row title="Sharing" detail="Share a QR code or link with family or doctors" onClick={() => nav("sharing")} />
          <Button className="ai-text" onClick={() => nav("assistant")}>Ask AI · Find my results</Button>
          <Button onClick={() => nav("chart")}>Compare past results</Button>
        </Card>
        <Card>
          <h2>Account &amp; settings</h2>
          <Row title="My orders" detail="Reviews, memberships and consultations" onClick={() => nav("orders")} />
          <Row title="Settings" detail="Privacy, notifications and security" onClick={() => nav("settings")} />
        </Card>
        <p className="caption center">A personal summary of your records; not an official medical record.</p>
      </div>
    </AppShell>
  );
}

function ComingSoon({ kind, nav, back }: { kind: "Membership" | "Online consultation"; nav: Nav; back: () => void }) {
  return (
    <AppShell title={kind} back={back}>
      <div className="content">
        <Card className="coming">
          <Icon name={kind === "Membership" ? "crown" : "hospital"} />
          <h2>Coming soon</h2>
          <p className="subtle">
            {kind === "Membership"
              ? "Unlimited reports, monthly human reviews, and result trend alerts are in development. We'll notify you when membership launches."
              : "Online consultations with partner hospital doctors using your structured report are in development."}
          </p>
          <Button className="compact" onClick={() => nav("generate")}>Back to reports</Button>
        </Card>
      </div>
    </AppShell>
  );
}

const reports = [
  ["Lung adenocarcinoma · Follow-up", "2026-08-13 13:42 · 6 pages"],
  ["Lung adenocarcinoma · 6-month follow-up", "2026-05-12 09:10 · 5 pages"],
  ["Lung adenocarcinoma · Initial diagnosis", "2025-11-20 16:03 · 8 pages"],
];

function Choice({ title, detail, selected }: { title: string; detail: string; selected?: boolean }) {
  return (
    <button className={`choice ${selected ? "selected" : ""}`}>
      <span>{title}{selected ? " ✓" : ""}</span>
      <small>{detail}</small>
    </button>
  );
}

function RequestReview({ nav, back }: { nav: Nav; back: () => void }) {
  return (
    <AppShell title="Request human review" back={back}>
      <div className="content">
        <Card><h2>Select report</h2>{reports.map((r, i) => <Choice key={r[0]} title={r[0]} detail={r[1]} selected={i === 0} />)}</Card>
        <Card>
          <h2>Select service</h2>
          <Choice title="Single review                       ¥8" detail="One report checked field by field; delivered within 24 hours" selected />
          <Choice title="Monthly membership                       ¥29/month" detail="2 reviews/month + unlimited reports" />
          <Choice title="Online consultation              Doctor's rate" detail="Send your report to a partner hospital doctor" />
        </Card>
        <Card>
          <h2>Note (optional)</h2>
          <p className="caption">Tell the reviewer what matters most</p>
          <textarea placeholder="E.g., please check targeted therapy doses and lab values" />
        </Card>
        <Card>
          <h2 className="spread"><span>Total</span><span>¥8</span></h2>
          <Button primary onClick={() => nav("review")}>Pay with WeChat &amp; submit</Button>
          <p className="caption">Human review is optional. Report creation and export remain free.</p>
        </Card>
      </div>
    </AppShell>
  );
}

function ReviewStatus({ completed, back, nav }: { completed?: boolean; back: () => void; nav: Nav }) {
  const steps = completed
    ? [["Submitted", "05-12 10:20"], ["Reviewer assigned", "05-12 10:35"], ["Fields checked", "05-12 15:40"], ["Corrected report delivered", "05-12 17:02"]]
    : [["Submitted", "08-13 14:02"], ["Reviewer assigned", "08-13 14:20"], ["Checking each field", "Expected 08-13 18:00"], ["Corrected report delivery", "Expected 08-14 10:00"]];
  return (
    <AppShell title="Review status" back={back}>
      <div className="content">
        <Card>
          <h2>Lung adenocarcinoma · {completed ? "6-month follow-up" : "Follow-up"}</h2>
          <p className="caption">Order {completed ? "od-81190" : "od-88214"} · Human review · ¥8</p>
          <strong className="status-label">{completed ? "Completed" : "In progress"}</strong>
        </Card>
        <Card><h2>Progress</h2><div className="progress-list">{steps.map((s, i) => <div className={!completed && i > 1 ? "pending" : ""} key={s[0]}><span>{completed || i < 2 ? "✓" : "◷"}&nbsp; {s[0]}</span><small>{s[1]}</small></div>)}</div></Card>
        <Card>
          <h2>Correction log</h2>
          <p className="caption">Corrections checked against original files</p>
          <div className="correction"><small>{completed ? "Surgery date" : "Genetic testing"}</small><p>{completed ? "2025-03-06 → 2025-03-09" : "EGFR 19del positive → EGFR exon 19 deletion positive (allele frequency 32.4%)"}</p><small>Note: {completed ? "verified against surgical record" : "frequency added from original"}</small></div>
          {!completed && <div className="correction"><small>CYFRA21-1</small><p>2026-08: 2.4 → 2026-08: 2.14</p><small>Note: OCR decimal-point error</small></div>}
        </Card>
        <Button onClick={() => nav(completed ? "medical" : "details")}>View report</Button>
      </div>
    </AppShell>
  );
}

function PastReports({ back, nav, openReport }: { back: () => void; nav: Nav; openReport: (id: string) => void }) {
  const [items, setItems] = useState<Array<{ id: string; fileName: string; createdAt: string; generated: boolean }> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/reports`, {
      headers: apiHeaders(), cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load your reports.");
      if (!Array.isArray(result.reports)) throw new Error("Invalid report list.");
      if (!controller.signal.aborted) setItems(result.reports);
    }).catch((error) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load your reports.");
    });
    return () => controller.abort();
  }, []);
  return (
    <AppShell title="Reports" back={back}>
      <div className="content">
        <p className="caption">One report per upload. Each upload can contain multiple original files.</p>
        {error ? <p className="chat-error" role="alert">{error}</p> : items === null ? <p role="status">Loading reports…</p> : items.length === 0 ?
          <Card><h2>No reports yet</h2><Button onClick={() => nav("generate")}>Upload a file</Button></Card> :
          <Card>{items.map((item) => <Row key={item.id} title={`Report · ${item.fileName}`} detail={`${new Date(item.createdAt).toLocaleDateString()} · ${item.generated ? "Saved report" : "Open to generate report"}`} onClick={() => openReport(item.id)} />)}</Card>}
      </div>
    </AppShell>
  );
}

const fileGroups = [
  ["2025-03-18", ["Discharge summary P1", "Discharge summary P2", "Complete blood count", "Chest CT report.pdf"]],
  ["2025-01-06", ["Outpatient record", "Biochemistry panel", "Pathology report.pdf"]],
  ["2024-11-22", ["Initial diagnosis", "Tumor markers", "Medication list", "PET-CT report.pdf", "Genetic test.pdf"]],
] as const;

type RecordDocument = {
  title: string;
  type: string;
  date: string;
  facility: string;
  summary?: string;
  rows: Array<[string, string, string, boolean?]>;
};

const recordDocuments: Record<string, RecordDocument> = {
  "Discharge summary P1": {
    title: "Discharge summary · Page 1",
    type: "Inpatient discharge record",
    date: "2025-03-18",
    facility: "** City First People's Hospital",
    summary: "Admitted for surgical treatment of a right upper-lobe lung lesion.",
    rows: [
      ["Admission diagnosis", "Right upper-lobe lung mass", "Clinical record"],
      ["Discharge diagnosis", "Lung adenocarcinoma, stage IIIA", "Pathology confirmed"],
      ["Procedure", "Thoracoscopic right upper lobectomy", "2025-03-09"],
      ["Condition at discharge", "Stable; incision healing well", "Follow-up required"],
    ],
  },
  "Discharge summary P2": {
    title: "Discharge summary · Page 2",
    type: "Treatment and follow-up plan",
    date: "2025-03-18",
    facility: "** City First People's Hospital",
    rows: [
      ["Medication", "Osimertinib 80 mg once daily", "As prescribed"],
      ["Review", "Oncology clinic in 2 weeks", "Bring pathology report"],
      ["Monitoring", "Blood count and liver function", "Every 2–4 weeks"],
      ["Warning signs", "Fever, dyspnea, severe rash", "Seek medical care"],
    ],
  },
  "Complete blood count": {
    title: "Complete blood count",
    type: "Laboratory examination report",
    date: "2025-03-18",
    facility: "** City First People's Hospital · Laboratory",
    rows: [
      ["White blood cells", "4.6 ×10⁹/L", "3.5–9.5"],
      ["Neutrophils", "68.2%", "40–75"],
      ["Hemoglobin", "109 g/L ↓", "115–150", true],
      ["Platelets", "186 ×10⁹/L", "125–350"],
      ["Lymphocytes", "0.9 ×10⁹/L ↓", "1.1–3.2", true],
    ],
  },
  "Chest CT report.pdf": {
    title: "Chest CT examination report",
    type: "Diagnostic imaging report",
    date: "2025-03-18",
    facility: "** City First People's Hospital · Imaging Center",
    summary: "Postoperative changes in the right lung. No clear recurrence at the surgical site. Mediastinal lymph nodes are smaller than before.",
    rows: [
      ["Examination", "Contrast-enhanced chest CT", "Chest"],
      ["Surgical site", "No definite recurrent lesion", "Stable"],
      ["Lymph nodes", "Smaller than previous scan", "Follow-up"],
      ["Pleural effusion", "None", "—"],
    ],
  },
  "Outpatient record": {
    title: "Oncology outpatient record",
    type: "Follow-up consultation",
    date: "2025-01-06",
    facility: "** City First People's Hospital",
    rows: [
      ["Main concern", "Routine post-treatment follow-up", "—"],
      ["Current symptoms", "Mild fatigue; occasional rash", "Grade 1"],
      ["Performance status", "ECOG 1", "0–5"],
      ["Plan", "Continue treatment and repeat CT", "In 3 months"],
    ],
  },
  "Biochemistry panel": {
    title: "Comprehensive biochemistry panel",
    type: "Laboratory examination report",
    date: "2025-01-06",
    facility: "** City First People's Hospital · Laboratory",
    rows: [
      ["Albumin", "33.1 g/L ↓", "40–55", true],
      ["ALT", "41 U/L", "7–45"],
      ["AST", "32 U/L", "13–35"],
      ["Total bilirubin", "14.2 μmol/L", "5–21"],
      ["Creatinine", "68 μmol/L", "41–81"],
      ["LDH", "286 U/L", "120–250", true],
    ],
  },
  "Pathology report.pdf": {
    title: "Histopathology report",
    type: "Surgical pathology",
    date: "2025-01-06",
    facility: "** City Pathology Center",
    summary: "Invasive lung adenocarcinoma with acinar-predominant pattern.",
    rows: [
      ["Specimen", "Right upper lung lobe", "Resection"],
      ["Tumor size", "3.2 × 2.6 × 2.1 cm", "Maximum diameter 3.2 cm"],
      ["Margins", "Negative", "R0"],
      ["Lymph nodes", "2 / 12 positive", "N2"],
      ["Pathologic stage", "pT2aN2M0", "Stage IIIA"],
    ],
  },
  "Initial diagnosis": {
    title: "Initial diagnosis record",
    type: "Multidisciplinary assessment",
    date: "2024-11-22",
    facility: "** City First People's Hospital",
    rows: [
      ["Primary diagnosis", "Right lung adenocarcinoma", "Confirmed"],
      ["Clinical stage", "cT2aN2M0", "Stage IIIA"],
      ["Symptoms", "Persistent cough; mild chest discomfort", "6 weeks"],
      ["Treatment plan", "Surgery followed by adjuvant therapy", "MDT decision"],
    ],
  },
  "Tumor markers": {
    title: "Tumor marker panel",
    type: "Laboratory examination report",
    date: "2024-11-22",
    facility: "** City First People's Hospital · Laboratory",
    rows: [
      ["CEA", "18.4 ng/mL ↑", "0–5", true],
      ["CYFRA21-1", "7.9 ng/mL ↑", "0–3.3", true],
      ["NSE", "14.8 ng/mL", "0–16.3"],
      ["CA19-9", "31.2 U/mL", "0–37"],
      ["CA125", "42.6 U/mL ↑", "0–35", true],
    ],
  },
  "Medication list": {
    title: "Current medication list",
    type: "Medication reconciliation",
    date: "2024-11-22",
    facility: "CaseMate structured record",
    rows: [
      ["Osimertinib", "80 mg once daily", "Targeted therapy"],
      ["Calcium carbonate", "600 mg once daily", "Supplement"],
      ["Vitamin D3", "800 IU once daily", "Supplement"],
      ["Moisturising cream", "Apply as needed", "Rash care"],
    ],
  },
  "PET-CT report.pdf": {
    title: "Whole-body PET-CT report",
    type: "Nuclear medicine imaging",
    date: "2024-11-22",
    facility: "** City Medical Imaging Center",
    summary: "Hypermetabolic lesion in the right upper lung with mediastinal lymph-node involvement. No definite distant metastasis.",
    rows: [
      ["Primary lesion", "SUVmax 8.6", "Right upper lobe"],
      ["Mediastinal node", "SUVmax 5.2", "Station 4R"],
      ["Distant metastasis", "Not identified", "M0"],
      ["Impression", "Findings favor primary lung malignancy", "Pathology advised"],
    ],
  },
  "Genetic test.pdf": {
    title: "Molecular pathology report",
    type: "Tumor genetic testing",
    date: "2024-11-22",
    facility: "** Precision Medicine Laboratory",
    rows: [
      ["EGFR exon 19 deletion", "Positive", "Allele frequency 32.4%", true],
      ["ALK fusion", "Negative", "Not detected"],
      ["ROS1 fusion", "Negative", "Not detected"],
      ["KRAS mutation", "Negative", "Not detected"],
      ["PD-L1 TPS", "10%", "Low expression"],
    ],
  },
};

function RecordPreview({
  record,
  close,
  nav,
}: {
  record: RecordDocument;
  close: () => void;
  nav: Nav;
}) {
  return (
    <div className="record-preview">
      <header className="record-preview-header">
        <button onClick={close}>‹ Back</button>
        <h1>Examination report</h1>
      </header>
      <div className="record-preview-scroll">
        <article className="report-paper">
          <div className="report-paper-brand">
            <span>CASEMATE MEDICAL RECORD</span>
            <small>Redacted copy</small>
          </div>
          <h2>{record.title}</h2>
          <p className="report-type">{record.type}</p>
          <div className="report-patient-grid">
            <span><small>Patient</small>Wang**</span>
            <span><small>Sex / Age</small>Female / 58</span>
            <span><small>Report date</small>{record.date}</span>
            <span><small>Record ID</small>CM-****-754</span>
          </div>
          <p className="report-facility">{record.facility}</p>
          {record.summary && (
            <section className="report-summary">
              <h3>Findings / Summary</h3>
              <p>{record.summary}</p>
            </section>
          )}
          <div className="report-table">
            <div className="report-table-head">
              <span>Item</span><span>Result</span><span>Reference / Note</span>
            </div>
            {record.rows.map(([item, result, reference, flagged]) => (
              <div className={flagged ? "flagged" : ""} key={item}>
                <span>{item}</span><strong>{result}</strong><span>{reference}</span>
              </div>
            ))}
          </div>
          <div className="report-signoff">
            <span><small>Reviewed by</small>CaseMate OCR</span>
            <span><small>Status</small>Verify against original</span>
          </div>
          <p className="report-disclaimer">
            This is a structured, redacted copy for personal record management. Verify all values against the original medical document.
          </p>
        </article>
        <div className="record-preview-actions">
          <Button className="ai-text" onClick={() => nav("assistant")}>Ask AI · Explain this report</Button>
          <Button onClick={() => nav("chart")}>Compare related results</Button>
        </div>
      </div>
    </div>
  );
}

function Uploaded({ back, nav }: { back: () => void; nav: Nav }) {
  const [selectedRecord, setSelectedRecord] = useState<UploadedRecord | null>(null);
  const [uploadedRecords, setUploadedRecords] = useState<UploadedRecord[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/records`,
      { headers: apiHeaders(), cache: "no-store" },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load records.");
        if (!Array.isArray(result.records)) throw new Error("The records service returned an invalid response.");
        setUploadedRecords(result.records);
      })
      .catch((error) =>
        setLoadError(error instanceof Error ? error.message : "Unable to load records."),
      );
  }, []);

  return (
    <>
      <AppShell title="Uploaded files" back={back}>
        <div className="content">
          {!loadError && <p className="caption">{uploadedRecords.length} upload records securely saved for this account.</p>}
          {loadError && <p className="chat-error" role="alert">{loadError}</p>}
          {uploadedRecords.length > 0 ? (
            <Card>
              <h2>Your uploads</h2>
              <div className="file-grid">
                {uploadedRecords.map((record) => (
                  <button key={record.id} onClick={() => setSelectedRecord(record)}>
                    <Icon name={record.mimeType.startsWith("image/") ? "image" : "doc"} />
                    <small>{record.fileName}</small>
                    {record.files && <small>{record.files.length} original file(s)</small>}
                    <small className={record.extractionStatus === "ready" ? "ai-text" : undefined}>
                      {record.extractionStatus === "ready"
                        ? "AI searchable"
                        : record.extractionStatus === "needs_ocr"
                          ? "OCR required"
                          : "No text found"}
                    </small>
                  </button>
                ))}
              </div>
            </Card>
          ) : (
            !loadError && <Card><h2>No uploaded files yet</h2><p className="caption">Files you upload while logged into this account will appear here.</p></Card>
          )}
          <Button onClick={() => nav("generate")}>Back to reports</Button>
        </div>
      </AppShell>
      {selectedRecord && (
        <OriginalFile
          record={selectedRecord}
          close={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}

function Privacy({ back }: { back: () => void }) {
  const records = [
    ["Discharge summary_2026-07.jpg", "Processed 2026-08-13", [["Name", "Wang**", true], ["National ID", "Fully masked", true], ["Hospital ID", "00****1", true], ["Phone number", "Fully masked", true], ["Attending doctor", "Li Jianguo", false]]],
    ["Chest CT report_2026-07-28.pdf", "Processed 2026-07-28", [["Name", "Fully masked", true], ["Exam ID", "Fully masked", true], ["Hospital", "** City First People's Hospital", true]]],
  ] as const;
  return (
    <AppShell title="Privacy management" back={back}>
      <div className="content">
        <Card><p className="subtle">Uploads are automatically redacted. See what was masked in each file and change individual settings. Related report sections will be regenerated after changes.</p></Card>
        {records.map(([title, date, fields]) => <Card key={title}><h2>{title}</h2><p className="caption">{date}</p><div className="privacy-level"><button>Strict</button><button className="active">Standard</button><button>Identifiers only</button></div>{fields.map(([t, d, on]) => <Setting key={t} title={t} detail={d as string} initial={on as boolean} />)}</Card>)}
        <Button primary>Save changes</Button>
      </div>
    </AppShell>
  );
}

function ShareModal({ close }: { close: () => void }) {
  const [tab, setTab] = useState<"qr" | "link">("qr");
  const [copied, setCopied] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="share-modal" role="dialog" aria-modal="true" aria-label="Share this report" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><h2>Share this report</h2><button onClick={close}>×</button></div>
        <div className="share-tabs"><button className={tab === "qr" ? "active" : ""} onClick={() => setTab("qr")}>▦ QR code</button><button className={tab === "link" ? "active" : ""} onClick={() => setTab("link")}>Link</button></div>
        {tab === "qr" ? <img className="modal-qr" src={icons.qr} alt="Report QR code" /> : <div className="link-placeholder">Your share link will appear here</div>}
        <p className="caption center">{tab === "qr" ? "Scan to view this redacted report." : "Open the link to view this redacted report."} Access expires after 7 days.</p>
        <Button onClick={() => setCopied(true)}>{copied ? "Saved" : tab === "qr" ? "Save QR code" : "Copy link"}</Button>
      </section>
    </div>
  );
}

function Sharing({ back }: { back: () => void }) {
  const [modal, setModal] = useState(false);
  const [allow, setAllow] = useState(false);
  return (
    <AppShell title="Sharing" back={back}>
      <div className="content">
        <Card><p className="subtle">Share a redacted report with family, caregivers, or doctors. They can only view the selected report and cannot edit it. You can revoke access at any time.</p></Card>
        <Card><h2>Select a report</h2>{reports.map((r, i) => <Choice key={r[0]} title={r[0]} detail={r[1]} selected={i === 0} />)}</Card>
        <Card>
          <h2>Share via</h2>
          <div className="inline-tabs"><button>QR code</button><button>Link</button></div>
          <img className="qr" src={icons.qr} alt="Report QR code" />
          <p className="caption">Scan with WeChat to view</p><p className="caption">Expires in</p>
          <div className="expiry"><button>24 hours</button><button className="active">7 days</button><button>30 days</button><button>No expiry</button></div>
          <div className="setting"><span>Allow downloads<small>When off, recipients can view online but cannot save the file</small></span><Toggle value={allow} onChange={setAllow} /></div>
          <Button onClick={() => setModal(true)}>Copy link</Button>
          <Button primary onClick={() => setModal(true)}>Create &amp; share</Button>
        </Card>
        <Card><h2>Shared reports</h2><p className="caption">Revoke access at any time; access ends immediately</p><Row title="Lung adenocarcinoma · Follow-up" detail="Daughter · QR code · Expires in 7 days" /><Button className="compact">Revoke</Button><Row title="Lung adenocarcinoma · Initial diagnosis" detail="Attending doctor · Link · Expired" /></Card>
      </div>
      {modal && <ShareModal close={() => setModal(false)} />}
    </AppShell>
  );
}

function Orders({ back, nav }: { back: () => void; nav: Nav }) {
  return (
    <AppShell title="My orders" back={back}>
      <div className="content">
        <div className="order-tabs"><button>All</button><button>Reviews</button><button>Membership</button><button>Consultations</button></div>
        <Card>
          <Row title="Lung adenocarcinoma · Follow-up" detail="Human review · ¥8 · 2026-08-13 14:02 · In progress" onClick={() => nav("review")} />
          <Row title="Monthly membership" detail="2 reviews/month + unlimited reports · Active" onClick={() => nav("membership")} />
          <Row title="Online text consultation" detail="Respiratory medicine · Dr. Chen · Completed" onClick={() => nav("consultation")} />
          <Row title="Lung adenocarcinoma · 6-month follow-up" detail="Human review · ¥8 · 2026-05-12 10:20 · Completed" onClick={() => nav("completed")} />
        </Card>
        <p className="caption">Report creation and export are free. Only paid services appear here.</p>
      </div>
    </AppShell>
  );
}

function Settings({
  back,
  nav,
  onLogout,
}: {
  back: () => void;
  nav: Nav;
  onLogout: () => void;
}) {
  return (
    <AppShell title="Settings" back={back}>
      <div className="content">
        <Card><h2>Default privacy level</h2><p className="caption">Automatically redact new uploads at this level</p><Setting title="Automatic redaction on upload" /><div className="inline-tabs"><button>Strict</button><button>Standard</button><button>Identifiers only</button></div><p className="caption">Keep surname; mask ID and phone numbers (recommended)</p><Row title="View past redactions" onClick={() => nav("privacy")} /></Card>
        <Card><h2>Notifications</h2><Setting title="Human review updates" detail="Notify me when a reviewer starts or finishes" /><Setting title="Report ready" detail="Notify me when a report is ready or needs confirmation" /><Setting title="Result trend alerts" detail="Alert me to significant changes in key lab results" initial={false} /><Setting title="Service updates" detail="Membership benefits and new features" initial={false} /></Card>
        <Card><h2>Account &amp; security</h2><Row title="Linked phone" detail="138****6621" /><Row title="WeChat authorization" detail="Authorized" /><Row title="Logged-in devices" detail="2 devices" /><Row title="Verify when opening app" detail="Off" /></Card>
        <Card><h2>Data management</h2><Row title="Clear local cache" detail="42.6 MB" /><Row title="Export all my records" detail="Download archive" /><Row title="Delete account and data" detail="Permanent" /></Card>
        <Card><h2>Help &amp; about</h2><Row title="User guide" /><Row title="Support / Feedback" /><Row title="Privacy policy & Terms" /><Row title="App version" detail="V1.0.0" /></Card>
        <Button onClick={onLogout}>Log out</Button>
        <p className="caption">A personal summary of your records; not an official medical record or medical advice.</p>
      </div>
    </AppShell>
  );
}

function Medical({ back, nav }: { back: () => void; nav: Nav }) {
  return (
    <AppShell title="Medical report" back={back}>
      <div className="content">
        <Card><h2>Lung adenocarcinoma · 6-month follow-up.docx</h2><p className="caption">2026-05-12 09:10 · 5 pages · Patient Wang**</p><Button className="compact" onClick={() => nav("details")}>Edit</Button></Card>
        <Card><h2>Report preview</h2><p className="subtle">This report is archived. Export it below to view the complete content.</p></Card>
        <Card><h2>Imaging files</h2><p className="caption">Original CT / MRI images</p><Button>Upload imaging files linked to this report</Button></Card>
        <div className="three-buttons"><Button>↓ PDF</Button><Button>↓ Word</Button><Button onClick={() => nav("sharing")}>Share</Button></div>
        <p className="caption">Export is free. Human review is an optional paid service.</p>
      </div>
    </AppShell>
  );
}

function ReportDetails({ back, nav, uploaded = false, recordId }: { back: () => void; nav: Nav; uploaded?: boolean; recordId?: string }) {
  if (uploaded) return (
    <AppShell title="Medical report" back={back} fixedAction={<Button className="ai-text" onClick={() => nav("assistant")}>Ask AI · Find &amp; explain</Button>}>
      <UploadedReport key={recordId || "combined"} recordId={recordId} onUpload={() => nav("generate")} onSources={() => nav("uploaded")} />
    </AppShell>
  );
  return (
    <AppShell
      title="Medical report"
      back={back}
      fixedAction={
        <Button className="ai-text" onClick={() => nav("assistant")}>
          Ask AI · Find &amp; explain
        </Button>
      }
    >
      <div className="content">
        <Card>
          <div className="report-heading"><Icon name="report" size={38} /><div><h2>Lung adenocarcinoma · Follow-up.docx</h2><small>2026-08-13 13:42 · 6 pages · Patient Wang**</small></div><Button className="compact">Edit</Button></div>
          <p className="caption">Example template for manual entry; these are sample patient details.</p>
          <p className="notice">3 uncertain fields are highlighted in yellow. Check them against the originals.</p>
        </Card>
        <Card className="confirm-card">
          <h2>8 items to confirm</h2>
          <p className="subtle">Uncertain values are retained as recorded. Compare them with the originals, edit them, or request a human review.</p>
          <div className="uncertain"><p>The OCR label and value “126” appear inconsistent with the reference range. Check the original label and decimal point.</p><small>Suggestion: check the original; the value may be 1.26</small><div className="two-buttons"><Button>I&apos;ll edit</Button><Button onClick={() => nav("request")}>Human review</Button></div></div>
          <div className="uncertain"><p>Albumin was recorded as 353 on June 26 and 33.1 four days later. This large change may indicate an error.</p><small>Suggestion: check whether the June 26 result is 35.3</small><div className="two-buttons"><Button>I&apos;ll edit</Button><Button onClick={() => nav("request")}>Human review</Button></div></div>
          <button className="muted-link">Show 6 more items&nbsp; ›</button>
          <Button primary onClick={() => nav("request")}>Review all items (¥8)</Button>
        </Card>
        <Card><h2>1. Basic information</h2><div className="detail-list"><small>Patient</small><p>Wang** (Female / 58)</p><small>Primary diagnosis</small><p>Stage IIIA lung adenocarcinoma</p><small>Report date</small><p>2026-08-13</p></div></Card>
        <Card><h2>2. Treatment history (timeline)</h2><p className="subtle">2025-03-09 · Surgery<br />2025-04 to 2025-07 · Adjuvant chemotherapy<br />2025-08 to present · Targeted therapy</p></Card>
        <Card>
          <h2>3. Key result history</h2>
          <div className="report-metric">
            <small>CEA（ng/mL）</small>
            <p>2024-11: 18.4 → 2025-06: 5.2 → 2026-08: 3.1</p>
            <small>Source: 5 lab reports</small>
          </div>
          <div className="report-metric">
            <small>CYFRA21-1&nbsp; · &nbsp;Verify</small>
            <p>2024-11: 7.9 → 2026-08: 2.4</p>
            <small>Source: 4 lab reports</small>
            <Button onClick={() => nav("request")}>Request human review →</Button>
          </div>
          <div className="report-metric">
            <small>White blood cells (10⁹/L)</small>
            <p>Latest: 4.6; lowest during chemotherapy: 2.1</p>
            <small>Source: 9 blood count reports</small>
            <Button className="report-action" onClick={() => nav("chart")}>
              Interactive comparison
            </Button>
            <Button className="report-action ai-text" onClick={() => nav("assistant")}>
              Ask AI · Find &amp; explain
            </Button>
          </div>
        </Card>
        <Card>
          <h2>4. Imaging &amp; assessment</h2>
          <div className="report-metric">
            <small>2026-07-28 Chest CT</small>
            <p>No clear recurrence at surgical site; mediastinal lymph nodes smaller than before</p>
            <small>Source: imaging report P1</small>
          </div>
          <div className="report-metric">
            <small>Response assessment</small>
            <p>Continued SD / No progression</p>
            <small className="ai-text">Source: AI summary</small>
          </div>
        </Card>
        <Card>
          <h2>5. Follow-up questions</h2>
          <div className="report-metric">
            <small>Question 1</small>
            <p>Should targeted maintenance therapy continue? For how long?</p>
            <small className="ai-text">Source: AI generated</small>
          </div>
          <div className="report-metric">
            <small>Question 2</small>
            <p>Could recent mouth ulcers and rash be medication side effects?</p>
            <small>Source: symptom records</small>
          </div>
        </Card>
        <Card>
          <h2>Imaging files</h2>
          <p className="caption">Original CT / MRI images</p>
          <Button>Upload imaging files linked to this report</Button>
        </Card>
        <div className="three-buttons">
          <Button>↓ PDF</Button>
          <Button>↓ Word</Button>
          <Button onClick={() => nav("sharing")}>Share</Button>
        </div>
        <p className="caption">Export is free. Human review is an optional paid service.</p>
      </div>
    </AppShell>
  );
}

function Assistant({ back, nav }: { back: () => void; nav: Nav }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const askAssistant = async (question: string) => {
    const value = question.trim();
    if (!value || loading) return;

    const nextMessages = [
      ...messages,
      { role: "user" as const, content: value },
    ];
    setMessages(nextMessages);
    setText("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/chat`,
        {
          method: "POST",
          headers: {
            ...apiHeaders(),
          },
          body: JSON.stringify({
            messages: nextMessages,
          }),
        },
      );

      const responseText = await response.text();
      let result: { message?: string; error?: string } = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        if (response.status === 404) {
          throw new Error(
            "The AI endpoint is not deployed yet. Redeploy the Supabase Edge Function.",
          );
        }
        throw new Error(
          response.ok
            ? "The AI endpoint returned an invalid response."
            : `The AI service returned HTTP ${response.status}.`,
        );
      }
      if (!response.ok || typeof result.message !== "string") {
        throw new Error(result.error || "The AI assistant could not answer.");
      }
      const answer = result.message;

      setMessages((items) => [
        ...items,
        { role: "assistant", content: answer },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The AI assistant could not answer. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Records assistant" back={back}>
      <div className="assistant-content">
        <p className="caption">Searching the medical records uploaded to your account</p>
        <div className="ai-message"><strong>✦ Records assistant</strong><p>Hi, I can find test results in your records or compare results across dates. What would you like to know?</p></div>
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div className="user-message" key={`${message.content}-${index}`}>
              {message.content}
            </div>
          ) : (
            <div className="ai-message" key={`${message.content}-${index}`}>
              <strong>✦ Records assistant</strong>
              <p className="ai-answer">{message.content}</p>
            </div>
          ),
        )}
        {loading && (
          <div className="ai-message" role="status">
            <strong>✦ Records assistant</strong>
            <p className="ai-thinking">Reviewing the report…</p>
          </div>
        )}
        {error && (
          <div className="chat-error" role="alert">
            <p>{error}</p>
            <Button onClick={() => askAssistant(messages.at(-1)?.content || text)}>
              Try again
            </Button>
          </div>
        )}
        <Button onClick={() => askAssistant("What changed since last time?")}>
          What changed since last time?
        </Button>
      </div>
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          askAssistant(text);
        }}
      >
        <span>＋</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask a question or choose a suggestion…"
          disabled={loading}
        />
        <button disabled={loading || !text.trim()}>{loading ? "…" : "↑"}</button>
        <small className="ai-text">AI may make mistakes · Verify against original records</small>
      </form>
    </AppShell>
  );
}

function Compare({ table, back, nav }: { table?: boolean; back: () => void; nav: Nav }) {
  return (
    <AppShell
      title={table ? "Compare results · Table" : "Compare past results"}
      back={back}
      fixedAction={<Button className="ai-text" onClick={() => nav("assistant")}>Ask AI · {table ? "Find & explain" : "Explain this result"}</Button>}
    >
      <div className="content compare-content">
        <Card><h2>Hemoglobin&nbsp; · &nbsp;g/L</h2><p>Selected: 06-26 and 07-06</p>{!table && <p className="caption">Year not recorded. Check the original lab report.</p>}<Button onClick={() => nav(table ? "chart" : "table")}>{table ? "Show trend chart" : "Show data table"}</Button></Card>
        {table ? (
          <Card><h2>Result comparison</h2><div className="result-table"><b>Date</b><b>Value</b><b>Unit</b><span>06-26</span><span>92</span><span>g/L</span><span>07-06</span><span>109</span><span>g/L</span></div><p className="subtle">Prototype reference range: 115–150 g/L.<br />Verify the reference range in each original report.</p><p className="caption">Year not recorded; no year has been assumed.</p><button className="text-button">View source records</button></Card>
        ) : (
          <Card><h2>Change between records</h2><div className="chart"><img src={icons.chart} alt="" /><span className="v92">92</span><span className="v109">109</span><span className="d1">06-26</span><span className="d2">07-06</span><span className="unit">g/L</span></div><p>The value rose from 92 to 109 g/L, an increase of 17 g/L. This alone does not indicate improvement or deterioration.</p></Card>
        )}
        {table ? <Card><h2>Next step</h2><p>Add “Which other tests are needed to interpret this result?” to your follow-up questions.</p><Button onClick={() => nav("details")}>Back to follow-up questions</Button></Card> : <Card><h2>View each record</h2><Button>06-26 · 92 g/L · View record</Button><Button>07-06 · 109 g/L · View record</Button><p className="caption">Before comparing, verify the indicator, unit, dates, and each report&apos;s reference range.</p></Card>}
      </div>
    </AppShell>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("welcome");
  const [history, setHistory] = useState<Page[]>([]);
  const [healthDetails, setHealthDetails] = useState<string[]>([]);
  const [reportMode, setReportMode] = useState<"manual" | "uploaded">("uploaded");
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(sessionStorage.getItem("casemate_session")),
  );
  const nav: Nav = (next) => {
    if (
      !authenticated &&
      next !== "welcome" &&
      next !== "signup" &&
      next !== "login"
    ) {
      setPage("login");
      return;
    }
    if (next === page) return;
    if (next === "conversation") setReportMode("manual");
    if (next === "details" && page !== "conversation") {
      setReportMode("uploaded");
      setSelectedReportId(undefined);
    }
    setHistory((items) => [...items, page]);
    setPage(next);
    window.scrollTo(0, 0);
  };
  const back = () => {
    const previous = history.at(-1) || "profile";
    setHistory((items) => items.slice(0, -1));
    setPage(previous);
    window.scrollTo(0, 0);
  };
  const sendHealthDetail = (message: string) => {
    setReportMode("manual");
    setHealthDetails((items) => [...items, message]);
    if (page !== "conversation") nav("conversation");
  };
  const completeLogin = () => {
    setHealthDetails([]);
    setReportMode("uploaded");
    setAuthenticated(true);
    setHistory(["welcome"]);
    setPage("generate");
    window.scrollTo(0, 0);
  };
  const logout = () => {
    sessionStorage.removeItem("casemate_session");
    sessionStorage.removeItem("casemate_user");
    setAuthenticated(false);
    setHealthDetails([]);
    setReportMode("uploaded");
    setHistory([]);
    setPage("welcome");
    window.scrollTo(0, 0);
  };

  if (page === "welcome") return <Welcome nav={nav} />;
  if (page === "signup" || page === "login") {
    return (
      <AuthForm
        mode={page}
        nav={nav}
        onAuthenticated={completeLogin}
      />
    );
  }
  const openFileReport = (recordId: string) => {
    nav("details");
    setReportMode("uploaded");
    setSelectedReportId(recordId);
  };
  if (page === "generate") return <Generate nav={nav} onSend={sendHealthDetail} onUploaded={openFileReport} />;
  if (page === "conversation") {
    return (
      <Conversation
        nav={nav}
        healthDetails={healthDetails}
        onSend={sendHealthDetail}
      />
    );
  }
  if (page === "human") return <HumanReview nav={nav} />;
  if (page === "profile") return <Profile nav={nav} />;
  if (page === "membership") return <ComingSoon kind="Membership" nav={nav} back={back} />;
  if (page === "consultation") return <ComingSoon kind="Online consultation" nav={nav} back={back} />;
  if (page === "request") return <RequestReview nav={nav} back={back} />;
  if (page === "review") return <ReviewStatus nav={nav} back={back} />;
  if (page === "completed") return <ReviewStatus completed nav={nav} back={back} />;
  if (page === "past") return <PastReports nav={nav} back={back} openReport={openFileReport} />;
  if (page === "uploaded") return <Uploaded nav={nav} back={back} />;
  if (page === "privacy") return <Privacy back={back} />;
  if (page === "sharing") return <Sharing back={back} />;
  if (page === "orders") return <Orders nav={nav} back={back} />;
  if (page === "settings") {
    return <Settings nav={nav} back={back} onLogout={logout} />;
  }
  if (page === "medical") return <Medical nav={nav} back={back} />;
  if (page === "details") return <ReportDetails nav={nav} back={back} uploaded={reportMode === "uploaded"} recordId={selectedReportId} />;
  if (page === "assistant") return <Assistant nav={nav} back={back} />;
  if (page === "table") return <Compare table nav={nav} back={back} />;
  return <Compare nav={nav} back={back} />;
}
