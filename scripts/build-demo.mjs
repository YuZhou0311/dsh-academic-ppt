#!/usr/bin/env node
/** Offline reproducible example. Default output is a new directory below the invoking cwd. */
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProject, updateRecords, buildProject, checkProject, renderProjectArtifact } from '../src/core.mjs';
import { safePath } from '../src/io.mjs';

const argv=process.argv.slice(2), cwd=process.cwd(), exampleRoot=fileURLToPath(new URL('../examples/materials-v04/',import.meta.url));
let target, render=false;const fonts=[];
for(let i=0;i<argv.length;i++) {
  if(argv[i]==='--output'&&argv[i+1]) target=argv[++i];
  else if(argv[i]==='--render') render=true;
  else if(argv[i]==='--font-dir'&&argv[i+1]) fonts.push(argv[++i]);
  else if(argv[i]==='--help') {console.log('npm run demo -- [--output NEW_DIRECTORY] [--render] [--font-dir WORKSPACE_FONT_DIRECTORY]\nOffline materials-v04 teaching simulation; imports recordsPath batches into a new academic project. Never overwrites an existing output. --render needs the optional LibreOffice kit.');process.exit(0);}
  else throw new Error('Unknown or incomplete argument: '+argv[i]);
}
// Match DSH's platform-aware working-directory and symlink boundaries.
const root=await safePath(cwd,target||`academic-demo-${new Date().toISOString().slice(0,10)}-${randomUUID().slice(0,8)}`);
await mkdir(root); // EEXIST intentionally stops. Existing files are never removed or overwritten.
await mkdir(join(root,'records'));
for(const name of ['protocol.md','fatigue.csv','analyze.py','analysis.json','requirements.txt','LICENSE'])await copyFile(join(exampleRoot,name),join(root,name));
const content=JSON.parse(await readFile(join(exampleRoot,'deck.json'),'utf8'));
const sourceNames=new Set(['protocol.md','fatigue.csv']);
for(const paper of content.papers){
  if(!sourceNames.has(paper.reading.source))throw new Error('Unexpected materials demo source: '+paper.reading.source);
  paper.reading.source=join(root,paper.reading.source);
}
let state=await createProject({cwd,projectDir:join(root,'project'),title:content.title,brief:content.brief,capabilities:{imageInput:'unknown',source:'Offline example rebuild; no host image-input capability has been verified.'}});
let batchNumber=0;
async function recordBatch(name,payload){
  const recordsPath=join(root,'records',String(++batchNumber).padStart(2,'0')+'-'+name+'.json');
  await writeFile(recordsPath,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
  state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,recordsPath});
}
await recordBatch('design',{design:content.design});
for(const [key,limit] of [['papers',5],['claims',20],['assets',8],['slides',8]])for(let i=0;i<content[key].length;i+=limit)await recordBatch(key,{[key]:content[key].slice(i,i+limit)});
const build=await buildProject({cwd,projectPath:state.projectPath,expectedRevision:state.revision,mode:'review'});
if(!build.ok)throw new Error('Demo was blocked: '+JSON.stringify(build.issues));
const rendering=render?await renderProjectArtifact({cwd,projectPath:state.projectPath,expectedRevision:state.revision,...(fonts.length?{fontDirectories:fonts}:{})}):{status:'not-requested'};
const check=await checkProject({cwd,projectPath:state.projectPath});
const referenceTemplateIds=[...new Set(content.slides.map(s=>s.referenceTemplateId).filter(Boolean))];
const result={example:{name:'materials-v04',identity:'New teaching-simulation inputs, not a real experiment, institution, project or paper.',sourceDirectory:root,recordTransport:'recordsPath',recordBatchCount:batchNumber},projectPath:state.projectPath,revision:state.revision,build,rendering,check,templateReuse:{referenceTemplateIds}};
await writeFile(join(root,'demo-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
// A short output keeps DSH/DeepSeek context focused; complete receipts remain beside the project.
const saved=JSON.parse(await readFile(state.projectPath,'utf8'));
console.log(JSON.stringify({ok:true,example:'materials-v04',projectPath:state.projectPath,revision:state.revision,qualityProfile:saved.brief.qualityProfile,imageInput:saved.capabilities.imageInput,recordBatchCount:batchNumber,pptx:saved.artifact.files.pptx.path,pptxSha256:saved.artifact.files.pptx.sha256,html:saved.artifact.files.html.path,speech:saved.artifact.files.speech.path,renderStatus:rendering.status,static:check.summary,visual:check.verification.visual,readyForDelivery:check.verification.readyForDelivery,referenceTemplateIds,resultPath:join(root,'demo-result.json')},null,2));
