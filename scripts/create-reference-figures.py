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
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':14,'axes.titlesize':16,'axes.labelsize':14,'xtick.labelsize':12,'ytick.labelsize':12,'axes.spines.top':False,'axes.spines.right':False,'axes.linewidth':0.8,'legend.frameon':False,'savefig.facecolor':'white'})
blue='#204b7a';red='#983747';gray='#636b75';rng=np.random.default_rng(2048)
x=np.arange(0,21,2); y0=np.array([12,18,23,27,31,34,36,38,39,40,41]);y1=np.array([12,20,28,34,39,43,46,48,49,50,51]);err=np.array([2,2,3,3,4,4,4,5,5,5,5])
data={'notice':'Synthetic demonstration values only. Replace with verified paper source data before reporting scientific findings.','time':x.tolist(),'conditionA':y0.tolist(),'conditionB':y1.tolist(),'illustrativeIntervalHalfWidth':err.tolist()}
def curve(ax,label='A'):
    ax.plot(x,y0,'o-',c=gray,label='Condition A',lw=2,ms=4)
    ax.plot(x,y1,'s-',c=blue,label='Condition B',lw=2,ms=4)
    ax.fill_between(x,y1-err,y1+err,color=blue,alpha=.12)
    ax.set(xlabel='Time (a.u.)',ylabel='Response (a.u.)',title=f'{label}  Response over time',ylim=(0,60));ax.legend(loc='upper left',fontsize=11);ax.grid(axis='y',c='#dce2e9',lw=.6)
def distribution(ax,label='B'):
    vals=[rng.normal(mu,sd,18) for mu,sd in [(24,4),(29,5),(35,4)]]
    parts=ax.boxplot(vals,patch_artist=True,widths=.45,tick_labels=['Control','Low','High'])
    for q,c in zip(parts['boxes'],[gray,blue,red]):q.set(facecolor=c,alpha=.13,edgecolor=c)
    for i,(v,c) in enumerate(zip(vals,[gray,blue,red]),1):ax.scatter(np.linspace(i-.13,i+.13,len(v)),v,s=14,c=c,alpha=.75,zorder=3)
    ax.set(ylabel='Observed value (a.u.)',title=f'{label}  Independent observations',ylim=(10,48));ax.grid(axis='y',c='#dce2e9',lw=.6)
def transfer(ax,label='C'):
    matrix=np.array([[.82,.76,.71,.66],[.78,.85,.73,.69],[.70,.75,.87,.74],[.63,.68,.72,.84]])
    im=ax.imshow(matrix,cmap='Blues',vmin=.5,vmax=1,aspect='auto')
    ax.set(xticks=range(4),yticks=range(4),xticklabels=['E1','E2','E3','E4'],yticklabels=['E1','E2','E3','E4'],xlabel='Test environment',ylabel='Training environment',title=f'{label}  Transfer matrix')
    for i in range(4):
        for j in range(4):ax.text(j,i,f'{matrix[i,j]:.2f}',ha='center',va='center',color='white' if matrix[i,j]>.8 else '#102840',fontsize=13)
    return im
def errorbars(ax,label='D'):
    means=np.array([0.0,.22,.31,.43]);lower=np.array([.08,.11,.14,.16]);pos=np.arange(4)
    ax.errorbar(means,pos,xerr=lower,fmt='o',color=blue,ecolor=gray,capsize=4,lw=1.5)
    ax.axvline(0,c='#8b939c',lw=1,ls='--');ax.set(yticks=pos,yticklabels=['Reference','Variant 1','Variant 2','Variant 3'],xlabel='Effect relative to reference (a.u.)',title=f'{label}  Effect and interval',xlim=(-.2,.7));ax.invert_yaxis();ax.grid(axis='x',c='#dce2e9',lw=.6)
def save(fig,name):
    fig.text(.5,.012,'SYNTHETIC TEMPLATE DATA · NOT A RESEARCH FINDING',ha='center',va='bottom',fontsize=10,color='#983747')
    fig.savefig(out/name,dpi=140,bbox_inches=None);plt.close(fig)
for name,fn in [('response.png',curve),('distribution.png',distribution),('transfer.png',transfer),('effect-interval.png',errorbars)]:
    fig,ax=plt.subplots(figsize=(8,4.8));fn(ax);fig.subplots_adjust(left=.16,right=.96,top=.87,bottom=.20);save(fig,name)
fig,axs=plt.subplots(2,2,figsize=(12,7.2))
for fn,ax,l in zip([curve,distribution,transfer,errorbars],axs.flat,'ABCD'):fn(ax,l)
fig.subplots_adjust(left=.095,right=.98,top=.92,bottom=.115,hspace=.68,wspace=.42);save(fig,'four-panels.png')
fig,axs=plt.subplots(1,3,figsize=(16,3.8))
for fn,ax,l in zip([curve,distribution,errorbars],axs,'ABD'):
    fn(ax,l)
    ax.tick_params(labelsize=12)
    ax.title.set_fontsize(16)
    ax.xaxis.label.set_size(14);ax.yaxis.label.set_size(14)
fig.subplots_adjust(left=.065,right=.99,top=.84,bottom=.25,wspace=.62);save(fig,'wide-panels.png')
fig,axs=plt.subplots(3,1,figsize=(6.5,10.8))
for fn,ax,l in zip([curve,distribution,errorbars],axs,'ABD'):fn(ax,l)
fig.subplots_adjust(left=.24,right=.96,top=.95,bottom=.085,hspace=.65);save(fig,'portrait-panels.png')
(out/'synthetic-data.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'output':str(out),'pngs':7,'data':'synthetic-data.json'}))
