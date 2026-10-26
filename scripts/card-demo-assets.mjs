/** Original schematic pixels for the public design catalog, never evidence.
 * There are no observations, measurements, geographical locations or results. */
import { PNG } from 'pngjs';

const W=768,H=240;
function drawing(kind){
  const p=new PNG({width:W,height:H});p.data.fill(255);
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const pixel=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;p.data[i]=c[0];p.data[i+1]=c[1];p.data[i+2]=c[2];p.data[i+3]=255;};
  const rect=(x,y,w,h,c)=>{const color=rgb(c);for(let j=Math.max(0,Math.floor(y));j<Math.min(H,y+h);j++)for(let i=Math.max(0,Math.floor(x));i<Math.min(W,x+w);i++)pixel(i,j,color);};
  const line=(x1,y1,x2,y2,c,width=4)=>{const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));for(let i=0;i<=n;i++)rect(x1+(x2-x1)*i/n-width/2,y1+(y2-y1)*i/n-width/2,width,width,c);};
  const frame=(x,y,w,h,c='#B8C7D0')=>{rect(x,y,w,h,c);rect(x+3,y+3,w-6,h-6,'#FFFFFF');};
  const circle=(x,y,r,c)=>{const color=rgb(c);for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)if(i*i+j*j<=r*r)pixel(x+i,y+j,color);};
  const arrow=(x1,y1,x2,y2,c='#577988')=>{line(x1,y1,x2,y2,c);const a=Math.atan2(y2-y1,x2-x1);line(x2,y2,x2-17*Math.cos(a-.5),y2-17*Math.sin(a-.5),c);line(x2,y2,x2-17*Math.cos(a+.5),y2-17*Math.sin(a+.5),c);};
  const glyph=(letter,x,y,size=5)=>{
    const fonts={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111']};
    fonts[letter].forEach((row,j)=>[...row].forEach((v,i)=>{if(v==='1')rect(x+i*size,y+j*size,size,size,'#244761');}));
  };
  frame(8,8,W-16,H-16,'#D4DEE4');
  if(kind==='A'){
    for(const [i,x] of [48,294,540].entries()){
      frame(x,41,180,158);rect(x+5,46,170,44,i===1?'#DDECE9':'#E7EEF3');
      for(let r=0;r<3;r++)rect(x+26,111+r*26,128-r*16,8,i===1?'#4E8B80':'#668BA2');
      glyph(String.fromCharCode(65+i),x+76,54,4);
    }
    arrow(235,120,281,120);arrow(481,120,527,120);
  }else if(kind==='B'){
    const palette=['#EDF2F4','#CEDFE2','#99BEC2','#5A9297','#376A79'];
    for(let r=0;r<6;r++)for(let c=0;c<11;c++)rect(55+c*60,30+r*30,54,24,palette[(r+c*2)%palette.length]);
    frame(233,87,184,64,'#244761');
    for(let r=0;r<2;r++)for(let c=0;c<3;c++)rect(237+c*60,91+r*30,54,24,palette[((r+2)+(c+3)*2)%palette.length]);
  }else{
    frame(65,77,176,86);glyph('A',138,105,4);
    frame(338,18,176,86);glyph('B',412,47,4);
    frame(338,136,176,86);glyph('C',412,165,4);
    line(247,120,286,120,'#577988');line(286,61,286,179,'#577988');arrow(286,61,326,61);arrow(286,179,326,179);
    circle(627,120,57,'#DDECE9');circle(627,120,40,'#FFFFFF');line(627,101,627,139,'#376A79',6);line(608,120,646,120,'#376A79',6);
    arrow(524,61,569,88);arrow(524,179,569,152);
  }
  return 'data:image/png;base64,'+PNG.sync.write(p,{colorType:6,deflateLevel:9}).toString('base64');
}

export function cardDemoAssets(){
  const a=drawing('A'),b=drawing('B'),c=drawing('C');
  return [a,b,c,b].map((data,index)=>({
    id:`card-demo-${String.fromCharCode(97+index)}`,data,width:W,height:H,
    figure:`示意${String.fromCharCode(65+index)}`,caption:'原创结构示意，不含研究数据',
    displayCaption:index===3?'结构示例 B 局部，非研究图':'结构示例 '+String.fromCharCode(65+index)+'，非研究图',
    sourceUrl:'urn:dsh-academic-ppt:original-card-schematic',sourceVersion:'Original catalog schematic',license:'MIT',usage:'figure',provenance:'template-demo',
    cropNote:index===3?'明确预置的示意B局部；图片卡片本身不自动裁切。':'完整示意图，无裁切',treatment:'plain',
    reading:{purpose:'evidence',contentType:'diagram',task:'explain-process',verifiedBy:'unverified'},
    ...(index===3?{viewport:{x:.30,y:.35,w:.25,h:.30}}:{})
  }));
}
