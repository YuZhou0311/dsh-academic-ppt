/** Release readiness is separate from export success. These checks establish
 * provenance and recorded review coverage, never an automated aesthetic grade. */
export function deliveryReadiness(project,checked,storyboard){
  const blockers=[],add=(code,message,action,slideIds=[])=>blockers.push({code,message,action,slideIds});
  const errors=(checked.issues??[]).filter(i=>i.severity==='error');
  if(errors.length)add('static-errors',`仍有 ${errors.length} 个证据/内容/几何错误。`,'按 issues 修复对应页面或资料缺口，保留原要求；重新 build(review)。',[...new Set(errors.map(i=>i.slideId).filter(Boolean))]);
  if(!checked.artifact?.current)add('current-build-required','当前工程没有一致、未被外部修改的构建。','生成当前版本，再实际渲染。');
  else if(project.artifact?.mode!=='review')add('draft-not-deliverable','当前文件是草稿，不能作为最终学术汇报交付。','修复阻断项后使用 build(mode=review)，不得重命名草稿冒充正式稿。');
  if(checked.render?.status!=='rendered')add('actual-render-required','尚无当前 PPTX 的有效真实渲染。','调用 render；引擎不可用时明确当前只能提供未验收预览，不能登记通过。');
  if(checked.render?.missingFonts?.length)add('missing-fonts','实际渲染缺少字体：'+checked.render.missingFonts.join('、'),'配置所需字体并重渲染，再查看所有当前页面。');
  const reviews=(project.visualReviews??[]).filter(r=>checked.artifact?.current&&r.pptxSha256===checked.artifact.pptxSha256&&r.basis==='pptx-render');
  const pending=[],needsFix=[];
  for(const slide of project.slides??[]){
    const review=reviews.findLast(r=>r.reviewedSlides?.includes(slide.id));
    if(!review)pending.push(slide.id);else if(review.result!=='passed')needsFix.push(slide.id);
  }
  if(needsFix.length)add('unresolved-visual-issues','当前版本仍有 needs-fix 页面。','默认继续修复、重建、重渲染并复核；不要把“是否继续修 v2”当作完成。',needsFix);
  if(pending.length)add('visual-review-incomplete','当前最终画面尚未逐页完成实际视觉检查。','查看缺少审查的实际 PPTX 页面并提交对应 observations。',pending);
  if(storyboard?.required&&!storyboard.present)add('storyboard-required','六页及以上整稿需要明确故事板与代表样张。','用 plan 登记实际论证路线，审阅封面、困难页和连续三页。');
  if(storyboard?.present&&!storyboard.ready)add('storyboard-unfinished','故事板取舍、计划兑现或样张复核仍未完成。','处理 storyboard.issues 与 pilot 状态；已委托的决定自主完成，不重复请求授权。');
  if(project.brief?.qualityProfile!=='academic')add('academic-profile-required','当前工程未启用学术质量检查。','保留研究要求，迁移到 academic 质量档案后检查。');
  return {readyForDelivery:blockers.length===0,status:blockers.length?'blocked':'ready',blockers,
    nextActions:blockers.slice(0,4).map(b=>b.action),
    limits:'通过表示当前文件、计划与具名视觉审查一致；科学结论及审美仍依赖真实来源阅读和实际看图，不是自动质量保证。'};
}

/** Resolve the next concrete repair first, rather than printing a checklist
 * whose early warnings hide later blocking errors. */
export function repairQueue(issues){
  const groups=new Map();
  const category=code=>/overflow|overlap|font|geometry|clipp|readability|label|projection/.test(code)?'legibility':/storyboard|narrative/.test(code)?'story':/dialogue|reference-study/.test(code)?'direction':/source|paper|claim|evidence|figure|asset/.test(code)?'evidence':'content';
  for(const issue of [...issues].sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1))){
    const key=(issue.slideId??issue.path??'project')+'|'+category(issue.code??'');
    if(!groups.has(key))groups.set(key,{target:issue.slideId??issue.path??'project',category:category(issue.code??''),severity:issue.severity,codes:[],messages:[]});
    const row=groups.get(key);if(!row.codes.includes(issue.code)){row.codes.push(issue.code);row.messages.push(issue.message);}
  }
  return [...groups.values()];
}
