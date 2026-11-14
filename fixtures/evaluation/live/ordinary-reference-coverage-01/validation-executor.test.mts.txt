import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const owned='/workspace/task-evidence/ordinary-reference-coverage-01';
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
let fetchCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=(async()=>{ fetchCalls++;throw new Error('offline_fetch_forbidden');}) as typeof fetch;
for (const variation of ['valid','commit','source','plan','executor','dirty'] as const) {
 test(`executor freeze ${variation} is checked before dispatch`,async()=>{
  const sandbox=await mkdtemp(`${owned}/validation-sandbox-`);
  try {
   const root=`${sandbox}/repo`,directory=`${sandbox}/campaign`;
   await mkdir(root);await mkdir(directory);
   const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString();
   git('init','-q');git('config','user.email','offline-validator@example.invalid');git('config','user.name','Offline validator');
   await writeFile(`${root}/package.json`,'{"private":true}\n');git('add','package.json');git('commit','-qm','Synthetic offline source');
   const source=(await readFile(`${owned}/execute.mts`,'utf8')).replace("const root = '/workspace/junction-2026-current';",`const root = ${JSON.stringify(root)};`).replace("const directory = '/workspace/task-evidence/ordinary-reference-coverage-01';",`const directory = ${JSON.stringify(directory)};`);
   const modulePath=`${sandbox}/executor.mts`;await writeFile(modulePath,source);
   const module=await import(pathToFileURL(modulePath).href);
   const snapshot=await module.sourceSnapshot();assert.equal(snapshot.dirty,false);
   const plan=JSON.stringify({name:'Synthetic offline freeze',limits:{},manifest:{cases:[{label:'offline-control',text:'I prefer morning walks.',allowedPublic:[]}]}});
   await writeFile(`${directory}/plan.json`,plan);
   const freeze={...snapshot,planSHA256:sha(plan),executorSHA256:sha(source)};
   if(variation==='commit')freeze.commit='0'.repeat(40);
   if(variation==='source')freeze.sourceSHA256='0'.repeat(64);
   if(variation==='plan')freeze.planSHA256='0'.repeat(64);
   if(variation==='executor')freeze.executorSHA256='0'.repeat(64);
   if(variation==='dirty')await writeFile(`${root}/untracked.txt`,'dirty');
   await writeFile(`${directory}/freeze.json`,JSON.stringify(freeze));
   if(variation==='valid') {
    assert.equal((await module.verifyFreeze()).cases.length,1);
    await module.execute(false);
   } else await assert.rejects(module.verifyFreeze(),/freeze_mismatch/);
   await assert.rejects(access(`${directory}/run`));
   assert.equal(fetchCalls,0);
  } finally {await rm(sandbox,{recursive:true,force:true});}
 });
}
test.after(()=>{globalThis.fetch=originalFetch;assert.equal(fetchCalls,0);});
