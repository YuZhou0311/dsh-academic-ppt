#!/usr/bin/env python3
"""Inspect native PPTX structure with the Python standard library.
NOT a renderer. Theme/inherited text properties and geometry without an explicit
transform are not guessed. Outputs stay local; do not redistribute source assets.
"""
import argparse, collections, hashlib, html, json, math, posixpath, sys, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
EMU=914400
I=(1.,0.,0.,1.,0.,0.)
def q(s):
    a,b=s.split(':');return '{'+NS[a]+'}'+b

def mul(a,b):
    A,B,C,D,E,F=a;g,h,i,j,k,l=b
    return (A*g+C*h,B*g+D*h,A*i+C*j,B*i+D*j,A*k+C*l+E,B*k+D*l+F)

def point(m,x,y):
    a,b,c,d,e,f=m;return a*x+c*y+e,b*x+d*y+f

def translate(x,y):return (1,0,0,1,x,y)

def group_matrix(xfrm):
    """Map child coordinates through scale, reflection, rotation, and translation."""
    def xy(tag,ax,ay,defaults):
        e=xfrm.find(q(tag));return defaults if e is None else (float(e.get(ax,defaults[0])),float(e.get(ay,defaults[1])))
    x,y=xy('a:off','x','y',(0,0));w,h=xy('a:ext','cx','cy',(1,1))
    ox,oy=xy('a:chOff','x','y',(0,0));cw,ch=xy('a:chExt','cx','cy',(w,h))
    if not cw or not ch:raise ValueError('group has zero child extent')
    m=mul(translate(x,y),mul((w/cw,0,0,h/ch,0,0),translate(-ox,-oy)))
    angle=float(xfrm.get('rot',0))/60000*math.pi/180
    sx=-1 if xfrm.get('flipH') in ('1','true') else 1
    sy=-1 if xfrm.get('flipV') in ('1','true') else 1
    c,s=math.cos(angle),math.sin(angle)
    rotation=(c*sx,s*sx,-s*sy,c*sy,0,0)
    return mul(mul(translate(x+w/2,y+h/2),mul(rotation,translate(-x-w/2,-y-h/2))),m)

def bounds(xfrm,parent=I):
    off=xfrm.find(q('a:off'));ext=xfrm.find(q('a:ext'))
    if off is None or ext is None:return None
    x,y=float(off.get('x',0)),float(off.get('y',0));w,h=float(ext.get('cx',0)),float(ext.get('cy',0))
    rad=float(xfrm.get('rot',0))/60000*math.pi/180;c,s=math.cos(rad),math.sin(rad)
    rotation=mul(translate(x+w/2,y+h/2),mul((c,s,-s,c,0,0),translate(-x-w/2,-y-h/2)))
    m=mul(parent,rotation);pts=[point(m,a,b) for a,b in [(x,y),(x+w,y),(x,y+h),(x+w,y+h)]]
    xs,ys=zip(*pts);return [min(xs)/EMU,min(ys)/EMU,(max(xs)-min(xs))/EMU,(max(ys)-min(ys))/EMU]

def inspect(source,selected=None,include_text=False):
    source=Path(source);report={'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scope':'slide-local leaf objects; master artwork excluded; explicit text styles only','limitations':['Not a PPTX rendering or an aesthetic score.','Missing placeholder geometry and inherited/theme typography are reported, not inferred.','Charts, SmartArt and embedded raster content are not semantically decoded.'],'slides':[]}
    with zipfile.ZipFile(source) as z:
        infos=z.infolist()
        if len(infos)>20000 or sum(i.file_size for i in infos)>1024**3 or any(i.file_size>150*1024**2 for i in infos):raise ValueError('PPTX exceeds inspection resource limits')
        names=set(z.namelist())
        def read(part):
            data=z.read(part)
            if b'<!DOCTYPE' in data or b'<!ENTITY' in data:raise ValueError('XML entities are not accepted')
            return ET.fromstring(data)
        def rels(part):
            rp=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
            if rp not in names:return {}
            out={}
            for r in read(rp):
                if r.get('TargetMode')=='External':continue
                target=r.get('Target','');resolved=posixpath.normpath(posixpath.join(posixpath.dirname(part),target)) if not target.startswith('/') else target.lstrip('/')
                if resolved.startswith('../'):raise ValueError('invalid relationship path')
                out[r.get('Id')]=resolved
            return out
        pr=read('ppt/presentation.xml');sz=pr.find(q('p:sldSz'))
        width,height=int(sz.get('cx'))/EMU,int(sz.get('cy'))/EMU;report['slideSizeInches']=[width,height]
        ids=pr.find(q('p:sldIdLst'));prrels=rels('ppt/presentation.xml');report['pageCount']=len(ids)
        for page,sid in enumerate(ids,1):
            if selected is not None and page not in selected:continue
            part=prrels[sid.get(q('r:id'))];root=read(part);rr=rels(part);objects=[];warnings=[];fontcounts=collections.Counter();facecounts=collections.Counter()
            def walk(tree,m=I,groups=()):
                for el in tree:
                    kind=el.tag.split('}')[-1]
                    if kind=='grpSp':
                        xf=el.find('p:grpSpPr/a:xfrm',NS)
                        if xf is None:warnings.append('group transform missing');new=m
                        else:new=mul(m,group_matrix(xf))
                        walk(el,new,groups+(len(groups)+1,));continue
                    if kind not in ('sp','pic','graphicFrame','cxnSp'):continue
                    xf=el.find('p:spPr/a:xfrm',NS)
                    if xf is None:xf=el.find('p:xfrm',NS)
                    rect=None if xf is None else bounds(xf,m)
                    cn=next(iter(el.findall('.//p:cNvPr',NS)),None)
                    oid=cn.get('id') if cn is not None else str(len(objects)+1)
                    texts=[];sizes=[];faces=[]
                    for r in el.findall('.//a:r',NS):
                        t=r.find(q('a:t'));t='' if t is None else t.text or '';texts.append(t);rp=r.find(q('a:rPr'))
                        if rp is not None:
                            if rp.get('sz'):
                                val=int(rp.get('sz'))/100;sizes.append(val);fontcounts[str(val)]+=len(t)
                            for ff in ['a:latin','a:ea','a:cs']:
                                face=rp.find(q(ff))
                                if face is not None and face.get('typeface'):faces.append(face.get('typeface'));facecounts[face.get('typeface')]+=len(t)
                    is_table=el.find('.//a:tbl',NS) is not None
                    obj={'id':oid,'kind':'table' if is_table else kind,'groupDepth':len(groups),'boundsInches':None if rect is None else [round(v,5) for v in rect],'explicitFontSizesPt':sorted(set(sizes)),'explicitFontFaces':sorted(set(faces)),'textCharacters':len(''.join(texts))}
                    if rect is None:warnings.append(f'object {oid}: no explicit geometry (may inherit placeholder transform)')
                    if include_text:obj['text']=''.join(texts)
                    if kind=='pic':
                        b=el.find('.//a:blip',NS);target=rr.get(b.get(q('r:embed'))) if b is not None else None
                        obj['imagePart']=target
                        if target in names:obj['imageSha256']=hashlib.sha256(z.read(target)).hexdigest()
                        crop=el.find('.//a:srcRect',NS);obj['cropFraction']={k:int(crop.get(k,'0'))/100000 for k in ['l','t','r','b']} if crop is not None else dict.fromkeys(['l','t','r','b'],0)
                    objects.append(obj)
            tree=root.find('p:cSld/p:spTree',NS)
            if tree is not None:walk(tree)
            report['slides'].append({'page':page,'part':part,'leafObjects':len(objects),'pictures':sum(o['kind']=='pic' for o in objects),'tables':sum(o['kind']=='table' for o in objects),'explicitSizeCharacterCounts':dict(fontcounts),'explicitFaceCharacterCounts':dict(facecounts),'objects':objects,'warnings':warnings})
    return report

def write_output(report,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=False)
    (out/'profile.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    w,h=report['slideSizeInches'];scale=1280/w
    for page in report['slides']:
        svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 {h*scale+30}"><rect width="100%" height="100%" fill="white"/><text x="8" y="18" font-size="14">GEOMETRY ONLY / page {page["page"]} / NOT a rendered slide</text>']
        for o in page['objects']:
            if o['boundsInches'] is None:continue
            x,y,bw,bh=[v*scale for v in o['boundsInches']];y+=30
            color='#7B4A9D' if o['kind']=='pic' else '#1865A6' if o['kind']=='table' else '#7B8D9C'
            svg.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(0,bw):.2f}" height="{max(0,bh):.2f}" fill="none" stroke="{color}" stroke-width=".7"/><text x="{x+2:.2f}" y="{y+11:.2f}" font-size="9" fill="{color}">{html.escape(o["id"])} {o["kind"]}</text>')
        svg.append('</svg>');(out/f'page-{page["page"]:02d}-geometry.svg').write_text(''.join(svg),encoding='utf-8')
    (out/'README.txt').write_text('Local reference-study output. Contains no copied image bytes. Geometry SVG is NOT an actual render. Text and file identity may be private; do not redistribute without authorization.\n',encoding='utf-8')

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source');ap.add_argument('--out',required=True);ap.add_argument('--pages');ap.add_argument('--include-text',action='store_true');a=ap.parse_args()
    try:
        selected=None if not a.pages else {int(n) for n in a.pages.split(',')}
        if selected is not None and any(n<1 for n in selected):raise ValueError('page numbers are 1-based')
        report=inspect(a.source,selected,a.include_text)
        if selected and not selected.issubset({s['page'] for s in report['slides']}):raise ValueError('requested page is outside presentation')
        write_output(report,a.out);print(json.dumps({'ok':True,'pages':[s['page'] for s in report['slides']],'output':a.out,'note':'Structural inventory only; render and inspect visually next.'},ensure_ascii=False))
    except (OSError,ValueError,KeyError,zipfile.BadZipFile,ET.ParseError) as e:
        print(json.dumps({'ok':False,'error':str(e)},ensure_ascii=False),file=sys.stderr);sys.exit(1)
