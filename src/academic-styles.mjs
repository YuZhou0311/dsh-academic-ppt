/** Executable academic design directions. These defaults organize reading;
 * they never select scientific claims, recolor source figures or certify taste.
 * Keep profile values out of saved overrides so switching a profile can change
 * its defaults without discarding the user's explicit choices.
 */
import { getAcademicPalette } from './academic-palette.mjs';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sans='Noto Sans CJK SC',serif='Noto Serif CJK SC';
const base={fontFamily:sans,titleFontFamily:sans,annotationFontFamily:sans,
  system:{preset:'academic-report',header:'plain',cover:'minimal',panel:'plain',titleSize:44,coverTitleSize:72,bodySize:28,panelTitleSize:30,captionSize:18,sectionSize:26},
  cardDefaults:{surface:'plain',radius:0,padding:12,accent:'none',elevation:false},
  chrome:{showTopRule:false,showSection:false},projection:{bodyMin:28,labelMin:24,noteMin:18},tableStyle:'three-line'};
const direction=(id,label,description,useWhen,avoidWhen,overrides)=>({id,label,description,useWhen,avoidWhen,
  paletteId:overrides.paletteId||'graphite-blue',
  defaults:{...base,...overrides,system:{...base.system,...overrides.system},cardDefaults:{...base.cardDefaults,...overrides.cardDefaults},chrome:{...base.chrome,...overrides.chrome},palette:getAcademicPalette(overrides.paletteId||'graphite-blue')},
  reference:'references/academic-styles/index.html',
});

export const DEFAULT_ACADEMIC_STYLE_ID='research-seminar';
export const TABLE_STYLES=Object.freeze(['three-line','ruled','banded']);
export const ACADEMIC_STYLES=freeze(Object.fromEntries([
  direction('research-seminar','研究研讨','开放白底、大证据与就近解释；标题直接给出研究对象或受证据支持的发现。',
    ['组会、会议口头报告','需要快速读清一张关键图'],['机构模板要求固定母版'],{}),
  direction('thesis-defense','正式答辩','可见章节、克制细线分组与完整条件；用稳定定位支持评委追问。',
    ['学位答辩、开题','较长报告需要章节定位'],['短闪电报告不需要持续导航'],
    {paletteId:'blue-slate',system:{header:'rule',cover:'framed',panel:'line',titleSize:40,coverTitleSize:68,panelTitleSize:28,sectionSize:28},chrome:{showSection:true},tableStyle:'ruled'}),
  direction('methods-whiteboard','理论与方法','开放推导区、较大正文、衬线标题和较清楚的注释；适合定义、公式与逐步建模。',
    ['方法讲解、模型假设、公式推导'],['需要原样保留的期刊多面板图不应改画为白板'],
    {titleFontFamily:serif,system:{header:'plain',cover:'editorial',panel:'plain',titleSize:40,coverTitleSize:64,bodySize:30,panelTitleSize:28,captionSize:20},cardDefaults:{padding:8},tableStyle:'three-line'}),
  direction('paper-club','论文精读','清楚区分原文证据与讲者解释；衬线正文、无填充分组与可定位图注支持细读。',
    ['单篇论文精读','方法与原图之间往返讨论'],['跨论文排名不能套用单篇因果链'],
    {fontFamily:serif,paletteId:'burgundy-stone',system:{header:'rule',cover:'project',panel:'plain',titleSize:42,coverTitleSize:64,panelTitleSize:28,captionSize:20},chrome:{showSection:true},tableStyle:'ruled'}),
  direction('evidence-synthesis','证据综合','衬线标题、共同尺度、细线分组与三线表；比较对象和不可比条件同时可见。',
    ['综述、跨研究证据矩阵','冲突结果与有效性边界'],['研究口径不一致时不能自动汇总或排名'],
    {titleFontFamily:serif,paletteId:'indigo-gray',system:{header:'rule',cover:'editorial',panel:'line',titleSize:42,coverTitleSize:66,panelTitleSize:28,captionSize:20},chrome:{showSection:true},cardDefaults:{padding:10},tableStyle:'three-line'}),
  direction('field-report','田间与空间观测','开放图面、短组名与局部浅底条件区；真实照片、地图和时间地点信息形成同一证据组。',
    ['田间实验、遥感、生态或空间观测','需要同时读清地点、时段与对照'],['学科名称不自动要求绿色，也不允许装饰照片代替数据'],
    {titleFontFamily:serif,paletteId:'forest-stone',system:{header:'plain',cover:'editorial',panel:'tint',titleSize:40,coverTitleSize:68,panelTitleSize:28,captionSize:20},chrome:{showSection:true},tableStyle:'banded'}),
].map(entry=>{delete entry.defaults.paletteId;return [entry.id,entry];})));
export const ACADEMIC_STYLE_IDS=Object.freeze(Object.keys(ACADEMIC_STYLES));

export function getAcademicStyle(id=DEFAULT_ACADEMIC_STYLE_ID){
  if(!Object.hasOwn(ACADEMIC_STYLES,id))throw new RangeError(`未知学术风格 ${String(id)}；可选：${ACADEMIC_STYLE_IDS.join('、')}。`);
  return structuredClone(ACADEMIC_STYLES[id]);
}

/** Omitted profiles preserve legacy design behavior. Every explicit token wins;
 * object tokens merge by property, so a custom header does not erase the rest
 * of a profile. This function never mutates the saved record.
 */
export function applyAcademicStyle(input={}){
  if(!input.styleProfile)return {...input};
  const defaults=getAcademicStyle(input.styleProfile).defaults,result={...defaults,...input};
  for(const key of ['system','palette','chrome','cardDefaults','projection'])result[key]={...defaults[key],...input[key]};
  // A legacy fontFamily override intentionally changes body only; role-specific
  // families remain independently editable and must exist in the render host.
  return result;
}
