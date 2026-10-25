/** Reading-role checks on the final native scene, not a claim of live projection legibility. */
export const DEFAULT_PROJECTION=Object.freeze({bodyMin:28,labelMin:24,noteMin:18});
const notes=new Set(['note','caption','citation','footer','source-details','context-caption','cover-metadata','cover-occasion']);
const labels=new Set(['label','diagram-group','diagram-label','diagram-body','diagram-edge-label','figure-legend','plot-axis-label','plot-axis-tick','plot-group-label','plot-unit','plot-value-label','plot-reading-note','reference-title','reference-index','identity','section-label','section-index','index','metric-label']);
export function readingRole(node){
 if(notes.has(node.role))return 'note';
 if(labels.has(node.role))return 'label';
 if(node.role==='title'||String(node.role||'').endsWith('title')||['metric','cover-title','closing-statement'].includes(node.role))return 'title';
 return 'body';
}
export function projectionIssues(page,policy){
 if(!policy)return [];
 const issues=[];
 for(const node of page.nodes||[]){
  if(node.kind==='text'){
   const role=readingRole(node),minimum=role==='title'?policy.labelMin:policy[`${role}Min`];
   if(node.fontSize+1e-6<minimum)issues.push({severity:'error',code:'projection-font-too-small',slideId:page.id,objectId:node.id,role,fontSize:node.fontSize,minimum,message:`${role}文字最终为${Math.round(node.fontSize*100)/100}px，低于本工程${minimum}px阅读政策；调整布局或明确修改策略，不把必要正文改成注释。`});
  }else if(node.kind==='table'&&node.fontSize+1e-6<policy.labelMin)issues.push({severity:'error',code:'projection-font-too-small',slideId:page.id,objectId:node.id,role:'label',fontSize:node.fontSize,minimum:policy.labelMin,message:'表格单元格低于本工程必要标签字级；调整表格设计后重新渲染。'});
 }
 return issues;
}
