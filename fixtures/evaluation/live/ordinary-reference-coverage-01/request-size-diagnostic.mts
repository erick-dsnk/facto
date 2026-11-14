import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createJudge } from '/workspace/junction-2026-current/services/api/src/providers/jev/judgment.ts';
import { MODEL_VERSION } from '/workspace/junction-2026-current/packages/contracts/src/index.ts';
const report=JSON.parse(await readFile('/workspace/task-evidence/ordinary-reference-coverage-01/run/report.json','utf8'));
const sample=report.cases.find((x:any)=>x.label==='OR05-gibraltar');
const text=sample.admittedPublic[0];
const evidence=sample.evidence.filter((x:any)=>x.stage==='retrieval'||x.stage==='alternate').at(-1).records;
let diagnostic:any;
await createJudge({ask:async request=>{
 const serialized=JSON.stringify({model:MODEL_VERSION,state:request.state,questions:request.questions});
 diagnostic={kind:'offline_request_reconstruction_no_dispatch',recordedCase:sample.label,sourceCommit:report.metadata.commit,requestBytes:Buffer.byteLength(serialized),requestSHA256:createHash('sha256').update(serialized).digest('hex'),questions:Object.keys(request.questions).length,evidenceRecords:evidence.length,recordedLimit:report.limits.requestBytes,note:'Reconstructs blocked alternate-judgment payload from recorded public evidence; no model request/retry and no modification to frozen plan or first run. This harness cap is not a production provider outbound limit.'};
 throw new Error('offline_capture_complete');
}})({id:'offline-public',originalText:text,checkedText:text,sourceSpan:{start:0,end:Array.from(text).length},admission:{admissionAction:'check',assertionStatus:'asserted',reasonCode:'public_fact',hasPracticalConsequence:null,matchedSelectedTopic:null}},evidence,{signal:new AbortController().signal,now:()=>0,consume:()=>{}}).catch(error=>{if(error.message!=='offline_capture_complete')throw error});
await writeFile('/workspace/task-evidence/ordinary-reference-coverage-01/request-size-diagnostic.json',JSON.stringify(diagnostic,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(diagnostic));
