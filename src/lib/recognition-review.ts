// Decides which recognized lab values need a person to look at the original.
// A value is only flagged when there is evidence it was read wrongly: the image
// around it is blurred/faded/covered, OCR produced non-numeric junk, the number
// is physiologically impossible, or it contradicts other results on the same
// report (e.g. Hemoglobin vs Hematocrit). Clean reports pass straight through.

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; confidence: number; bbox?: Box };
export type OcrLine = { text: string; confidence: number; bbox?: Box; words?: OcrWord[] };
export type GrayImage = { width: number; height: number; data: ArrayLike<number> };
export type IssueKind = "blurred" | "faded" | "unreadable" | "missing" | "implausible" | "inconsistent" | "lowConfidence" | "unit" | "range" | "date" | "text";
export type RowParts = { name: string; value?: string; unit: string; reference: string; rest: string };
export type RecognitionIssue = {
  id: string;
  page: number;
  line: number;
  confidence: number;
  text: string;
  test: string;
  field: "value" | "range" | "date" | "text";
  recognized: string;
  unit: string;
  unitOptions: string[];
  kinds: IssueKind[];
  reasons: string[];
  expected?: string;
  suggestion?: string;
  parts?: RowParts;
  box?: Box;
  crop?: string;
  frame?: { width: number; height: number };
};
export type RecognitionResult = { text: string; needsReview: boolean; issues: RecognitionIssue[]; scannedPages: number[]; checkedValues?: number };

type UnitDef = { unit: string; min: number; max: number; aliases?: string[] };
type Analyte = { key: string; label: string; names: string[]; units: UnitDef[]; pct?: string };
// Usual adult values in the first (canonical) unit. Only used to decide which of
// two conflicting results is the misread one — never to judge a result itself.
const TYPICAL: Record<string, [number, number]> = {
  wbc: [3.5, 9.5], rbc: [3.8, 5.8], hgb: [115, 175], hct: [35, 50], mcv: [80, 100], mch: [27, 34], mchc: [316, 354], plt: [125, 350],
  neut: [1.8, 6.3], lymph: [1.1, 3.2], mono: [0.1, 0.6], eos: [0.02, 0.52], baso: [0, 0.06],
  neutPct: [40, 75], lymphPct: [20, 50], monoPct: [3, 10], eosPct: [0.4, 8], basoPct: [0, 1],
  alb: [40, 55], tp: [65, 85], tbil: [0, 21], dbil: [0, 7],
};
const distance = (key: string, value: number) => {
  const range = TYPICAL[key];
  if (!range || value <= 0) return 0;
  if (value >= range[0] && value <= range[1]) return 0;
  return Math.abs(Math.log10(value / (value < range[0] ? Math.max(range[0], 1e-6) : range[1])));
};

const U = (unit: string, min: number, max: number, aliases: string[] = []): UnitDef => ({ unit, min, max, aliases });
const COUNT9 = (min: number, max: number) => U("10^9/L", min, max, ["x10^9/L", "10*9/L", "G/L"]);
const PCT = (min = 0, max = 100) => U("%", min, max);
const ANALYTES: Analyte[] = [
  { key: "wbc", label: "White blood cells / 白细胞", names: ["whitebloodcells", "whitebloodcell", "whitebloodcellcount", "wbc", "白细胞", "白细胞计数", "leukocytes"], units: [COUNT9(0.1, 300)] },
  { key: "rbc", label: "Red blood cells / 红细胞", names: ["redbloodcells", "redbloodcell", "redbloodcellcount", "rbc", "红细胞", "红细胞计数", "erythrocytes"], units: [U("10^12/L", 0.8, 8.5, ["x10^12/L", "10*12/L", "T/L"])] },
  { key: "hgb", label: "Hemoglobin / 血红蛋白", names: ["hemoglobin", "haemoglobin", "hgb", "hb", "血红蛋白", "血红蛋白浓度"], units: [U("g/L", 30, 250), U("g/dL", 3, 25)] },
  { key: "hct", label: "Hematocrit / 红细胞压积", names: ["hematocrit", "haematocrit", "hct", "红细胞压积", "红细胞比容", "红细胞比积"], units: [PCT(8, 75), U("L/L", 0.08, 0.75)] },
  { key: "mcv", label: "MCV / 平均红细胞体积", names: ["mcv", "meancorpuscularvolume", "meancellvolume", "平均红细胞体积"], units: [U("fL", 50, 140, ["fl"])] },
  { key: "mch", label: "MCH / 平均红细胞血红蛋白量", names: ["mch", "meancorpuscularhemoglobin", "平均红细胞血红蛋白量", "平均红细胞血红蛋白含量"], units: [U("pg", 12, 50)] },
  { key: "mchc", label: "MCHC / 平均红细胞血红蛋白浓度", names: ["mchc", "meancorpuscularhemoglobinconcentration", "平均红细胞血红蛋白浓度"], units: [U("g/L", 250, 420), U("g/dL", 25, 42)] },
  { key: "plt", label: "Platelets / 血小板", names: ["platelets", "platelet", "plateletcount", "plt", "血小板", "血小板计数"], units: [COUNT9(1, 2500)] },
  { key: "neut", label: "Neutrophils / 中性粒细胞", names: ["neutrophils", "neutrophil", "neutrophilcount", "neut", "neut#", "中性粒细胞", "中性粒细胞计数", "中性粒细胞绝对值"], units: [COUNT9(0, 250)], pct: "neutPct" },
  { key: "neutPct", label: "Neutrophil % / 中性粒细胞比例", names: ["neutrophilpercentage", "neutrophils%", "neut%", "中性粒细胞比例", "中性粒细胞百分比"], units: [PCT()] },
  { key: "lymph", label: "Lymphocytes / 淋巴细胞", names: ["lymphocytes", "lymphocyte", "lymphocytecount", "lymph", "lymph#", "淋巴细胞", "淋巴细胞计数", "淋巴细胞绝对值"], units: [COUNT9(0, 250)], pct: "lymphPct" },
  { key: "lymphPct", label: "Lymphocyte % / 淋巴细胞比例", names: ["lymphocytepercentage", "lymphocytes%", "lymph%", "淋巴细胞比例", "淋巴细胞百分比"], units: [PCT()] },
  { key: "mono", label: "Monocytes / 单核细胞", names: ["monocytes", "monocyte", "mono", "mono#", "单核细胞", "单核细胞计数"], units: [COUNT9(0, 50)], pct: "monoPct" },
  { key: "monoPct", label: "Monocyte % / 单核细胞比例", names: ["monocytepercentage", "mono%", "单核细胞比例", "单核细胞百分比"], units: [PCT()] },
  { key: "eos", label: "Eosinophils / 嗜酸性粒细胞", names: ["eosinophils", "eosinophil", "eos", "eos#", "嗜酸性粒细胞", "嗜酸性粒细胞计数"], units: [COUNT9(0, 30)], pct: "eosPct" },
  { key: "eosPct", label: "Eosinophil % / 嗜酸性粒细胞比例", names: ["eos%", "嗜酸性粒细胞比例", "嗜酸性粒细胞百分比"], units: [PCT()] },
  { key: "baso", label: "Basophils / 嗜碱性粒细胞", names: ["basophils", "basophil", "baso", "baso#", "嗜碱性粒细胞", "嗜碱性粒细胞计数"], units: [COUNT9(0, 10)], pct: "basoPct" },
  { key: "basoPct", label: "Basophil % / 嗜碱性粒细胞比例", names: ["baso%", "嗜碱性粒细胞比例", "嗜碱性粒细胞百分比"], units: [PCT()] },
  { key: "alb", label: "Albumin / 白蛋白", names: ["albumin", "alb", "白蛋白", "血清白蛋白"], units: [U("g/L", 5, 65), U("g/dL", 0.5, 6.5)] },
  { key: "tp", label: "Total protein / 总蛋白", names: ["totalprotein", "tp", "总蛋白", "血清总蛋白"], units: [U("g/L", 20, 130), U("g/dL", 2, 13)] },
  { key: "cre", label: "Creatinine / 肌酐", names: ["creatinine", "cr", "crea", "肌酐", "血肌酐"], units: [U("umol/L", 5, 3000, ["μmol/L", "µmol/L"]), U("mg/dL", 0.05, 35)] },
  { key: "urea", label: "Urea / 尿素", names: ["urea", "bun", "尿素", "尿素氮", "bloodureanitrogen"], units: [U("mmol/L", 0.3, 120), U("mg/dL", 1, 330)] },
  { key: "ua", label: "Uric acid / 尿酸", names: ["uricacid", "ua", "尿酸"], units: [U("umol/L", 20, 2000, ["μmol/L", "µmol/L"]), U("mg/dL", 0.3, 35)] },
  { key: "tbil", label: "Total bilirubin / 总胆红素", names: ["totalbilirubin", "tbil", "总胆红素"], units: [U("umol/L", 0, 1000, ["μmol/L", "µmol/L"]), U("mg/dL", 0, 60)] },
  { key: "dbil", label: "Direct bilirubin / 直接胆红素", names: ["directbilirubin", "dbil", "直接胆红素", "结合胆红素"], units: [U("umol/L", 0, 800, ["μmol/L", "µmol/L"]), U("mg/dL", 0, 50)] },
  { key: "alt", label: "ALT / 丙氨酸氨基转移酶", names: ["alt", "alanineaminotransferase", "sgpt", "丙氨酸氨基转移酶", "谷丙转氨酶"], units: [U("U/L", 0, 20000, ["IU/L"])] },
  { key: "ast", label: "AST / 天门冬氨酸氨基转移酶", names: ["ast", "aspartateaminotransferase", "sgot", "天门冬氨酸氨基转移酶", "天冬氨酸氨基转移酶", "谷草转氨酶"], units: [U("U/L", 0, 20000, ["IU/L"])] },
  { key: "alp", label: "ALP / 碱性磷酸酶", names: ["alp", "alkalinephosphatase", "碱性磷酸酶"], units: [U("U/L", 0, 10000, ["IU/L"])] },
  { key: "ggt", label: "GGT / γ-谷氨酰转移酶", names: ["ggt", "gammaglutamyltransferase", "γ-谷氨酰转移酶", "谷氨酰转肽酶"], units: [U("U/L", 0, 10000, ["IU/L"])] },
  { key: "k", label: "Potassium / 钾", names: ["potassium", "k", "k+", "钾", "血钾"], units: [U("mmol/L", 1.0, 10)] },
  { key: "na", label: "Sodium / 钠", names: ["sodium", "na", "na+", "钠", "血钠"], units: [U("mmol/L", 95, 185)] },
  { key: "cl", label: "Chloride / 氯", names: ["chloride", "cl", "cl-", "氯", "血氯"], units: [U("mmol/L", 60, 145)] },
  { key: "ca", label: "Calcium / 钙", names: ["calcium", "ca", "钙", "血钙"], units: [U("mmol/L", 0.8, 5), U("mg/dL", 3, 20)] },
  { key: "glu", label: "Glucose / 葡萄糖", names: ["glucose", "glu", "fastingglucose", "fastingbloodglucose", "葡萄糖", "血糖", "空腹血糖"], units: [U("mmol/L", 0.5, 60), U("mg/dL", 10, 1100)] },
  { key: "hba1c", label: "HbA1c / 糖化血红蛋白", names: ["hba1c", "glycatedhemoglobin", "糖化血红蛋白"], units: [PCT(3, 20), U("mmol/mol", 9, 200)] },
  { key: "crp", label: "C-reactive protein / C反应蛋白", names: ["crp", "c-reactiveprotein", "creactiveprotein", "c反应蛋白", "c-反应蛋白"], units: [U("mg/L", 0, 600), U("mg/dL", 0, 60)] },
  { key: "inr", label: "INR / 国际标准化比值", names: ["inr", "internationalnormalizedratio", "国际标准化比值"], units: [U("", 0.5, 15)] },
  { key: "pt", label: "Prothrombin time / 凝血酶原时间", names: ["pt", "prothrombintime", "凝血酶原时间"], units: [U("s", 5, 200, ["sec", "秒"])] },
  { key: "aptt", label: "APTT / 活化部分凝血活酶时间", names: ["aptt", "activatedpartialthromboplastintime", "活化部分凝血活酶时间"], units: [U("s", 10, 250, ["sec", "秒"])] },
  { key: "fib", label: "Fibrinogen / 纤维蛋白原", names: ["fibrinogen", "fib", "纤维蛋白原"], units: [U("g/L", 0.1, 15)] },
  { key: "ddimer", label: "D-dimer / D-二聚体", names: ["d-dimer", "ddimer", "d-二聚体", "d二聚体"], units: [U("mg/L FEU", 0, 100, ["mg/L", "mgFEU/L", "ug/mL FEU", "μg/mL"])] },
  { key: "cea", label: "CEA / 癌胚抗原", names: ["cea", "carcinoembryonicantigen", "癌胚抗原"], units: [U("ng/mL", 0, 100000, ["ug/L", "μg/L"])] },
  { key: "cyfra", label: "CYFRA21-1 / 细胞角蛋白19片段", names: ["cyfra21-1", "cyfra211", "cytokeratin19fragment", "细胞角蛋白19片段"], units: [U("ng/mL", 0, 10000)] },
  { key: "nse", label: "NSE / 神经元特异性烯醇化酶", names: ["nse", "neuron-specificenolase", "neuronspecificenolase", "神经元特异性烯醇化酶"], units: [U("ng/mL", 0, 10000)] },
  { key: "afp", label: "AFP / 甲胎蛋白", names: ["afp", "alpha-fetoprotein", "alphafetoprotein", "甲胎蛋白"], units: [U("ng/mL", 0, 1000000)] },
  { key: "ca125", label: "CA125", names: ["ca125", "ca-125", "糖类抗原125"], units: [U("U/mL", 0, 100000)] },
  { key: "ca199", label: "CA19-9", names: ["ca19-9", "ca199", "糖类抗原19-9", "糖类抗原199"], units: [U("U/mL", 0, 100000)] },
  { key: "tc", label: "Total cholesterol / 总胆固醇", names: ["totalcholesterol", "tc", "chol", "总胆固醇"], units: [U("mmol/L", 0.5, 30), U("mg/dL", 20, 1200)] },
  { key: "tg", label: "Triglycerides / 甘油三酯", names: ["triglycerides", "triglyceride", "tg", "甘油三酯"], units: [U("mmol/L", 0.05, 60), U("mg/dL", 5, 5000)] },
  { key: "tsh", label: "TSH / 促甲状腺激素", names: ["tsh", "thyroidstimulatinghormone", "促甲状腺激素"], units: [U("mIU/L", 0, 500, ["uIU/mL", "μIU/mL"])] },
];

const BY_NAME = new Map<string, Analyte>();
const BY_KEY = new Map<string, Analyte>();
for (const analyte of ANALYTES) {
  BY_KEY.set(analyte.key, analyte);
  for (const name of analyte.names) BY_NAME.set(name, analyte);
}
const ALIASES_LONGEST = [...BY_NAME.keys()].sort((a, b) => b.length - a.length);

const compactCjk = (value: string) => value.replace(/(?<=[\u4e00-\u9fff：，。（）])\s+(?=[\u4e00-\u9fff：，。（）])/g, "");
const normName = (value: string) => value.toLowerCase().replace(/[\s:：*·,，、_|]/g, "");
function findAnalyte(name: string): Analyte | undefined {
  const n = normName(name);
  if (!n) return undefined;
  const direct = BY_NAME.get(n) || BY_NAME.get(n.replace(/[.]/g, ""));
  if (direct) return direct;
  const stripped = n.replace(/[(（][^)）]*[)）]?/g, "");
  if (BY_NAME.get(stripped)) return BY_NAME.get(stripped);
  const inner = n.match(/[(（]([^)）]+)[)）]/)?.[1];
  if (inner && BY_NAME.get(inner)) return BY_NAME.get(inner);
  for (const alias of ALIASES_LONGEST) {
    const cjk = /[一-鿿]/.test(alias);
    if ((cjk ? alias.length < 2 : alias.length < 4) || !stripped.startsWith(alias)) continue;
    // Only a short abbreviation may follow, e.g. "血红蛋白hgb".
    if (/^[a-z#%+\-]{0,6}$/.test(stripped.slice(alias.length))) return BY_NAME.get(alias);
  }
  return undefined;
}

// ---------- tokens ----------
type Token = { text: string; confidence: number; bbox?: Box };
const DASH = /^[-–—~～=]$/;
const NUMERIC = /^[<>≤≥]?\d[\d.,:]*$/;
const RANGE = /^[<>≤≥]?\d[\d.,:]*\s*[-–—~～=]+\s*\d[\d.,:]*$/;
const FLAG = /^(h|l|hh|ll|high|low|normal|abnormal|偏高|偏低|正常|异常|↑|↓|\*|阳性|阴性|positive|negative)$/i;
const unitLike = (text: string) => /[a-zA-Zμµ%]/.test(text) && (/\//.test(text) || /^%$/.test(text) || /^(fl|pg|s|sec|秒|iu|u)$/i.test(text));
const unionBox = (boxes: Array<Box | undefined>): Box | undefined => {
  const list = boxes.filter((b): b is Box => Boolean(b));
  if (!list.length) return undefined;
  return { x0: Math.min(...list.map((b) => b.x0)), y0: Math.min(...list.map((b) => b.y0)), x1: Math.max(...list.map((b) => b.x1)), y1: Math.max(...list.map((b) => b.y1)) };
};
function mergeRanges(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const a = tokens[i], b = tokens[i + 1], c = tokens[i + 2];
    const merge = (parts: Token[]) => ({ text: parts.map((p) => p.text).join(""), confidence: Math.min(...parts.map((p) => p.confidence)), bbox: unionBox(parts.map((p) => p.bbox)) });
    if (b && c && NUMERIC.test(a.text) && DASH.test(b.text) && NUMERIC.test(c.text)) { out.push(merge([a, b, c])); i += 2; continue; }
    if (b && /^[<>≤≥]?\d[\d.,:]*[-–—~～=]$/.test(a.text) && NUMERIC.test(b.text)) { out.push(merge([a, b])); i += 1; continue; }
    if (b && NUMERIC.test(a.text) && /^[-–—~～=]\d[\d.,:]*$/.test(b.text)) { out.push(merge([a, b])); i += 1; continue; }
    out.push(a);
  }
  return out;
}
const cleanNumber = (text: string) => text.replace(/:/g, ".").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
function parseRange(text: string): { low?: number; high?: number } | undefined {
  const t = cleanNumber(text).replace(/\s/g, "");
  const two = t.match(/^(\d+(?:\.\d+)?)[-–—~～=]+(\d+(?:\.\d+)?)$/);
  if (two) { const low = Number(two[1]), high = Number(two[2]); return low <= high ? { low, high } : undefined; }
  const lt = t.match(/^[<≤](\d+(?:\.\d+)?)$/);
  if (lt) return { high: Number(lt[1]) };
  const gt = t.match(/^[>≥](\d+(?:\.\d+)?)$/);
  if (gt) return { low: Number(gt[1]) };
  return undefined;
}

// ---------- units ----------
const unitSkeleton = (text: string) => text.toLowerCase().normalize("NFKC")
  .replace(/[μµ]/g, "u").replace(/^[x×*]/, "").replace(/[°^*'"`,\s.]/g, "").replace(/o/g, "0").replace(/[|!i](?=\/)/g, "l");
function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
function resolveUnit(analyte: Analyte | undefined, raw: string, value: number | null, range?: { low?: number; high?: number }): { unit: string; def?: UnitDef; ok: boolean } {
  const units = analyte?.units || [];
  if (!analyte || !units.length) return { unit: raw, ok: true };
  if (units.length === 1 && units[0].unit === "") return { unit: "", def: units[0], ok: true };
  if (raw) {
    const sk = unitSkeleton(raw);
    let best: { def: UnitDef; d: number } | undefined, tie = false;
    for (const def of units) for (const form of [def.unit, ...(def.aliases || [])]) {
      const d = levenshtein(sk, unitSkeleton(form));
      if (!best || d < best.d) { best = { def, d }; tie = false; } else if (d === best.d && best.def !== def) tie = true;
    }
    if (best && !tie && best.d <= Math.max(1, Math.round(unitSkeleton(best.def.unit).length * 0.34))) return { unit: best.def.unit, def: best.def, ok: true };
  }
  if (units.length === 1) return { unit: units[0].unit, def: units[0], ok: true };
  // Several unit systems (g/L vs g/dL): the printed reference range decides.
  const mid = range?.low !== undefined && range?.high !== undefined ? (range.low + range.high) / 2 : range?.high ?? range?.low;
  const probe = mid ?? value;
  if (probe !== undefined && probe !== null) {
    const fits = units.filter((def) => probe >= def.min && probe <= def.max);
    if (fits.length === 1) return { unit: fits[0].unit, def: fits[0], ok: true };
  }
  return { unit: raw, ok: false };
}

// ---------- image quality ----------
type Ink = { sharp: number; height: number; faded: boolean };
function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))];
}
function inkStats(image: GrayImage, box: Box): Ink | undefined {
  const x0 = Math.max(0, Math.floor(box.x0)), y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(image.width, Math.ceil(box.x1)), y1 = Math.min(image.height, Math.ceil(box.y1));
  const w = x1 - x0, h = y1 - y0;
  if (w < 3 || h < 3) return undefined;
  const at = (x: number, y: number) => image.data[(y0 + y) * image.width + x0 + x];
  const pixels: number[] = [], grads: number[] = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const v = at(x, y); pixels.push(v);
    if (x + 1 < w) grads.push(Math.abs(at(x + 1, y) - v));
    if (y + 1 < h) grads.push(Math.abs(at(x, y + 1) - v));
  }
  const contrast = percentile(pixels, 95) - percentile(pixels, 5) + 1;
  const sharp = percentile(grads, 98) / contrast;
  // Faded glyph: one character much lighter than the darkest ink in the word.
  const columnMin = Array.from({ length: w }, (_, x) => { let m = 255; for (let y = 0; y < h; y += 1) m = Math.min(m, at(x, y)); return m; });
  const wordMin = Math.min(...columnMin);
  const segments: number[] = [];
  let start = -1;
  for (let x = 0; x <= w; x += 1) {
    const ink = x < w && columnMin[x] < 200;
    if (ink && start < 0) start = x;
    if (!ink && start >= 0) { if (x - start >= 2) segments.push(Math.min(...columnMin.slice(start, x))); start = -1; }
  }
  const faded = wordMin < 70 && segments.length >= 2 && segments.some((m) => m > 100);
  return { sharp, height: h, faded };
}

// ---------- rows ----------
type Row = {
  line: number;
  analyte?: Analyte;
  key: string;
  label: string;
  name: string;
  value?: Token;
  valueText: string;
  number: number | null;
  junk: string;
  unit: string;
  unitDef?: UnitDef;
  unitOk: boolean;
  reference: string;
  range?: { low?: number; high?: number };
  rangeConfidence: number;
  rangeSuggestion?: string;
  rest: string[];
  box?: Box;
  kinds: Set<IssueKind>;
  reasons: string[];
  expected?: string;
  suggestion?: string;
  score: number;
  ink?: Ink;
};

// Wide-spaced fonts make the recognizer split "3.92" into "3." + "92" and
// "4.30-5.80" into "4." + "30-5." + "80"; glue number pieces that touch.
function joinNumberPieces(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (prev?.bbox && token.bbox && /\d/.test(prev.text) && /\d/.test(token.text) && !/[\u4e00-\u9fff]/.test(prev.text + token.text)) {
      const height = Math.max(prev.bbox.y1 - prev.bbox.y0, token.bbox.y1 - token.bbox.y0, 1);
      const gap = token.bbox.x0 - prev.bbox.x1;
      if (gap >= -2 && gap <= height * 0.6) {
        out[out.length - 1] = { text: prev.text + token.text, confidence: Math.min(prev.confidence, token.confidence), bbox: unionBox([prev.bbox, token.bbox]) };
        continue;
      }
    }
    out.push(token);
  }
  return out;
}
function tokensOf(line: OcrLine): Token[] {
  const raw: Token[] = line.words?.length
    ? line.words.map((w) => ({ text: w.text.trim(), confidence: w.confidence, bbox: w.bbox }))
    : line.text.split(/\s+/).map((text) => ({ text, confidence: line.confidence }));
  return mergeRanges(joinNumberPieces(raw.filter((t) => t.text && !/^[|\[\]{}_]+$/.test(t.text))));
}

function parseRow(line: OcrLine, index: number): Row | undefined {
  const tokens = tokensOf(line);
  if (tokens.length < 2) return undefined;
  let nameLength = 0, analyte: Analyte | undefined;
  for (let k = Math.min(14, tokens.length - 1); k >= 1; k -= 1) {
    const candidate = findAnalyte(tokens.slice(0, k).map((t) => t.text).join(" "));
    if (candidate) { nameLength = k; analyte = candidate; break; }
  }
  if (!analyte) {
    // Unknown test: a text name followed by a number and a unit or range still counts as a result row.
    while (nameLength < tokens.length && !/\d/.test(tokens[nameLength].text) && !unitLike(tokens[nameLength].text)) nameLength += 1;
    const name = tokens.slice(0, nameLength).map((t) => t.text).join(" ");
    const after = tokens.slice(nameLength);
    if (!/[a-zA-Z一-鿿]{2}/.test(name) || /[:：]$/.test(name) || !after.some((t) => unitLike(t.text)) || !after.some((t) => RANGE.test(t.text))) return undefined;
  }
  const name = compactCjk(tokens.slice(0, nameLength).map((t) => t.text).join(" "));
  const after = tokens.slice(nameLength);
  let value: Token | undefined, unitToken: Token | undefined, reference: Token | undefined;
  const rest: string[] = [];
  for (const token of after) {
    if (!reference && RANGE.test(token.text)) { reference = token; continue; }
    if (!unitToken && (unitLike(token.text) || (analyte && value && !reference && !FLAG.test(token.text) && /[a-zA-Z%]/.test(token.text)))) { unitToken = token; continue; }
    if (!value && !reference && /\d/.test(token.text) && !/\//.test(token.text)) { value = token; continue; }
    if (!value && !reference && !unitToken && !FLAG.test(token.text) && /[^\w]/.test(token.text) && token.text.length <= 3) { value = token; continue; }
    if (token.confidence < 50 && !FLAG.test(token.text) && !/\d/.test(token.text)) continue;
    // Pieces of a unit that was read twice ("10^9/ 儿 L") are noise once the unit is known.
    if (unitToken && !FLAG.test(token.text) && (/\//.test(token.text) || unitToken.text.startsWith(token.text) || (token.text.length === 1 && !/\d/.test(token.text)))) continue;
    rest.push(token.text);
  }
  if (!value && !unitToken && !reference) return undefined;
  let number: number | null = null, junk = "", valueText = value?.text || "";
  if (value) {
    const m = cleanNumber(value.text).match(/^([<>≤≥]?)(\d+(?:\.\d+)?)(.*)$/);
    if (m) {
      number = Number(m[2]);
      junk = m[3].replace(/^[↑↓*]+$/, "");
      if (junk === "%" && analyte?.units.some((u) => u.unit === "%")) { junk = ""; if (!unitToken) unitToken = { text: "%", confidence: value.confidence }; }
      if (/^(h|l)$/i.test(junk)) { rest.unshift(junk); junk = ""; }
      valueText = `${m[1]}${m[2]}${junk}`;
    } else junk = value.text;
  }
  const range = reference ? parseRange(reference.text) : undefined;
  if (analyte?.pct && (unitToken?.text === "%" || (!unitToken && range?.high !== undefined && range.high > 20 && (number ?? 0) > 20))) analyte = BY_KEY.get(analyte.pct);
  const resolved = resolveUnit(analyte, unitToken?.text || "", number, range);
  return {
    line: index, analyte, key: analyte?.key || `other:${normName(name)}`, label: analyte ? analyte.label : name, name,
    value, valueText, number, junk, unit: resolved.unit, unitDef: resolved.def, unitOk: resolved.ok || !analyte,
    reference: reference ? cleanNumber(reference.text).replace(/\s/g, "").replace(/[–—~～=]+/g, "-") : "", range, rangeConfidence: reference?.confidence ?? 100, rest,
    box: line.bbox || unionBox(tokens.map((t) => t.bbox)), kinds: new Set(), reasons: [], score: 0,
  };
}

const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toString() : Math.abs(n) >= 10 ? (Math.round(n * 10) / 10).toString() : (Math.round(n * 100) / 100).toString());
const show = (row: Row) => `${row.valueText}${row.unit === "%" ? "%" : row.unit ? ` ${row.unit}` : ""}`;
const shortLabel = (row: Row) => row.label.split(" / ")[0];

// ---------- cross-result relations ----------
type Values = Record<string, number>;
type Relation = { keys: string[]; ok: (v: Values) => boolean; expect: (key: string, v: Values) => [number, number] | undefined; why: (key: string, v: Values) => string };
const RELATIONS: Relation[] = [
  {
    keys: ["hgb", "hct"],
    ok: (v) => { const mchc = (v.hgb / v.hct) * 100; return mchc >= 290 && mchc <= 380; },
    expect: (key, v) => key === "hgb" ? [v.hct * 3.2, v.hct * 3.6] : [v.hgb / 3.6, v.hgb / 3.2],
    why: (key) => key === "hgb" ? "Hemoglobin (g/L) is normally 3.2–3.6 × Hematocrit (%)" : "Hematocrit (%) is normally Hemoglobin (g/L) ÷ 3.2–3.6",
  },
  {
    keys: ["hct", "rbc", "mcv"],
    ok: (v) => Math.abs((v.hct / v.rbc) * 10 - v.mcv) / v.mcv <= 0.08,
    expect: (key, v) => key === "mcv" ? [(v.hct / v.rbc) * 10 * 0.95, (v.hct / v.rbc) * 10 * 1.05] : key === "hct" ? [(v.mcv * v.rbc) / 10 * 0.95, (v.mcv * v.rbc) / 10 * 1.05] : [(v.hct * 10) / v.mcv * 0.95, (v.hct * 10) / v.mcv * 1.05],
    why: () => "MCV should equal Hematocrit ÷ Red blood cells × 10 on the same report",
  },
  {
    keys: ["hgb", "rbc", "mch"],
    ok: (v) => Math.abs(v.hgb / v.rbc - v.mch) / v.mch <= 0.08,
    expect: (key, v) => key === "mch" ? [(v.hgb / v.rbc) * 0.95, (v.hgb / v.rbc) * 1.05] : key === "hgb" ? [v.mch * v.rbc * 0.95, v.mch * v.rbc * 1.05] : [(v.hgb / v.mch) * 0.95, (v.hgb / v.mch) * 1.05],
    why: () => "MCH should equal Hemoglobin ÷ Red blood cells on the same report",
  },
  {
    keys: ["hgb", "hct", "mchc"],
    ok: (v) => Math.abs((v.hgb / v.hct) * 100 - v.mchc) / v.mchc <= 0.08,
    expect: (key, v) => key === "mchc" ? [(v.hgb / v.hct) * 95, (v.hgb / v.hct) * 105] : key === "hgb" ? [(v.mchc * v.hct) / 100 * 0.95, (v.mchc * v.hct) / 100 * 1.05] : [(v.hgb * 100) / v.mchc * 0.95, (v.hgb * 100) / v.mchc * 1.05],
    why: () => "MCHC should equal Hemoglobin ÷ Hematocrit × 100 on the same report",
  },
  {
    keys: ["wbc", "neut", "lymph", "mono", "eos", "baso"],
    ok: (v) => { const parts = ["neut", "lymph", "mono", "eos", "baso"].filter((k) => k in v); return !parts.length || parts.reduce((s, k) => s + v[k], 0) <= v.wbc * 1.08 + 0.05; },
    expect: (key, v) => { const parts = ["neut", "lymph", "mono", "eos", "baso"].filter((k) => k in v); const sum = parts.reduce((s, k) => s + v[k], 0); return key === "wbc" ? [sum, Number.POSITIVE_INFINITY] : [0, v.wbc - (sum - v[key])]; },
    why: (key) => key === "wbc" ? "White blood cells must be at least the sum of the white-cell types listed" : "The white-cell types listed cannot add up to more than White blood cells",
  },
  {
    keys: ["neutPct", "lymphPct", "monoPct", "eosPct", "basoPct"],
    ok: (v) => Object.values(v).reduce((s, n) => s + n, 0) <= 101,
    expect: (key, v) => [0, 100 - (Object.values(v).reduce((s, n) => s + n, 0) - v[key])],
    why: () => "White-cell percentages cannot add up to more than 100%",
  },
  { keys: ["dbil", "tbil"], ok: (v) => v.dbil <= v.tbil * 1.02, expect: (key, v) => key === "dbil" ? [0, v.tbil] : [v.dbil, Number.POSITIVE_INFINITY], why: () => "Direct bilirubin cannot be higher than Total bilirubin" },
  { keys: ["alb", "tp"], ok: (v) => v.alb <= v.tp, expect: (key, v) => key === "alb" ? [0, v.tp] : [v.alb, Number.POSITIVE_INFINITY], why: () => "Albumin cannot be higher than Total protein" },
];
const CANONICAL: Record<string, string> = { hgb: "g/L", hct: "%", rbc: "10^12/L", mcv: "fL", mch: "pg", mchc: "g/L", wbc: "10^9/L", neut: "10^9/L", lymph: "10^9/L", mono: "10^9/L", eos: "10^9/L", baso: "10^9/L", neutPct: "%", lymphPct: "%", monoPct: "%", eosPct: "%", basoPct: "%", tbil: "umol/L", dbil: "umol/L", alb: "g/L", tp: "g/L" };
const SHIFTS = [0.1, 10, 0.01];

function relationValues(relation: Relation, rows: Map<string, Row>, override?: [string, number]): Values | undefined {
  const values: Values = {};
  for (const key of relation.keys) {
    const row = rows.get(key);
    if (override && override[0] === key) { values[key] = override[1]; continue; }
    if (!row || row.number === null || row.junk || row.unit !== CANONICAL[key]) continue;
    values[key] = row.number;
  }
  const required = relation.keys[0] === "wbc" ? ["wbc"] : relation.keys[0] === "neutPct" ? [] : relation.keys;
  if (required.some((key) => !(key in values)) || Object.keys(values).length < 2) return undefined;
  return values;
}

function applyRelations(rows: Map<string, Row>) {
  type Failure = { relation: Relation; values: Values; members: string[] };
  const failures: Failure[] = [];
  for (const relation of RELATIONS) {
    const values = relationValues(relation, rows);
    if (!values) continue;
    const members = Object.keys(values);
    if (relation.ok(values)) {
      for (const key of members) {
        const row = rows.get(key)!;
        row.score -= 1;
        // A blurred/faded number that still fits the other results is probably right: say so.
        const expected = relation.expect(key, values);
        if (row.kinds.size && !row.expected && expected && Number.isFinite(expected[1])) {
          const others = members.filter((k) => k !== key).map((k) => `${shortLabel(rows.get(k)!)} ${show(rows.get(k)!)}`).join(", ");
          row.expected = `${fmt(Math.max(0, expected[0]))}–${fmt(expected[1])}${row.unit === "%" ? "%" : ` ${row.unit}`}`;
          row.reasons.push(`${row.valueText} fits with ${others}, so it is probably right — just confirm it matches the photo.`);
        }
      }
      continue;
    }
    for (const key of members) rows.get(key)!.score += 1;
    failures.push({ relation, values, members });
  }
  for (const failure of failures) {
    const fixes = new Map<string, number>();
    for (const key of failure.members) {
      const row = rows.get(key)!;
      for (const factor of SHIFTS) {
        const candidate = Number((row.number! * factor).toPrecision(6));
        if (row.unitDef && (candidate < row.unitDef.min || candidate > row.unitDef.max)) continue;
        const values = relationValues(failure.relation, rows, [key, candidate]);
        if (values && failure.relation.ok(values)) { fixes.set(key, candidate); row.score += 2; break; }
      }
      const r = row.range;
      if (r && row.number !== null && ((r.high !== undefined && row.number > r.high * 2.5) || (r.low !== undefined && r.low > 0 && row.number < r.low / 2.5))) row.score += 1;
      const fix = fixes.get(key);
      if (fix !== undefined && r && (r.low === undefined || fix >= r.low) && (r.high === undefined || fix <= r.high)) row.score += 1;
      // A repair that moves the value towards usual values is more believable than one that moves it away.
      if (fix !== undefined) { const before = distance(key, row.number!), after = distance(key, fix); if (after < before - 0.3) row.score += 1; else if (after > before + 0.3) row.score -= 1; }
    }
    const top = Math.max(...failure.members.map((key) => rows.get(key)!.score));
    const blamed = failure.members.filter((key) => rows.get(key)!.score === top);
    for (const key of blamed) {
      const row = rows.get(key)!;
      row.kinds.add("inconsistent");
      const expected = failure.relation.expect(key, failure.values);
      const others = failure.members.filter((k) => k !== key).map((k) => `${shortLabel(rows.get(k)!)} ${show(rows.get(k)!)}`).join(", ");
      let reason = `${failure.relation.why(key, failure.values)}.`;
      if (blamed.length > 1) reason = `${blamed.map((k) => `${shortLabel(rows.get(k)!)} ${show(rows.get(k)!)}`).join(" and ")} don't fit together, and nothing else on the report shows which one was misread — please check both. ${reason}`;
      if (expected && Number.isFinite(expected[1])) {
        row.expected = `${fmt(Math.max(0, expected[0]))}–${fmt(expected[1])}${row.unit === "%" ? "%" : ` ${row.unit}`}`.trim();
        reason += ` With ${others}, ${shortLabel(row)} should be about ${row.expected} — but ${row.valueText} was read.`;
      } else reason += ` It does not fit with ${others}.`;
      row.reasons.push(reason);
      const fix = fixes.get(key);
      if (fix !== undefined && !row.suggestion) row.suggestion = fmt(fix);
    }
  }
}

function checkRows(rows: Row[], image?: GrayImage) {
  const withInk = rows.filter((row) => row.value?.bbox && image);
  for (const row of withInk) row.ink = inkStats(image!, row.value!.bbox!);
  const inks = withInk.map((row) => row.ink).filter((ink): ink is Ink => Boolean(ink));
  const medianSharp = inks.length >= 3 ? percentile(inks.map((i) => i.sharp), 50) : 0.65;
  const medianHeight = inks.length >= 3 ? percentile(inks.map((i) => i.height), 50) : 0;
  const centers = rows.filter((r) => r.value?.bbox).map((r) => (r.value!.bbox!.x0 + r.value!.bbox!.x1) / 2);
  const valueColumn = centers.length >= 3 ? percentile(centers, 50) : undefined;
  const pageWidth = Math.max(0, ...rows.map((r) => r.box?.x1 || 0));

  for (const row of rows) {
    // A number far away from the Result column is not the result (e.g. the result cell is empty).
    if (row.value?.bbox && valueColumn !== undefined && pageWidth && Math.abs((row.value.bbox.x0 + row.value.bbox.x1) / 2 - valueColumn) > pageWidth * 0.15) {
      row.rest.unshift(row.value.text); row.value = undefined; row.valueText = ""; row.number = null; row.junk = ""; row.ink = undefined;
    }
    if (!row.value) {
      row.kinds.add("missing"); row.score += 5;
      row.reasons.push("No result was found in the Result column. The number may be covered, erased or outside the photo.");
      continue;
    }
    if (row.junk || row.number === null) {
      row.kinds.add("unreadable"); row.score += 3;
      row.reasons.push(`The result was read as “${row.value.text}”, which is not a clean number — part of it is probably smudged or covered.`);
    }
    if (row.ink && (row.ink.sharp < medianSharp * 0.65 || (medianHeight && row.ink.height > medianHeight * 1.6 && row.ink.sharp < medianSharp * 0.8))) {
      row.kinds.add("blurred"); row.score += 3;
      row.reasons.push("This number is blurred in the original, so the digits may have been misread.");
    }
    if (row.ink?.faded) {
      row.kinds.add("faded"); row.score += 3;
      row.reasons.push("One of the digits is much lighter than the others — it may be a faded digit or a decimal point that did not print.");
    }
    if (row.value.confidence < 60 && !row.kinds.has("unreadable")) {
      row.kinds.add("lowConfidence"); row.score += 2;
      row.reasons.push("The text recognizer was unsure about this number.");
    }
    if (row.number !== null && row.unitDef && (row.number < row.unitDef.min || row.number > row.unitDef.max)) {
      row.kinds.add("implausible"); row.score += 2;
      const fix = SHIFTS.map((f) => Number((row.number! * f).toPrecision(6))).find((n) => n >= row.unitDef!.min && n <= row.unitDef!.max);
      if (fix !== undefined) row.suggestion = fmt(fix);
      row.reasons.push(`${shortLabel(row)} of ${row.valueText} ${row.unit} is not physically possible${fix !== undefined ? ` — a decimal point was probably missed (${fmt(fix)}?)` : ""}.`);
    }
    if (!row.unitOk) {
      row.kinds.add("unit"); row.score += 1;
      row.reasons.push(`The unit was read as “${row.unit || "nothing"}”; choose the unit printed on the original.`);
    }
  }
  for (const row of rows) {
    // A reference range with a dropped decimal ("11-32" for 1.1-3.2) would make the result look normal or abnormal wrongly.
    const typical = TYPICAL[row.key], r = row.range;
    if (!typical || !r || r.low === undefined || r.high === undefined || row.rangeConfidence >= 70 || row.unit !== CANONICAL[row.key]) continue;
    const mid = (r.low + r.high) / 2, usual = (typical[0] + typical[1]) / 2;
    if (mid / usual < 4 && usual / mid < 4) continue;
    const factor = SHIFTS.find((f) => { const m = mid * f; return m / usual < 1.6 && usual / m < 1.6; });
    if (factor !== undefined) row.rangeSuggestion = `${fmt(r.low * factor)}-${fmt(r.high * factor)}`;
  }
  const byKey = new Map<string, Row>();
  for (const row of rows) if (!byKey.has(row.key)) byKey.set(row.key, row);
  applyRelations(byKey);
}

const rowLine = (parts: RowParts, value: string) => [parts.name, value, parts.unit, parts.reference, parts.rest].filter(Boolean).join(" ");
export function rebuildRowLine(issue: Pick<RecognitionIssue, "parts">, value: string, unit?: string) {
  if (!issue.parts) return value;
  return rowLine({ ...issue.parts, unit: unit ?? issue.parts.unit }, value);
}

const DATE = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/;
// Tesseract may split a wide table row into separate blocks per column. Rebuild
// rows from word positions so a test name stays with its result, unit and range.
export function toVisualLines(lines: OcrLine[]): OcrLine[] {
  const all = lines.flatMap((line) => line.words || []).filter((word) => word.text.trim());
  if (!all.length || all.some((word) => !word.bbox)) return lines;
  // The recognizer sometimes reports the same printed word twice in different blocks.
  const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const words: OcrWord[] = [];
  for (const word of [...all].sort((a, b) => b.confidence - a.confidence)) {
    const box = word.bbox!;
    const duplicate = words.some((kept) => { const k = kept.bbox!; const overlap = area({ x0: Math.max(k.x0, box.x0), y0: Math.max(k.y0, box.y0), x1: Math.min(k.x1, box.x1), y1: Math.min(k.y1, box.y1) }); return overlap > 0.5 * Math.min(area(k), area(box)); });
    if (!duplicate) words.push(word);
  }
  const rows: OcrWord[][] = [];
  for (const word of [...words].sort((a, b) => a.bbox!.x0 - b.bbox!.x0)) {
    const box = word.bbox!;
    let best: OcrWord[] | undefined, bestOverlap = 0;
    for (const row of rows) {
      const last = row[row.length - 1].bbox!;
      if (last.x0 > box.x0) continue;
      const overlap = (Math.min(last.y1, box.y1) - Math.max(last.y0, box.y0)) / Math.max(1, Math.min(last.y1 - last.y0, box.y1 - box.y0));
      if (overlap > bestOverlap) { bestOverlap = overlap; best = row; }
    }
    if (best && bestOverlap >= 0.4) best.push(word); else rows.push([word]);
  }
  return rows
    .map((row) => ({ text: row.map((w) => w.text).join(" "), confidence: row.reduce((n, w) => n + w.confidence, 0) / row.length, bbox: unionBox(row.map((w) => w.bbox)), words: row }))
    .sort((a, b) => (a.bbox!.y0 + a.bbox!.y1) - (b.bbox!.y0 + b.bbox!.y1));
}

export function assessRecognizedPage(text: string, page: number, confidence: number, lines: OcrLine[] = [], image?: GrayImage): RecognitionResult {
  const usable = toVisualLines(lines).filter((line) => line.text.trim());
  const textLines = usable.length ? usable.map((line) => compactCjk(line.text.replace(/\s+$/, ""))) : text.split("\n");
  const rows: Row[] = [];
  usable.forEach((line, index) => { const row = parseRow(line, index); if (row) rows.push(row); });
  checkRows(rows, image);
  const issues: RecognitionIssue[] = [];
  for (const row of rows) {
    textLines[row.line] = rowLine({ name: row.name, unit: row.unit, reference: row.reference, rest: compactCjk(row.rest.join(" ")) }, row.valueText);
    if (!row.kinds.size) continue;
    const options = row.analyte?.units.map((u) => u.unit).filter(Boolean) || [];
    issues.push({
      id: `p${page}-l${row.line}`, page, line: row.line, confidence: row.value?.confidence ?? 0, text: textLines[row.line],
      test: row.label, field: "value", recognized: row.valueText, unit: row.unit, unitOptions: row.kinds.has("unit") ? options : [],
      kinds: [...row.kinds], reasons: row.reasons, expected: row.expected, suggestion: row.suggestion,
      parts: { name: row.name, value: row.valueText, unit: row.unit, reference: row.reference, rest: compactCjk(row.rest.join(" ")) }, box: row.box,
    });
  }
  for (const row of rows) {
    if (!row.rangeSuggestion) continue;
    const typical = TYPICAL[row.key];
    issues.push({
      id: `p${page}-l${row.line}-range`, page, line: row.line, confidence: row.rangeConfidence, text: textLines[row.line],
      test: row.label, field: "range", recognized: row.reference, unit: row.unit, unitOptions: [], kinds: ["range"],
      reasons: [`The reference range was read as ${row.reference}, but the usual range for ${shortLabel(row)} is around ${typical[0]}–${typical[1]}${row.unit === "%" ? "%" : ` ${row.unit}`}. A decimal point was probably missed.`],
      suggestion: row.rangeSuggestion,
      parts: { name: row.name, value: row.valueText, unit: row.unit, reference: row.reference, rest: compactCjk(row.rest.join(" ")) }, box: row.box,
    });
  }
  const rowLines = new Set(rows.map((row) => row.line));
  usable.forEach((line, index) => {
    if (rowLines.has(index)) return;
    const dateWord = line.words?.find((w) => DATE.test(w.text));
    const match = (dateWord?.text || line.text).match(DATE);
    if (match && /date|日期|时间/i.test(line.text)) {
      const month = Number(match[2]), day = Number(match[3]);
      const bad = month < 1 || month > 12 || day < 1 || day > 31;
      if (bad || (dateWord && dateWord.confidence < 60)) issues.push({
        id: `p${page}-l${index}`, page, line: index, confidence: dateWord?.confidence ?? line.confidence, text: textLines[index], test: "Examination date",
        field: "date", recognized: match[0], unit: "", unitOptions: [], kinds: ["date"],
        reasons: [bad ? `The date was read as ${match[0]}, which is not a real date.` : "The date is hard to read; results are placed on the timeline by this date."], box: line.bbox,
      });
      return;
    }
    // Narrative pages (CT, pathology): only numbers the recognizer could barely read.
    if (!rows.length) {
      const weak = line.words?.filter((w) => /\d/.test(w.text) && w.confidence < 50) || [];
      if (weak.length) issues.push({
        id: `p${page}-l${index}`, page, line: index, confidence: Math.min(...weak.map((w) => w.confidence)), text: textLines[index], test: "Text with numbers",
        field: "text", recognized: textLines[index], unit: "", unitOptions: [], kinds: ["text"],
        reasons: [`“${weak.map((w) => w.text).join(" ")}” could not be read reliably in this sentence.`], box: line.bbox,
      });
    }
  });
  if (!rows.length && usable.length && confidence < 50 && !issues.length) issues.push({
    id: `p${page}-page`, page, line: 0, confidence, text: textLines[0] || "", test: "Whole page", field: "text", recognized: "", unit: "", unitOptions: [], kinds: ["text"],
    reasons: ["Most of this page could not be read. Check the text against the original or upload a clearer photo."],
  });
  if (!usable.some((line) => /\S/.test(line.text)) && !text.trim()) issues.push({
    id: `p${page}-empty`, page, line: 0, confidence, text: "", test: "Whole page", field: "text", recognized: "", unit: "", unitOptions: [], kinds: ["text"],
    reasons: ["No text was found on this page. Type the results from the original, or remove the file."],
  });
  issues.sort((a, b) => a.line - b.line);
  return { text: textLines.join("\n"), needsReview: issues.length > 0, issues, scannedPages: [page], checkedValues: rows.length };
}

export function joinRecognizedPages(pages: RecognitionResult[]): RecognitionResult {
  let offset = 0;
  const issues: RecognitionIssue[] = [];
  for (const page of pages) {
    issues.push(...page.issues.map((issue) => ({ ...issue, line: issue.line + offset })));
    offset += page.text.split("\n").length + 1;
  }
  return {
    text: pages.map((page) => page.text).join("\n\n"),
    needsReview: pages.some((page) => page.needsReview),
    issues,
    scannedPages: pages.flatMap((page) => page.scannedPages),
    checkedValues: pages.reduce((n, page) => n + (page.checkedValues || 0), 0),
  };
}

export type IssueFix = { mode: "value"; value: string; unit?: string } | { mode: "keep" } | { mode: "remove" };
export function isFixComplete(issue: RecognitionIssue, fix?: IssueFix) {
  if (!fix) return false;
  if (fix.mode !== "value") return fix.mode === "remove" || (fix.mode === "keep" && issue.recognized !== "" && !issue.kinds.includes("unreadable"));
  if (issue.field === "value") return /^[<>≤≥]?\d+(?:\.\d+)?$/.test(fix.value.trim()) && (!issue.unitOptions.length || Boolean(fix.unit));
  if (issue.field === "range") return /^[<>≤≥]?\d[\d.]*(\s*[-–~]\s*\d[\d.]*)?$/.test(fix.value.trim());
  return Boolean(fix.value.trim());
}
export function applyFixes(text: string, issues: RecognitionIssue[], fixes: Record<string, IssueFix | undefined>) {
  const lines: Array<string | null> = text.split("\n");
  const rows = new Map<number, { parts: RowParts; value?: string }>();
  for (const issue of issues) {
    const fix = fixes[issue.id];
    if (!fix || fix.mode === "keep" || lines[issue.line] === null) continue;
    if (fix.mode === "remove") { lines[issue.line] = null; rows.delete(issue.line); continue; }
    if (issue.field === "value" || issue.field === "range") {
      const current = rows.get(issue.line) || { parts: { ...issue.parts! } };
      if (issue.field === "value") { current.value = fix.value.trim(); if (fix.unit) current.parts.unit = fix.unit; }
      else current.parts.reference = fix.value.trim().replace(/\s+/g, "");
      rows.set(issue.line, current);
    } else if (issue.field === "date") lines[issue.line] = (lines[issue.line] || "").replace(issue.recognized, fix.value.trim());
    else lines[issue.line] = fix.value;
  }
  for (const [line, row] of rows) {
    if (lines[line] === null) continue;
    lines[line] = rowLine(row.parts, row.value ?? row.parts.value ?? "");
  }
  return lines.filter((line): line is string => line !== null).join("\n");
}
export function canConfirmRecognition(text: string, checked: boolean): boolean {
  return checked && Boolean(text.replace(/^\[Page \d+\]\s*$/gm, "").trim()) && text.length <= 100000;
}
