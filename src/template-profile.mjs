/** Only inert, bounded native background primitives may enter a project. */
import Ajv from 'ajv';

const object = (properties, required=[]) => ({type:'object',properties,required,additionalProperties:false});
const text = (maxLength=300) => ({type:'string',maxLength});
const number = (minimum,maximum) => ({type:'number',minimum,maximum});
const integer = (minimum,maximum) => ({type:'integer',minimum,maximum});
const array = (items,maxItems,minItems=0) => ({type:'array',items,maxItems,minItems});
const hex = {type:'string',pattern:'^#[0-9a-fA-F]{6}$'};
const paint = {type:'string',pattern:'^(none|#[0-9a-fA-F]{6})$'};
const sha = {type:'string',pattern:'^[a-f0-9]{64}$'};
const geometry = {x:number(-20000,20000),y:number(-20000,20000),w:number(0,20000),h:number(0,20000)};
const sourcePart = {type:'string',pattern:'^ppt/slides/slide[0-9]+\\.xml$',maxLength:3000};
const sourceFields = {sourceSlide:integer(1,200),sourcePart,sourceShapeId:text(200),sourceName:text(2000)};
const primitive = object({
 ...geometry,...sourceFields,kind:{type:'string',enum:['rect','ellipse','line']},fill:paint,stroke:paint,
 strokeWidth:number(0,100),fillOpacity:number(0,1),strokeOpacity:number(0,1),radius:number(0,10000),
 dash:{type:'string',enum:['dash','dot']},
 shadow:object({color:hex,opacity:number(0,1),angle:number(-360,360),offset:number(0,1000),blur:number(0,1000)},['color','opacity','angle','offset','blur']),
},['kind','x','y','w','h','fill','stroke','strokeWidth']);
const zone = object({x:number(0,1),y:number(0,1),w:number(.001,1),h:number(.001,1)},['x','y','w','h']);
const component = object({
 id:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$'},
 sourceSha256:sha,sourceSlide:integer(1,200),sourcePart,sourceGroupId:text(200),sourceFrameId:text(200),sourceName:text(2000),
 derivation:{type:'string',enum:['native-group-backgrounds','contained-native-backgrounds']},
 width:number(1,20000),height:number(1,20000),sourceBox:object(geometry,['x','y','w','h']),
 nodes:array(primitive,200,1),textZones:object({title:zone,body:zone},['title','body']),
 sourceShapeIds:array(text(200),400,1),oldTextExcluded:{type:'boolean',const:true},
},['id','sourceSha256','sourceSlide','derivation','width','height','sourceBox','nodes','sourceShapeIds','oldTextExcluded']);
const source = object({path:text(3000),sha256:sha,width:number(1,20000),height:number(1,20000)},['path','sha256','width','height']);
const unsupported = object({...sourceFields,reason:text(4000)},['reason']);
export const templateProfileSchema = object({sources:array(source,4,1),components:array(component,600),unsupported:array(unsupported,12000)},['sources','components','unsupported']);
const validate = new Ajv({allErrors:true,strict:true}).compile(templateProfileSchema);

export function assertTemplateProfile(profile) {
 if(!validate(profile))throw new Error('INVALID_TEMPLATE_PROFILE: '+validate.errors.slice(0,5).map(e=>`${e.instancePath} ${e.message}`).join('; '));
 const sourceHashes=new Set(profile.sources.map(s=>s.sha256)),ids=new Set();let nodeCount=0;
 for(const c of profile.components){
  if(ids.has(c.id))throw new Error('DUPLICATE_TEMPLATE_COMPONENT: '+c.id);ids.add(c.id);
  if(!sourceHashes.has(c.sourceSha256))throw new Error('INVALID_TEMPLATE_PROFILE: component source hash is not registered');
  nodeCount+=c.nodes.length;if(nodeCount>6000)throw new Error('INVALID_TEMPLATE_PROFILE: too many background primitives; provide a smaller template');
  for(const n of c.nodes){
   if(n.kind!=='line'&&(n.w<=0||n.h<=0))throw new Error('INVALID_TEMPLATE_PROFILE: empty background primitive');
   if(n.x<-.5||n.y<-.5||n.x+n.w>c.width+.5||n.y+n.h>c.height+.5)throw new Error('INVALID_TEMPLATE_PROFILE: primitive exceeds component frame');
  }
  for(const z of Object.values(c.textZones??{}))if(z.x+z.w>1.005||z.y+z.h>1.005)throw new Error('INVALID_TEMPLATE_PROFILE: text zone exceeds component frame');
 }
 return profile;
}

/** Keep only the validated subset; discarded XML metadata never becomes SVG/HTML. */
export function normalizeTemplateProfiles(profiles) {
 if(!Array.isArray(profiles)||!profiles.length||profiles.length>4)throw new Error('INVALID_TEMPLATE_PROFILE: expected one to four profiles');
 for(const p of profiles)if(p?.format!=='academic-template-profile'||p.version!==1||p.sha256!==p.source?.sha256||!Array.isArray(p.components)||!Array.isArray(p.unsupported))throw new Error('INVALID_TEMPLATE_PROFILE: use a profile produced by academic_ppt_template');
 return assertTemplateProfile({sources:profiles.map(p=>p.source),components:profiles.flatMap(p=>p.components),unsupported:profiles.flatMap(p=>p.unsupported)});
}
