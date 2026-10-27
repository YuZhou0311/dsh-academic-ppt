/** Authored frame paint is separate from a recipe's content and geometry. */
export const CARD_FRAME_FIELDS = Object.freeze(['fill','stroke','strokeWidth','dash','shadow']);

/** Card recipes are measured at their destination width. A free-flow text
 * card hugs that measurement; it is not a thumbnail enlarged to fill a cell.
 * Explicit boxes remain authored geometry, but substantial empty tails must
 * be reviewed rather than counted as occupied evidence area. */
export function fitCardSurfaceBox(b,card,box,measurement) {
  const measuredHeight=measurement.minimumH;
  if(!Number.isFinite(measuredHeight)||measuredHeight<=0)return box;
  if(!card.box)return {...box,h:Math.min(box.h,measuredHeight)};
  const unusedHeight=Math.max(0,box.h-measuredHeight),unusedFraction=unusedHeight/box.h;
  if(unusedHeight>=72&&unusedFraction>=.28)b.page.issues.push({
    severity:'warning',code:'card-excess-whitespace',slideId:b.page.id,cardId:card.id,
    allocatedHeight:box.h,measuredHeight,unusedHeight,unusedFraction,
    box:{x:box.x,y:box.y+measuredHeight,w:box.w,h:unusedHeight},
    message:'显式卡片框明显高于完整内容所需高度，形成连续空腔。查看实际渲染：缩短外框并重新分配区域、扩大相关证据或调整图文关系；只有确有比较对齐/分组用途时保留并在审查中说明。不能靠装饰、填充色或缩字掩盖留白。',
  });
  return box;
}

export function cardFramePaint(appearance = {}, defaults = {}, { fill = true, stroke = true, shadow = true, elevationOpacity = .08 } = {}) {
  const paint = {
    fill:fill ? appearance.fill ?? defaults.fill ?? 'none' : defaults.fill ?? 'none',
    stroke:stroke ? appearance.stroke ?? defaults.stroke ?? 'none' : defaults.stroke ?? 'none',
    strokeWidth:appearance.strokeWidth ?? defaults.strokeWidth ?? 1.25,
  };
  const dash = appearance.dash ?? defaults.dash ?? 'solid';
  if(dash !== 'solid')paint.dash = dash;
  if(shadow && appearance.shadow && typeof appearance.shadow === 'object')paint.shadow = {...appearance.shadow};
  // Existing elevation remains available for paper surfaces. A transparent or
  // dashed container never acquires a shadow merely by inheriting that default.
  else if(shadow && appearance.shadow !== false && appearance.elevation && paint.fill !== 'none' && dash === 'solid')paint.shadow = {color:'#20334A',opacity:elevationOpacity,blur:3,offset:2,angle:90};
  return paint;
}

export const frameHasPaint = paint => paint.fill !== 'none' || paint.stroke !== 'none';

/** A single closed outline shared by SVG and editable PowerPoint custom geometry. */
export function cutCornerPoints(width,height,cut) {
  if(![width,height,cut].every(Number.isFinite)||width<=0||height<=0||cut<=0||cut>Math.min(width,height))throw new Error('切角轮廓需要位于表面内的正尺寸。');
  return [{x:0,y:0},{x:width-cut,y:0},{x:width,y:cut},{x:width,y:height},{x:0,y:height}];
}

const rgb=color=>/^#[\da-f]{6}$/i.test(color||'')?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):null;
const luminance=channels=>channels.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
function containsTextBox(node,box) {
  const corners=[[box.x,box.y],[box.x+box.w,box.y],[box.x,box.y+box.h],[box.x+box.w,box.y+box.h]];
  if(!corners.every(([x,y])=>x>=node.x-1e-6&&y>=node.y-1e-6&&x<=node.x+node.w+1e-6&&y<=node.y+node.h+1e-6))return false;
  // A measured text slot includes unused right-hand space. Its far corner may
  // touch a cut or ellipse while its actual text remains on the filled face.
  const x=box.x+box.w/2,y=box.y+box.h/2;
  if(node.kind==='ellipse')return ((x-node.x-node.w/2)/(node.w/2))**2+((y-node.y-node.h/2)/(node.h/2))**2<=1+1e-6;
  return !node.cornerCut||x-node.x-(y-node.y)<=node.w-node.cornerCut+1e-6;
}

/** Used only for explicit authored fill overrides. Keep a preferred role color
 * when readable; otherwise select a foreground against the actual painted
 * backing, including an independent heading and transparent parent surfaces. */
export function readableCardColor(b,box,preferred) {
  let background=rgb(b.page.background)||rgb(b.p.background)||rgb(b.p.paper)||[255,255,255];
  for(const node of b.page.nodes){
    const fill=rgb(node.fill);
    if(!fill||!['rect','ellipse'].includes(node.kind)||!containsTextBox(node,box))continue;
    const alpha=Math.max(0,Math.min(1,node.fillOpacity??1));
    background=fill.map((value,i)=>value*alpha+background[i]*(1-alpha));
  }
  for(const candidate of [preferred,b.p.ink])if(rgb(candidate)&&contrast(rgb(candidate),background)>=4.5)return candidate;
  return contrast([255,255,255],background)>=contrast([0,0,0],background)?'#FFFFFF':'#000000';
}

export function cardFrameStroke(appearance = {}, stroke, strokeWidth = 1.25) {
  const paint = cardFramePaint(appearance,{stroke,strokeWidth},{fill:false,shadow:false});
  return {stroke:paint.stroke,strokeWidth:paint.strokeWidth,...(paint.dash ? {dash:paint.dash} : {})};
}

export function reportInvisibleCardShadow(b,cardId) {
  b.page.issues.push({severity:'error',code:'card-shadow-needs-surface',slideId:b.page.id,cardId,
    message:'阴影需要实际可见的表面。plain 卡片请明确 fill 或 stroke；开放括线、上下线的阴影请明确实色 fill，透明边界通常使用 shadow:false。'});
}
