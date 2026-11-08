/** A small, recursive, content-first language; not a gallery of whole-slide templates.
 * Only registered evidence IDs and literal authored text are accepted. */
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const text=(maxLength=1800)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const id={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'};
const num=(minimum,maximum)=>({type:'number',minimum,maximum});
const en=values=>({type:'string',enum:values});
const arr=(items,maxItems=40,minItems=0)=>({type:'array',items,maxItems,minItems});
const color={type:'string',pattern:'^#[a-fA-F0-9]{6}$'};
const ids=arr(id,30);
export const NODE_SCHEMA_ID='urn:dsh:page-authoring-node:1';
const ref={$ref:NODE_SCHEMA_ID};
const common={id,weight:num(.1,20),extent:{oneOf:[num(20,650),{const:'content'}]}};
const role=en(['body','label','note','title']);
const flowNode=obj({id,label:text(140),detail:text(400),tone:en(['plain','soft','accent','ink'])},['id','label']);
const flowEdge=obj({from:id,to:id,kind:en(['flow','feedback','association']),label:text(80)},['from','to','kind']);
export const pageNodeSchema={$id:NODE_SCHEMA_ID,oneOf:[
 obj({...common,kind:{const:'split'},axis:en(['x','y']),align:en(['start','center','end']),gap:num(0,80),children:arr(ref,8,2)},['id','kind','axis','children']),
 obj({...common,kind:{const:'group'},title:text(300),tone:en(['plain','paper','soft','accent','ink']),headingStyle:en(['band','tab','rail','rule','text']),padding:num(0,40),child:ref},['id','kind','child']),
 obj({...common,kind:{const:'text'},text:text(6000),role,bold:{type:'boolean'},size:num(18,72),color,emphasis:arr(text(160),8),align:en(['left','center','right']),vertical:en(['top','center','bottom']),claimIds:ids},['id','kind','text','role']),
 obj({...common,kind:{const:'figure'},assetId:id,caption:text(800),showCaption:{type:'boolean'},align:en(['top','center','bottom']),captionGap:num(4,24),claimIds:ids},['id','kind','assetId']),
 obj({...common,kind:{const:'table'},columns:arr(text(220),8,1),rows:arr(arr({type:'string',maxLength:800},8,1),12,1),columnWeights:arr(num(.1,12),8,1),headerTone:en(['soft','accent','ink']),rowHeaders:{type:'boolean'},rowTones:arr(en(['none','soft','accent','secondary']),12),columnAlign:arr(en(['left','center','right']),8),claimIds:ids},['id','kind','columns','rows']),
 obj({...common,kind:{const:'comparison'},label:text(200),items:arr(obj({id,label:text(120),tone:en(['plain','accent','secondary'])},['id','label']),4,2),metrics:arr(obj({label:text(160),unit:text(80),values:arr(text(200),4,2),scale:obj({min:num(-1e9,1e9),max:num(-1e9,1e9)},['min','max']),note:text(360)},['label','values']),6,1),claimIds:ids},['id','kind','items','metrics']),
 obj({...common,kind:{const:'statement'},label:text(80),text:text(900),tone:en(['soft','accent','ink']),claimIds:ids},['id','kind','text']),
 obj({...common,kind:{const:'flow'},orientation:en(['auto','horizontal','vertical']),align:en(['top','center','bottom']),nodes:arr(flowNode,10,2),edges:arr(flowEdge,16),claimIds:ids},['id','kind','nodes','edges']),
]};
export const composePageRequestSchema=obj({
 kind:{const:'compose-page'},mode:en(['create','replace']),changeNote:text(1800),
 slide:obj({id,title:text(700),paperIds:ids,claimIds:ids,notes:{type:'string',maxLength:30000},seconds:num(0,1800),
 section:obj({title:text(200),number:text(12)},['title']),sectionId:id,transition:text(1000),
 argument:obj({role:en(['question','mechanism','design','evidence','synthesis','limitation','proposal']),question:text(1000),contribution:text(1800),boundary:text(1400)},['role','question','contribution','boundary'])},['id','title','paperIds','claimIds','notes','seconds']),
 intent:obj({relationship:en(['comparison','sequence','mechanism','hierarchy','evidence-explanation','matrix','synthesis','definition']),primaryNodeId:id,readingOrder:arr(id,30,1),rationale:text(1400)},['relationship','primaryNodeId','readingOrder','rationale']),
 body:ref,
},['kind','mode','slide','intent','body']);

/** Covers use the existing complete-title renderer, not columns of body cards. */
export const composeOpeningRequestSchema=obj({
 kind:{const:'compose-opening'},mode:en(['create','replace']),changeNote:text(1800),
 slide:obj({id,title:text(700),subtitle:text(1200),paperIds:ids,claimIds:ids,notes:{type:'string',maxLength:30000},seconds:num(0,1800)},['id','title','paperIds','claimIds','notes','seconds']),
 cover:obj({variant:en(['framed','project','minimal','split','editorial']),titleLines:arr(text(700),4,1),occasion:text(300),presenter:text(300),affiliation:text(700),date:text(100),visualCaption:text(700),assetId:id},['variant'])
},['kind','mode','slide','cover']);
