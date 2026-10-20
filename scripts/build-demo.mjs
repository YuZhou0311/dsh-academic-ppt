#!/usr/bin/env node
/** Offline reproducible example. Default output is a new directory below the invoking cwd. */
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProject, updateRecords, buildProject, checkProject, renderProjectArtifact } from '../src/core.mjs';
import { buildAcademicTools } from '../src/tools.mjs';
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
await copyFile(join(exampleRoot,'assets/pheno-figure3.png'),join(root,'assets/pheno-figure3.png'));
await copyFile(join(exampleRoot,'native-card-reference.pptx'),join(root,'native-card-reference.pptx'));
await copyFile(join(exampleRoot,'ASSETS.md'),join(root,'ASSETS.md'));
const templateTool=buildAcademicTools().find(t=>t.name==='academic_ppt_template');
const profile=await templateTool.execute({filePath:join(root,'native-card-reference.pptx'),outputPath:join(root,'template-profile.json')},{agent:{session:{header:{cwd}}}});
const evidence=profile.components.find(c=>c.sourceName==='academic-evidence-sheet');
const boundary=profile.components.find(c=>c.sourceName==='academic-boundary-fold');
if(!evidence||!boundary)throw new Error('Demo reference components were not actually imported.');
const content=scienceDemo();
content.assets=content.assets.map(a=>({...a,path:join(root,a.path)}));
for(const slide of content.slides)for(const card of slide.cards){if(card.templateComponentId==='@evidence-sheet')card.templateComponentId=evidence.id;if(card.templateComponentId==='@boundary-fold')card.templateComponentId=boundary.id;}
let state=await createProject({cwd,projectDir:join(root,'project'),title:content.title,brief:content.brief,design:content.design,capabilities:content.capabilities});
state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,papers:content.papers,claims:content.claims,assets:content.assets,templateProfilePaths:[profile.profilePath]});
for(let i=0;i<content.slides.length;i+=8) state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,slides:content.slides.slice(i,i+8)});
const build=await buildProject({cwd,projectPath:state.projectPath,expectedRevision:state.revision,mode:'review'});
if(!build.ok)throw new Error('Demo was blocked: '+JSON.stringify(build.issues));
const rendering=render?await renderProjectArtifact({cwd,projectPath:state.projectPath,expectedRevision:state.revision,...(fonts.length?{fontDirectories:fonts}:{})}):{status:'not-requested'};
const check=await checkProject({cwd,projectPath:state.projectPath});
const result={projectPath:state.projectPath,revision:state.revision,build,rendering,check,templateReuse:{source:join(root,'native-card-reference.pptx'),profilePath:profile.profilePath,components:[evidence.id,boundary.id],disclosure:'Original reference authored for this plugin. Prior user templates are unavailable in this project.'}};
await writeFile(join(root,'demo-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
// A short output keeps DSH/DeepSeek context focused; complete receipts remain beside the project.
const saved=JSON.parse(await readFile(state.projectPath,'utf8'));
console.log(JSON.stringify({ok:true,projectPath:state.projectPath,revision:state.revision,pptx:saved.artifact.files.pptx.path,html:saved.artifact.files.html.path,speech:saved.artifact.files.speech.path,renderStatus:rendering.status,static:check.summary,visual:check.verification.visual,templateComponents:[evidence.id,boundary.id],resultPath:join(root,'demo-result.json')},null,2));
