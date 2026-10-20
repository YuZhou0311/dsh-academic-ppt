/** Contact sheets from already-rendered pages. They support navigation, not visual approval. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PNG} from 'pngjs';

const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
function pixel(out,x,y,c){if(x<0||y<0||x>=out.width||y>=out.height)return;const at=(y*out.width+x)*4;out.data[at]=c[0];out.data[at+1]=c[1];out.data[at+2]=c[2];out.data[at+3]=255;}
function number(out,value,x,y){for(const [i,d] of String(value).padStart(2,'0').split('').entries())for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(digits[Number(d)][row*3+col]==='1')for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)pixel(out,x+i*14+col*3+dx,y+row*3+dy,[37,54,70]);}

export async function createContactSheets(pngPaths,directory,{signal}={}) {
  const paths=[];
  for(let start=0;start<pngPaths.length;start+=24){
    signal?.throwIfAborted();
    const pages=pngPaths.slice(start,start+24),cols=Math.min(3,pages.length),rows=Math.ceil(pages.length/cols),cw=408,ch=260;
    const out=new PNG({width:cols*cw+16,height:rows*ch+16});out.data.fill(246);
    for(let k=3;k<out.data.length;k+=4)out.data[k]=255;
    for(const [i,path] of pages.entries()){
      signal?.throwIfAborted();
      const input=PNG.sync.read(await readFile(path)),scale=Math.min(392/input.width,222/input.height),w=Math.max(1,Math.round(input.width*scale)),h=Math.max(1,Math.round(input.height*scale));
      const ox=16+i%cols*cw,oy=16+Math.floor(i/cols)*ch;
      number(out,start+i+1,ox,oy);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const sx=Math.min(input.width-1,Math.floor(x/scale)),sy=Math.min(input.height-1,Math.floor(y/scale)),at=(sy*input.width+sx)*4,a=input.data[at+3]/255;
        pixel(out,ox+x,oy+26+y,[0,1,2].map(c=>Math.round(input.data[at+c]*a+255*(1-a))));
      }
    }
    const path=join(directory,`contact-sheet-${String(paths.length+1).padStart(2,'0')}.png`);
    await writeFile(path,PNG.sync.write(out),{flag:'wx',signal});paths.push(path);
  }
  return paths;
}
