/** Live DSH evidence for two different events: model image input, and a file
 * offered to the user's UI. Neither means that a human opened/approved it.
 * Session-local, no credentials or conversation text, no calls to a model.
 * Receipt loss after restart fails closed: reread/represent the current files.
 */
import {HostCollaboration} from './host-collaboration.mjs';
import {readFileSync,statSync} from 'node:fs';
import {safePath,readBounded} from './io.mjs';
import {pilotSlideIds,pilotFingerprint} from './storyboard.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,isAbsolute} from 'node:path';

const MAX_FILE=64*1024*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=blocks=>(blocks??[]).filter(b=>b.type==='text').map(b=>b.text??'').join('\n');
function fileHash(path){
  if(typeof path!=='string'||!isAbsolute(path))return undefined;
  try{const s=statSync(path);if(!s.isFile()||s.size>MAX_FILE)return undefined;return sha(readFileSync(path));}catch{return undefined;}
}
const owner=exec=>exec?.agent?.session;
export class HostVisualWorkflow {
  #states=new WeakMap();
  constructor(ctx){this.ctx=ctx;this.collaboration=new HostCollaboration();}
  state(exec){
    const key=owner(exec);if(!key||typeof key!=='object')return undefined;
    if(!this.#states.has(key))this.#states.set(key,{images:new Map(),shown:new Map(),pendingReads:new Map(),activeProject:null,activeCwd:null});
    return this.#states.get(key);
  }
  /** Observe only a successful final pipeline result, not requested paths. */
  observe(exec,result){
    this.collaboration.observeQuestion(exec,result);
    const s=this.state(exec);if(!s)return;
    const attempt=exec.name==='read_image'?s.pendingReads.get(exec.callId):undefined;
    if(exec.name==='read_image')s.pendingReads.delete(exec.callId);
    if(result?.isError!==false)return;
    if(exec.name==='read_image'){
      const image=(result.content??[]).find(b=>b.type==='image'&&b.attachment);
      if(!image)return; // OCR/text/path responses are not image input.
      const digest=/^sha256:([a-f0-9]{64})$/.exec(image.attachment.attachmentId??'')?.[1];
      if(!digest)return; // Unsupported attachment provenance must not be invented.
      const path=/<path>([^<]+)<\/path>/.exec(text(result.content))?.[1]??exec.arguments?.file_path;
      if(!isAbsolute(path??''))return;
      const current=fileHash(path);
      // Official attachments may normalize/downscale pixels. Bind the source
      // only when a pre-execution snapshot still matches after the successful
      // image result; do not treat the transformed attachment hash as the file.
      const original=attempt?.path===path&&attempt.sha256===current?current:current===digest?digest:undefined;
      if(!original)return;
      s.images.set(original,{path,sha256:original,attachmentSha256:digest,callId:exec.callId,time:Date.now()});
    }
    if(exec.name==='present'){
      const files=Array.isArray(result.value?.files)?result.value.files:exec.arguments?.files??[];
      for(const f of files){const raw=typeof f==='string'?f:f.path;const path=raw&&(isAbsolute(raw)?raw:s.activeCwd?resolve(s.activeCwd,raw):undefined);const digest=fileHash(path);if(digest)s.shown.set(path,{sha256:digest,callId:exec.callId,time:Date.now(),humanClock:this.collaboration.state(exec.agent?.session)?.clock??0});}
    }
    if(exec.name.startsWith('academic_ppt_')&&typeof result.value?.projectPath==='string')s.activeProject=result.value.projectPath;
  }
  async project(path,cwd){
    if(!path)return null;
    const file=await safePath(cwd??process.cwd(),path,{mustExist:true});
    const bytes=await readBounded(file);
    return JSON.parse(bytes.toString('utf8'));
  }
  currentImages(p){return p?.artifact?.render?.pngPaths??[];}
  previewIsCurrent(s,p){
    const r=p?.artifact?.render;if(!r?.ok)return false;
    // A complete current PDF or all current PNGs is an accessible preview.
    const shown=path=>{const receipt=s.shown.get(path);return !!receipt&&receipt.sha256===fileHash(path);};
    return Boolean(r.pdfPath&&shown(r.pdfPath))||Boolean(r.pngPaths?.length&&r.pngPaths.every(shown));
  }
  presentedIdentity(s,p){
    const r=p?.artifact?.render??{};
    const paths=r.pdfPath&&s.shown.has(r.pdfPath)?[r.pdfPath]:(r.pngPaths??[]);
    return sha(JSON.stringify({pptx:p?.artifact?.pptxSha256??p?.artifact?.files?.pptx?.sha256??null,files:paths.map(path=>({path,sha256:s.shown.get(path)?.sha256??null}))}));
  }
  async before({name,args,cwd,exec}){
    const s=this.state(exec);if(!s)return; // CLI remains explicit/manual, not a fictitious DSH session.
    if(args.projectPath){s.activeProject=await safePath(cwd,args.projectPath,{mustExist:true});s.activeCwd=cwd;}
    const currentProject=args.projectPath?await this.project(args.projectPath,cwd):null;
    if(currentProject&&this.previewIsCurrent(s,currentProject)){const r=currentProject.artifact.render;const paths=r.pdfPath&&s.shown.has(r.pdfPath)?[r.pdfPath]:r.pngPaths;const clocks=paths.map(path=>s.shown.get(path)?.humanClock??0);this.collaboration.markPresented(exec,s.activeProject,currentProject,Math.max(...clocks),this.presentedIdentity(s,currentProject));}
    await this.collaboration.before({name,args:args.projectPath?{...args,projectPath:s.activeProject}:args,cwd,exec,project:currentProject,previewIsCurrent:this.previewIsCurrent(s,currentProject)});
    if(name==='academic_ppt_review'&&args.basis==='pptx-render'&&args.reviewer==='vision-model'){
      const p=await this.project(args.projectPath,cwd);
      const paths=this.currentImages(p),missing=[];
      for(const id of args.reviewedSlides??[]){
        const i=p.slides.findIndex(slide=>slide.id===id),path=paths[i],digest=fileHash(path);
        if(i<0||!digest||!s.images.has(digest))missing.push({slideId:id,path:path??null});
      }
      if(missing.length)throw new Error('PAGE_IMAGES_NOT_OBSERVED: 当前单页PNG缺少本会话成功read_image的字节收据：'+JSON.stringify(missing)+'. 先逐页读取，或仅提交已看页面；联系表、路径、旧的不同字节图、OCR和声明“已看”均不抵扣。同字节未改页面可复用读取记录。');
    }
    if(name==='academic_ppt_plan'&&args.requestPath){
      const request=JSON.parse((await readBounded(await safePath(cwd,args.requestPath,{mustExist:true}),1024*1024)).toString('utf8'));
      if(['compose-page','compose-opening'].includes(request.kind)){
        const current=await this.project(args.projectPath,cwd);
        if(current.storyboard?.pages?.length>=6&&current.storyboard.pilot){
          const id=request.slide?.id,existing=(current.slides??[]).some(s=>s.id===id);
          if(!existing&&!pilotSlideIds(current.storyboard).includes(id)&&current.pilotReview?.fingerprint!==pilotFingerprint(current))
            throw new Error('PILOT_NOT_REVIEWED_BEFORE_EXPANSION: 新构图入口也须先完成困难样张，不能以compose-page绕过样张反馈。');
        }
      }
    }
    if(name==='academic_ppt_record'){
      const batch=args.recordsPath?JSON.parse((await readBounded(await safePath(cwd,args.recordsPath,{mustExist:true}),1024*1024)).toString('utf8')):args;
      const current=await this.project(args.projectPath,cwd);
      if(current.storyboard?.pages?.length>=6&&current.storyboard.pilot){
        const pilotIds=pilotSlideIds(current.storyboard),existing=new Set((current.slides??[]).map(s=>s.id));
        const expanding=(batch.slides??[]).filter(slide=>!existing.has(slide.id)&&!pilotIds.includes(slide.id));
        if(expanding.length&&current.pilotReview?.fingerprint!==pilotFingerprint(current))throw new Error('PILOT_NOT_REVIEWED_BEFORE_EXPANSION: 先完成故事板指定的困难页/连续样张，实际看图并展示，再通过plan(kind:pilot-review)登记真实反馈或明确委托。尚不可批量新增非样张页面：'+expanding.map(s=>s.id).join(', ')+'。取证与修订现有页可以继续。');
      }
      const final=batch.design?.consultation?.finalReview;
      if(final?.status==='confirmed'){
        const p=await this.project(args.projectPath,cwd);
        if(!this.previewIsCurrent(s,p))throw new Error('USER_PREVIEW_NOT_PRESENTED: 不能登记当前成品已获确认：本会话尚未用present成功展示当前完整PDF或全部PNG。先展示、再取得真实回答；模型read_image不等于用户看到。');
      }
    }
    if(name==='academic_ppt_build'&&args.mode==='review'){
      const p=await this.project(args.projectPath,cwd);
      if(p.storyboard?.pages?.length>=6&&!p.figureInventory&&(p.assets??[]).some(a=>a.paperId&&(a.path||a.sourcePath))){
        throw new Error('SOURCE_FIGURE_INVENTORY_REQUIRED: 整稿审阅前，用plan(kind:figure-inventory)扫描已下载原图所在的明确目录，按paperId和可选filenamePrefix归属；逐图记录selected或not-used。不要仅扫描最终选中的3张图来替代获取清单。草稿仍可构建。');
      }
    }
  }
  /** Narrow guard: only visual/final acceptance questions in an active deck.
   * Source selection and narrative questions without rendered material pass. */
  async questionGuard(exec,next){
    const s=this.state(exec);
    if(exec.name==='read_image'&&s?.activeCwd&&typeof exec.arguments?.file_path==='string'){
      try{const path=await safePath(s.activeCwd,exec.arguments.file_path,{mustExist:true});const digest=fileHash(path);if(digest){if(s.pendingReads.size>=128)s.pendingReads.delete(s.pendingReads.keys().next().value);s.pendingReads.set(exec.callId,{path,sha256:digest});}}catch{ /* Leave actual read permissions and errors to the official filesystem tool. */ }
    }
    if(exec.name!=='ask_user_question'||!s?.activeProject)return next();
    const qs=exec.arguments?.questions??[];
    const asksVisual=qs.some(q=>/视觉|样张|配色|版式|成品|最终确认|visual|pilot|final[_ -]?review/i.test([q.id,q.header,q.question].join(' ')));
    if(!asksVisual)return next();
    let p;try{p=await this.project(s.activeProject,s.activeCwd);}catch{return next();}
    if(!p?.artifact?.render?.ok){
      if(p?.artifact||p?.builtOnce)return {kind:'deny',reason:'USER_PREVIEW_NOT_PRESENTED: 当前修改后没有有效预览，先重建、渲染并展示，不要求用户盲批。'};
      return next();
    }
    if(this.previewIsCurrent(s,p))return {kind:'deny',reason:'VISUAL_FEEDBACK_REQUIRES_TURN_BOUNDARY: 当前候选已经登记到present，但宿主可能在本轮结束后才显示文件卡。不要再弹阻塞确认框。完成本轮必要自查，在最终消息附当前PDF/PNG的宿主文件链接、说明改动，然后结束本轮，等待用户自然语言反馈；这不等于用户已接受。'};
    return {kind:'deny',reason:'USER_PREVIEW_NOT_PRESENTED: 先调用present展示当前PDF及困难页PNG，再问视觉/成品是否接受。read_image仅给模型，不给用户；展示失败则说明预览不可达，不要求盲批。当前PDF：'+(p.artifact.render.pdfPath??'无；请展示全部单页PNG')};
  }
  async after({name,args,cwd,exec,value}){
    const s=this.state(exec);if(!s)return value;
    if(value?.projectPath){s.activeProject=value.projectPath;s.activeCwd=cwd;}
    if(args.projectPath){const current=await this.project(args.projectPath,cwd);value=this.collaboration.after({name,args:{...args,projectPath:s.activeProject},exec,value,project:current});}
    if(name!=='academic_ppt_render'||value?.ok!==true)return value;
    if(args.publishPreview===false)return {...value,userPreview:{status:'not-presented',reason:'本次显式关闭自动展示；请求视觉确认前仍须present。'}};
    if(typeof this.ctx.tools?.execute!=='function')return {...value,userPreview:{status:'unavailable',reason:'宿主没有可调用的工具流水线；不能声称用户已看到预览。'}};
    // One native present call supports at most four files. PDF covers all pages;
    // two large body pages and an overview make the pending decision inspectable.
    const p=await this.project(args.projectPath,cwd),paths=value.pngPaths??[];
    const bodyIndices=p.slides.map((slide,i)=>({slide,i})).filter(({slide})=>!['cover','agenda','roadmap','section','closing','references'].includes(slide.layout)).map(({i})=>i);
    const priority=[p.storyboard?.pilot?.hardestSlideId,...(p.storyboard?.pilot?.sequenceSlideIds??[])].filter(Boolean);
    const chosen=[...new Set([...priority.map(id=>p.slides.findIndex(s=>s.id===id)).filter(i=>i>=0),...bodyIndices])].slice(0,2);
    const files=[
      ...(value.pdfPath?[{path:value.pdfPath,description:`候选预览 r${value.revision}（未获批准）：当前全稿PDF，可逐页查看`}]:[]),
      ...((value.contactSheetPaths??[]).slice(0,1).map(path=>({path,description:`候选预览 r${value.revision}：当前全稿缩略总览，仅用于节奏比较`}))),
      ...chosen.filter(i=>paths[i]).map(i=>({path:paths[i],description:`候选预览 r${value.revision}：第${i+1}页正文，等待实际审阅，并非最终交付`})),
    ].slice(0,4);
    if(!files.length)return {...value,userPreview:{status:'unavailable',reason:'没有可展示的当前渲染文件。'}};
    const nested=await this.ctx.tools.execute({name:'present',arguments:{files},callId:`academic-preview-${randomUUID()}`,rootCallId:exec.rootCallId??exec.callId,parent:exec.token,agent:exec.agent,signal:exec.signal});
    for(const c of nested.additionalContexts??[])exec.deferContext?.(c);
    // present is an accessibility event, never a user approval.
    if(nested.isError)return {...value,userPreview:{status:'unavailable',files,reason:text(nested.content).slice(0,900)||'present失败。'}};
    // Observer normally records it; direct adapters also use the same success condition.
    this.observe({name:'present',arguments:{files},callId:'academic-preview',agent:exec.agent},nested);
    this.collaboration.markPresented(exec,s.activeProject,p,undefined,this.presentedIdentity(s,p));
    value=this.collaboration.after({name,args:{...args,projectPath:s.activeProject},exec,value,project:p});
    return {...value,userPreview:{status:'presented',files,basis:'successful-host-present-not-human-open-or-approval',nextAction:'先完成必要自查；需要视觉反馈时在最终消息附文件链接并结束本轮，再等待用户自然语言回复。不要调用阻塞ask_user_question；文件卡可能仅在本轮结束后显示。'}};
  }
}
