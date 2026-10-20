#!/usr/bin/env python3
"""Create deterministic scientific chart placeholders for the academic layout pack.

All values are synthetic demonstrations. They are not paper results.
Matplotlib is needed only to recreate these bundled chart PNGs, not to run DSH.
"""
from pathlib import Path
import argparse, json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p=argparse.ArgumentParser()
p.add_argument('--output', default=str(Path(__file__).resolve().parents[1]/'skills/dsh-academic-ppt/references/templates/assets'))
a=p.parse_args(); out=Path(a.output); out.mkdir(parents=True,exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':20,'axes.titlesize':20,'axes.labelsize':20,'xtick.labelsize':20,'ytick.labelsize':20,'axes.spines.top':False,'axes.spines.right':False,'axes.linewidth':1.0,'legend.frameon':False,'savefig.facecolor':'white'})
blue='#204b7a';red='#983747';gray='#636b75';rng=np.random.default_rng(2048)
x=np.arange(0,21,2); y0=np.array([12,18,23,27,31,34,36,38,39,40,41]);y1=np.array([12,20,28,34,39,43,46,48,49,50,51]);err=np.array([2,2,3,3,4,4,4,5,5,5,5])
observations=[rng.normal(mu,sd,18) for mu,sd in [(24,4),(29,5),(35,4)]]
matrix=np.array([[.82,.76,.71,.66],[.78,.85,.73,.69],[.70,.75,.87,.74],[.63,.68,.72,.84]])
means=np.array([0.0,.22,.31,.43]);lower=np.array([.08,.11,.14,.16])
data={'notice':'Synthetic demonstration values only. Replace with verified paper source data before reporting scientific findings.','time':x.tolist(),'conditionA':y0.tolist(),'conditionB':y1.tolist(),'illustrativeIntervalHalfWidth':err.tolist(),'observations':dict(zip(['Control','Low','High'],[v.tolist() for v in observations])),'transferMatrix':matrix.tolist(),'effectMeans':means.tolist(),'effectIntervalHalfWidths':lower.tolist(),'figureTypography':{'sourceDpi':140,'minimumReadingLabelPt':20,'wideReadingLabelPt':24,'smallDisclosurePt':10,'note':'Disclosure text is not an axis or data label. A/B denote Condition A/B; Ref. and V1–V3 denote reference and variants. Compound overview images need separate projected-size review.'}}
def curve(ax,label='A'):
    ax.plot(x,y0,'o-',c=gray,label='A',lw=2,ms=4)
    ax.plot(x,y1,'s-',c=blue,label='B',lw=2,ms=4)
    ax.fill_between(x,y1-err,y1+err,color=blue,alpha=.12)
    ax.set(xlabel='Time (a.u.)',ylabel='Response (a.u.)',title=f'{label}  Time response',ylim=(0,60),xlim=(-1,25.5),xticks=[0,10,20],yticks=[0,30,60]);ax.grid(axis='y',c='#dce2e9',lw=.6)
    # Endpoint labels identify both conditions without covering the evidence.
    ax.text(21.2,y0[-1],'A',color=gray,fontsize=20,va='center')
    ax.text(21.2,y1[-1],'B',color=blue,fontsize=20,va='center')
def distribution(ax,label='B'):
    vals=observations
    parts=ax.boxplot(vals,patch_artist=True,widths=.45,tick_labels=['Control','Low','High'])
    for q,c in zip(parts['boxes'],[gray,blue,red]):q.set(facecolor=c,alpha=.13,edgecolor=c)
    for i,(v,c) in enumerate(zip(vals,[gray,blue,red]),1):ax.scatter(np.linspace(i-.13,i+.13,len(v)),v,s=14,c=c,alpha=.75,zorder=3)
    ax.set(ylabel='Value (a.u.)',title=f'{label}  Observations',ylim=(10,48),yticks=[10,25,40]);ax.grid(axis='y',c='#dce2e9',lw=.6)
def transfer(ax,label='C'):
    im=ax.imshow(matrix,cmap='Blues',vmin=.5,vmax=1,aspect='auto')
    ax.set(xticks=range(4),yticks=range(4),xticklabels=['E1','E2','E3','E4'],yticklabels=['E1','E2','E3','E4'],xlabel='Test env.',ylabel='Train env.',title=f'{label}  Transfer matrix')
    for i in range(4):
        for j in range(4):ax.text(j,i,f'{matrix[i,j]:.2f}',ha='center',va='center',color='white' if matrix[i,j]>.8 else '#102840',fontsize=20)
    return im
def errorbars(ax,label='D'):
    pos=np.arange(4)
    ax.errorbar(means,pos,xerr=lower,fmt='o',color=blue,ecolor=gray,capsize=4,lw=1.5)
    ax.axvline(0,c='#8b939c',lw=1,ls='--');ax.set(yticks=pos,yticklabels=['Ref.','V1','V2','V3'],xlabel='Effect (a.u.)',title=f'{label}  Effect interval',xlim=(-.2,.7),xticks=[0,.3,.6]);ax.invert_yaxis();ax.grid(axis='x',c='#dce2e9',lw=.6)
def save(fig,name):
    fig.text(.5,.012,'SYNTHETIC DATA · MIT',ha='center',va='bottom',fontsize=10,color='#983747')
    fig.savefig(out/name,dpi=140,bbox_inches=None);plt.close(fig)
for name,fn in [('response.png',curve),('distribution.png',distribution),('transfer.png',transfer),('effect-interval.png',errorbars)]:
    fig,ax=plt.subplots(figsize=(3.8,2.8));fn(ax);fig.subplots_adjust(left=.22,right=.965,top=.80,bottom=.33);save(fig,name)
fig,axs=plt.subplots(2,2,figsize=(10,7.4))
for fn,ax,l in zip([curve,distribution,transfer,errorbars],axs.flat,'ABCD'):fn(ax,l)
fig.subplots_adjust(left=.12,right=.97,top=.91,bottom=.12,hspace=.85,wspace=.70);save(fig,'four-panels.png')
fig,axs=plt.subplots(1,3,figsize=(14,3.5))
for fn,ax,l in zip([curve,distribution,errorbars],axs,'ABD'):
    fn(ax,l)
    ax.tick_params(labelsize=24)
    ax.title.set_fontsize(24)
    ax.xaxis.label.set_size(24);ax.yaxis.label.set_size(24)
    for t in ax.texts: t.set_fontsize(24)
    if ax.get_legend():
        for t in ax.get_legend().get_texts(): t.set_fontsize(24)
fig.subplots_adjust(left=.065,right=.985,top=.82,bottom=.31,wspace=.66);save(fig,'wide-panels.png')
fig,axs=plt.subplots(3,1,figsize=(6.5,10.8))
for fn,ax,l in zip([curve,distribution,errorbars],axs,'ABD'):fn(ax,l)
fig.subplots_adjust(left=.20,right=.96,top=.945,bottom=.105,hspace=.75);save(fig,'portrait-panels.png')
(out/'synthetic-data.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'output':str(out),'pngs':7,'data':'synthetic-data.json'}))
