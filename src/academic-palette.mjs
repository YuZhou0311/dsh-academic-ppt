/** Restrained, independently authored color systems for academic presentations.
 * These are role palettes, not templates or institutional brand colors. Choose
 * according to content and existing evidence colors; no discipline is assigned
 * a mandatory hue. Explicit user colors remain available to the caller.
 */
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const palette = (ink, accent, secondary, muted, line, tint, gold) => ({
  background:'#FFFFFF', paper:'#FFFFFF', ink, accent, secondary, muted, line, soft:tint, tint, gold,
});
const mix = (a, b, amount) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
// Keep all settings executable with the existing card/panel contract. Tone is
// a semantic choice, not a mandate to paint every surface or recolor evidence.
const surfaceOptions = p => [
  { id:'partial-fill', use:'主证据组的深色题签，白底正文', panelSurface:'band', cardAppearance:{layout:'banded',surface:'outline',fill:p.paper,stroke:p.line} },
  { id:'dark-anchor', use:'少量核心判断或章节锚点，白字', cardAppearance:{surface:'solid',fill:p.accent,stroke:p.accent,accent:'none'} },
  { id:'tonal-group', use:'条件或比较组的中间色面，深字', cardAppearance:{surface:'tint',fill:mix(p.accent,p.paper,.78),stroke:p.line} },
  { id:'open-evidence', use:'图表与辅助解释留在白底开放区域', panelSurface:'plain', cardAppearance:{surface:'plain',fill:'none',stroke:'none',accent:'none'} },
];

export const DEFAULT_ACADEMIC_PALETTE_ID = 'blue-slate';
export const ACADEMIC_PALETTES = freeze(Object.fromEntries(Object.entries({
  'blue-slate': {
    id:'blue-slate', label:'深蓝与石墨',
    description:'白底、深蓝标题与石墨正文；适合需要清楚层级和克制强调的正式学术汇报。',
    palette:palette('#202A35','#254B6E','#6D5868','#526170','#BAC6D2','#F1F4F7','#86673F'),
  },
  'forest-stone': {
    id:'forest-stone', label:'墨绿与暖灰',
    description:'低饱和墨绿与中性灰；在研究内容和现有证据图适合时选择，不因学科标签自动套用。',
    palette:palette('#26312C','#315A4B','#5C6076','#55645B','#BECBC3','#F1F5F2','#826A42'),
  },
  'indigo-gray': {
    id:'indigo-gray', label:'靛蓝与冷灰',
    description:'稳重靛蓝、冷灰和少量灰紫强调；保持文字、图注和比较关系的阅读优先级。',
    palette:palette('#2A2D38','#465477','#79616B','#5A606D','#C2C7D3','#F3F3F7','#7D6D44'),
  },
  'burgundy-stone': {
    id:'burgundy-stone', label:'酒红与石灰白',
    description:'深酒红作为少量标题与导航色，配合石灰白和灰蓝；无需机构品牌也可形成正式层级。',
    palette:palette('#302B2D','#743F4D','#4D6570','#655B60','#CDBFC5','#F6F2F3','#786B46'),
  },
  'graphite-blue': {
    id:'graphite-blue', label:'石墨与灰蓝',
    description:'接近中性的石墨主色与灰蓝辅助色；适合已有多彩图表、需要减少页面装饰干扰的报告。',
    palette:palette('#252A30','#3B4C5B','#506D7B','#59616A','#C1C9D0','#F2F4F6','#7B644C'),
  },
}).map(([id, entry]) => [id, {...entry, surfaceOptions:surfaceOptions(entry.palette)}])));
export const ACADEMIC_PALETTE_IDS = Object.freeze(Object.keys(ACADEMIC_PALETTES));

/** Return an isolated token map, so local tuning never changes another deck. */
export function getAcademicPalette(id = DEFAULT_ACADEMIC_PALETTE_ID) {
  if (!Object.hasOwn(ACADEMIC_PALETTES, id)) throw new RangeError(`未知学术配色 ${String(id)}；可选：${ACADEMIC_PALETTE_IDS.join('、')}。`);
  return { ...ACADEMIC_PALETTES[id].palette };
}
