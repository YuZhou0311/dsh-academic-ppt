"""Exact, reproducible teaching graphics for the supplied conformal tutorial.

Run: python author_figures.py
All numerical examples are explicitly illustrative; no experiment is fabricated.
"""
from pathlib import Path
import json, math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Rectangle, FancyBboxPatch
from scipy.stats import beta
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'figures'
OUT.mkdir(exist_ok=True)
font_manager.fontManager.addfont(ROOT/'inputs/fonts/NotoSansCJKsc-Regular.otf')
font_manager.fontManager.addfont(ROOT/'inputs/fonts/NotoSansCJKsc-Bold.otf')
plt.rcParams.update({'font.family':'Noto Sans CJK SC', 'font.size':17,
                     'axes.unicode_minus':False, 'svg.fonttype':'none',
                     'axes.spines.top':False,'axes.spines.right':False})
NAVY='#034A90'; INK='#172A3D'; RED='#B24B34'; GRAY='#526477'
LIGHT='#ECF1F7'; LINE='#C5D2DF'; TEAL='#287D8E'
manifest={}

def save(fig,name,meta):
    for ext in ['png','svg']:
        fig.savefig(OUT/f'{name}.{ext}', dpi=160, bbox_inches='tight',
                    pad_inches=.12, facecolor='white')
    plt.close(fig)
    manifest[name]=meta

# 1. Rank argument, exactly n=9 and alpha=.2. The ten positions are possible
# ranks of the unseen score, not ten observed calibration measurements.
fig,ax=plt.subplots(figsize=(11.8,4.4))
ax.set_xlim(-.7,9.8);ax.set_ylim(-1.55,2.05);ax.axis('off')
ax.text(-.5,1.73,'交换性：测试分数的秩等可能落在 10 个位置',fontsize=23,color=INK,weight='bold')
for r in range(1,11):
    x=r-1; col=NAVY if r<=8 else RED
    ax.add_patch(FancyBboxPatch((x-.34,.18),.69,.65,
                boxstyle='round,pad=0.02,rounding_size=0.08',
                facecolor=col,edgecolor=col))
    ax.text(x,.50,str(r),color='white',ha='center',va='center',fontsize=24,weight='bold')
ax.annotate('',xy=(7.45,-.06),xytext=(-.44,-.06),arrowprops={'arrowstyle':'|-|','color':NAVY,'lw':2})
ax.annotate('',xy=(9.45,-.06),xytext=(7.56,-.06),arrowprops={'arrowstyle':'|-|','color':RED,'lw':2})
ax.text(3.5,-.43,'覆盖：前 8 个秩',ha='center',fontsize=22,color=NAVY,weight='bold')
ax.text(8.5,-.43,'失覆盖',ha='center',fontsize=22,color=RED,weight='bold')
ax.text(-.5,-1.10,r'$n=9,\quad \alpha=0.2,\quad k=\lceil (n+1)(1-\alpha)\rceil=8$',fontsize=23,color=INK)
save(fig,'rank-proof',{'type':'author-created exact teaching diagram','source':'Appendix D, pp.50–51',
      'n':9,'alpha':.2,'k':8,'probability':.8,'note':'Possible ranks, not an empirical sample.'})

# 2. CQR: chosen smooth quantile estimates and a fixed illustrative q=.18.
x=np.linspace(0,1,300)
center=.4+1.05*x+.17*np.sin(2*np.pi*x)
width=.16+.42*x
lo=center-width;hi=center+width;q=.18
fig,ax=plt.subplots(figsize=(10.8,5.4))
ax.fill_between(x,lo-q,hi+q,color='#DDEAF6',label='校准后区间')
ax.fill_between(x,lo,hi,color='#B4CBDD',label='原始分位数区间')
ax.plot(x,lo-q,c=NAVY,lw=2.5);ax.plot(x,hi+q,c=NAVY,lw=2.5)
ax.plot(x,lo,c=GRAY,lw=1.8,ls='--');ax.plot(x,hi,c=GRAY,lw=1.8,ls='--')
xp=.72;ix=np.argmin(abs(x-xp))
ax.annotate('',xy=(xp,hi[ix]+q),xytext=(xp,hi[ix]),arrowprops={'arrowstyle':'<->','color':RED,'lw':2})
ax.text(xp+.025,hi[ix]+q*.38,r'$q$',fontsize=24,color=RED)
ax.set(xlim=(0,1),ylim=(-.05,2.3))
ax.set_xlabel('输入 x（示意，无量纲）',fontsize=21);ax.set_ylabel('输出 y（示意，无量纲）',fontsize=21)
ax.legend(loc='upper left',frameon=False,fontsize=22)
ax.grid(axis='y',alpha=.16);ax.tick_params(labelsize=22)
fig.tight_layout()
save(fig,'cqr-interval',{'type':'author-created illustration; not paper data','source':'§2.2, Eq.(4), p.8',
     'grid':{'start':0,'stop':1,'count':300},'center':'.4+1.05*x+.17*sin(2*pi*x)',
     'half_width':'.16+.42*x','q':q,'note':'Positive q expands. A negative calibrated q would shrink.'})

# 3. APS conservative prefix (Eq.3); same illustrative threshold for two inputs.
fig,axes=plt.subplots(1,2,figsize=(11.7,4.65),sharey=True)
probs=[np.array([.9,.07,.02,.01]),np.array([.35,.30,.20,.15])]
labels=['A','B','C','D']; qaps=.8
for a,p,title in zip(axes,probs,['较容易的输入','较困难的输入']):
    cum=np.cumsum(p)
    cutoff=min(len(p),int(np.sum(cum<qaps))+1)
    cols=[NAVY if j<cutoff else '#CCD6DF' for j in range(4)]
    a.bar(np.arange(4),p,width=.61,color=cols)
    for j,v in enumerate(p):a.text(j,v+.03,f'{v:.2f}',ha='center',fontsize=21,color=INK)
    a.set_xticks(range(4),labels,fontsize=22)
    a.set_ylim(0,1.08);a.set_title(title,fontsize=23,weight='bold',pad=16)
    a.set_xlabel('类别按预测概率降序',fontsize=21)
    a.text(.40 if cutoff==1 else .03,.87,f'输出前缀：{{{", ".join(labels[:cutoff])}}}',transform=a.transAxes,
           fontsize=21,color=NAVY,weight='bold')
    a.grid(axis='y',alpha=.13)
axes[0].set_ylabel('模型预测概率',fontsize=21)
for a in axes:a.tick_params(axis='y',labelsize=21)
fig.tight_layout(w_pad=2)
save(fig,'aps-adaptivity',{'type':'author-created illustrative probability vectors; not data',
     'source':'§2.1 Eq.(3), pp.6–7','probability_vectors':[p.tolist() for p in probs],
     'q':qaps,'rule':'Include the first class crossing the threshold (conservative prefix).',
     'sets':[['A'],['A','B','C']],'note':'The q shown is illustrative. It is calibrated on held-out data in the method.'})

# 4. Exact counterexample described in the tutorial: 90%-mass group with full
# coverage, 10%-mass group with none. Every dot is 1% population mass.
fig,ax=plt.subplots(figsize=(11.7,4.7));ax.axis('off')
for j in range(100):
    row,col=divmod(j,10)
    ax.scatter(col,row,s=150,c=NAVY if j<90 else RED,marker='o')
ax.set_xlim(-.7,17);ax.set_ylim(10.1,-1.1)
ax.text(11,-.2,'A 组：占总体 90%',fontsize=24,color=NAVY,weight='bold')
ax.text(11,1.1,'组内覆盖率 100%',fontsize=22,color=INK)
ax.text(11,3.4,'B 组：占总体 10%',fontsize=24,color=RED,weight='bold')
ax.text(11,4.7,'组内覆盖率 0%',fontsize=22,color=INK)
ax.text(11,7.2,'总体仍覆盖 90%',fontsize=25,color=INK,weight='bold')
ax.text(11,8.7,'0.9 × 1 + 0.1 × 0 = 0.9',fontsize=20,color=GRAY)
save(fig,'marginal-counterexample',{'type':'author-created exact counterexample',
     'source':'§3.1 p.13 text example','group_mass':[.9,.1],'group_coverage':[1,0],
     'marginal_coverage':.9,'note':'100 dots represent population mass; this is not a dataset of 100 observations.'})

# 5. Analytic coverage distribution, not a Monte Carlo histogram.
fig,ax=plt.subplots(figsize=(10.9,5.3))
z=np.linspace(.79,.995,1600);alpha=.1;rows=[]
for n,col in [(100,GRAY),(1000,TEAL),(10000,NAVY)]:
    k=math.ceil((n+1)*(1-alpha));b=n+1-k
    dens=beta.pdf(z,k,b)
    ax.plot(z,dens,color=col,lw=2.8,label=f'n = {n:,}')
    low,high=beta.ppf([.025,.975],k,b)
    rows.append({'n':n,'k':k,'second_shape':b,'central95':[float(low),float(high)],'mean':k/(n+1)})
ax.axvline(.9,color=RED,lw=1.5,ls='--')
ax.set(xlim=(.80,.985),ylim=(0,145))
ax.set_xlabel('固定校准集后的真实覆盖概率',fontsize=21);ax.set_ylabel('概率密度',fontsize=21)
ax.legend(frameon=False,loc='upper left',fontsize=22)
ax.text(.939,112,'α = 0.1\ni.i.d. 连续分数',fontsize=20,color=INK)
ax.grid(axis='y',alpha=.16)
ax.tick_params(labelsize=22);fig.tight_layout()
save(fig,'calibration-beta',{'type':'author-created analytic plot, no observed data',
     'source':'§3.2 pp.14–15; Appendix C pp.49–50',
     'law':'Beta(k,n+1-k), k=ceil((n+1)*(1-alpha))','alpha':alpha,'values':rows,
     'grid':{'start':.79,'stop':.995,'count':1600}})

# 6. Preserve original Fig.15 left panel, axes and legend. No redrawing or
# digitization of values. PDF coordinates obtained from the inspected page.
doc=fitz.open(ROOT/'inputs/paper.pdf');page=doc[23]
clip=fitz.Rect(72,198,317,311)
page.get_pixmap(matrix=fitz.Matrix(5,5),clip=clip).save(OUT/'weather-original.png')
manifest['weather-original']={'type':'source crop','source':'paper.pdf p.24 Figure15 left',
     'clip_pdf_points':[72,198,317,311],
     'note':'Original line plot; retains coverage axis, timestamp axis, weighted/unweighted legend. No numerical digitization.'}

(OUT/'figure-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'created':list(manifest),'output':str(OUT)},ensure_ascii=False))
