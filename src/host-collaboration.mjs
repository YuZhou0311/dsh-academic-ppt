/** Live, session-local human response receipts. Never reads credentials, old
 * sessions, or arbitrary user files. A quoted answer is evidence of a message,
 * not a reliable automatic interpretation of its meaning. UI approval remains
 * distinct from model image review. CLI has no such proof and does not pretend.
 */
import {readBounded,safePath,stable,hash} from './io.mjs';
import {designSourceResolved,designDecisionResolved} from './design-dialogue.mjs';
import {pilotFingerprint,pilotSlideIds} from './storyboard.mjs';

const text=blocks=>Array.isArray(blocks)?blocks.filter(b=>b.type==='text').map(b=>b.text??'').join('\n'):'';
const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/gu,'').trim();
const accepted=r=>r&&['confirmed','delegated'].includes(r.status);
const badApproval=/(不满意|不可以|不行|不好|不接受|不要扩稿|别扩稿|不通过|未通过|没达到|没有达到|差距|重做|不要继续|先停|待修改|需要修改|revise|reject|not\s+approv)/i;
const scopeTerms={source:/设计|模板|参考|原创|design|template|source/i,storyline:/故事|主线|内容|路线|story|narrative|outline/i,
 'pilot-review':/样张|样稿|试作|预览|pilot|prototype|preview/i,'final-review':/最终|成品|交付|final|deliver/i};
const delegates=/(自行|自主|全权|委托|你来决定|由你决定|不用问|无需确认|不必确认|不需要确认|不必.*确认|delegate|autonom|decide|without.*approv|no.*confirm)/i;
const explicitSkip=/(不用|无需|不必|不需要|免于).{0,12}(确认|审阅|审查|反馈|问)|委托.{0,15}(审查|验收)|(?:skip|without|no).{0,20}(approval|confirm|review)|delegate.{0,20}review/i;
const allStages=/(全程|所有阶段|所有节点).{0,15}(不.*问|不.*确认|自行.*审)|all stages.{0,30}(without|no).{0,10}(approval|confirm)/i;

export class HostCollaboration {
 #states=new WeakMap();
 state(session){if(!session||typeof session!=='object')return null;
  if(!this.#states.has(session))this.#states.set(session,{clock:0,answers:[],projects:new Map()});return this.#states.get(session);}
 observeSession(session,event){
  const s=this.state(session);if(!s)return;s.clock++;
  // dsh user-role context may be produced by a tool, skill or subagent. Only
  // actual user-origin messages count; never accept a relay as consent.
  if(event?.type!=='user/message'||event.data?.source?.kind!=='user')return;
  const value=text(event.data.content);if(!value.trim())return;
  s.answers.push({text:value.slice(0,24000),clock:s.clock,source:'user/message',id:event.data.id??String(event.seq)});
  s.answers=s.answers.slice(-40);
 }
 observeQuestion(exec,result){
  if(exec?.name!=='ask_user_question'||result?.isError!==false)return;
  const s=this.state(exec.agent?.session);if(!s)return;
  for(const a of result.value?.answers??[]){
   const values=[...(Array.isArray(a.selected)?a.selected:[]),...(Array.isArray(a.selectedOptions)?a.selectedOptions:[]),a.text,a.answer,a.custom].filter(x=>typeof x==='string'&&x.trim());
   if(values.length)s.answers.push({text:values.join('；'),clock:++s.clock,source:'ask_user_question',id:a.id??exec.callId});
  }
  s.answers=s.answers.slice(-40);
 }
 findAnswer(s,quote,{after=-1,approval=false,delegationTopic}={}){
  const q=norm(quote);if(!q)throw Error('HUMAN_RESPONSE_REQUIRED: 保存真实回答的原文片段，不用模型总结代替。');
  const answer=s.answers.findLast(a=>a.clock>after&&norm(a.text).includes(q));
  if(!answer)throw Error('HUMAN_RESPONSE_NOT_OBSERVED: 本会话未收到对应的真实用户原话或问答工具成功回答。尚未问就先询问；已展示预览则结束本轮等待，不能自填confirmed/delegated。重启后收据不继承，请用一次简短复核恢复范围。');
  if(approval&&s.answers.findLast(a=>a.clock>after)!==answer)throw Error('SUPERSEDED_USER_RESPONSE: 此后已有新的用户反馈，不能继续引用更早的认可；请按当前回答处理。');
  if(approval&&!/(认可|接受|同意|通过|可以|继续|采用|保留|满意|没问题|yes|ok|approve|accept|good|proceed)/i.test(answer.text))throw Error('EXPLICIT_APPROVAL_REQUIRED: 这条消息不是明确的样张/成品认可，请按真实反馈处理，不自行推定。');
  if(approval&&badApproval.test(answer.text))throw Error('USER_REQUESTED_REVISION: 回答包含否定或修改意见，不能整体登记为已认可。保留局部选择，修改后再展示。');
  if(delegationTopic){
   if(!delegates.test(answer.text))throw Error('EXPLICIT_DELEGATION_REQUIRED: 制作请求或普通“继续”不构成委托。');
   if(['pilot-review','final-review'].includes(delegationTopic)&&!allStages.test(answer.text)&&!(scopeTerms[delegationTopic].test(answer.text)&&explicitSkip.test(answer.text)))
    throw Error('APPROVAL_SCOPE_REQUIRED: 自主选配色/构图/故事线，不等于免除样张或最终审查。需要明确覆盖该审查阶段的真实授权。');
  }
  return answer;
 }
 async read(path,cwd){return JSON.parse((await readBounded(await safePath(cwd,path,{mustExist:true}),1024*1024)).toString('utf8'));}
 track(s,path,p){if(!s.projects.has(path))s.projects.set(path,{shown:null,accepted:null});return s.projects.get(path);}
 validateConsultation(s,c,old={}){
  if(!c)return;
  if(c.mode==='delegated'&&(c.delegation!==old.delegation||stable(c.delegationTopics??[])!==stable(old.delegationTopics??[]))){
   for(const topic of c.delegationTopics??[])this.findAnswer(s,c.delegation,{delegationTopic:topic});
  }
  const records=[['source',c.source,old.source],...(c.decisions??[]).map(r=>[r.topic,r,(old.decisions??[]).find(x=>x.topic===r.topic)])];
  for(const [topic,r,prev]of records)if(accepted(r)&&stable(r)!==stable(prev??null))
   this.findAnswer(s,r.userResponse,{delegationTopic:r.status==='delegated'?topic:undefined});
 }
 async before({name,args,cwd,exec,project,previewIsCurrent}){
  const s=this.state(exec?.agent?.session);if(!s)return;
  if(name==='academic_ppt_init'){this.validateConsultation(s,args.design?.consultation);return;}
  if(!args.projectPath||!project)return;
  const tracked=this.track(s,args.projectPath,project),consultation=project.design?.consultation??{};
  const guided=consultation.workflowVersion===2;
  if(!guided)return;
  let batch,request;
  if(name==='academic_ppt_record'){
   batch=args.recordsPath?await this.read(args.recordsPath,cwd):args;
   this.validateConsultation(s,batch.design?.consultation,consultation);
   const final=batch.design?.consultation?.finalReview;
   if(accepted(final)&&stable(final)!==stable(consultation.finalReview??null)){
    if(final.status==='delegated')this.findAnswer(s,final.userResponse,{delegationTopic:'final-review'});
    else{if(!previewIsCurrent||!tracked.shown)throw Error('USER_PREVIEW_NOT_PRESENTED: 先展示当前成品。');this.findAnswer(s,final.userResponse,{after:tracked.shown.clock,approval:true});}
   }
  }
  if(name==='academic_ppt_plan'&&args.requestPath){
   request=await this.read(args.requestPath,cwd);
   if(request.kind==='storyboard'&&accepted(request.storyboard?.decision))this.findAnswer(s,request.storyboard.decision.userResponse,{delegationTopic:request.storyboard.decision.status==='delegated'?'storyline':undefined});
   if(request.kind==='pilot-review'){
    if(!previewIsCurrent||!tracked.shown)throw Error('USER_PREVIEW_NOT_PRESENTED: 样张确认必须先展示当前PDF或全部PNG。');
    if(request.decision==='delegated')this.findAnswer(s,request.userResponse,{delegationTopic:'pilot-review'});
    else this.findAnswer(s,request.userResponse,{after:tracked.shown.clock,approval:true});
   }
  }
  const incoming=['compose-page','compose-opening'].includes(request?.kind)?[request.slide]:batch?.slides??[];
  if(incoming.length){
   const missing=['source','storyline'].filter(topic=>topic==='source'?!designSourceResolved(consultation):!designDecisionResolved(consultation,topic));
   if(missing.length)throw Error('BRIEF_CHECKPOINT_REQUIRED: 排页前先用一条消息对齐设计来源与主线（已有用户明确要求直接引用，不重问）。待决：'+missing.join(', ')+'。可以继续核对材料，不能先排完再补确认。');
   const existing=new Set((project.slides??[]).map(x=>x.id)),additions=incoming.filter(x=>!existing.has(x.id));
   const acceptedPilot=this.pilotAccepted(s,tracked,project);
   if(additions.length&&!acceptedPilot){
    if(tracked.shown)throw Error('PILOT_FEEDBACK_PENDING: 已展示样张，但未收到并登记本次真实认可。此时结束本轮等用户反馈；允许修订已有页，不允许扩稿。设计委托不免除样张反馈。');
    const ids=pilotSlideIds(project.storyboard);
    if(ids.length&&additions.some(x=>!ids.includes(x.id)))throw Error('PILOT_SCOPE_REQUIRED: 先完成指定的困难样张，不添加非样张页面。');
    if(!ids.length&&existing.size+additions.length>3)throw Error('PILOT_SCOPE_REQUIRED: 尚未指定/认可样张，先完成至多三页正文候选并展示；封面和书目不能替代困难正文。这不是成稿页数上限。');
   }
  }
 }
 pilotAccepted(s,tracked,p){
  const a=tracked.accepted;if(!a)return false;
  if(s.answers.some(reply=>reply.clock>a.clock&&badApproval.test(reply.text)))return false;
  return a.fingerprint===pilotFingerprint(p,{slideIds:a.slideIds});
 }
 markPresented(exec,path,p,clock,previewIdentity){const s=this.state(exec?.agent?.session);if(!s)return;
  const t=this.track(s,path,p),identity=previewIdentity??p.artifact?.pptxSha256??p.artifact?.files?.pptx?.sha256??hash(stable(p.artifact?.render?.pngPaths??[]));
  if(t.shown?.identity===identity)return; // Re-presenting the same bytes must not erase a later answer.
  t.shown={identity,clock:clock??s.clock};
 }
 after({name,args,exec,value,project}){
  const s=this.state(exec?.agent?.session);if(!s||!args.projectPath||!project)return value;
  const t=this.track(s,args.projectPath,project);
  if(name==='academic_ppt_plan'&&value?.pilotReview){
   const slideIds=value.pilotReview.slideIds??(project.storyboard?.pilot?pilotSlideIds(project.storyboard):(project.slides??[]).map(s=>s.id));
   t.accepted={slideIds:[...slideIds],fingerprint:pilotFingerprint(project,{slideIds}),clock:s.clock};
  }
  const pending=t.shown&&!this.pilotAccepted(s,t,project);
  return {...value,collaboration:{stage:pending?'awaiting-pilot-feedback':'working',mustStopForFeedback:!!pending,
   nextAction:pending?'本轮仅完成现有页自查，附当前文件链接并结束，等用户自然语言反馈；不要扩稿或自填批准。':'先明确来源和主线；已有明确要求直接沿用。设计自主选择不包含免除样张认可。',
   evidence:'live-user-origin-messages-and-successful-question-answers; not an aesthetic judgment'}};
 }
}
