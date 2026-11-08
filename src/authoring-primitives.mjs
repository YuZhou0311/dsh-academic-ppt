/** Small native geometry helpers. They do not choose a narrative, invent data,
 * approve a layout, or bypass record/check/build. Units: plugin canvas pixels. */
import {wrapText} from './scene.mjs';
function finite(...values){if(!values.every(Number.isFinite))throw new Error('GEOMETRY_REQUIRES_FINITE_NUMBERS');}
export function splitBox(box,weights,{axis='x',gap=20}={}){
 finite(box.x,box.y,box.w,box.h,gap,...weights);
 if(!['x','y'].includes(axis)||!weights.length||weights.some(v=>v<=0)||gap<0||box.w<=0||box.h<=0)throw new Error('INVALID_SPLIT_BOX');
 const dimension=axis==='x'?'w':'h',size=box[dimension]-gap*(weights.length-1),sum=weights.reduce((a,b)=>a+b,0);
 if(size<=0)throw new Error('GAPS_EXCEED_BOX');let cursor=box[axis];
 return weights.map(weight=>{const b={...box,[axis]:cursor,[dimension]:size*weight/sum};cursor+=b[dimension]+gap;return b;});
}
export function anchor(box,side){
 if(!['left','right','top','bottom'].includes(side))throw new Error('INVALID_ANCHOR');
 return {x:side==='left'?box.x:side==='right'?box.x+box.w:box.x+box.w/2,y:side==='top'?box.y:side==='bottom'?box.y+box.h:box.y+box.h/2};
}
export function nativeDrawing(id,box){
 finite(box.x,box.y,box.w,box.h);if(box.w<=0||box.h<=0)throw new Error('INVALID_DRAWING_BOX');
 const drawing={id,width:box.w,height:box.h,elements:[]};let n=0;
 const check=b=>{finite(b.x,b.y,b.w,b.h);if(b.w<=0||b.h<=0||b.x<-.01||b.y<-.01||b.x+b.w>box.w+.01||b.y+b.h>box.h+.01)throw new Error('DRAWING_OUTSIDE_REGION: '+JSON.stringify(b));};
 const add=e=>{drawing.elements.push({id:`e${++n}`,...e});return e;};
 return {
  drawing,
  region:{id,title:'',heading:'hidden',surface:'plain',padding:0,box,drawingIds:[id]},
  text(text,b,{size=28,role='body',bold=false,color='#20353C',align='left',lineHeight=1.2,claimIds=[]}={}){
   if(typeof text!=='string'||!text.trim())throw new Error('EMPTY_TEXT');
   const lines=wrapText(text,b.w,size,{bold});const h=b.h??Math.ceil(lines.length*size*lineHeight+5);
   check({...b,h});if(lines.length*size*lineHeight+4>h+.1)throw new Error('TEXT_NEEDS_MORE_HEIGHT: '+text);
   return add({kind:'text',...b,h,text,fontSize:size,role,bold,color,align,lineHeight,...(claimIds.length?{claimIds}:{})});
  },
  rect(b,{fill='#EFF3F3',stroke='none',width=1,role='group'}={}){check(b);return add({kind:'rect',...b,fill,stroke,strokeWidth:width,role});},
  line(points,{color='#365B64',width=2,role='relationship',arrow=false,dash,claimIds=[]}={}){
   if(points.length<2)throw new Error('LINE_REQUIRES_TWO_POINTS');
   for(const p of points){finite(p.x,p.y);if(p.x<0||p.y<0||p.x>box.w||p.y>box.h)throw new Error('LINE_OUTSIDE_REGION');}
   return add({kind:'line',points,stroke:color,strokeWidth:width,role,endArrow:arrow,...(dash?{dash}:{}),...(claimIds.length?{claimIds}:{})});
  },
  edge(from,fromSide,to,toSide,{via=[],...options}={}){return this.line([anchor(from,fromSide),...via,anchor(to,toSide)],{arrow:true,...options});},
 };
}
