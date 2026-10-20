/** Reproducible original reference deck, authored for this plugin (not a user template). */
import PptxGenJS from 'pptxgenjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function createNativeReference(path) {
  const p = new PptxGenJS();
  p.defineLayout({ name: 'ACADEMIC', width: 1280 / 96, height: 720 / 96 });
  p.layout = 'ACADEMIC'; p.title = 'Academic native card reference';
  p.author = 'DSH Academic PPT'; p.subject = 'Original demonstration components';
  p.theme = { headFontFace: 'Noto Sans CJK SC', bodyFontFace: 'Noto Sans CJK SC', lang: 'zh-CN' };
  const s = p.addSlide(); s.background = { color: 'F5F3EF' };
  const box = (x,y,w,h) => ({x:x/96,y:y/96,w:w/96,h:h/96});
  const rect = (name,x,y,w,h,fill,line='CFD7DA',more={}) => s.addShape(p.ShapeType.rect, {objectName:name,...box(x,y,w,h),fill:{color:fill},line:{color:line,width:.75},...more});
  const line = (name,x1,y1,x2,y2,color,width=1,dash) => s.addShape(p.ShapeType.line,{objectName:name,...box(x1,y1,x2-x1,y2-y1),line:{color,width,...(dash?{dashType:dash}:{})}});
  const text = (name,value,x,y,w,h,size,color='315B70') => s.addText(value,{objectName:name,...box(x,y,w,h),fontFace:'Noto Sans CJK SC',fontSize:size*.75,color,bold:name.includes('title'),margin:0,breakLine:false,wrap:false});
  text('reference-title','学术原生组件 · 自制参考',52,50,1150,60,38);
  text('reference-origin','本文件专为插件示例设计；用户此前两份模板原文件未在当前工程中提供。',52,118,1160,50,19,'607080');
  // All decoration sits inside each source rectangle. Import retains the actual native geometry.
  rect('academic-evidence-sheet',52,230,576,279,'FFFFFF');
  rect('evidence-side-spine',52,230,7,279,'315B70','315B70');
  line('evidence-heading-rule',76,286,604,286,'CFD7DA');
  line('evidence-bottom-rule',76,490,132,490,'B38D56',2.25);
  line('evidence-top-right',570,244,612,244,'527F7E',1.5);
  text('evidence-title-zone','Evidence title',78,248,520,36,24);
  text('evidence-body-zone','Evidence body placeholder',78,303,520,178,22,'243648');
  rect('academic-boundary-fold',652,230,576,279,'FFFFFF','B38D56',{line:{color:'B38D56',width:1,dashType:'dash'}});
  rect('boundary-top-marker',674,230,92,6,'B38D56','B38D56');
  line('boundary-fold-diagonal',1196,230,1228,262,'B38D56',1);
  line('boundary-fold-left',1196,230,1196,262,'B38D56',1);
  line('boundary-fold-bottom',1196,262,1228,262,'B38D56',1);
  line('boundary-heading-rule',676,286,1186,286,'CFD7DA');
  text('boundary-title-zone','Boundary title',678,248,494,36,24);
  text('boundary-body-zone','Boundary body placeholder',678,303,520,178,22,'243648');
  text('reference-notes','左：证据纸页（侧脊、细线、短金线）；右：边界便笺（虚线、角折、顶标）。旧文字仅用于定位文字区。',52,552,1176,90,20,'607080');
  s.addNotes('Original native shapes, lines and editable text. MIT-licensed with the plugin. No prior user template was recovered or imitated as a claim of provenance.');
  await writeFile(path,Buffer.from(await p.write({outputType:'nodebuffer',compression:true})),{flag:'wx'});
  return path;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = resolve(process.argv[2] || fileURLToPath(new URL('./native-card-reference.pptx',import.meta.url)));
  console.log(await createNativeReference(path));
}
