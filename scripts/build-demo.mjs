#!/usr/bin/env node
/** Offline reproducible example. Default output is a new directory below the invoking cwd. */
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProject, updateRecords, buildProject, checkProject, renderProjectArtifact } from '../src/core.mjs';
import { safePath } from '../src/io.mjs';
import { scienceDemo } from '../examples/science-demo.mjs';

const argv=process.argv.slice(2), cwd=process.cwd(), exampleRoot=fileURLToPath(new URL('../examples/',import.meta.url));
let target, render=false;const fonts=[];
for(let i=0;i<argv.length;i++) {
  if(argv[i]==='--output'&&argv[i+1]) target=argv[++i];
  else if(argv[i]==='--render') render=true;
  else if(argv[i]==='--font-dir'&&argv[i+1]) fonts.push(argv[++i]);
  else if(argv[i]==='--help') {console.log('npm run demo -- [--output NEW_DIRECTORY] [--render] [--font-dir WORKSPACE_FONT_DIRECTORY]\nOffline; never overwrites an existing output. --render needs the optional LibreOffice kit.');process.exit(0);}
  else throw new Error('Unknown or incomplete argument: '+argv[i]);
}
// Match DSH's platform-aware working-directory and symlink boundaries.
const root=await safePath(cwd,target||`academic-demo-${new Date().toISOString().slice(0,10)}-${randomUUID().slice(0,8)}`);
await mkdir(root); // EEXIST intentionally stops. Existing files are never removed or overwritten.
await mkdir(join(root,'assets'));
await copyFile(join(exampleRoot,'ASSETS.md'),join(root,'ASSETS.md'));
const content=scienceDemo();
for(const assetPath of new Set(content.assets.map(a=>a.path))){
  const source=await safePath(exampleRoot,assetPath,{mustExist:true});
  const destination=await safePath(root,assetPath);
  await copyFile(source,destination);
}
content.assets=content.assets.map(a=>({...a,path:join(root,a.path)}));
let state=await createProject({cwd,projectDir:join(root,'project'),title:content.title,brief:content.brief,design:content.design,capabilities:content.capabilities});
for(const [key,limit] of [['papers',5],['claims',20],['assets',8]])for(let i=0;i<content[key].length;i+=limit)state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,[key]:content[key].slice(i,i+limit)});
for(let i=0;i<content.slides.length;i+=8) state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,slides:content.slides.slice(i,i+8)});
const build=await buildProject({cwd,projectPath:state.projectPath,expectedRevision:state.revision,mode:'review'});
if(!build.ok)throw new Error('Demo was blocked: '+JSON.stringify(build.issues));
const rendering=render?await renderProjectArtifact({cwd,projectPath:state.projectPath,expectedRevision:state.revision,...(fonts.length?{fontDirectories:fonts}:{})}):{status:'not-requested'};
const check=await checkProject({cwd,projectPath:state.projectPath});
const referenceTemplateIds=[...new Set(content.slides.map(s=>s.referenceTemplateId).filter(Boolean))];
const result={projectPath:state.projectPath,revision:state.revision,build,rendering,check,templateReuse:{referenceTemplateIds,disclosure:'Bundled native academic layouts, newly authored after studying 39 pages from two user-supplied academic templates. Original source decks are not redistributed.'}};
await writeFile(join(root,'demo-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
// A short output keeps DSH/DeepSeek context focused; complete receipts remain beside the project.
const saved=JSON.parse(await readFile(state.projectPath,'utf8'));
console.log(JSON.stringify({ok:true,projectPath:state.projectPath,revision:state.revision,pptx:saved.artifact.files.pptx.path,html:saved.artifact.files.html.path,speech:saved.artifact.files.speech.path,renderStatus:rendering.status,static:check.summary,visual:check.verification.visual,referenceTemplateIds,resultPath:join(root,'demo-result.json')},null,2));
