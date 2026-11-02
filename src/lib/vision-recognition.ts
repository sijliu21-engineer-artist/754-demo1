import { projectId, publicAnonKey } from "../../utils/supabase/info";
import type { RecognitionResult, RecognitionIssue } from "./recognition-review";

export class VisionServiceUnavailable extends Error {}

export async function inspectReportImage(image: string, ocrText: string, page: number): Promise<RecognitionResult> {
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ba71e98d/recognition/vision`, {
    method:"POST", signal:AbortSignal.timeout(100000),
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${publicAnonKey}`,"X-CaseMate-Session":sessionStorage.getItem("casemate_session") || ""},
    body:JSON.stringify({image,ocrText}),
  });
  const payload = await response.json().catch(()=>null);
  if ([404, 501, 503].includes(response.status)) throw new VisionServiceUnavailable("Cloud image review is unavailable.");
  if(!response.ok) throw new Error(payload?.error || "AI image recognition is unavailable. Please retry; no report has been saved.");
  if(!Array.isArray(payload?.lines) || !payload.lines.length) throw new Error("AI returned an incomplete report. Please retry.");
  const issues: RecognitionIssue[] = [];
  const text = payload.lines.map((row: {text:string;test:string;unit:string;status:string;reason:string;field:string}, line:number) => {
    if(row.status === "clear") return row.text;
    const numeric = row.field === "value";
    const safeText = numeric ? [row.test, "[UNREADABLE]", row.unit].filter(Boolean).join(" ") : row.text;
    issues.push({id:`vision-${page}-${line}`,page,line,confidence:0,text:safeText,test:row.test,field:numeric ? "value" : "text",recognized:"",unit:row.unit,unitOptions:[],kinds:["unreadable",row.status === "missing" ? "missing" : "blurred"],reasons:[row.reason],...(numeric ? {parts:{name:row.test,value:"",unit:row.unit,reference:"",rest:""}} : {})});
    return safeText;
  }).join("\n");
  return {text,issues,needsReview:issues.length>0,scannedPages:[page],checkedValues:payload.lines.length};
}
