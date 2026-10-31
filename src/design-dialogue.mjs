/** Recorded design dialogue and reference learning. This module plans questions;
 * it never asks the user, infers consent, or independently verifies a review. */
import { CARD_PRESET_IDS, getCardPreset } from './card-catalog.mjs';
import { PAGE_RECIPE_IDS } from './page-recipes.mjs';
import { ACADEMIC_STYLE_IDS } from './academic-styles.mjs';

const text=(maxLength=1800)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const en=values=>({type:'string',enum:values});
const arr=(items,maxItems,minItems=0)=>({type:'array',items,maxItems,minItems});
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const list=value=>Array.isArray(value)?value:[];
const meaningful=value=>typeof value==='string'&&value.trim().length>0;
const distinct=values=>[...new Set(values)];

export const DESIGN_TOPICS=Object.freeze(['density','storyline','palette','shape','language','texture','cover']);
export const GUIDED_DESIGN_TOPICS=Object.freeze([...DESIGN_TOPICS,'layout']);
export const DELEGATION_TOPICS=Object.freeze([...GUIDED_DESIGN_TOPICS,'source','final-review']);
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
export const consultationSchema=obj({
  mode:en(['collaborative','delegated']),delegation:text(2400),interaction:en(['checkpoints','topics']),
  workflowVersion:{type:'integer',const:2},delegationTopics:{...arr(en(DELEGATION_TOPICS),DELEGATION_TOPICS.length,1),uniqueItems:true},
  source:obj({status:en(['proposed','confirmed','delegated','awaiting-upload']),
    mode:en(['content-led','reference-guided','template-faithful']),userResponse:text(2400),templatePaths:arr(text(3000),4,1),
  },['status']),
  finalReview:obj({status:en(['proposed','confirmed','delegated']),userResponse:text(2400),pptxSha256:digest,renderReceiptSha256:digest,notes:text(2400)},['status']),
  decisions:arr(obj({topic:en(GUIDED_DESIGN_TOPICS),status:en(['proposed','confirmed','delegated']),
    recommendation:text(1600),options:arr(obj({id:text(100),label:text(200),rationale:text(1000)},['id','label','rationale']),3,2),
    selected:text(1800),userResponse:text(2400),rationale:text(1800),referencePaths:arr(text(3000),8,1),
  },['topic','status']),GUIDED_DESIGN_TOPICS.length),
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

const DESIGN_STUDY_SOURCES=['page-recipe','academic-style','user-template','scientific-reference'];
const DESIGN_STUDY_FIELDS=['source','referenceId','previewPath','readingOrder','evidenceHierarchy','adaptation'];
export const designStudySchema=obj({
  source:en(DESIGN_STUDY_SOURCES),referenceId:text(3000),previewPath:text(3000),
  readingOrder:text(1800),evidenceHierarchy:text(1800),adaptation:text(2000),typography:text(1600),grouping:text(1600),
},DESIGN_STUDY_FIELDS);

export const referenceStudySchema=obj({
  status:en(['reviewed','not-applicable']),catalogIds:arr(text(100),CARD_PRESET_IDS.length,1),previewPaths:arr(text(3000),CARD_PRESET_IDS.length,1),
  pageRecipeIds:arr(text(100),32,1),templateReferences:arr(text(3000),8,1),
  observations:text(4000),selectedPresets:arr(text(100),CARD_PRESET_IDS.length),adaptations:arr(text(1400),16,1),reason:text(2400),
  componentStudies:arr(componentStudySchema,12,1),designStudies:arr(designStudySchema,12,1),paletteRationale:text(2400),
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

/** Whole-page research is a first-class alternative to studying card frames.
 * Identifier checks establish traceability only, never visual understanding.
 */
export function designStudyIssues(study,{severity='error'}={}){
  const issues=[],add=(code,path,message)=>issues.push({severity,code,path,message});
  for(const [index,record]of list(study?.designStudies).entries()){
    const path='design.referenceStudy.designStudies.'+index;
    const missing=DESIGN_STUDY_FIELDS.filter(key=>!meaningful(record?.[key]));
    if(missing.length)add('design-reference-study-incomplete',path,'设计细读需要真实来源与预览、阅读顺序、证据层级和本稿适配：'+missing.join('、')+'。');
    if(!DESIGN_STUDY_SOURCES.includes(record?.source))add('design-reference-unknown-source',path+'.source','使用整页语法、学术风格、用户模板或公开科学演示作为可定位参考。');
    else if(record.source==='page-recipe'&&!PAGE_RECIPE_IDS.includes(record.referenceId))add('design-reference-unknown-page',path+'.referenceId','page-recipe须使用layouts目录中的真实ID，并查看对应页面。');
    else if(record.source==='academic-style'&&!ACADEMIC_STYLE_IDS.includes(record.referenceId))add('design-reference-unknown-style',path+'.referenceId','academic-style须使用contract(design).academicStyles中的真实ID，并查看该方向的实际样张。');
    else if(record.source==='user-template'&&!hasTemplatePage(record))add('design-reference-template-page-missing',path+'.referenceId','用户模板须定位实际源页，如slide 3或第3页；本稿目标页不能代替出处。');
    else if(record.source==='scientific-reference'&&!/^https?:\/\/\S+/i.test(record.referenceId||''))add('design-reference-url-missing',path+'.referenceId','公开科学参考的referenceId须含实际来源URL；previewPath定位实际查看的页面或图片。');
  }
  return issues;
}

const option=(id,label,rationale)=>({id,label,rationale});
const TOPICS={
  source:{label:'设计来源',question:'这次按插件默认方式原创设计，还是使用你提供的 PPT 模板？',
    recommendation:'默认可以用插件的学术设计语法原创；有参考模板时先实际阅读，并区分学习其视觉语言与明确保留原版式。用户没有回答前不替其选定。',
    options:[option('content-led','插件默认原创','围绕本次证据和故事线设计，展示样张后共同调整。'),option('reference-guided','提供模板供参考','读取模板的颜色、层级和组件语法，再按本次内容重新组织。'),option('template-faithful','按指定模板套用','按用户明确指定的版式和品牌约束适配内容，并处理尺寸、留白和溢出。')]},
  density:{label:'信息密度',question:'主要用于现场讲述、答辩复读，还是会后阅读？',
    recommendation:'先根据观看场景确定密度；现场讲述优先可读图面和较大文字，关键条件仍在正文。',
    options:[option('talk','现场讲述','短句与较大字号，充分保留主图及必要比较条件。'),option('defense','答辩兼复读','图、机制、对照与条件并存，信息较充分。'),option('reading','阅读材料','保留更多细节，并用清楚分组支持自行阅读。')]},
  storyline:{label:'故事线',question:'希望听众沿哪条研究路线理解这次汇报？',
    recommendation:'先提出与本次材料对应的两条具体路线，说明每条路线怎样回答中心问题。',
    options:[option('question-evidence','问题与证据','围绕研究问题，比较方法与证据，最后说明边界。'),option('mechanism-comparison','机制与比较','先解释关键机制，再用共同条件比较结果。'),option('progress-decision','进展与下一步','从目标及新增证据进入失败诊断和下一步设计。')]},
  palette:{label:'配色',question:'哪组学术配色更适合本次材料和观看场景？',
    recommendation:'在真实样张中展示深色标题/主结构、局部实色与浅底的比例；已有多彩图表时减少无关装饰色，不把学术感等同于全页浅灰浅蓝。',
    options:[option('graphite-blue','石墨与灰蓝','接近中性，适合原图色彩较多的页面。'),option('blue-slate','深蓝与石墨','清晰稳重，适合正式学术汇报。'),option('forest-stone','墨绿与暖灰','低饱和色系，依据实际原图选择。')]},
  shape:{label:'形态',question:'整体更偏圆润、干净利落，还是克制混合？',
    recommendation:'用卡片边角、细线和题签展示差异，图内科学信息保持完整。',
    options:[option('crisp','干净利落','小圆角或直角、细描边、清楚对齐。'),option('soft','温和圆润','柔和圆角与浅底，保留学术层级。'),option('mixed','克制混合','主证据利落，解释卡使用轻微圆角。')]},
  language:{label:'语言',question:'标题和解释更希望采用哪种学术表达？',
    recommendation:'采用具体、可核对的判断句，按听众背景选择术语密度，避免口号和重复长句。',
    options:[option('concise','精炼学术','短判断句和就近读图提示，讲稿承接细节。'),option('explanatory','解释型学术','对跨专业概念增加必要解释。'),option('technical','专业讨论','术语、方法条件和证据限定更充分。')]},
  texture:{label:'层次质感',question:'页面层次更倾向开放平面、浅底分组，还是轻微层次？',
    recommendation:'依据证据关系比较无填充实/虚线框、局部深色填充、白底细框与轻阴影；说明每种处理的作用和适用页，不把整稿限制为浅底色卡。',
    options:[option('flat','开放平面','深色字级与必要的实/虚线分组，保持证据主体清楚。'),option('selective-fill','局部实色','用深色题签、对照栏或结论区建立重心，保留白底图表。'),option('subtle-depth','白底轻层次','少量细框、浮签与浅阴影突出局部证据。')]},
  cover:{label:'封面',question:'看过实际封面候选后，希望采用哪种题名与信息组织？',
    recommendation:'根据已经确认的密度、配色与形态制作两个真实候选，展示后再确认；已指定封面或明确委托时沿用。',
    options:[option('title-led','题名主导','用语义断行、对齐和真实身份建立层级。'),option('research-led','研究视觉','仅在有识别价值的真实研究图时与题名组合。')]},
  layout:{label:'排版布局',question:'样张中的证据面积、卡片尺度和阅读顺序，哪种组织更适合现场讲述？',
    recommendation:'比较真实结果页和连续三页；说明主图、解释、条件区的面积，以及哪些页面开放排版、哪些用组件分组。按当前文字和图形重排卡片，检查内部与整页空区。',
    options:[option('evidence-led','主证据主导','主图占主要阅读面积，解释紧邻目标，卡片根据文字量伸缩。'),option('paired-comparison','共同尺度比较','同类结果对齐，同轴同序，条件和差异就近比较。'),option('mechanism-sequence','机制逐步展开','按机制或论证关系组织不同页型，重视段落节奏。')]},
};
const STAGES=[{id:'content',topics:['density','storyline']},{id:'visual-style',topics:['palette','shape']},
  {id:'expression',topics:['language','texture']},{id:'cover',topics:['cover']}];

function taskOnlyRequest(value){
  const normalized=String(value??'').replace(/[\s。.!！,，:：]/g,'').toLowerCase();
  return /^(?:(?:请|麻烦|帮我|帮忙|请帮我))*(?:制作|做|生成|优化|改进|更新)(?:一(?:份|个|套))?(?:学术)?(?:ppt|powerpoint|演示文稿|幻灯片|报告)$/.test(normalized)||
    /^(?:please)?(?:make|create|build|improve|update)(?:me)?(?:a|the)?(?:ppt|powerpoint|presentation|slides)$/.test(normalized);
}
function resolved(decision,guided=false){return decision&&['confirmed','delegated'].includes(decision.status)&&
  meaningful(decision.selected)&&meaningful(decision.userResponse)&&!(guided&&taskOnlyRequest(decision.userResponse));}
const guided=consultation=>consultation?.workflowVersion===2;
const topicsFor=consultation=>guided(consultation)?GUIDED_DESIGN_TOPICS:DESIGN_TOPICS;
function delegatedTopic(consultation,topic){
  return consultation?.mode==='delegated'&&meaningful(consultation.delegation)&&
    (!guided(consultation)||!taskOnlyRequest(consultation.delegation)&&list(consultation.delegationTopics).includes(topic));
}
export function designSourceResolved(consultation){
  if(!guided(consultation))return true;
  const source=consultation.source;
  return Boolean(source&&['confirmed','delegated'].includes(source.status)&&
    ['content-led','reference-guided','template-faithful'].includes(source.mode)&&meaningful(source.userResponse)&&
    !taskOnlyRequest(source.userResponse)&&!(source.status==='delegated'&&!list(consultation.delegationTopics).includes('source'))&&
    (source.mode==='content-led'||list(source.templatePaths).some(meaningful)));
}

/** Send actionable choices to design helpers, not the raw conversation. */
export function resolvedDesignPreferences(consultation){
  return list(consultation?.decisions).filter(decision=>resolved(decision,guided(consultation))).map(({topic,selected,rationale})=>
    ({topic,selected,...(meaningful(rationale)?{rationale}:{})}));
}

export function designDecisionResolved(consultation,topic){
  if(topic==='source')return designSourceResolved(consultation);
  return Boolean(delegatedTopic(consultation,topic)||
    resolved(list(consultation?.decisions).find(decision=>decision.topic===topic),guided(consultation)));
}

/** Questions are proposals, not proof that a host has displayed them. */
export function designDialoguePlan(consultation={mode:'collaborative'}){
  const records=list(consultation.decisions),byTopic=new Map(records.map(d=>[d.topic,d]));
  const workflowTopics=topicsFor(consultation),pendingDesignTopics=workflowTopics.filter(topic=>!designDecisionResolved(consultation,topic));
  const sourcePending=!designSourceResolved(consultation),sourceDelegated=sourcePending&&delegatedTopic(consultation,'source'),pendingTopics=[...(sourcePending?['source']:[]),...pendingDesignTopics];
  const stage=STAGES.find(s=>s.topics.some(topic=>pendingDesignTopics.includes(topic)));
  let questions=(stage?.topics||[]).filter(topic=>pendingDesignTopics.includes(topic)).map(topic=>{
    const record=byTopic.get(topic),defaults=TOPICS[topic];
    return {id:'design_'+topic,topic,label:defaults.label,text:defaults.question,
      recommendation:record?.recommendation||defaults.recommendation,
      options:record?.options||defaults.options,...(record?.referencePaths?{referencePaths:record.referencePaths}:{})};
  });
  let stageId=stage?.id||'ready';
  if((consultation.interaction==='checkpoints'||guided(consultation))&&pendingDesignTopics.length){
    const storyTopics=['density','storyline','language'].filter(topic=>pendingDesignTopics.includes(topic));
    stageId=storyTopics.length?'story':'pilot-direction';
    questions=storyTopics.length?[{id:'design_story',topic:'storyline',topics:storyTopics,label:'故事线与使用场景',
      text:'结合听众和时长，这份汇报更适合沿哪条研究问题路线展开？',
      recommendation:'展示已填入真实材料的问题路线、核心证据与必须保留的条件，并说明推荐。将使用场景、语言深度与路线一起确认；已有答案直接沿用。必须等待真实回答，普通制作请求不表示用户已委托研究取舍。',
      options:TOPICS.storyline.options}]:[{id:'design_pilot_direction',topic:'cover',topics:pendingDesignTopics,label:'配色、排版与风格的真实样张',
      text:'看过封面、困难正文和连续三页后，哪套配色、布局与风格更合适？哪些地方需要调整？',
      recommendation:'先展示同尺度的真实候选再问，说明配色与对比、阅读顺序、主证据、就近解释、字体角色、开放分组或必要边界、表格规则、章节定位和留白如何支持阅读。按观看任务选择相关academicStyles候选，不必展示全部六类。可以一轮确认整套方案，也可只改用户不满意的部分；不能把笼统“方向”替代具体设计讨论。',
      options:[option('research-seminar','开放研讨','主图与就近解释先被读到，开放白底减少无用容器。'),option('thesis-defense','正式答辩','可见章节定位、稳定字级和完整比较条件支持评委追问。'),option('adapt-from-evidence','按证据调整','沿用已展示的真实材料，具体调整公式推导、论文细读、跨研究比较或空间观测的阅读关系。')]}];
  }
  if(sourcePending){
    stageId=consultation.source?.status==='awaiting-upload'?'source-upload':'source';
    questions=stageId==='source-upload'||sourceDelegated?[]:[{id:'design_source',topic:'source',topics:['source'],label:TOPICS.source.label,text:TOPICS.source.question,
      recommendation:TOPICS.source.recommendation,options:TOPICS.source.options}];
  }
  const preparePilot=(consultation.interaction==='checkpoints'||guided(consultation))&&stageId==='pilot-direction';
  return {mode:consultation.mode||'collaborative',interaction:consultation.interaction||'topics',...(guided(consultation)?{workflowVersion:2}:{}),stage:stageId,pendingTopics,
    resolvedTopics:[...(guided(consultation)&&!sourcePending?['source']:[]),...workflowTopics.filter(topic=>!pendingDesignTopics.includes(topic))],questions,
    recordedDecisions:records.map(({topic,status,selected,userResponse,rationale,referencePaths})=>({topic,status,
      ...(selected?{selected}:{}),...(userResponse?{userResponse}:{}),...(rationale?{rationale}:{}),...(referencePaths?{referencePaths:[...referencePaths]}:{})})),
    ...(consultation.source?{source:structuredClone(consultation.source)}:{}),
    ...(meaningful(consultation.delegation)?{delegation:consultation.delegation}:{}),
    ...(consultation.delegationTopics?{delegationTopics:[...consultation.delegationTopics]}:{}),
    questionTiming:preparePilot?'after-actual-pilot-render':'current-checkpoint',
    requiresUserResponse:pendingTopics.length>0&&!preparePilot&&(!sourceDelegated||stageId==='source-upload'),
    readyForFinalDesign:pendingTopics.length===0,
    nextAction:stageId==='source-upload'?'await-template-upload':sourceDelegated?'record-authorized-design-source':preparePilot?'prepare-pilot-candidates':pendingTopics.length?'ask-design-questions':'continue-reference-learning',
    instructions:pendingTopics.length?[
      sourcePending?(stageId==='source-upload'?'用户已选择提供模板，等待附件；不要再次询问同一选择。来源核对和可撤销候选可继续，实际模板未读前不声称已套用模板。':sourceDelegated?'已有明确覆盖设计来源的用户授权，无需再问。依据可用材料选择具体mode，以source.status=delegated保存原授权userResponse；模板路线须有实际templatePaths，不能虚构附件。':'先展示默认原创、模板参考与明确套模板三个选项，说明区别并等待用户回答。未回复不是默认同意；不能直接把source写成confirmed，也不能把“帮我做PPT”当作全权授权。'):
      preparePilot?'先制作并实际渲染封面、困难正文和连续三页；返回的问题留到展示真实样张后提出。未决视觉偏好不阻断可撤销的原生候选或可用生图参考，不能为了制作候选提前填confirmed。':'本轮只提出返回的相关问题，并给出结合当前内容的推荐。选项是提议，不代表已经问过或用户同意。',
      sourceDelegated?'复用已记录的授权范围和原话，不新增或扩大授权，也不把既有委托伪装成一次新的用户回答。':'在聊天中实际展示问题/样张，然后结束本轮等待回答。没有提问工具也必须直接在对话中询问。等待用户回答后记录selected或source.mode、原话userResponse及适配理由；不能在同一轮自问自答。',
      '已给的偏好直接复用；明确委托只作用于已授权的主题和阶段，普通制作请求、沉默、工具成功均不构成同意。等待期间可继续来源核对、取图和可撤销候选；批量排版与正式交付应以协商结果为依据。',
      ...((consultation.interaction==='checkpoints'||guided(consultation))?['一次成套方案选择可以落实多个topics，把同一真实回答映射到各字段的具体选择；配色、布局、风格仍须在展示中说清，不增加机械问卷，也不能自动替用户确认。']:[]),
    ]:['保留已确认选择与真实委托依据，继续研究、实际参考学习和逐页设计；不重复追问同一决定。整稿完成后展示实际渲染和审查结论，按最终审查授权范围处理交付。'],
    basis:'proposed-questions-and-caller-recorded-responses-not-independent-user-confirmation'};
}

/** Delivery-only human checkpoint. It must not block the render the user needs
 * to review, and it never turns agent visual approval into a human decision. */
export function finalReviewReport(project,{pptxSha256,renderReceiptSha256,rendered=false,reviewed=false}={}){
  const consultation=project.design?.consultation,record=consultation?.finalReview;
  if(!guided(consultation))return {required:false,status:'legacy',ready:true,resolved:true,requiresUserResponse:false,issues:[],questions:[],nextAction:'continue-existing-delivery',nextActions:[]};
  const hashesReady=/^[a-f0-9]{64}$/.test(pptxSha256??'')&&/^[a-f0-9]{64}$/.test(renderReceiptSha256??'');
  const readyToDiscuss=rendered&&reviewed&&hashesReady;
  if(!readyToDiscuss)return {required:true,status:'not-ready',ready:false,resolved:false,requiresUserResponse:false,issues:[],questions:[],nextAction:'complete-actual-render-review',nextActions:['先完成当前PPTX的真实渲染、逐页自审与缺陷修复，再进行最终用户审查。'],
    instructions:['先修复实际PPTX并完成当前渲染的逐页自审，再向用户展示成品和审查摘要；不要在看不到成品时索要最终确认。']};
  const responseValid=record&&['confirmed','delegated'].includes(record.status)&&meaningful(record.userResponse)&&!taskOnlyRequest(record.userResponse)&&
    !(record.status==='delegated'&&!list(consultation.delegationTopics).includes('final-review'));
  const current=record?.pptxSha256===pptxSha256&&record?.renderReceiptSha256===renderReceiptSha256;
  if(responseValid&&current)return {required:true,status:record.status,ready:true,resolved:true,requiresUserResponse:false,issues:[],questions:[],record:structuredClone(record),nextAction:'deliver-current-reviewed-artifact',nextActions:['沿用当前成品的实际确认或明确最终审查授权，继续交付，不重复询问。']};
  if(delegatedTopic(consultation,'final-review'))return {required:true,status:'authorized-awaiting-record',ready:false,resolved:false,requiresUserResponse:false,
    questions:[],nextAction:'record-authorized-final-review',nextActions:['已有明确覆盖最终审查/交付的授权，不重复询问；完成自审后用原授权记录delegated，并绑定当前PPTX和渲染哈希。'],
    issues:[{severity:'error',code:'final-human-review-record-required',path:'design.consultation.finalReview',message:'已存在最终审查委托，请将真实delegation原话与当前双哈希写入finalReview；当前尚无适用于本版本的记录。'}],
    instructions:['仅复用明确包含final-review的实际授权，不扩大其他主题的授权。修复科学与版式问题后，以当前真实渲染的哈希登记；不将Agent自审称为新的用户确认。'],
    delegation:consultation.delegation};
  const stale=responseValid&&!current;
  return {required:true,status:stale?'stale':'pending',ready:false,resolved:false,requiresUserResponse:true,nextAction:'ask-final-review',nextActions:['向用户展示实际成品与自审摘要，等待真实最终意见；按既有明确涵盖最终审查的授权范围执行。'],
    issues:[{severity:'error',code:stale?'final-human-review-stale':'final-human-review-pending',path:'design.consultation.finalReview',
      message:stale?'最终确认对应的PPTX或渲染已变化。展示受影响页面并获得实际回答，或按已明确授权的最终审查范围复核后更新记录。':'已完成当前成品自审，接下来向用户展示真实渲染、故事线和已修复问题，收集最终意见。仅有Agent的passed记录不等于用户确认。'}],
    questions:[{id:'design_final_review',topic:'final-review',label:'最终审查',text:'这是完成逐页自审后的实际成品。故事线、配色、布局和重点表达是否符合你的预期？还有哪些页面需要调整？',
      options:[option('accept','确认交付','按当前已审查版本导出交付。'),option('revise','指出需要调整的页面','保留已确认部分，修改指定页后重新渲染并审查。')]}],
    instructions:['展示当前实际PPTX的概览和受关注页面，简要说明科学限定、故事线、深浅配色、布局节奏、卡片尺度与留白检查。收到修改意见先修复，不能把修复责任交给用户。',
      'finalReview须保存真实userResponse及当前pptxSha256、renderReceiptSha256。已有明确涵盖最终审查/交付的授权可记录delegated并继续；不把初始“帮我做PPT”扩展成该授权，也不因同一文件重复问。'],
    ...(record?{record:structuredClone(record)}:{}),basis:'caller-recorded-human-response-or-explicit-final-review-delegation'};
}

/** Keep discussion separate from science requirements; delegation never relaxes
 * source, image, typography, or actual-render review gates. */
export function designDialogueReport(project){
  const consultation=project.design?.consultation,study=project.design?.referenceStudy;
  const legacy=!consultation,slides=list(project.slides),issues=[];
  const plannedPages=list(project.storyboard?.pages).length;
  const designLearningRequired=(guided(consultation)||consultation?.interaction==='checkpoints')&&Math.max(slides.length,plannedPages)>=6;
  const componentLearningRequired=designLearningRequired; // compatibility alias: now any relevant design study qualifies
  const componentSeverity=designLearningRequired?'error':'warning';
  const plan=legacy?{mode:'legacy',stage:'legacy',pendingTopics:[],resolvedTopics:[],questions:[],readyForFinalDesign:true,
    nextAction:'review-existing-preferences',instructions:['旧工程继续可读；整稿重新设计时按当前用户意向补充协商记录，局部修改不强制重问全部偏好。']}:designDialoguePlan(consultation);
  const add=(code,path,message,details={},severity=legacy?'warning':'error')=>issues.push({severity,code,path,message,...details});
  if(legacy&&slides.length)add('design-dialogue-legacy','design.consultation','此旧工程没有分阶段设计协商记录；保留已知偏好，重新设计整稿时补齐，局部修改不必重走全流程。');
  if(consultation){
    const records=list(consultation.decisions),topics=records.map(d=>d.topic);
    if(new Set(topics).size!==topics.length)add('design-dialogue-duplicate-topic','design.consultation.decisions','每个设计主题只保留当前一次决定，不能同时记录互相冲突的选择。');
    if(consultation.mode==='delegated'&&!meaningful(consultation.delegation))add('design-delegation-missing','design.consultation.delegation','整体委托需要保留用户明确授权自行决定的原话或等价具体依据。');
    if(guided(consultation)&&consultation.mode==='delegated'){
      if(!list(consultation.delegationTopics).length)add('design-delegation-scope-required','design.consultation.delegationTopics','明确记录用户授权的主题与阶段；配色委托不自动包含故事线、模板来源或最终审查。');
      if(taskOnlyRequest(consultation.delegation))add('design-delegation-task-only','design.consultation.delegation','普通“帮我做PPT”制作请求不构成全权设计或最终审查委托，先按当前节点进行讨论。');
    }
    if(guided(consultation)&&consultation.source&&['confirmed','delegated'].includes(consultation.source.status)&&!designSourceResolved(consultation))
      add('design-source-response-incomplete','design.consultation.source','设计来源选择须有具体mode和真实userResponse；模板参考/套用还需已提供的templatePaths，不能将未回答或待上传标成确认完成。');
    if(guided(consultation)&&designSourceResolved(consultation)&&consultation.source.mode!==(project.design?.mode||'content-led'))
      add('design-source-mode-mismatch','design.mode','当前design.mode与用户已选择的设计来源不一致，落实该选择后继续。',{selectedMode:consultation.source.mode,currentMode:project.design?.mode||'content-led'});
    for(const [i,decision] of records.entries())if(['confirmed','delegated'].includes(decision.status)&&!resolved(decision,guided(consultation)))
      add('design-response-record-incomplete',`design.consultation.decisions.${i}`,'已确认或已委托的决定需要selected和真实userResponse，不能把推荐选项自动当成用户选择。',{topic:decision.topic});
    if((slides.length||plannedPages)&&plan.pendingTopics.length)add('design-dialogue-pending','design.consultation',
      '尚有设计主题未确认或明确委托：'+plan.pendingTopics.map(t=>TOPICS[t].label).join('、')+'。'+(plan.questionTiming==='after-actual-pilot-render'?'先展示真实样张，再将实际回答按已展示的取舍写入design.consultation；仅记录决定而科学内容与设计不变时，保留当前渲染与已有审查。':'按本轮问题取得反馈；')+'研究与候选可继续，正式构建暂缓。',{pendingTopics:plan.pendingTopics});
  }
  const cards=slides.flatMap(s=>list(s.cards));
  const usedPresets=distinct(cards.map(c=>c.preset).filter(Boolean));
  const imageCards=cards.filter(c=>list(c.figureIds).length);
  const componentStudies=list(study?.componentStudies),designStudies=list(study?.designStudies),detailedStudies=[...componentStudies,...designStudies];
  const referenceStudy={status:study?.status||'missing',usedPresets,pageRecipeIds:list(study?.pageRecipeIds),imageCardCount:imageCards.length,
    imagePresetIds:usedPresets.filter(id=>getCardPreset(id)?.family==='figure'),componentLearningRequired,designLearningRequired,
    designStudyCount:designStudies.length,designSources:distinct(designStudies.map(record=>record.source)),
    componentStudyCount:componentStudies.length,componentSources:distinct(componentStudies.map(record=>record.source)),
    paletteRationaleRecorded:meaningful(study?.paletteRationale)};
  if(!study){
    if(designLearningRequired)add('design-reference-study-required','design.referenceStudy',
      '整稿样张阶段需可定位、与本次证据有关的设计研究。用designStudies记录整页/学术风格/科学参考的阅读顺序和证据层级，或用componentStudies记录确实相关的组件；开放科学排版不必先学卡片。保留paletteRationale。');
    if(usedPresets.length)add('card-reference-used-unreviewed','design.referenceStudy','实际使用的卡片preset尚无查看记录；查看对应真实预览后保存catalogIds或同ID的card-library组件细读。',{presetIds:usedPresets});
    if(legacy&&slides.length)add('design-reference-legacy','design.referenceStudy','旧工程继续可编辑；整稿重新设计时补充内容相关的真实参考和配色依据。',{},'warning');
  }else if(study.status==='reviewed'){
    const missing=[];
    if(!meaningful(study.observations)&&!detailedStudies.length)missing.push('observations');
    if(!list(study.previewPaths).length&&!detailedStudies.some(record=>meaningful(record.previewPath)))missing.push('previewPaths');
    if(!list(study.adaptations).length&&!detailedStudies.some(record=>meaningful(record.adaptation)))missing.push('adaptations');
    if(!list(study.catalogIds).length&&!list(study.pageRecipeIds).length&&!list(study.templateReferences).length&&!detailedStudies.length)missing.push('catalogIds/pageRecipeIds/templateReferences/componentStudies/designStudies');
    if(missing.length)add('card-reference-study-incomplete','design.referenceStudy','参考学习缺少实际目录、预览观察或内容适配记录：'+missing.join('、')+'。');
    if(!detailedStudies.length&&designLearningRequired)add('design-reference-study-required','design.referenceStudy',
      '完整新稿需designStudies或componentStudies中的内容相关细读。记录实际预览、阅读顺序/证据层级及本稿改造；仅列目录ID不等于学习，也不要求使用卡片。');
    if(!meaningful(study.paletteRationale))add('reference-palette-rationale-missing','design.referenceStudy.paletteRationale','记录本稿配色理由：文字/底色对比、主辅层级、与原图颜色的关系及已确定色义；模板配色不自动成为固定要求。',{},componentSeverity);
    issues.push(...componentStudyIssues(study,{severity:legacy?'warning':'error'}),...designStudyIssues(study,{severity:legacy?'warning':'error'}));
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
    if(designLearningRequired)add('reference-study-exception-full-redesign','design.referenceStudy','完整新稿请用designStudies记录与证据有关的实际页面、科学表达或学术风格参考及配色理由。开放排版完全有效，无需额外学习卡片；not-applicable不能替代整稿设计研究。');
    if(!meaningful(study.reason)||study.reason.trim().length<18)add('card-reference-exception-too-thin','design.referenceStudy.reason','限定本次局部修改的页/对象或科学图直接排版范围，说明实际载体和不适用原因；“自由设计”“没有preset”不能代替具体范围。');
    if(usedPresets.length)add('card-reference-exception-conflict','design.referenceStudy','当前实际使用卡片preset，须查看对应参考；普通开放文字组不属于preset要求。');
  }
  return {...plan,referenceStudy,summary:{pendingTopics:plan.pendingTopics.length,confirmedTopics:plan.resolvedTopics.length,
    nativeCardCount:cards.length,imageCardCount:imageCards.length,usedPresetCount:usedPresets.length,componentStudyCount:componentStudies.length,designStudyCount:designStudies.length,blockingIssues:issues.filter(i=>i.severity==='error').length},issues,
    limits:'这些字段是可审查的会话与看图记录；插件不会替用户确认，不独立验证聊天原话、参考图观察或审美质量。'};
}
