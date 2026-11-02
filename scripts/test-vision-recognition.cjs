const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),ts=require("typescript");
function load(path,stubs,globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in stubs))throw Error(n);return stubs[n]},...globals});return exports;}
(async()=>{
let payload;
const client=load("src/lib/vision-recognition.ts",{"../../utils/supabase/info":{projectId:"test",publicAnonKey:"public"}},{sessionStorage:{getItem:()=>"session"},AbortSignal,fetch:async()=>({ok:true,json:async()=>payload})});
payload={lines:[{text:"Creatinine 126 umol/L",test:"Creatinine",unit:"umol/L",status:"clear",field:"value"},{text:"Hemoglobin ??? g/L",test:"Hemoglobin / 血红蛋白",unit:"g/L",status:"blurred",field:"value",reason:"Digits blurred"}]};
let result=await client.inspectReportImage("data:image/jpeg;base64,AA==","wrong OCR",1);
assert.equal(result.issues.length,1);assert.equal(result.issues[0].recognized,"");assert.equal(result.issues[0].test,"Hemoglobin / 血红蛋白");assert.match(result.text,/Creatinine 126/);assert.doesNotMatch(result.text,/\?\?\?/);
const review=load("src/lib/recognition-review.ts",{});
const issue=result.issues[0];assert.equal(review.isFixComplete(issue,{mode:"keep"}),false);
const fixed=review.applyFixes(result.text,result.issues,{[issue.id]:{mode:"value",value:"112"}});assert.match(fixed,/112 g\/L/);assert.doesNotMatch(fixed,/UNREADABLE/);
payload={lines:[payload.lines[0]]};result=await client.inspectReportImage("","",1);assert.equal(result.needsReview,false);
let route,session=true,env={},providerCalls=0,lastRequest;
load("supabase/functions/server/vision_routes.tsx",{"./auth_routes.tsx":{resolveSession:async()=>session?{}:null}},{Deno:{env:{get:n=>env[n]}},URL,AbortSignal,fetch:async(url,options)=>{lastRequest={url:String(url),body:JSON.parse(options.body)};providerCalls++;return {ok:true,json:async()=>({choices:[{finish_reason:"stop",message:{content:JSON.stringify({complete:true,lines:payload.lines})}}]})}}}).registerVisionRoutes({post:(_,h)=>route=h});
const c={req:{header:()=>undefined,text:async()=>JSON.stringify({image:"data:image/jpeg;base64,AA=="})},json:(body,status=200)=>({body,status})};
assert.equal((await route(c)).status,503);assert.equal(providerCalls,0);
session=false;assert.equal((await route(c)).status,401);session=true;
env={VISION_API_KEY:"test",VISION_BASE_URL:"https://example.com/v1",VISION_MODEL:"vision"};assert.equal((await route(c)).status,200);
env={DEEPSEEK_API_KEY:"existing-key"};assert.equal((await route(c)).status,200);
assert.equal(lastRequest.url,"https://api.deepseek.com/chat/completions");assert.equal(lastRequest.body.model,"deepseek-flash");assert.equal(lastRequest.body.messages[1].content[1].image_url.detail,"high");
env={DEEPSEEK_API_KEY:"existing-key",VISION_BASE_URL:"https://other.example/v1"};let before=providerCalls;assert.equal((await route(c)).status,503);assert.equal(providerCalls,before);
env={DEEPSEEK_API_KEY:"existing-key"};payload={lines:[]};assert.equal((await route(c)).status,502);
console.log("PASS: clear abnormal result bypasses review; blurred row requires input; corrections replace hidden result; unauthenticated, missing configuration and incomplete AI responses block upload.");
})().catch(e=>{console.error(e);process.exitCode=1});
