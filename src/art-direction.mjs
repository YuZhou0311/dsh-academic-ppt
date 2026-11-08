/** Visual grammar, not page templates. Existing projects without this field
 * are unchanged. User-specified tokens always win; source pixels never change. */
export const ART_DIRECTIONS=Object.freeze({
 structured:{label:'结构化学术',description:'章节色带、清楚的组题签、浅底承托与白底图证；匹配项目答辩的完成度，不规定区域数量。',
  defaults:{titleFontFamily:'Noto Sans CJK SC',fontFamily:'Noto Sans CJK SC',annotationFontFamily:'Noto Sans CJK SC',
   system:{header:'band',cover:'framed',panel:'line',titleSize:40,bodySize:28,panelTitleSize:28,captionSize:18,sectionSize:24},chrome:{showSection:true}},
  group:{tone:'paper',headingStyle:'band',padding:16,titleGap:12,sectionGap:20},figure:{align:'top',captionGap:8},table:{rule:'rows'}},
 editorial:{label:'编辑式学术',description:'衬线题名、局部色签、轻边线与非对称主辅；复杂内容仍用共享行列组织。',
  defaults:{titleFontFamily:'Noto Serif CJK SC',fontFamily:'Noto Sans CJK SC',annotationFontFamily:'Noto Sans CJK SC',
   system:{header:'rule',cover:'editorial',panel:'line',titleSize:42,bodySize:28,panelTitleSize:28,captionSize:18,sectionSize:24},chrome:{showSection:true}},
  group:{tone:'plain',headingStyle:'tab',padding:16,titleGap:12,sectionGap:20},figure:{align:'top',captionGap:8},table:{rule:'rows'}},
 open:{label:'开放学术',description:'开放分组与细线标题，保留清晰字级和相邻图注；不是以稀疏程度判断专业。',
  defaults:{system:{header:'rule',panel:'plain',titleSize:40,bodySize:28,captionSize:18},chrome:{showSection:true}},
  group:{tone:'plain',headingStyle:'rule',padding:12,titleGap:12,sectionGap:20},figure:{align:'top',captionGap:8},table:{rule:'rows'}}
});
export const ART_DIRECTION_IDS=Object.freeze(Object.keys(ART_DIRECTIONS));
export function getArtDirection(id){
 if(!Object.hasOwn(ART_DIRECTIONS,id))throw new RangeError('Unknown artDirection: '+id);
 return structuredClone(ART_DIRECTIONS[id]);
}
