import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateReview,dimensions} from '../scripts/check-art-direction.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'art-direction-'));
 const png=(v=0,w=1280,h=720)=>{const b=Buffer.alloc(40,v);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b;};
 const add=(name,buf)=>{fs.writeFileSync(path.join(root,name),buf);return {file:name,sha256:sha(buf)};};
 const pptx=add('deck.pptx',Buffer.from('test artifact bytes; not a PPTX parser fixture'));
 const ref=add('reference.png',png(0));const image=add('current.png',png(1));
 const m={schemaVersion:1,target:'Strong project-report hierarchy, with connected evidence groups.',pptx,references:[{...ref,observation:'The reference uses a continuous hierarchy from title to evidence.'}],render:{renderer:'Unit-test PNG-header fixture only',inputPptxSha256:pptx.sha256,pageCount:1,pages:[{page:1,...image}]},pages:[{page:1,currentRenderSha256:image.sha256,reviewer:'vision-model',status:'candidate',observations:Object.fromEntries(dimensions.map(d=>[d,`Page 1 specific inspection for ${d}; structural record only.`])),unresolved:[]}],directionApproval:{kind:'pending'}};
 return {root,m,add,png,done:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function run(name,fn){test(name,()=>{const f=fixture();try{fn(f);}finally{f.done();}});}
run('candidate records can be consistent without user approval',f=>assert.equal(validateReview(f.m,f.root).ok,true));
run('changed PPTX invalidates artifact binding',f=>{fs.appendFileSync(path.join(f.root,'deck.pptx'),'changed');assert.equal(validateReview(f.m,f.root).ok,false);});
run('old renderer input hash is rejected',f=>{f.m.render.inputPptxSha256='a'.repeat(64);assert.equal(validateReview(f.m,f.root).ok,false);});
run('old page review hash is rejected',f=>{f.m.pages[0].currentRenderSha256='b'.repeat(64);assert.equal(validateReview(f.m,f.root).ok,false);});
run('missing reference is rejected',f=>{f.m.references=[];assert.equal(validateReview(f.m,f.root).ok,false);});
run('missing typography observation is rejected',f=>{delete f.m.pages[0].observations.typography;assert.equal(validateReview(f.m,f.root).ok,false);});
run('generic praise is not a review observation',f=>{f.m.pages[0].observations.hierarchy='looks good';assert.equal(validateReview(f.m,f.root).ok,false);});
run('duplicate rendered page is rejected',f=>{f.m.render.pages.push({...f.m.render.pages[0]});assert.equal(validateReview(f.m,f.root).ok,false);});
run('thumbnail cannot replace readable render',f=>{Object.assign(f.m.references[0],f.add('tiny.png',f.png(0,100,100)));assert.equal(validateReview(f.m,f.root).ok,false);});
run('identical before and after cannot substantiate a revision',f=>{f.m.pages[0].revision={before:f.m.render.pages[0],actions:['Changed the chart geometry in the main panel.'],afterObservation:'The revised panel now aligns with the table.'};assert.equal(validateReview(f.m,f.root).ok,false);});
run('different revision with actions is evidence-consistent',f=>{f.m.pages[0].revision={before:f.add('before.png',f.png(2)),actions:['Changed the chart geometry in the main panel.'],afterObservation:'The revised panel now aligns with the table.'};assert.equal(validateReview(f.m,f.root).ok,true);});
run('final does not infer approval from candidate',f=>assert.equal(validateReview(f.m,f.root,'final').ok,false));
run('final requires declared review readiness and approval scope',f=>{f.m.pages[0].status='ready';f.m.directionApproval={kind:'accepted',userQuote:'Test fixture only: accepted the presented direction.'};assert.equal(validateReview(f.m,f.root,'final').ok,true);});
run('unresolved problems block final',f=>{f.m.pages[0].status='ready';f.m.directionApproval={kind:'accepted',userQuote:'Test fixture only: accepted the presented direction.'};f.m.pages[0].unresolved=['Axis text unreadable'];assert.equal(validateReview(f.m,f.root,'final').ok,false);});
run('path traversal is rejected',f=>{f.m.references[0].file='../outside.png';assert.equal(validateReview(f.m,f.root).ok,false);});
run('symlink escape is rejected',f=>{const outside=fs.mkdtempSync(path.join(os.tmpdir(),'outside-'));try{fs.writeFileSync(path.join(outside,'a.png'),f.png());fs.symlinkSync(path.join(outside,'a.png'),path.join(f.root,'link.png'));f.m.references[0].file='link.png';assert.equal(validateReview(f.m,f.root).ok,false);}finally{fs.rmSync(outside,{recursive:true,force:true});}});
run('malformed array members return errors rather than crash',f=>{f.m.references=[null];f.m.render.pages=[null];f.m.pages=[null];assert.equal(validateReview(f.m,f.root).ok,false);});
run('non-object manifest is rejected',f=>assert.equal(validateReview(null,f.root).ok,false));
