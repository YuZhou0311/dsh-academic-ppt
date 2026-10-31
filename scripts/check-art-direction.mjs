#!/usr/bin/env node
/** Validate review evidence consistency, NOT aesthetic quality or user consent authenticity. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const dimensions = ['referenceMatch','hierarchy','relationships','evidenceLegibility','typography','color','density'];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const substantive = v => typeof v === 'string' && v.trim().length >= 8 && !/^(整体专业|全部通过|看起来很好|looks good|all passed)[。.!\s]*$/i.test(v.trim());

export function validateReview(manifest, directory, mode='candidate') {
  const errors=[], warnings=[];
  if(!manifest || typeof manifest!=='object' || Array.isArray(manifest))return {ok:false,errors:['manifest must be an object'],warnings};
  const fail=(where,msg)=>errors.push(`${where}: ${msg}`);
  if (!['candidate','final'].includes(mode)) return {ok:false,errors:['mode must be candidate or final'],warnings};
  const root=fs.realpathSync(directory);
  function artifact(a,where,png=false){
    if(!a || typeof a.file!=='string' || !/^[a-f0-9]{64}$/.test(a.sha256||'')){fail(where,'file and lowercase SHA-256 are required');return null;}
    if(path.isAbsolute(a.file)||a.file.includes('\\')){fail(where,'use a relative POSIX path inside the review bundle');return null;}
    let real;
    try {real=fs.realpathSync(path.resolve(root,a.file));}catch{fail(where,'file not found');return null;}
    const rel=path.relative(root,real);
    if(rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel)){fail(where,'path or symlink escapes review bundle');return null;}
    const st=fs.statSync(real);
    if(!st.isFile()||st.size>150*1024*1024){fail(where,'not a regular file or exceeds 150 MiB');return null;}
    const data=fs.readFileSync(real);
    if(hash(data)!==a.sha256)fail(where,'artifact hash is stale or incorrect');
    if(png){
      if(data.length<33||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data.toString('ascii',12,16)!=='IHDR')fail(where,'expected a PNG header');
      else if(data.readUInt32BE(16)<640||data.readUInt32BE(20)<360)fail(where,'use a readable page render, not a thumbnail');
    }
    return {sha256:hash(data),file:a.file};
  }
  if(manifest?.schemaVersion!==1)fail('schemaVersion','expected 1');
  const pptx=artifact(manifest?.pptx,'pptx');
  if(!substantive(manifest?.target))fail('target','describe the concrete chosen visual target');
  if(!Array.isArray(manifest?.references)||!manifest.references.length)fail('references','at least one inspected reference page is required');
  else manifest.references.forEach((r,i)=>{
    artifact(r,`references[${i}]`,true);
    if(!substantive(r?.observation))fail(`references[${i}]`,'record a concrete visual observation');
  });
  const render=manifest?.render;
  if(!render||!substantive(render.renderer))fail('render','identify the actual PPTX rendering engine');
  if(pptx&&render?.inputPptxSha256!==pptx.sha256)fail('render','render must be bound to the current PPTX');
  const rendered=new Map();
  if(!Array.isArray(render?.pages)||!render.pages.length)fail('render.pages','actual page renders are required');
  else render.pages.forEach((r,i)=>{
    if(!r || typeof r!=='object'){fail(`render.pages[${i}]`,'invalid page record');return;}
    if(!Number.isInteger(r.page)||r.page<1||rendered.has(r.page))fail(`render.pages[${i}]`,'invalid or duplicate page');
    artifact(r,`render.pages[${i}]`,true);rendered.set(r.page,r);
  });
  if(Number.isInteger(render?.pageCount)&&render.pageCount!==rendered.size)fail('render.pageCount','does not match render list');
  if(!Array.isArray(manifest?.pages)||manifest.pages.length!==rendered.size)fail('pages','review every rendered page once');
  const seen=new Set();
  for(const page of Array.isArray(manifest?.pages)?manifest.pages:[]){
    if(!page || typeof page!=='object'){fail('pages','invalid page review');continue;}
    const where=`page ${page.page}`;
    if(seen.has(page.page)||!rendered.has(page.page))fail(where,'unknown or duplicate page');
    seen.add(page.page);
    if(page.currentRenderSha256!==rendered.get(page.page)?.sha256)fail(where,'page review is not bound to current PNG');
    if(!['vision-model','human'].includes(page.reviewer))fail(where,'reviewer must be vision-model or human');
    if(!['candidate','ready','blocked'].includes(page.status))fail(where,'status must be candidate, ready or blocked');
    if(mode==='final'&&page.status!=='ready')fail(where,'final mode requires ready status');
    for(const dim of dimensions)if(!substantive(page.observations?.[dim]))fail(`${where}.${dim}`,'provide a specific observation, not generic praise');
    if(!Array.isArray(page.unresolved))fail(where,'unresolved must be an explicit array');
    if(mode==='final'&&page.unresolved?.length)fail(where,'unresolved issues remain');
    if(page.revision){
      const before=artifact(page.revision.before,`${where}.revision.before`,true);
      if(before&&before.sha256===page.currentRenderSha256)fail(where,'claimed revision has identical before/after images');
      if(!Array.isArray(page.revision.actions)||!page.revision.actions.length||!page.revision.actions.every(substantive))fail(where,'describe actual revision actions');
      if(!substantive(page.revision.afterObservation))fail(where,'record what was seen after rerender');
    }
  }
  if(mode==='final'){
    const approval=manifest?.directionApproval;
    if(!approval||!['accepted','delegated'].includes(approval.kind)||!substantive(approval.userQuote))fail('directionApproval','record the real acceptance or explicit delegation and its scope');
  }
  warnings.push('Checks byte binding and record completeness only. Does not prove a rendering occurred, that someone inspected it, that the observations are true, or that the design is good.');
  return {ok:errors.length===0,mode,result:errors.length?'inconsistent':'evidence-consistent',errors,warnings};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),file=args[0],idx=args.indexOf('--mode'),mode=idx<0?'candidate':args[idx+1];
  if(!file)throw new Error('Usage: node scripts/check-art-direction.mjs review.json [--mode candidate|final]');
  const abs=path.resolve(file);if(fs.statSync(abs).size>4*1024*1024)throw new Error('Manifest exceeds 4 MiB');
  const result=validateReview(JSON.parse(fs.readFileSync(abs,'utf8')),path.dirname(abs),mode);
  console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
 }catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=2;}
}
