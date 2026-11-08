#!/usr/bin/env node
/** Rebuild public-safe authored examples, never model/visual approval. */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderProject} from '../src/render.mjs';
import {renderDeck} from '../src/vendor/dsh-ppt-render.mjs';
const source=fileURLToPath(new URL('../skills/dsh-academic-ppt/references/design-cases/',import.meta.url));
let output,render=false;const fonts=[];const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 if(args[i]==='--output'&&args[i+1])output=resolve(args[++i]);
 else if(args[i]==='--render')render=true;
 else if(args[i]==='--font-dir'&&args[i+1])fonts.push(resolve(args[++i]));
 else if(args[i]==='--help'){console.log('node scripts/build-design-cases.mjs --output NEW_DIRECTORY [--render] [--font-dir LOCAL_DIRECTORY]\nNo network/model calls, no automatic visual approval.');process.exit(0);}
 else throw new Error('Unknown/incomplete argument: '+args[i]);
}
if(!output)throw new Error('Supply --output NEW_DIRECTORY');
if(fonts.length>4)throw new Error('At most four font directories');
await mkdir(dirname(output),{recursive:true});await mkdir(output);
const manifest=JSON.parse(await readFile(join(source,'catalog.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
manifest.build={rendered:render,visualReview:'not-reviewed',source:'public original result/method/multi-panel teaching cases; assistant-authored, not real-model QA'};
for(const c of manifest.cases){
 const dir=join(output,c.id);await mkdir(dir);
 const p=JSON.parse(await readFile(join(source,c.input),'utf8'));
 if(p.slides.length!==1||p.assets.length||p.papers.length||p.claims.length)throw new Error('Design cases must remain native, one-page, and clearly teaching-only');
 const result=await renderProject(p);
 const pptx=join(output,c.pptx);await writeFile(pptx,result.pptx);
 for(const name of ['input.json','README.md'])await copyFile(join(source,c.id,name),join(dir,name));
 await writeFile(join(dir,'scene-issues.json'),JSON.stringify(result.issues,null,2)+'\n');
 c.pptxSha256=sha(result.pptx);c.inputSha256=sha(await readFile(join(output,c.input)));
 c.sceneErrors=result.issues.filter(i=>i.severity==='error').length;
 c.sceneWarnings=result.issues.filter(i=>i.severity==='warning').length;
 if(c.sceneErrors)throw new Error('Case geometry has errors: '+c.id);
 if(render){
  const rendered=await renderDeck({pptxPath:pptx,outputDir:join(dir,'render'),format:'png',width:1600,...(fonts.length?{fontDirectories:fonts}:{})});
  if(!rendered.ok||rendered.missingFonts.length)throw new Error('Real render failed or missing fonts: '+JSON.stringify(rendered));
  await copyFile(rendered.pngPaths[0],join(output,c.preview));
  c.previewSha256=sha(await readFile(join(output,c.preview)));
  c.receipt=relative(output,rendered.receiptPath).split('\\').join('/');
  c.receiptSha256=sha(await readFile(rendered.receiptPath));
 }else{delete c.previewSha256;delete c.receiptSha256;delete c.receipt;}
 console.log(c.id,JSON.stringify({sceneErrors:c.sceneErrors,sceneWarnings:c.sceneWarnings,rendered:render}));
}
for(const f of ['README.md','teaching-data.json'])await copyFile(join(source,f),join(output,f));
await writeFile(join(output,'catalog.json'),JSON.stringify(manifest,null,2)+'\n');
