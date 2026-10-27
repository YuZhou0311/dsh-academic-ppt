/** Recorded design dialogue and reference learning. This module plans questions;
 * it never asks the user, infers consent, or independently verifies a review. */
import { CARD_PRESET_IDS, getCardPreset } from './card-catalog.mjs';
import { PAGE_RECIPE_IDS } from './page-recipes.mjs';

const text=(maxLength=1800)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const en=values=>({type:'string',enum:values});
const arr=(items,maxItems,minItems=0)=>({type:'array',items,maxItems,minItems});
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const list=value=>Array.isArray(value)?value:[];
const meaningful=value=>typeof value==='string'&&value.trim().length>0;
const distinct=values=>[...new Set(values)];

export const DESIGN_TOPICS=Object.freeze(['density','storyline','palette','shape','language','texture','cover']);
export const consultationSchema=obj({
  mode:en(['collaborative','delegated']),delegation:text(2400),interaction:en(['checkpoints','topics']),
  decisions:arr(obj({topic:en(DESIGN_TOPICS),status:en(['proposed','confirmed','delegated']),
    recommendation:text(1600),options:arr(obj({id:text(100),label:text(200),rationale:text(1000)},['id','label','rationale']),3,2),
    selected:text(1800),userResponse:text(2400),rationale:text(1800),referencePaths:arr(text(3000),8,1),
  },['topic','status']),7),
},['mode']);

/** Apply an authoring default without upgrading a loaded legacy record. The
 * caller chooses the new-project default or the existing project's value. */
export function withConsultationInteraction(consultation,fallbackInteraction){
  const result=structuredClone(consultation??{mode:'collaborative'});
  if(result.interaction===undefined&&fallbackInteraction!==undefined)result.interaction=fallbackInteraction;
  return result;
}

const COMPONENT_SOURCES=['card-library','editorial','user-template'];
const COMPONENT_FIELDS=['source','referenceId','previewPath','frame','titleTreatment','spacing','adaptation'];
const EDITORIAL_IDS=new Set(Array.from({length:20},(_,i)=>'C'+String(i+1).padStart(2,'0')));
export const componentStudySchema=obj({
  source:en(COMPONENT_SOURCES),referenceId:text(500),previewPath:text(3000),
  frame:text(1800),titleTreatment:text(1600),spacing:text(1600),adaptation:text(2000),colorHierarchy:text(1600),
},COMPONENT_FIELDS);

export const referenceStudySchema=obj({
  status:en(['reviewed','not-applicable']),catalogIds:arr(text(100),CARD_PRESET_IDS.length,1),previewPaths:arr(text(3000),CARD_PRESET_IDS.length,1),
  pageRecipeIds:arr(text(100),32,1),templateReferences:arr(text(3000),8,1),
  observations:text(4000),selectedPresets:arr(text(100),CARD_PRESET_IDS.length),adaptations:arr(text(1400),16,1),reason:text(2400),
  componentStudies:arr(componentStudySchema,12,1),paletteRationale:text(2400),
},['status']);

const hasTemplatePage=record=>{
  const value=[record?.referenceId,record?.previewPath].filter(meaningful).join(' ');
  return /第\s*(?:0*[1-9]\d*|[一二三四五六七八九十百零〇两]+)\s*页|(?:^|[^\p{L}\p{N}])(?:slides?|pages?|p)\s*[.\s:_=#-]*0*[1-9]\d*(?!\d)/iu.test(value);
};

/** Check traceable identifiers and field coverage, never whether a person or
 * model really viewed the reference or made a good visual judgment. */
export function componentStudyIssues(study,{severity='error'}={}){
  const issues=[],add=(code,path,message,details={})=>issues.push({severity,code,path,message,...details});
  for(const [index,record] of list(study?.componentStudies).entries()){
    const path='design.referenceStudy.componentStudies.'+index;
    const missing=COMPONENT_FIELDS.filter(key=>!meaningful(record?.[key]));
    if(missing.length)add('component-reference-study-incomplete',path,'组件细读须逐项记录来源/预览、边框填充与实虚线/阴影、题签处理、间距和本稿具体改造或不采用原因：'+missing.join('、')+'。',{fields:missing});
    if(!COMPONENT_SOURCES.includes(record?.source))add('component-reference-unknown-source',path+'.source','组件来源仅支持 card-library、editorial 或 user-template。');
    else if(record.source==='card-library'&&!CARD_PRESET_IDS.includes(record.referenceId))add('component-reference-unknown-card',path+'.referenceId','卡片组件引用需来自原48款原生卡片的真实ID；查询academic_ppt_cards后查看对应预览，不编造目录名。');
    else if(record.source==='editorial'&&!EDITORIAL_IDS.has(record.referenceId))add('component-reference-unknown-editorial',path+'.referenceId','编辑式组件引用使用原20款中的精确编号 C01–C20，并保留实际查看的预览位置。');
    else if(record.source==='user-template'&&!hasTemplatePage(record))add('component-reference-template-page-missing',path+'.referenceId','用户模板组件须在referenceId或previewPath明确定位源页（第几页、slide N或page N）；adaptation中的本稿目标页及观察正文不能代替源页出处。');
  }
  return issues;
}

const option=(id,label,rationale)=>({id,label,rationale});
const TOPICS={
  density:{label:'信息密度',question:'主要用于现场讲述、答辩复读，还是会后阅读？',
    recommendation:'先根据观看场景确定密度；现场讲述优先可读图面和较大文字，关键条件仍在正文。',
    options:[option('talk','现场讲述','短句与较大字号，充分保留主图及必要比较条件。'),option('defense','答辩兼复读','图、机制、对照与条件并存，信息较充分。'),option('reading','阅读材料','保留更多细节，并用清楚分组支持自行阅读。')]},
  storyline:{label:'故事线',question:'希望听众沿哪条研究路线理解这次汇报？',
    recommendation:'先提出与本次材料对应的两条具体路线，说明每条路线怎样回答中心问题。',
    options:[option('question-evidence','问题与证据','围绕研究问题，比较方法与证据，最后说明边界。'),option('mechanism-comparison','机制与比较','先解释关键机制，再用共同条件比较结果。'),option('progress-decision','进展与下一步','从目标及新增证据进入失败诊断和下一步设计。')]},
  palette:{label:'配色',question:'哪组学术配色更适合本次材料和观看场景？',
    recommendation:'展示两到三组候选及其使用比例；已有多彩图表时优先减少页面装饰色，不按学科机械选色。',
    options:[option('graphite-blue','石墨与灰蓝','接近中性，适合原图色彩较多的页面。'),option('blue-slate','深蓝与石墨','清晰稳重，适合正式学术汇报。'),option('forest-stone','墨绿与暖灰','低饱和色系，依据实际原图选择。')]},
  shape:{label:'形态',question:'整体更偏圆润、干净利落，还是克制混合？',
    recommendation:'用卡片边角、细线和题签展示差异，图内科学信息保持完整。',
    options:[option('crisp','干净利落','小圆角或直角、细描边、清楚对齐。'),option('soft','温和圆润','柔和圆角与浅底，保留学术层级。'),option('mixed','克制混合','主证据利落，解释卡使用轻微圆角。')]},
  language:{label:'语言',question:'标题和解释更希望采用哪种学术表达？',
    recommendation:'采用具体、可核对的判断句，按听众背景选择术语密度，避免口号和重复长句。',
    options:[option('concise','精炼学术','短判断句和就近读图提示，讲稿承接细节。'),option('explanatory','解释型学术','对跨专业概念增加必要解释。'),option('technical','专业讨论','术语、方法条件和证据限定更充分。')]},
  texture:{label:'层次质感',question:'页面层次更倾向开放平面、浅底分组，还是轻微层次？',
    recommendation:'质感用于区分研究关系；只选必要的层次，不把阴影或大色块当信息。',
    options:[option('flat','开放平面','主要依靠留白、细线、字级建立层级。'),option('tinted','浅底分组','用克制浅底和描边组织图像与解释。'),option('subtle-depth','轻微层次','少量浮签或浅层次突出局部证据。')]},
  cover:{label:'封面',question:'看过实际封面候选后，希望采用哪种题名与信息组织？',
    recommendation:'根据已经确认的密度、配色与形态制作两个真实候选，展示后再确认；已指定封面或明确委托时沿用。',
    options:[option('title-led','题名主导','用语义断行、对齐和真实身份建立层级。'),option('research-led','研究视觉','仅在有识别价值的真实研究图时与题名组合。')]},
};
const STAGES=[{id:'content',topics:['density','storyline']},{id:'visual-style',topics:['palette','shape']},
  {id:'expression',topics:['language','texture']},{id:'cover',topics:['cover']}];

function resolved(decision){return decision&&['confirmed','delegated'].includes(decision.status)&&
  meaningful(decision.selected)&&meaningful(decision.userResponse);}

/** Send actionable choices to design helpers, not the raw conversation. */
export function resolvedDesignPreferences(consultation){
  return list(consultation?.decisions).filter(resolved).map(({topic,selected,rationale})=>
    ({topic,selected,...(meaningful(rationale)?{rationale}:{})}));
}

export function designDecisionResolved(consultation,topic){
  return Boolean(consultation?.mode==='delegated'&&meaningful(consultation.delegation)||
    resolved(list(consultation?.decisions).find(decision=>decision.topic===topic)));
}

/** Questions are proposals, not proof that a host has displayed them. */
export function designDialoguePlan(consultation={mode:'collaborative'}){
  const records=list(consultation.decisions),byTopic=new Map(records.map(d=>[d.topic,d]));
  const delegated=consultation.mode==='delegated'&&meaningful(consultation.delegation);
  const pendingTopics=delegated?[]:DESIGN_TOPICS.filter(topic=>!resolved(byTopic.get(topic)));
  const stage=STAGES.find(s=>s.topics.some(topic=>pendingTopics.includes(topic)));
  let questions=(stage?.topics||[]).filter(topic=>pendingTopics.includes(topic)).map(topic=>{
    const record=byTopic.get(topic),defaults=TOPICS[topic];
    return {id:'design_'+topic,topic,label:defaults.label,text:defaults.question,
      recommendation:record?.recommendation||defaults.recommendation,
      options:record?.options||defaults.options,...(record?.referencePaths?{referencePaths:record.referencePaths}:{})};
  });
  let stageId=stage?.id||'ready';
  if(consultation.interaction==='checkpoints'&&pendingTopics.length){
    const storyTopics=['density','storyline','language'].filter(topic=>pendingTopics.includes(topic));
    stageId=storyTopics.length?'story':'pilot-direction';
    questions=storyTopics.length?[{id:'design_story',topic:'storyline',topics:storyTopics,label:'故事线与使用场景',
      text:'结合听众和时长，这份汇报更适合沿哪条研究问题路线展开？',
      recommendation:'展示已填入真实材料的问题路线、核心证据与必须保留的条件，并说明推荐。将使用场景、语言深度与路线一起确认；已有答案直接沿用。',
      options:TOPICS.storyline.options}]:[{id:'design_pilot_direction',topic:'cover',topics:pendingTopics,label:'真实样张的整体方向',
      text:'看过封面、困难正文和连续三页后，哪套完整方向更合适？',
      recommendation:'先展示同样科学内容的真实候选再问，把配色、形态、层次、封面放在完整方案里比较；不要逐项问审美术语。',
      options:[option('evidence-editorial','开放图证','大图与近邻解释，克制色块和清晰的学术字级。'),option('formal-defense','正式答辩','稳定章节导航，实验/任务关系与比较条件更充分。'),option('light-report','清晰短讲','聚焦主证据和关键边界，讲稿承接次要细节。')]}];
  }
  return {mode:consultation.mode||'collaborative',interaction:consultation.interaction||'topics',stage:stageId,pendingTopics,
    resolvedTopics:DESIGN_TOPICS.filter(topic=>!pendingTopics.includes(topic)),questions,
    readyForFinalDesign:pendingTopics.length===0,
    nextAction:pendingTopics.length?'ask-design-questions':'continue-reference-learning',
    instructions:pendingTopics.length?[
      '本轮只提出返回的相关问题，并给出结合当前内容的推荐。选项是提议，不代表已经问过或用户同意。',
      '等待用户回答后记录selected、原话userResponse及适配理由。已给的偏好直接复用；明确委托才用delegated，不把刚发出的提问当成无回复。',
      '等待期间可继续来源核对、取图和可撤销候选；批量排版与正式交付应以协商结果为依据。',
      ...(consultation.interaction==='checkpoints'?['一次成套方案选择可以落实多个topics，把同一真实回答映射到各字段的具体选择；不得增加七次逐项问答，也不能自动替用户确认。']:[]),
    ]:['保留已确认选择与真实委托依据，继续研究、实际参考学习和逐页设计；不重复追问同一决定。'],
    basis:'proposed-questions-and-caller-recorded-responses-not-independent-user-confirmation'};
}

/** Keep discussion separate from science requirements; delegation never relaxes
 * source, image, typography, or actual-render review gates. */
export function designDialogueReport(project){
  const consultation=project.design?.consultation,study=project.design?.referenceStudy;
  const legacy=!consultation,slides=list(project.slides),issues=[];
  const plannedPages=list(project.storyboard?.pages).length;
  const componentLearningRequired=consultation?.interaction==='checkpoints'&&Math.max(slides.length,plannedPages)>=6;
  const componentSeverity=componentLearningRequired?'error':'warning';
  const plan=legacy?{mode:'legacy',stage:'legacy',pendingTopics:[],resolvedTopics:[],questions:[],readyForFinalDesign:true,
    nextAction:'review-existing-preferences',instructions:['旧工程继续可读；整稿重新设计时按当前用户意向补充协商记录，局部修改不强制重问全部偏好。']}:designDialoguePlan(consultation);
  const add=(code,path,message,details={},severity=legacy?'warning':'error')=>issues.push({severity,code,path,message,...details});
  if(legacy&&slides.length)add('design-dialogue-legacy','design.consultation','此旧工程没有分阶段设计协商记录；保留已知偏好，重新设计整稿时补齐，局部修改不必重走全流程。');
  if(consultation){
    const records=list(consultation.decisions),topics=records.map(d=>d.topic);
    if(new Set(topics).size!==topics.length)add('design-dialogue-duplicate-topic','design.consultation.decisions','每个设计主题只保留当前一次决定，不能同时记录互相冲突的选择。');
    if(consultation.mode==='delegated'&&!meaningful(consultation.delegation))add('design-delegation-missing','design.consultation.delegation','整体委托需要保留用户明确授权自行决定的原话或等价具体依据。');
    for(const [i,decision] of records.entries())if(['confirmed','delegated'].includes(decision.status)&&!resolved(decision))
      add('design-response-record-incomplete',`design.consultation.decisions.${i}`,'已确认或已委托的决定需要selected和真实userResponse，不能把推荐选项自动当成用户选择。',{topic:decision.topic});
    if(slides.length&&plan.pendingTopics.length)add('design-dialogue-pending','design.consultation',
      '尚有设计主题未确认或明确委托：'+plan.pendingTopics.map(t=>TOPICS[t].label).join('、')+'。按本轮问题取得反馈；研究与候选可继续，正式构建暂缓。',{pendingTopics:plan.pendingTopics});
  }
  const cards=slides.flatMap(s=>list(s.cards));
  const usedPresets=distinct(cards.map(c=>c.preset).filter(Boolean));
  const imageCards=cards.filter(c=>list(c.figureIds).length);
  const componentStudies=list(study?.componentStudies);
  const referenceStudy={status:study?.status||'missing',usedPresets,pageRecipeIds:list(study?.pageRecipeIds),imageCardCount:imageCards.length,
    imagePresetIds:usedPresets.filter(id=>getCardPreset(id)?.family==='figure'),componentLearningRequired,
    componentStudyCount:componentStudies.length,componentSources:distinct(componentStudies.map(record=>record.source)),
    paletteRationaleRecorded:meaningful(study?.paletteRationale)};
  if(!study){
    if(!legacy&&(slides.length||componentLearningRequired))add('card-reference-study-required','design.referenceStudy',
      '先看原48款卡片与20款编辑式参考中适合本稿的实际候选，并细读已提供模板的代表组件。记录边框/填充/虚线/阴影、题签、间距与本稿改造，再自主设计；不用preset或卡片也不能用整页语法ID替代组件学习。');
    if(componentLearningRequired)add('component-reference-study-required','design.referenceStudy.componentStudies','计划或实际达到六页的新checkpoints整稿，在困难样张阶段就需可定位的组件细读记录和配色理由；不要等整稿完成后反填。');
    else if(legacy&&slides.length)add('component-reference-legacy','design.referenceStudy.componentStudies','旧工程未保存组件细读记录；本次局部编辑继续兼容。整稿重设计时补充实际查看的组件、细节与配色依据。',{},'warning');
  }else if(study.status==='reviewed'){
    const missing=[];
    if(!meaningful(study.observations)&&!componentStudies.length)missing.push('observations');
    if(!list(study.previewPaths).length&&!componentStudies.some(record=>meaningful(record.previewPath)))missing.push('previewPaths');
    if(!list(study.adaptations).length&&!componentStudies.some(record=>meaningful(record.adaptation)))missing.push('adaptations');
    if(!list(study.catalogIds).length&&!list(study.pageRecipeIds).length&&!list(study.templateReferences).length&&!componentStudies.length)missing.push('catalogIds/pageRecipeIds/templateReferences/componentStudies');
    if(missing.length)add('card-reference-study-incomplete','design.referenceStudy','参考学习缺少实际目录、预览观察或内容适配记录：'+missing.join('、')+'。');
    if(!componentStudies.length)add(componentLearningRequired?'component-reference-study-required':'component-reference-legacy','design.referenceStudy.componentStudies',
      componentLearningRequired?'完整新稿需componentStudies记录具体组件的frame、titleTreatment、spacing和adaptation；只填pageRecipeIds、笼统观察或“不用preset”不能替代。可采用已细读用户模板，不要求额外目录打卡或使用卡片。':'旧记录没有逐组件细读字段，本次兼容继续；整稿重设计时补充真实预览、边框/题签/间距观察与本稿改造。',{},componentSeverity);
    if(!meaningful(study.paletteRationale))add('reference-palette-rationale-missing','design.referenceStudy.paletteRationale','记录本稿配色理由：文字/底色对比、主辅层级、与原图颜色的关系及已确定色义；模板配色不自动成为固定要求。',{},componentSeverity);
    issues.push(...componentStudyIssues(study,{severity:legacy?'warning':'error'}));
    const unknown=distinct([...list(study.catalogIds),...list(study.selectedPresets)]).filter(id=>!CARD_PRESET_IDS.includes(id));
    if(unknown.length)add('card-reference-unknown-preset','design.referenceStudy','目录/选中配方需来自实际卡片索引，未知ID：'+unknown.join('、')+'。');
    const unknownPages=distinct(list(study.pageRecipeIds)).filter(id=>!PAGE_RECIPE_IDS.includes(id));
    if(unknownPages.length)add('page-reference-unknown-recipe','design.referenceStudy.pageRecipeIds','整页语法需来自实际layouts目录，未知ID：'+unknownPages.join('、')+'。自定义构图可根据已查看的参考说明改造，不编造目录ID。');
    const inspectedCards=new Set([...list(study.catalogIds),...componentStudies.filter(record=>record.source==='card-library').map(record=>record.referenceId)]);
    const uninspected=list(study.selectedPresets).filter(id=>!inspectedCards.has(id));
    if(uninspected.length)add('card-reference-selection-unreviewed','design.referenceStudy','选中配方尚无已查看的catalogIds或同ID的card-library组件细读；先查看实际预览再记录选择。',{presetIds:uninspected});
    const unreviewedUsed=usedPresets.filter(id=>!inspectedCards.has(id));
    if(unreviewedUsed.length)add('card-reference-used-unreviewed','design.referenceStudy','实际使用的原生配方尚无已查看的catalogIds或同ID的card-library组件细读；查看对应预览并记录内容适配。用drawings重组仍不必采用预设。',{presetIds:unreviewedUsed});
    const unused=list(study.selectedPresets).filter(id=>!usedPresets.includes(id));
    if(slides.length&&unused.length)add('card-reference-adaptation-review','design.referenceStudy',
      '部分选中配方未以原生preset出现；核对是否已按记录改造成实际drawings，还是参考选择尚未落实。数量不作为强制卡片配额。',{presetIds:unused},'warning');
  }else if(study.status==='not-applicable'){
    if(componentLearningRequired)add('reference-study-exception-full-redesign','design.referenceStudy','not-applicable只适用于明确范围的局部修改或科学图直接排版；六页及以上的新checkpoints整稿即使全用drawings，也须先记录真实组件细读与配色理由，不能借此省略学习。');
    if(!meaningful(study.reason)||study.reason.trim().length<18)add('card-reference-exception-too-thin','design.referenceStudy.reason','限定本次局部修改的页/对象或科学图直接排版范围，说明实际载体和不适用原因；“自由设计”“没有preset”不能代替具体范围。');
    if(cards.length)add('card-reference-exception-conflict','design.referenceStudy','当前页面实际使用卡片，请完成与这些卡片相关的参考学习，不能同时声明卡片不适用。');
  }
  return {...plan,referenceStudy,summary:{pendingTopics:plan.pendingTopics.length,confirmedTopics:plan.resolvedTopics.length,
    nativeCardCount:cards.length,imageCardCount:imageCards.length,usedPresetCount:usedPresets.length,componentStudyCount:componentStudies.length,blockingIssues:issues.filter(i=>i.severity==='error').length},issues,
    limits:'这些字段是可审查的会话与看图记录；插件不会替用户确认，不独立验证聊天原话、参考图观察或审美质量。'};
}
