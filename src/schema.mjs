import Ajv from 'ajv';
import {templateProfileSchema,assertTemplateProfile} from './template-profile.mjs';

export const LAYOUTS = ['cover','roadmap','paper','figure-focus','figure-split','comparison','method','results','synthesis','proposal','closing','references'];
export const CARD_STYLES = ['open-frame','floating-tab','split-label','paper-shadow','title-band','stacked-corner','ledger','dashed-note'];
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
export const briefSchema = obj({centralQuestion:str(1200),audience:str(200),talkMinutes:num(1,180),targetPaperCount:integer(0,50),requireFullText:bool,impactFactorMin:num(0,1000)},['centralQuestion','audience','talkMinutes','targetPaperCount','requireFullText']);
export const capabilitiesSchema = obj({imageInput:en(['supported','unsupported','unknown']),source:nonempty(1000),verifiedAt:str(100)},['imageInput','source']);
export const designSchema = obj({fontFamily:nonempty(120),palette:obj({ink:color,paper:color,accent:color,secondary:color,muted:color,line:color,soft:color},['ink','paper','accent','secondary','muted','line','soft']),templateProfile:templateProfileSchema},['fontFamily','palette']);
export const paperSchema = obj({id,title:nonempty(1800),authors:arr(nonempty(180),100,1),year:integer(1600,2200),journal:nonempty(500),doi:nonempty(250),url:nonempty(2000),version:nonempty(500),studyType:en(['simulation','field','lab','review','system-evaluation']),reading:obj({status:en(['full-text','abstract-only','metadata-only']),sections:arr(nonempty(200),40),source:nonempty(2000),notes:str(6000)},['status','sections','source','notes']),methodSummary:str(3000),limitations:arr(nonempty(2000),30),impactFactor:obj({value:num(0,1000),year:integer(1900,2200),source:nonempty(2000),verifiedAt:nonempty(100)},['value','year','source','verifiedAt'])},['id','title','authors','year','journal','doi','url','version','studyType','reading','methodSummary','limitations']);
export const metricSchema = obj({label:nonempty(250),value:nonempty(250),unit:nonempty(250),baseline:nonempty(1200),denominator:nonempty(1200),aggregation:nonempty(1200)},['label','value','unit','baseline','denominator','aggregation']);
export const claimSchema = obj({id,paperId:id,kind:en(['reported','inference','proposal']),text:nonempty(5000),locator:nonempty(2000),context:nonempty(4000),metrics:arr(metricSchema,12),verified:bool},['id','paperId','kind','text','locator','context','verified']);
export const assetSchema = obj({id,path:nonempty(3000),data:nonempty(12000000),width:integer(1,16000),height:integer(1,16000),sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},paperId:id,figure:str(500),panel:str(300),caption:nonempty(2000),sourceUrl:nonempty(2000),sourceVersion:nonempty(500),license:nonempty(2000),usage:en(['figure','decorative']),cropNote:nonempty(2000)},['id','caption','sourceUrl','sourceVersion','license','usage','cropNote']);
export const cardSchema = obj({id,kind:en(['question','method','setting','result','boundary','hypothesis']),title:nonempty(300),body:str(2600),claimIds:ids,metric:obj({value:nonempty(100),unit:nonempty(100),label:nonempty(200),context:nonempty(1000)},['value','unit','label','context']),style:en(CARD_STYLES),accent:color,templateComponentId:nonempty(200),box},['id','kind','title','body','claimIds']);
const nodeSchema = obj({id,label:nonempty(220),detail:str(600)},['id','label']);
const edgeSchema = obj({from:id,to:id,label:str(180)},['from','to']);
const chartSchema = obj({kind:en(['bar','column','line']),categories:arr(nonempty(120),20,1),series:arr(obj({name:nonempty(150),values:arr(num(-1e12,1e12),20,1)},['name','values']),5,1),unit:nonempty(200),sourceClaimId:id},['kind','categories','series','unit','sourceClaimId']);
export const slideSchema = obj({id,layout:en(LAYOUTS),title:nonempty(700),kicker:str(200),subtitle:str(1200),paperIds:ids,claimIds:ids,takeaway:str(1000),notes:str(30000),seconds:num(0,1800),figureIds:arr(id,4),cards:arr(cardSchema,8),nodes:arr(nodeSchema,12),edges:arr(edgeSchema,24),chart:chartSchema},['id','layout','title','paperIds','claimIds','notes','seconds','figureIds','cards']);
export const projectContentSchema = obj({schemaVersion:{type:'integer',const:1},id,revision:integer(),title:nonempty(700),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema,papers:arr(paperSchema,60),claims:arr(claimSchema,600),assets:arr(assetSchema,160),slides:arr(slideSchema,120)},['schemaVersion','id','revision','title','brief','design','capabilities','papers','claims','assets','slides']);

const base = {projectPath:nonempty(3000)};
const revision = {expectedRevision:integer()};
const changes = arr(obj({slideId:id,cardId:id,patch:freeObject},['slideId','patch']),40,1);
export const toolSchemas = {
 academic_ppt_init:obj({projectDir:nonempty(3000),title:nonempty(700),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema},['projectDir','title']),
 academic_ppt_record:obj({...base,...revision,papers:arr(paperSchema,5,1),claims:arr(claimSchema,20,1),assets:arr(assetSchema,8,1),slides:arr(slideSchema,8,1),brief:briefSchema,design:designSchema,capabilities:capabilitiesSchema,templateProfilePaths:arr(nonempty(3000),4,1)},['projectPath','expectedRevision']),
 academic_ppt_context:obj({...base,stage:en(['auto','research','evidence','design','storyboard','render','review','delivery']),recordIds:arr(id,4)},['projectPath']),
 academic_ppt_build:obj({...base,...revision,mode:en(['review','draft'])},['projectPath','expectedRevision']),
 academic_ppt_edit:obj({...base,...revision,scope:en(['card-style','slide-content']),changes},['projectPath','expectedRevision','scope','changes']),
 academic_ppt_undo:obj({...base,...revision},['projectPath','expectedRevision']),
 academic_ppt_check:obj({...base},['projectPath']),
 academic_ppt_template:obj({filePath:nonempty(3000),outputPath:nonempty(3000)},['filePath']),
 academic_ppt_render:obj({...base,...revision,fontDirectories:arr(nonempty(3000),4,1)},['projectPath','expectedRevision']),
 academic_ppt_review:obj({...base,...revision,pptxSha256:{type:'string',pattern:'^[a-f0-9]{64}$'},reviewer:en(['human','vision-model']),basis:en(['html-preview','pptx-render']),reviewedSlides:arr(id,120,1),result:en(['passed','needs-fix']),notes:nonempty(6000)},['projectPath','expectedRevision','pptxSha256','reviewer','basis','reviewedSlides','result','notes'])
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
export function assertProject(p) {validateOrThrow(validateContent,contentOf(p),'project');if(p.design.templateProfile)assertTemplateProfile(p.design.templateProfile);for(const key of ['papers','claims','assets','slides']) {const ids=p[key].map(x=>x.id);if(new Set(ids).size!==ids.length) throw new Error('DUPLICATE_ID: '+key); }for(const slide of p.slides){const cards=slide.cards.map(c=>c.id);if(new Set(cards).size!==cards.length)throw new Error('DUPLICATE_ID: cards on '+slide.id);const nodes=(slide.nodes??[]).map(n=>n.id);if(new Set(nodes).size!==nodes.length)throw new Error('DUPLICATE_ID: method nodes');}return p;}
