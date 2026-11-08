/** Content-sized method diagrams. Coordinates only: no scientific edges are inferred.
 * Forward links remain adjacent; feedback uses reserved, non-overlapping lanes. */
export function layoutFlow(node, box, {wrap, size=24}={}) {
  const fail=(code,message,detail={})=>{const e=new Error(code+': '+message);e.code=code;e.detail={node:node.id,...detail};throw e;};
  const ns=node.nodes??[],es=node.edges??[],ids=ns.map(n=>n.id);
  if(ns.length<2||new Set(ids).size!==ns.length)fail('AUTHORING_FLOW_IDS','关系节点ID必须唯一，至少两个节点');
  for(const e of es){if(!ids.includes(e.from)||!ids.includes(e.to)||e.from===e.to)fail('AUTHORING_FLOW_EDGE','连接端点必须存在且不同',{edge:e});
    if(e.kind!=='feedback'&&Math.abs(ids.indexOf(e.from)-ids.indexOf(e.to))!==1)fail('AUTHORING_FLOW_NONADJACENT','跨节点前向连线请显式布线，不穿过中间节点',{edge:e});}
  const fs=es.filter(e=>e.kind==='feedback'),pad=16,gap=84;
  const th=(s,w,bold=false)=>s?wrap(s,w,size,{bold}).length*size*1.2+5:0;
  const heights=w=>ns.map(n=>32+th(n.label,w-2*pad,true)+(n.detail?12+th(n.detail,w-2*pad):0));
  const hw=(box.w-gap*(ns.length-1))/ns.length;
  const horizontalOK=hw>=184&&ns.length<=5;
  const hhs=horizontalOK?heights(hw):[];
  const hh=horizontalOK?Math.max(...hhs):Infinity;
  const horizontalHeight=hh+(fs.length?fs.length*48+12:0);
  let orientation=node.orientation??'auto';
  if(orientation==='auto')orientation=horizontalOK&&horizontalHeight<=box.h?'horizontal':'vertical';
  let boxes,requiredHeight,feedbackWidth=0;
  if(orientation==='horizontal'){
    if(!horizontalOK)fail('AUTHORING_FLOW_SPACE','横向节点过窄；用auto/vertical、增宽或分组',{nodeWidth:hw});
    requiredHeight=horizontalHeight;
    boxes=ns.map((n,i)=>({id:n.id,x:box.x+i*(hw+gap),y:box.y,w:hw,h:hh}));
  }else{
    feedbackWidth=fs.length*116;
    const w=box.w-feedbackWidth;
    if(w<184)fail('AUTHORING_FLOW_SPACE','纵向节点与反馈通道宽度不足',{nodeWidth:w});
    const hs=heights(w);requiredHeight=hs.reduce((a,b)=>a+b,0)+72*(ns.length-1);
    let y=box.y;boxes=ns.map((n,i)=>{const b={id:n.id,x:box.x,y,w,h:hs[i]};y+=hs[i]+72;return b;});
  }
  if(requiredHeight>box.h+.01)fail('AUTHORING_FLOW_SPACE','完整节点和反馈通道放不下；增高、重排或拆分，不缩字',{orientation,requiredHeight,availableHeight:box.h});
  const offset=node.align==='center'?(box.h-requiredHeight)/2:node.align==='bottom'?box.h-requiredHeight:0;
  boxes=boxes.map(b=>({...b,y:b.y+offset}));
  const byId=new Map(boxes.map(b=>[b.id,b]));let f=0;
  const edges=es.map(e=>{
    const a=byId.get(e.from),b=byId.get(e.to);let points,labelBox;
    if(orientation==='horizontal'){
      if(e.kind==='feedback'){
        const y=box.y+offset+hh+36+f++*48;
        points=[{x:a.x+a.w/2,y:a.y+a.h},{x:a.x+a.w/2,y},{x:b.x+b.w/2,y},{x:b.x+b.w/2,y:b.y+b.h}];
        labelBox={x:Math.min(a.x,b.x)+a.w/2+14,y:y-30,w:Math.abs(a.x-b.x)-28,h:28};
      }else{
        const forward=b.x>a.x,x1=forward?a.x+a.w:a.x,x2=forward?b.x:b.x+b.w,y=a.y+a.h/2;
        points=[{x:x1,y},{x:x2,y}];labelBox={x:Math.min(x1,x2)+2,y:y-52,w:gap-4,h:48};
      }
    }else{
      if(e.kind==='feedback'){
        const x=box.x+box.w-feedbackWidth+(++f)*116-6;
        points=[{x:a.x+a.w,y:a.y+a.h/2},{x,y:a.y+a.h/2},{x,y:b.y+b.h/2},{x:b.x+b.w,y:b.y+b.h/2}];
        const mid=(a.y+a.h/2+b.y+b.h/2)/2;
        labelBox={x:x-104,y:mid-24,w:96,h:48};
      }else{
        const forward=b.y>a.y,y1=forward?a.y+a.h:a.y,y2=forward?b.y:b.y+b.h,x=a.x+a.w/2;
        points=[{x,y:y1},{x,y:y2}];labelBox={x:x+14,y:Math.min(y1,y2)+12,w:Math.max(60,a.w/2-30),h:48};
      }
    }
    return {...e,points,...(e.label?{labelBox}:{})};
  });
  return {orientation,requiredHeight,unusedHeight:box.h-requiredHeight,nodes:boxes,edges,padding:pad};
}
