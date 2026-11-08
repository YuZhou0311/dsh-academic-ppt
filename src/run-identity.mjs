/** Bounded execution provenance; not an aesthetic validator. No source content
 * or session messages are copied. Useful when a PDF alone cannot identify the
 * installed package, saved overrides, authoring path, or checkpoint state. */
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {resolveDesign} from './scene.mjs';
import {safePath,readBounded,hash,stable} from './io.mjs';
import {installedPlugin} from './authoring-guidance.mjs';
const sources=['tools.mjs','page-authoring.mjs','page-authoring-schema.mjs','adaptive-flow.mjs','composition-observations.mjs','scientific-text.mjs','host-collaboration.mjs','host-visual-workflow.mjs','art-direction.mjs'];
const codeHash=hash(sources.map(f=>hash(readFileSync(new URL(f,import.meta.url)))).join(':'));
export function executionIdentity(p){
 const d=resolveDesign(p.design),warnings=[];
 const pages=(p.slides??[]).map(s=>({slideId:s.id,layout:s.layout,route:s.authoringMap?'compose-page':s.layout==='cover'?'opening-layout':s.composition?'explicit-composition':s.drawings?.every(x=>x.box)?'positioned-drawings':'automatic-layout',primaryNodeId:s.authoringMap?.primaryNodeId??null}));
 if(!p.design?.artDirection)warnings.push('No saved artDirection: a profile/legacy style may be driving the appearance. Do not infer the installed version from the PDF.');
 if(p.design?.artDirection==='structured'&&d.system.header!=='band')warnings.push('Explicit system.header overrides the structured default. Check the actual user choice rather than silently changing it.');
 if(pages.some(s=>s.route==='automatic-layout'&&!['cover','references','section','closing','agenda','roadmap'].includes(s.layout)))warnings.push('At least one body page uses an automatic layout, not the content authoring route.');
 return {plugin:installedPlugin,codeSha256:codeHash,projectId:p.id,revision:p.revision,
  requestedDesign:{artDirection:p.design?.artDirection??null,styleProfile:p.design?.styleProfile??null,authoringMode:p.design?.authoringMode??null,explicitSystem:p.design?.system??null},
  effectiveDesign:{fontFamily:d.fontFamily,titleFontFamily:d.titleFontFamily,annotationFontFamily:d.annotationFontFamily,system:d.system,palette:d.palette},
  pages,recordedInteraction:{mode:p.design?.consultation?.mode??'legacy',stageStatuses:(p.design?.consultation?.decisions??[]).map(x=>({topic:x.topic,status:x.status})),pilotStatus:p.pilotReview?.decision??'not-recorded'},
  warnings,basis:'Executed plugin source, saved requested values and resolved tokens. Does not verify user approval, actual font substitution or visual quality.'};
}
export async function attachExecutionIdentity(name,value,cwd){
 if(!['academic_ppt_init','academic_ppt_context','academic_ppt_build','academic_ppt_render'].includes(name)||!value?.projectPath)return value;
 const path=await safePath(cwd,value.projectPath,{mustExist:true});const p=JSON.parse((await readBounded(path)).toString('utf8'));
 const identity=executionIdentity(p);let receiptPath;
 if(['academic_ppt_build','academic_ppt_render'].includes(name)&&value.ok!==false){
  receiptPath=join(dirname(path),'execution-identity-r'+p.revision+'-'+hash(stable(identity)).slice(0,12)+'.json');
  await writeFile(await safePath(cwd,receiptPath),JSON.stringify(identity,null,2)+'\n');
 }
 return {...value,executionIdentity:identity,...(receiptPath?{executionIdentityPath:receiptPath}:{})};
}
