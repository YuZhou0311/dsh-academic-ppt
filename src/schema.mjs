import Ajv from 'ajv';
import {templateProfileSchema,assertTemplateProfile} from './template-profile.mjs';
import { SEMANTIC_ICONS } from './card-surface.mjs';

export const LAYOUTS = ['cover','section','academic','roadmap','paper','figure-focus','figure-split','comparison','method','results','synthesis','proposal','closing','references'];
export const CARD_STYLES = ['plain','ruled','compact','academic-panel','academic-tab','academic-side','open-frame','floating-tab','split-label','paper-shadow','title-band','stacked-corner','ledger','dashed-note'];
const str = (maxLength=6000) => ({type:'string',maxLength});
const nonempty = (maxLength=6000) => ({...str(maxLength),minLength:1,pattern:'\\S'});
const id = {type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'};
const bool = {type:'boolean'};
const num = (minimum=0,maximum=1000000) => ({type:'number',minimum,maximum});
const integer = (minimum=0,maximum=1000000) => ({type:'integer',minimum,maximum});
const en = values => ({type:'string',enum:values});
const arr = (items,maxItems=100,minItems=0) => ({type:'array',items,maxItems,minItems});
const obj = (properties,required=[]) => ({type:'object',properties,required,additionalProperties:false});
const color = {type:'string',pattern:'^#[0-9a-fA-F]{6}$'};
const freeObject = {type:'object',additionalProperties:true};
const ids = arr(id,120);
const box = obj({x:num(0,1280),y:num(0,720),w:num(1,1280),h:num(1,720)},['x','y','w','h']);
const viewport = obj({x:num(0,1),y:num(0,1),w:num(0.001,1),h:num(0.001,1)},['x','y','w','h']);
export const figureReadingSchema = obj({purpose:en(['evidence','locator']),contentType:en(['dense-multipanel','plot','diagram','photo','table','mixed','unknown']),task:en(['overview','read-values','compare-panels','explain-process']),panelCount:integer(1,100),minLabelPx:num(1,4000),requiredElements:arr(nonempty(300),20),verifiedBy:en(['human','vision-model','unverified']),note:str(1600)},['purpose','contentType','task','verifiedBy']);
const figureQuerySchema = obj({width:integer(1,16000),height:integer(1,16000),viewport,reading:figureReadingSchema},['width','height','reading']);
export const narrativeSchema = obj({throughline:nonempty(1600),sections:arr(obj({id,title:nonempty(180),question:nonempty(500)},['id','title','question']),8,2)},['throughline','sections']);
export const briefSchema = obj({centralQuestion:str(1200),audience:str(200),talkMinutes:num(1,180),targetPaperCount:integer(0,50),requireFullText:bool,impactFactorMin:num(0,1000),genre:en(['literature-review','paper-reading','research-progress','proposal','defense']),qualityProfile:en(['academic']),requirePaperIntro:bool,narrative:narrativeSchema},['centralQuestion','audience','talkMinutes','targetPaperCount','requireFullText']);
export const capabilitiesSchema = obj({imageInput:en(['supported','unsupported','unknown']),source:nonempty(1000),verifiedAt:str(100)},['imageInput','source']);
export const academicSystemSchema = obj({preset:en(['academic-defense','academic-report','plain']),header:en(['band','rule','plain']),cover:en(['framed','project','minimal','split','editorial']),panel:en(['band','tint','line']),titleSize:num(32,44),coverTitleSize:num(60,100),bodySize:num(22,28),panelTitleSize:num(24,32),captionSize:num(16,22),sectionSize:num(24,34)});
export const cardAppearanceSchema = obj({surface:en(['outline','tint','solid','plain']),radius:num(0,18),padding:num(12,24),accent:en(['left','top','none']),elevation:bool});
export const chromeSchema = obj({header:en(['band','rule','plain']),showBrand:bool,showSection:bool,showPageNumber:bool,showFooter:bool,showSources:bool,showTopRule:bool,brandLabel:str(140)});
export const projectionSchema = obj({bodyMin:num(22,40),labelMin:num(18,36),noteMin:num(14,24)},['bodyMin','labelMin','noteMin']);
export const designDirectionSchema = obj({premise:nonempty(1600),visualGrammar:nonempty(1800),referenceLearning:str(1800),avoid:arr(nonempty(500),8)},['premise','visualGrammar']);
export const designSchema = obj({projection:projectionSchema,direction:designDirectionSchema,colorRoles:arr(obj({role:nonempty(120),color,meaning:nonempty(500)},['role','color','meaning']),12),mode:en(['content-led','reference-guided','template-faithful']),density:en(['balanced','compact']),cardDefaults:cardAppearanceSchema,chrome:chromeSchema,fontFamily:nonempty(120),palette:obj({ink:color,paper:color,background:color,accent:color,secondary:color,muted:color,line:color,soft:color,gold:color,tint:color},['ink','paper','accent','secondary','muted','line','soft']),system:academicSystemSchema,branding:obj({label:nonempty(140),logoAssetId:id}),templateProfile:templateProfileSchema},['fontFamily','palette']);
export const analysisSchema = obj({question:nonempty(1200),gap:nonempty(1500),mechanism:nonempty(2400),design:nonempty(2400),unitOfAnalysis:nonempty(1000),comparators:arr(nonempty(800),8,1),validity:nonempty(2000),locators:arr(nonempty(500),12,2)},['question','gap','mechanism','design','unitOfAnalysis','comparators','validity','locators']);
export const reasoningSchema = obj({warrant:nonempty(1800),boundary:nonempty(1800),alternatives:nonempty(1800)},['warrant','boundary']);
export const argumentSchema = obj({role:en(['question','mechanism','design','evidence','synthesis','limitation','proposal']),question:nonempty(1000),contribution:nonempty(1800),boundary:nonempty(1400)},['role','question','contribution','boundary']);
export const visualPlanSchema = obj({relationship:en(['comparison','sequence','mechanism','hierarchy','evidence-explanation','matrix','synthesis','definition']),primaryPanelId:id,readingOrder:arr(id,8,1),rationale:nonempty(1000),alternatives:arr(obj({structure:nonempty(500),tradeoff:nonempty(500)},['structure','tradeoff']),2,1),repetitionReason:nonempty(600)},['relationship','primaryPanelId','readingOrder','rationale']);
export const coverSchema = obj({presenter:nonempty(240),affiliation:nonempty(500),occasion:nonempty(300),date:nonempty(120),titleLines:arr(nonempty(300),4,1),variant:en(['formal','minimal','framed','project','split','editorial','custom']),assetId:id,visualCaption:str(300),icon:en(SEMANTIC_ICONS),boxes:obj({title:box,subtitle:box,occasion:box,metadata:box,visual:box},['title']),align:en(['left','center','right'])});
export const closingSchema = obj({variant:en(['statement','evidence']),statement:nonempty(600),question:nonempty(500),assetId:id,visualCaption:str(300),icon:en(SEMANTIC_ICONS)},['variant','statement']);
export const assessmentSchema = obj({slideId:id,contentCheck:nonempty(1200),legibilityCheck:nonempty(1200),issue: str(1200)},['slideId','contentCheck','legibilityCheck','issue']);
export const paperSchema = obj({id,title:nonempty(1800),authors:arr(nonempty(180),100,1),year:integer(1600,2200),journal:nonempty(500),doi:str(250),url:nonempty(2000),version:nonempty(500),sourceType:en(['article','preprint','report','dataset','protocol','thesis']),studyType:en(['simulation','field','lab','review','system-evaluation','qualitative','theoretical','mixed']),analysis:analysisSchema,reading:obj({status:en(['full-text','abstract-only','metadata-only']),sections:arr(nonempty(200),40),source:nonempty(2000),notes:str(6000)},['status','sections','source','notes']),methodSummary:str(3000),limitations:arr(nonempty(2000),30),impactFactor:obj({value:num(0,1000),year:integer(1900,2200),source:nonempty(2000),verifiedAt:nonempty(100)},['value','year','source','verifiedAt'])},['id','title','authors','year','journal','doi','url','version','studyType','reading','methodSummary','limitations']);
export const metricSchema = obj({label:nonempty(250),value:nonempty(250),unit:nonempty(250),baseline:nonempty(1200),denominator:nonempty(1200),aggregation:nonempty(1200)},['label','value','unit','baseline','denominator','aggregation']);
export const claimSchema = obj({id,paperId:id,kind:en(['reported','inference','proposal']),text:nonempty(5000),locator:nonempty(2000),context:nonempty(4000),metrics:arr(metricSchema,12),reasoning:reasoningSchema,dependsOn:ids,verified:bool},['id','paperId','kind','text','locator','context','verified']);
export const assetSchema = obj({id,path:nonempty(3000),sourcePath:{...nonempty(6000),description:'由 path 导入时自动保存解析后的来源路径；已嵌入 data 保留此值，不重新读取源文件。'},data:nonempty(12000000),width:integer(1,16000),height:integer(1,16000),sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},paperId:id,figure:str(500),panel:str(300),caption:nonempty(2000),displayCaption:nonempty(300),displayLegend:arr(obj({label:nonempty(80),color},['label','color']),10,1),treatment:en(['paper','plain']),reading:figureReadingSchema,sourceUrl:nonempty(2000),sourceVersion:nonempty(500),license:nonempty(2000),usage:en(['figure','decorative']),provenance:en(['source','author-created','template-demo']),cropNote:nonempty(2000),viewport},['id','caption','sourceUrl','sourceVersion','license','usage','cropNote']);
export const cardSchema = obj({id,kind:en(['question','method','setting','result','boundary','hypothesis']),title:nonempty(300),body:str(2600),emphasis:arr(nonempty(180),4,1),claimIds:ids,metric:obj({value:nonempty(100),unit:nonempty(100),label:nonempty(200),context:nonempty(1000)},['value','unit','label','context']),style:en(CARD_STYLES),appearance:cardAppearanceSchema,icon:en(SEMANTIC_ICONS),accent:color,templateComponentId:nonempty(200),box},['id','kind','title','body','claimIds']);
const nodeSchema = obj({id,label:nonempty(220),detail:str(600),kind:en(['question','method','setting','result','boundary','hypothesis']),box},['id','label']);
const edgeSchema = obj({from:id,to:id,label:str(180),kind:en(['flow','feedback','association'])},['from','to']);
const diagramSchema = obj({rows:arr(arr(id,4,1),4,1),rowLabels:arr(nonempty(120),4,1)},['rows']);
const drawingBase = {id,claimIds:ids};
const drawingBox = {x:num(0,1280),y:num(0,720),w:num(.01,1280),h:num(.01,720)};
const drawingPaint = {fill:{type:'string',pattern:'^(?:#[0-9a-fA-F]{6}|none)$'},stroke:{type:'string',pattern:'^(?:#[0-9a-fA-F]{6}|none)$'},strokeWidth:num(.1,20),dash:en(['dash','dot']),fillOpacity:num(0,1)};
export const drawingElementSchema = {oneOf:[
 obj({...drawingBase,kind:{const:'text'},...drawingBox,text:nonempty(6000),fontSize:num(8,120),role:en(['body','label','note','title']),bold:bool,color,align:en(['left','center','right']),lineHeight:num(1,1.8),emphasis:arr(nonempty(300),12)},['id','kind','x','y','w','h','text','fontSize','role']),
 obj({...drawingBase,kind:en(['rect','ellipse']),...drawingBox,...drawingPaint,radius:num(0,40),role:en(['group','data','decoration'])},['id','kind','x','y','w','h','role']),
 obj({...drawingBase,kind:{const:'line'},points:arr(obj({x:num(0,1280),y:num(0,720)},['x','y']),12,2),stroke:color,strokeWidth:num(.1,20),dash:en(['dash','dot']),endArrow:bool,role:en(['relationship','data','decoration'])},['id','kind','points','role']),
 obj({...drawingBase,kind:{const:'image'},...drawingBox,assetId:id},['id','kind','x','y','w','h','assetId'])
]};
export const drawingSchema = obj({id,width:num(1,1280),height:num(1,720),box,claimIds:ids,elements:arr(drawingElementSchema,240,1)},['id','width','height','elements']);
export const headingSchema = obj({box,lines:arr(nonempty(700),4,1),fontSize:num(32,64),align:en(['left','center','right']),color,emphasis:arr(nonempty(300),8)},['box']);
const panelProperties = {id,title:str(300),kind:en(['question','method','setting','result','boundary','hypothesis']),weight:num(.2,5),surface:en(['inherit','plain','rule','tint','band']),align:en(['stretch','start']),heading:en(['visible','hidden']),padding:num(0,24),figureIds:arr(id,4),cardIds:arr(id,8),drawingIds:arr(id,8),referenceIds:arr(id,6),chart:bool,plot:bool,plotId:id,table:bool,diagram:bool};
const compositionPanelSchema = obj(panelProperties,['id','title']);
export const compositionSchema = {...obj({lead:nonempty(1200),rows:arr(obj({weight:num(.2,5),panels:arr(compositionPanelSchema,4,1)},['panels']),3,1),regions:arr(obj({...panelProperties,box},['id','title','box']),12,1),conclusion:obj({label:nonempty(80),text:nonempty(1400)},['label','text'])}),oneOf:[{properties:{rows:{}},required:['rows']},{properties:{regions:{}},required:['regions']}]};
const sectionSchema = obj({number:nonempty(12),title:nonempty(200)},['title']);
const agendaSchema = obj({active:integer(1,8),items:arr(obj({title:nonempty(180),sectionId:id,question:nonempty(500)},['title']),8,1)},['items']);
const chartSchema = obj({kind:en(['bar','column','line']),categories:arr(nonempty(120),20,1),series:arr(obj({name:nonempty(150),values:arr(num(-1e12,1e12),20,1)},['name','values']),5,1),unit:nonempty(200),sourceClaimId:id,valueDecimals:integer(0,8)},['kind','categories','series','unit','sourceClaimId']);
export const plotSchema = obj({kind:en(['distribution','interval']),unit:nonempty(160),groups:arr(obj({label:nonempty(180),values:arr(num(-1e12,1e12),100,1),estimate:num(-1e12,1e12),lower:num(-1e12,1e12),upper:num(-1e12,1e12)},['label']),8,1),reference:num(-1e12,1e12),sourceClaimIds:ids,caption:str(1200)},['kind','unit','groups','sourceClaimIds']);
const identifiedPlotSchema=obj({id,...plotSchema.properties},['id',...plotSchema.required]);
export const tableSchema = obj({columns:arr(nonempty(180),8,1),rows:arr(arr(str(800),8,1),14,1),columnWeights:arr(num(.2,8),8,1),highlightRows:arr(integer(0,13),14),caption:str(1200),sourceClaimIds:ids},['columns','rows']);
export const slideSchema = obj({id,layout:en(LAYOUTS),referenceTemplateId:id,cover:coverSchema,closing:closingSchema,chrome:chromeSchema,section:sectionSchema,sectionId:id,transition:nonempty(1000),agenda:agendaSchema,contentChecks:arr(obj({id,text:nonempty(600)},['id','text']),30,1),composition:compositionSchema,heading:headingSchema,drawings:arr(drawingSchema,12,1),referenceIds:arr(id,6,1),diagram:diagramSchema,argument:argumentSchema,visualPlan:visualPlanSchema,panelTitles:arr(nonempty(220),8,1),title:nonempty(700),kicker:str(200),subtitle:str(1200),paperIds:ids,claimIds:ids,takeaway:str(1000),notes:str(30000),seconds:num(0,1800),figureIds:arr(id,4),figureBoxes:arr(box,4,1),cards:arr(cardSchema,8),nodes:arr(nodeSchema,16),edges:arr(edgeSchema,28),chart:chartSchema,plot:plotSchema,plots:arr(identifiedPlotSchema,4,1),table:tableSchema},['id','layout','title','paperIds','claimIds','notes','seconds','figureIds','cards']);
export const projectContentSchema = obj({schemaVersion:{type:'integer',const:1},id,revision:integer(),title:nonempty(700),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema,papers:arr(paperSchema,60),claims:arr(claimSchema,600),assets:arr(assetSchema,160),slides:arr(slideSchema,120)},['schemaVersion','id','revision','title','brief','design','capabilities','papers','claims','assets','slides']);

const base = {projectPath:nonempty(3000)};
const revision = {expectedRevision:integer()};
const changes = arr(obj({slideId:id,cardId:id,patch:freeObject,removeFields:arr(en(['referenceTemplateId','figureBoxes','cover','subtitle','takeaway','chart','plot','plots','table','panelTitles','kicker','section','sectionId','transition','agenda','composition','diagram','visualPlan','chrome','closing','heading','drawings','referenceIds','contentChecks']),20,1)},['slideId','patch']),40,1);
export const toolSchemas = {
 academic_ppt_init:obj({projectDir:nonempty(3000),title:nonempty(700),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema},['projectDir','title']),
 academic_ppt_record:obj({...base,...revision,recordsPath:nonempty(3000),papers:arr(paperSchema,5,1),claims:arr(claimSchema,20,1),assets:arr(assetSchema,8,1),slides:arr(slideSchema,8,1),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema,templateProfilePaths:arr(nonempty(3000),4,1),slideOrder:arr(id,120,1)},['projectPath','expectedRevision']),
 academic_ppt_study:obj({...base,...revision,outputDir:nonempty(3000),candidatesPath:nonempty(3000),candidates:arr(obj({id,label:nonempty(200),slide:slideSchema},['id','label','slide']),6,2),render:bool,fontDirectories:arr(nonempty(3000),4,1),externalReferencePrompts:bool},['projectPath','expectedRevision','outputDir']),
 academic_ppt_portfolio:obj({projectPaths:arr(nonempty(3000),12,2),outputPath:nonempty(3000)},['projectPaths']),
 academic_ppt_context:obj({...base,stage:en(['auto','research','evidence','design','storyboard','render','review','delivery']),recordIds:arr(id,4)},['projectPath']),
 academic_ppt_build:obj({...base,...revision,mode:en(['review','draft'])},['projectPath','expectedRevision']),
 academic_ppt_edit:obj({...base,...revision,scope:en(['card-style','slide-content']),changes},['projectPath','expectedRevision','scope','changes']),
 academic_ppt_undo:obj({...base,...revision},['projectPath','expectedRevision']),
 academic_ppt_check:obj({...base},['projectPath']),
 academic_ppt_template:obj({filePath:nonempty(3000),outputPath:nonempty(3000),render:bool,fontDirectories:arr(nonempty(3000),4,1)},['filePath']),
 academic_ppt_reference:obj({templateId:id,includeExamples:bool,category:en(['paper','method','experiment','results','figure','synthesis','limitations','plan']),figure:figureQuerySchema}),
 academic_ppt_render:obj({...base,...revision,fontDirectories:arr(nonempty(3000),4,1)},['projectPath','expectedRevision']),
 academic_ppt_contract:obj({topic:en(['brief','paper','claim','asset','slide','design','assessment'])},['topic']),
 academic_ppt_review:obj({...base,...revision,pptxSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},reviewer:en(['human','vision-model']),basis:en(['html-preview','pptx-render']),reviewedSlides:arr(id,120,1),result:en(['passed','needs-fix']),notes:nonempty(6000),observations:{...arr(assessmentSchema,120,1),description:'当前 academic 工程必填：每个 reviewedSlides ID 恰好一条，逐页填写 contentCheck、legibilityCheck 与 issue。仅未启用 academic 质量档案的旧工程兼容省略。'}},['projectPath','expectedRevision','pptxSha256','reviewer','basis','reviewedSlides','result','notes'])
};
const ajv = new Ajv({allErrors:true,strict:true});
const validators = Object.fromEntries(Object.entries(toolSchemas).map(([name,schema])=>[name,ajv.compile(schema)]));
const validateContent = ajv.compile(projectContentSchema);
function checkDangerousKeys(value,depth=0) {
 if (depth>32) throw new Error('INVALID_INPUT: JSON nesting exceeds 32 levels');
 if (Array.isArray(value)) { for(const v of value) checkDangerousKeys(v,depth+1); }
 else if(value && typeof value==='object') for(const [k,v] of Object.entries(value)) {
  if(['__proto__','prototype','constructor'].includes(k)) throw new Error('INVALID_INPUT: unsafe JSON key');
  checkDangerousKeys(v,depth+1);
 }
}
function validateOrThrow(validate,value,label) {
 checkDangerousKeys(value);
 if(!validate(value)) throw new Error('INVALID_INPUT: '+label+' '+validate.errors.slice(0,8).map(e=>`${e.instancePath || '/'} ${e.message}`).join('; '));
 return value;
}
export function assertToolArgs(name,args) {if(!validators[name]) throw new Error('Unknown tool: '+name);return validateOrThrow(validators[name],args,name);}
export function contentOf(p) {return Object.fromEntries(Object.keys(projectContentSchema.properties).map(k=>[k,p[k]]));}
export function assertProject(p) {
 validateOrThrow(validateContent,contentOf(p),'project');
 if(p.design.templateProfile)assertTemplateProfile(p.design.templateProfile);
 const unique=(values,label)=>{if(new Set(values).size!==values.length)throw new Error('DUPLICATE_ID: '+label);};
 for(const key of ['papers','claims','assets','slides'])unique(p[key].map(x=>x.id),key);
 for(const asset of p.assets){const v=asset.viewport;if(v&&(v.x+v.w>1+1e-9||v.y+v.h>1+1e-9))throw new Error('INVALID_VIEWPORT: source crop extends beyond the original image');}
 for(const slide of p.slides){
  for(const card of slide.cards)if(card.emphasis?.some(text=>!card.body.includes(text)))throw new Error('INVALID_EMPHASIS: every emphasis phrase must occur in its card body');
  for(const key of ['cards','nodes','drawings','plots','contentChecks'])unique((slide[key]??[]).map(x=>x.id),key+' on '+slide.id);
  unique(slide.referenceIds??[],'referenceIds on '+slide.id);
  for(const drawing of slide.drawings??[])unique(drawing.elements.map(x=>x.id),'elements in '+slide.id+'/'+drawing.id);
  if(slide.table?.rows.some(row=>row.length!==slide.table.columns.length))throw new Error('TABLE_DIMENSIONS: every row must match the columns');
 }
 return p;
}
