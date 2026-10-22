import { useEffect, useState } from "react";
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import OriginalFile from "./OriginalFile";

type Observation = { name: string; value: number; valueText: string; unit: string; date: string | null; patient: string; reference: string; quote: string; sourceId: string; recordId: string; fileName: string; mimeType: string };
type Group = { key: string; name: string; unit: string; patient: string; rows: Observation[] };
const aliases: Record<string, string> = { "血小板": "Platelets / 血小板", "血小板计数": "Platelets / 血小板", "platelets": "Platelets / 血小板", "plateletcount": "Platelets / 血小板", "plt": "Platelets / 血小板", "血红蛋白": "Hemoglobin / 血红蛋白", "血红蛋白浓度": "Hemoglobin / 血红蛋白", "hemoglobin": "Hemoglobin / 血红蛋白", "haemoglobin": "Hemoglobin / 血红蛋白", "hgb": "Hemoglobin / 血红蛋白", "hb": "Hemoglobin / 血红蛋白", "白细胞": "White blood cells / 白细胞", "白细胞计数": "White blood cells / 白细胞", "wbc": "White blood cells / 白细胞", "whitebloodcells": "White blood cells / 白细胞" };
const commonNames: Array<[string, string[]]> = [
  ["Albumin / 白蛋白", ["albumin", "白蛋白", "alb"]],
  ["Creatinine / 肌酐", ["creatinine", "肌酐"]],
  ["Potassium / 钾", ["potassium", "钾"]],
  ["Sodium / 钠", ["sodium", "钠"]],
  ["Urea / 尿素", ["urea", "尿素"]],
  ["Total bilirubin / 总胆红素", ["totalbilirubin", "总胆红素"]],
  ["Hematocrit / 红细胞压积", ["hematocrit", "红细胞压积", "hct"]],
  ["Red blood cells / 红细胞", ["redbloodcells", "红细胞", "红细胞计数", "rbc"]],
  ["Cytokeratin 19 fragment (CYFRA21-1) / 细胞角蛋白19片段", ["cyfra21-1", "细胞角蛋白19片段", "细胞角蛋白19片段cyfra21-1"]],
  ["International normalized ratio (INR) / 国际标准化比值", ["inr", "国际标准化比值inr", "国际标准化比值"]],
  ["Prothrombin time (PT) / 凝血酶原时间", ["pt", "凝血酶原时间pt", "凝血酶原时间"]],
];
commonNames.push(
  ["Alanine aminotransferase (ALT) / 丙氨酸氨基转移酶", ["alt", "alanineaminotransferase", "丙氨酸氨基转移酶", "丙氨酸氨基转移酶alt", "谷丙转氨酶", "谷丙转氨酶alt"]],
  ["Aspartate aminotransferase (AST) / 天门冬氨酸氨基转移酶", ["ast", "aspartateaminotransferase", "天门冬氨酸氨基转移酶", "天门冬氨酸氨基转移酶ast", "谷草转氨酶", "谷草转氨酶ast"]],
  ["Alkaline phosphatase (ALP) / 碱性磷酸酶", ["alp", "alkalinephosphatase", "碱性磷酸酶", "碱性磷酸酶alp"]],
  ["Activated partial thromboplastin time (APTT) / 活化部分凝血活酶时间", ["aptt", "活化部分凝血活酶时间", "活化部分凝血活酶时间aptt"]],
  ["Fibrinogen / 纤维蛋白原", ["fibrinogen", "fib", "纤维蛋白原"]],
  ["D-dimer / D-二聚体", ["d-dimer", "ddimer", "d-二聚体", "d二聚体"]],
  ["Mean corpuscular volume (MCV) / 平均红细胞体积", ["mcv", "meancorpuscularvolume", "平均红细胞体积"]],
  ["Mean corpuscular hemoglobin (MCH) / 平均红细胞血红蛋白量", ["mch", "meancorpuscularhemoglobin", "平均红细胞血红蛋白量"]],
  ["Mean corpuscular hemoglobin concentration (MCHC) / 平均红细胞血红蛋白浓度", ["mchc", "meancorpuscularhemoglobinconcentration", "平均红细胞血红蛋白浓度"]],
  ["Neutrophils / 中性粒细胞计数", ["neutrophils", "neutrophilcount", "中性粒细胞", "中性粒细胞计数", "neut#"]],
  ["Neutrophil percentage / 中性粒细胞比例", ["neutrophilpercentage", "neutrophils%", "neut%", "中性粒细胞比例", "中性粒细胞百分比"]],
  ["Lymphocytes / 淋巴细胞计数", ["lymphocytes", "lymphocytecount", "淋巴细胞计数"]],
  ["Lymphocyte percentage / 淋巴细胞比例", ["lymphocytepercentage", "淋巴细胞比例", "淋巴细胞百分比"]],
  ["Carcinoembryonic antigen (CEA) / 癌胚抗原", ["cea", "carcinoembryonicantigen", "癌胚抗原", "癌胚抗原cea"]],
  ["Neuron-specific enolase (NSE) / 神经元特异性烯醇化酶", ["nse", "neuron-specificenolase", "neuronspecificenolase", "神经元特异性烯醇化酶", "神经元特异性烯醇化酶nse"]],
  ["Calcium / 钙", ["calcium", "钙"]],
  ["Chloride / 氯", ["chloride", "氯"]],
  ["Glucose / 葡萄糖", ["glucose", "glu", "葡萄糖", "血糖"]],
  ["C-reactive protein (CRP) / C反应蛋白", ["crp", "c-reactiveprotein", "c反应蛋白", "c-反应蛋白"]],
  ["Total protein / 总蛋白", ["totalprotein", "总蛋白"]],
  ["Direct bilirubin / 直接胆红素", ["directbilirubin", "直接胆红素"]],
  ["Uric acid / 尿酸", ["uricacid", "尿酸"]],
);
for (const [name, names] of commonNames) for (const alias of names) aliases[alias] = name;
const normalize = (value: string) => value.toLowerCase().replace(/\s/g, "");
function groupRows(rows: Observation[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const name = aliases[normalize(row.name).replace(/^(previous|latest|current)/, "")] || `Translation pending / 名称待核对 · ${row.name}`;
    const key = JSON.stringify([normalize(name), row.unit.replace(/\s/g, ""), normalize(row.patient)]);
    const group = groups.get(key) || { key, name, unit: row.unit, patient: row.patient, rows: [] };
    // Re-uploaded identical dated evidence should not become another time point.
    if (!group.rows.some((prior) => row.date && prior.date === row.date && prior.value === row.value && normalize(prior.quote) === normalize(row.quote))) group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, rows: group.rows.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")) })).sort((a, b) => a.name.localeCompare(b.name));
}
async function api(path: string, signal: AbortSignal, method = "GET") {
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/${path}`, { method, signal, cache: "no-store", headers: { Authorization: `Bearer ${publicAnonKey}`, "X-CaseMate-Session": sessionStorage.getItem("casemate_session") || "" } });
  if (response.status === 404 && path.startsWith("observations")) throw new Error("The indicator service has not been deployed yet.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load indicators.");
  return result;
}
export default function IndicatorHistory({ onUpload }: { onUpload: () => void }) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const groups = groupRows(observations);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [table, setTable] = useState(false);
  const [confirmedPatient, setConfirmedPatient] = useState(false);
  const [status, setStatus] = useState("Loading your uploaded reports…");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [original, setOriginal] = useState<Observation | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("Loading your uploaded reports…"); setWarnings([]); setObservations([]);
    void (async () => {
      try {
        const result = await api("records", controller.signal);
        const rows: Observation[] = [];
        const issues: string[] = [];
        for (const [index, record] of (result.records || []).entries()) {
          if (controller.signal.aborted) return;
          setStatus(`Indexing ${index + 1} / ${result.records.length}: ${record.fileName}`);
          try {
            const extracted = await api(`observations?recordId=${encodeURIComponent(record.id)}`, controller.signal, "POST");
            rows.push(...extracted.observations); issues.push(...extracted.warnings);
            if (!controller.signal.aborted) { setObservations([...rows]); setWarnings([...issues]); }
          } catch (error) {
            if (controller.signal.aborted) return;
            issues.push(`${record.fileName}: ${error instanceof Error ? error.message : "Unable to index this file."}`);
            setWarnings([...issues]);
          }
        }
        if (!controller.signal.aborted) setStatus("");
      } catch (error) { if (!controller.signal.aborted) { setWarnings([error instanceof Error ? error.message : "Unable to load uploads."]); setStatus(""); } }
    })();
    return () => controller.abort();
  }, [retry]);
  const metrics = [...new Set(groups.map((item) => normalize(item.name)))].map((normalizedName) => {
    const series = groups.filter((item) => normalize(item.name) === normalizedName).sort((a, b) => b.rows.filter((row) => row.date).length - a.rows.filter((row) => row.date).length);
    return { name: series[0].name, key: normalizedName, series, rows: series.flatMap((item) => item.rows).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")) };
  }).sort((a, b) => {
    const rank = (name: string) => name.startsWith("Platelets /") ? 0 : name.startsWith("Hemoglobin /") ? 1 : 2;
    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
  });
  const group = groups.find((item) => item.key === selected);
  const siblingSeries = groups.filter((item) => normalize(item.name) === normalize(group?.name || ""));
  const dated = group?.rows.filter((row) => row.date) || [];
  const unitReadable = Boolean(group?.unit && /^[A-Za-zµμ%\d/^.*×³⁹¹²\s−-]+$/.test(group.unit));
  const needsPatientConfirmation = !group?.patient || /[*＊]/.test(group.patient);
  const canChart = dated.length >= 2 && new Set(dated.map((row) => row.date)).size >= 2 && unitReadable && (!needsPatientConfirmation || confirmedPatient);
  const points = dated.map((row) => ({ row, time: Date.parse(row.date!) }));
  const chartDates = [...new Set(dated.map((row) => row.date!))];
  const chartWidth = Math.max(640, chartDates.length * 125 + 110);
  const minValue = Math.min(...dated.map((row) => row.value));
  const maxValue = Math.max(...dated.map((row) => row.value));
  const margin = Math.max((maxValue - minValue) * .15, Math.abs(maxValue) * .05, 1);
  const x = (time: number) => 55 + chartDates.findIndex((date) => Date.parse(date) === time) / (chartDates.length - 1 || 1) * (chartWidth - 120);
  const y = (value: number) => 210 - (value - minValue + margin) / (maxValue - minValue + 2 * margin) * 170;
  return <div className="content indicator-history">
    {status && <section className="card"><p role="status" aria-live="polite">{status}</p><p className="caption">The first index may take a few minutes. Previously indexed uploads are reused.</p></section>}
    {warnings.length > 0 && <section className="card confirm-card"><details><summary>{warnings.length} indexing note(s)</summary>{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details><button className="button" disabled={Boolean(status)} onClick={() => setRetry(retry + 1)}>Retry indexing</button></section>}
    {!group ? <>
      <section className="card"><h2>Your indicators</h2><p className="caption">Laboratory results from your uploaded reports. Each indicator appears once. Patient and unit groups are kept separate inside Compare.</p><label>Find an indicator<input className="indicator-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Platelets, Hemoglobin, 血小板…" /></label><p className="caption">{metrics.length} indicator(s)</p></section>
      {metrics.filter((item) => `${item.name} ${item.rows.map((row) => row.name).join(" ")}`.toLowerCase().includes(query.toLowerCase())).map((item) => {
        const dates = item.rows.filter((row) => row.date).map((row) => row.date!);
        return <section className="card" key={item.key}><h2>{item.name}</h2><p>{item.rows.length} result(s){dates.length > 0 && ` · ${dates[0]} → ${dates.at(-1)}`}</p><p className="caption">{item.series.map((series) => series.unit || "Unit not recorded").filter((unit, i, all) => all.indexOf(unit) === i).join(" · ")}{item.series.length > 1 && ` · ${item.series.length} patient / unit groups`}</p><p className="caption">{new Set(item.rows.map((row) => row.sourceId)).size} source file(s){item.rows.some((row) => !row.date) && " · Some examination dates need confirmation"}</p><button className="button" onClick={() => { setSelected(item.series[0].key); setTable(false); setConfirmedPatient(false); }}>Compare →</button></section>;
      })}
      {!groups.length && !status && <section className="card"><h2>No indicators available yet</h2><p>Upload readable laboratory reports, or check the file messages above.</p><button className="button" onClick={onUpload}>Upload reports</button></section>}
      {groups.length > 0 && <button className="button" disabled={Boolean(status)} onClick={() => setRetry(retry + 1)}>Check for new uploads</button>}
    </> : <>
      <button className="button" onClick={() => setSelected(null)}>← All indicators</button>
      <section className="card"><h2>{group.name} · {group.unit || "Unit not recorded"}</h2>{siblingSeries.length > 1 && <label>Patient / unit group<select className="indicator-search" value={group.key} onChange={(event) => { setSelected(event.target.value); setConfirmedPatient(false); }}>{siblingSeries.map((series) => <option value={series.key} key={series.key}>{series.patient || "Patient not identified"} · {series.unit || "Unit not recorded"} · {series.rows.length} results</option>)}</select></label>}<p>{group.rows.length} historical result(s) · earliest to latest</p><p className="caption">Patient: {group.patient || "Not identified"}</p>{needsPatientConfirmation && <label className="indicator-confirm"><input type="checkbox" checked={confirmedPatient} onChange={(event) => setConfirmedPatient(event.target.checked)} /> I checked the originals: these results belong to the same patient.</label>}<button className="button" disabled={!canChart && table} onClick={() => setTable(!table)}>{table ? "Show trend chart" : "Show data table"}</button>{!canChart && <p className="notice">A trend needs two different full examination dates, a readable recorded unit, and a confirmed patient. All extracted results remain in the table below.</p>}</section>
      <section className="card"><h2>{table || !canChart ? "Result comparison" : "Change over time"}</h2>
        {table || !canChart ? <div className="indicator-table-wrap"><table className="indicator-table"><thead><tr><th>Date</th><th>Value</th><th>Unit</th><th>Reference range</th><th>Source</th></tr></thead><tbody>{group.rows.map((row, i) => <tr key={i}><td>{row.date || "Not recorded"}</td><td>{row.valueText}</td><td>{row.unit || "—"}</td><td>{row.reference || "Not recorded"}</td><td><button className="text-button" onClick={() => setOriginal(row)}>{row.fileName}</button></td></tr>)}</tbody></table></div> : <div className="indicator-chart-scroll"><svg className="indicator-chart" style={{ minWidth: chartDates.length > 4 ? chartWidth : 0 }} viewBox={`0 0 ${chartWidth} 295`} role="img" aria-label={`${group.name} from ${dated[0].date} to ${dated.at(-1)?.date}`}><path d={`M55 25V230H${chartWidth - 40}`} fill="none" stroke="#c5d2c7" /><text x="5" y="18" fontSize="12">{group.unit}</text><polyline fill="none" stroke="#304d3b" strokeWidth="3" points={points.map((point) => `${x(point.time)},${y(point.row.value)}`).join(" ")} />{points.map((point, i) => <g key={i}><circle cx={x(point.time)} cy={y(point.row.value)} r="5" fill="#304d3b"><title>{point.row.date}: {point.row.valueText} {group.unit} · {point.row.fileName}</title></circle><text x={x(point.time)} y={y(point.row.value) - 12} textAnchor="middle" fontSize="12">{point.row.valueText}</text></g>)}{chartDates.map((date) => {
          const dateX = x(Date.parse(date));
          const count = dated.filter((row) => row.date === date).length;
          return <g key={date}><path d={`M${dateX} 230v6`} stroke="#8a9c8e" /><text x={dateX} y="255" textAnchor="middle" fontSize="12">{date}</text>{count > 1 && <text x={dateX} y="276" textAnchor="middle" fontSize="11">{count} results</text>}</g>;
        })}</svg></div>}
        <p className="caption">{dated.length} dated result(s) across {chartDates.length} examination date(s). Every examination date is labeled; dates are equally spaced in chronological order. Records on the same date share one tick. Examination dates are taken from the originals. Undated results are excluded from the chart. Reference ranges are retained for each record.</p>
      </section>
      <section className="card"><h2>View each record</h2>{group.rows.map((row, i) => <details key={i}><summary>{row.date || "Date not recorded"} · {row.valueText} {row.unit} · {row.fileName}</summary><p className="caption">Original indicator / 原始指标: {row.name}</p><p className="indicator-quote">{row.quote}</p><button className="button" onClick={() => setOriginal(row)}>View original record</button></details>)}</section>
    </>}
    {original && <OriginalFile record={{ id: original.recordId, fileName: original.fileName, mimeType: original.mimeType }} close={() => setOriginal(null)} />}
  </div>;
}
