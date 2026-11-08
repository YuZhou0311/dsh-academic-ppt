#!/usr/bin/env node
/** Offline installation audit. Never reads API keys or changes a DSH profile. */
import {readFile,stat,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {installedPlugin,designCases} from '../src/authoring-guidance.mjs';
import {readBundledSkill,buildAcademicTools} from '../src/index.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function checkInstallation({render=false,outputDir,fontDirectories=[]}={}){
 const checks=[];const add=(name,ok,detail)=>checks.push({name,ok,detail});
 const [major,minor,patch]=process.versions.node.split('.').map(Number);
 add('node',major>=24||(major===22&&(minor>19||(minor===19&&patch>=0))),process.version);
 const skill=readBundledSkill();add('skill',skill.name===installedPlugin.name&&skill.content.includes(installedPlugin.guidanceRevision)&&skill.content.includes('read_image'),skill.name);
 const tools=buildAcademicTools();add('tools',tools.length===19,tools.map(t=>t.name));
 const authoring=await tools.find(t=>t.name==='academic_ppt_contract').execute({topic:'authoring'},{});
 add('content-authoring-contract',authoring.schema?.properties?.kind?.const==='compose-page'&&authoring.referencedSchemas?.length>0&&authoring.openingSchema?.properties?.kind?.const==='compose-opening',authoring.guidePath);
 for(const name of ['shared-comparison.json','method-feedback.json','paired-panels.json','compact-loop.json','count-ledger.json'])add('authoring-example:'+name,(await stat(join(authoring.examplesPath,name))).isFile(),name);
 const lessonDir=join(root,'skills/dsh-academic-ppt/references/reference-composition');
 const lessons=JSON.parse(await readFile(join(lessonDir,'manifest.json'),'utf8'));
 for(const f of lessons.files)add('composition-lesson:'+f.path,sha(await readFile(join(lessonDir,f.path)))===f.sha256,f.path);
 const catalog=JSON.parse(await readFile(join(root,'skills/dsh-academic-ppt/references/design-cases/catalog.json'),'utf8'));
 for(const c of catalog.cases){
  for(const [field,hashField] of [['preview','previewSha256'],['pptx','pptxSha256'],['input','inputSha256'],['receipt','receiptSha256']]){
   const path=join(root,'skills/dsh-academic-ppt/references/design-cases',c[field]);
   try{const bytes=await readFile(path);add('case:'+c.id+':'+field,sha(bytes)===c[hashField],path);}catch(e){add('case:'+c.id+':'+field,false,e.message);}
  }
 }
 let engine;
 try{const require=createRequire(import.meta.url);engine=require('@deepseek-ai/libreoffice-kit/package.json').version;}catch{engine=null;}
 add('optional-renderer-installed',engine==='0.1.5',engine??'Missing optional renderer. Install the full bundle dependencies; no visual completion may be claimed without a real render.');
 let actualRender={status:'not-executed',reason:'Pass --render and --output NEW_DIRECTORY for a real PPTX smoke test.'};
 if(render){
  if(!outputDir)throw new Error('--render requires --output NEW_DIRECTORY');
  const output=resolve(outputDir);await mkdir(dirname(output),{recursive:true});await mkdir(output);
  const c=catalog.cases[0],pptx=join(output,'smoke.pptx');
  await copyFile(join(root,'skills/dsh-academic-ppt/references/design-cases',c.pptx),pptx);
  const {renderDeck,readRenderReceipt}=await import('../src/vendor/dsh-ppt-render.mjs');
  actualRender=await renderDeck({pptxPath:pptx,outputDir:join(output,'render'),format:'png',...(fontDirectories.length?{fontDirectories:fontDirectories.map(p=>resolve(p))}:{})});
  add('actual-pptx-render',actualRender.ok===true&&actualRender.missingFonts?.length===0,actualRender);
  if(actualRender.ok)add('actual-render-binding',readRenderReceipt(pptx,actualRender.receiptPath).status==='rendered',actualRender.receiptPath);
 }
 return {ok:checks.every(c=>c.ok),installedPlugin,checks,designCases:designCases(),actualRender,
   unverified:['DSH Desktop/Web installation and current profile registration','Actual provider/model image serialization and understanding','Real DeepSeek autonomous composition and visual refinement','PowerPoint/WPS page-by-page rendering'],
   scope:'Local package, dependencies and optional render only; no model call, credentials, user approval or aesthetic certification.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  let render=false,outputDir;const fontDirectories=[];
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){
   if(args[i]==='--render')render=true;
   else if(args[i]==='--output'&&args[i+1])outputDir=args[++i];
   else if(args[i]==='--font-dir'&&args[i+1])fontDirectories.push(args[++i]);
   else if(args[i]==='--help'){console.log('node scripts/check-installation.mjs [--render --output NEW_DIRECTORY] [--font-dir LOCAL_DIRECTORY]');process.exit(0);}
   else throw new Error('Unknown/incomplete argument: '+args[i]);
  }
  const result=await checkInstallation({render,outputDir,fontDirectories});console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
