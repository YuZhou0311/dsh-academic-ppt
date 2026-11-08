/** Enumerate only explicitly supplied source-image folders. No network, no
 * workspace-wide discovery, no inferred figure captions or scientific claims. */
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
import {safePath,readBounded,imageDimensions,hash} from './io.mjs';
import {createContactSheets} from './montage.mjs';
const txt={type:'string',minLength:1,maxLength:3000};
const id={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'};
export const inventoryRequestSchema={type:'object',properties:{kind:{type:'string',const:'figure-inventory'},sources:{type:'array',minItems:1,maxItems:30,items:{type:'object',properties:{paperId:id,directory:txt,filenamePrefix:{type:'string',minLength:1,maxLength:160}},required:['paperId','directory'],additionalProperties:false}}},required:['kind','sources'],additionalProperties:false};
export const inventorySchema={type:'object',properties:{createdAt:txt,workspace:txt,sources:inventoryRequestSchema.properties.sources,items:{type:'array',maxItems:160,items:{type:'object',properties:{id,paperId:id,path:txt,sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},width:{type:'integer',minimum:1},height:{type:'integer',minimum:1},bytes:{type:'integer',minimum:1}},required:['id','paperId','path','sha256','width','height','bytes'],additionalProperties:false}},contactSheetPaths:{type:'array',maxItems:10,items:txt}},required:['createdAt','workspace','sources','items','contactSheetPaths'],additionalProperties:false};
export async function scanFigureInventory({cwd,sources,projectDir,paperIds,signal}){
 const items=[],seen=new Map();
 for(const source of sources){
  if(!paperIds.includes(source.paperId))throw new Error('INVENTORY_UNKNOWN_PAPER: '+source.paperId);
  const directory=await safePath(cwd,source.directory,{mustExist:true});
  const walk=async(dir,depth)=>{
   if(depth>4)throw new Error('INVENTORY_DEPTH_LIMIT: use smaller explicit source folders');
   for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    signal?.throwIfAborted();
    if(entry.isSymbolicLink())throw new Error('INVENTORY_SYMLINK_REJECTED: '+entry.name);
    const path=await safePath(cwd,join(dir,entry.name),{mustExist:true});
    if(entry.isDirectory()){await walk(path,depth+1);continue;}
    if(!entry.isFile()||!['.png','.jpg','.jpeg'].includes(extname(entry.name).toLowerCase())||(source.filenamePrefix&&!entry.name.startsWith(source.filenamePrefix)))continue;
    if(seen.has(path)){if(seen.get(path)!==source.paperId)throw new Error('INVENTORY_PAPER_CONFLICT: one file has two source identities');continue;}
    if(items.length>=160)throw new Error('INVENTORY_FILE_LIMIT: at most 160 image files');
    const bytes=await readBounded(path,8*1024*1024),dimensions=imageDimensions(bytes),digest=hash(bytes);
    items.push({id:'fig-'+hash(source.paperId+'\n'+path).slice(0,16),paperId:source.paperId,path,sha256:digest,width:dimensions.width,height:dimensions.height,bytes:bytes.length});
    seen.set(path,source.paperId);
   }
  };
  await walk(directory,0);
 }
 const out=await safePath(cwd,join(projectDir,'figure-inventory-'+randomUUID().slice(0,8)));
 await mkdir(out,{recursive:false});
 const pages=[];
 for(const [i,item] of items.entries()){
  signal?.throwIfAborted();const data=await readBounded(item.path,8*1024*1024);
  // Decode validated input, reduce thumbnails before contact sheets.
  const input=extname(item.path).toLowerCase()==='.png'?PNG.sync.read(data):jpeg.decode(data,{useTArray:true,maxResolutionInMP:32,maxMemoryUsageInMB:256});
  const scale=Math.min(1,720/input.width,500/input.height),w=Math.max(1,Math.round(input.width*scale)),h=Math.max(1,Math.round(input.height*scale));
  const thumb=new PNG({width:w,height:h});
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=(Math.min(input.height-1,Math.floor(y/scale))*input.width+Math.min(input.width-1,Math.floor(x/scale)))*4,di=(y*w+x)*4;thumb.data.set(input.data.subarray(si,si+4),di);}
  const path=join(out,`figure-${String(i+1).padStart(3,'0')}.png`);await writeFile(path,PNG.sync.write(thumb),{flag:'wx',signal});pages.push(path);
 }
 const contactSheetPaths=await createContactSheets(pages,out,{signal});
 const inventory={createdAt:new Date().toISOString(),workspace:resolve(cwd),sources,items,contactSheetPaths};
 await writeFile(join(out,'inventory.json'),JSON.stringify(inventory,null,2)+'\n',{flag:'wx',signal});
 return {inventory,path:join(out,'inventory.json')};
}
export function figureInventoryReport(project){
 const inventory=project.figureInventory;
 if(!inventory)return {status:'not-recorded',issues:[],note:'先用plan(kind:figure-inventory)扫描明确给出的取图目录；不能凭已入稿资产数推断下载总数。'};
 const assets=new Map((project.assets??[]).map(a=>[a.id,a])),papers=new Map((project.papers??[]).map(p=>[p.id,p]));
 const issues=[],rows=[];
 for(const item of inventory.items){
  const paper=papers.get(item.paperId),candidates=paper?.figureReview?.candidates??[];
  const c=candidates.find(c=>(c.assetId&&assets.get(c.assetId)?.sha256===item.sha256)||(c.inventoryId===item.id)||(c.localPath&&resolve(inventory.workspace,c.localPath)===item.path));
  let state=c?.decision??'pending';
  if(!c||state==='pending')issues.push({severity:'error',code:'downloaded-figure-undecided',paperId:item.paperId,path:'figureInventory.'+item.id,message:`已下载 ${basename(item.path)} 未逐图完成采用决定。查看缩略总览并打开相关原图；在该论文figureReview.candidates中用inventoryId关联selected或not-used及具体原因。`});
  if(state==='unavailable')issues.push({severity:'error',code:'downloaded-figure-marked-unavailable',paperId:item.paperId,path:'figureInventory.'+item.id,message:`${basename(item.path)} 已成功下载，不得再标记图像不可用。图注/语义缺口用captionStatus及not-used原因表达，不能将下载与可解释性合并。`});
  if(state==='not-used'&&!c.reason?.trim())issues.push({severity:'error',code:'downloaded-figure-disposition-missing',paperId:item.paperId,path:'figureInventory.'+item.id,message:'未采用原图需具体说明原因；不能仅因本页已有一张图而排除整份报告的其他证据需求。'});
  rows.push({inventoryId:item.id,paperId:item.paperId,path:item.path,decision:state,assetId:c?.assetId??null,captionStatus:c?.captionStatus??'not-recorded',reason:c?.reason??''});
 }
 return {status:issues.length?'needs-disposition':'accounted',downloadedCount:rows.length,selectedCount:rows.filter(r=>r.decision==='selected').length,notUsedCount:rows.filter(r=>r.decision==='not-used').length,pendingCount:rows.filter(r=>r.decision==='pending').length,rows,issues,contactSheetPaths:inventory.contactSheetPaths,basis:'explicit-directory-byte-inventory-not-caption-or-relevance-certification'};
}
