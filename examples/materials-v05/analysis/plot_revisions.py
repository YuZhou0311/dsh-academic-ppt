"""Legible publication figures for the final slide proportions; no project edits."""
from pathlib import Path
import csv,json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
R=Path(__file__).resolve().parents[1]
for face in ['Regular','Bold']:font_manager.fontManager.addfont(str(R/f'fonts/NotoSansCJKsc-{face}.otf'))
plt.rcParams.update({'font.family':'Noto Sans CJK SC','font.size':21,'axes.unicode_minus':False,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
rows=list(csv.DictReader((R/'inputs/fatigue.csv').open()))
fig,ax=plt.subplots(figsize=(9,4.6),dpi=180)
for i,(batch,process,label) in enumerate([('A','conventional','A 常规  n=12'),('B','conventional','B 常规  n=12'),('B','modified','B 改性  n=12'),('C','modified','C 改性  n=12')]):
 rr=[r for r in rows if r['batch']==batch and r['process']==process]
 for j,r in enumerate(rr):
  y=3-i+[-.08,0,.08][j%3]
  runout=r['endpoint']=='runout'
  if runout: y=3-i+(-.13 if r['specimen_id']=='C-mod-02' else .13)
  ax.scatter(int(r['cycles_observed'])/1e4,y,s=105 if runout else 65,marker='>' if runout else 'o',c='#B45132' if process=='modified' else '#034A90',edgecolor='white',linewidth=.5,zorder=3)
ax.set(xlim=(10,54),xticks=[10,20,30,40,50],ylim=(-.48,3.48),yticks=[3,2,1,0],yticklabels=['A 常规  n=12','B 常规  n=12','B 改性  n=12','C 改性  n=12'],xlabel='受限观察循环数 / 万次')
ax.grid(axis='x',color='#D6E1EB',lw=.9)
ax.tick_params(axis='y',length=0,labelsize=20,pad=12)
ax.tick_params(axis='x',labelsize=20)
ax.spines['left'].set_visible(False)
fig.subplots_adjust(left=.30,right=.98,bottom=.19,top=.96)
for ext in ['png','svg']:fig.savefig(R/f'figures/all-observations-v1.{ext}',facecolor='white')
plt.close(fig)
S=json.loads((R/'analysis/statistics.json').read_text())
xx=[0]+[r['cycles'] for r in S['C']['km_event_table']]+[500000]
yy=[1]+[r['survival'] for r in S['C']['km_event_table']]+[S['C']['survival_just_before_tau']]
fig,ax=plt.subplots(figsize=(8.8,5.5),dpi=180)
x=np.array(xx)/1e4
ax.step(x,yy,where='post',color='#034A90',lw=3.4)
ax.fill_between(x,yy,step='post',alpha=.12,color='#034A90')
ax.plot([50],[yy[-1]],marker='|',ms=21,mew=3,color='#B45132',clip_on=False)
ax.annotate('2件 runout\n50万次停止观察',xy=(50,yy[-1]),xytext=(26,.48),fontsize=22,color='#B45132',arrowprops=dict(arrowstyle='->',color='#B45132',lw=2.0))
ax.text(5,.18,'曲线下方面积\n受限均值 43.48万次',fontsize=22,color='#034A90')
ax.set(xlim=(0,52),ylim=(0,1.05),xticks=[0,10,20,30,40,50],yticks=[0,.25,.5,.75,1],xlabel='循环次数 / 万次',ylabel='未失效比例')
ax.grid(axis='y',color='#DDE5EC',lw=.8)
ax.set_title('C批改性 · 180 MPa · n=12',fontsize=22,loc='left',pad=16)
fig.subplots_adjust(left=.16,right=.97,bottom=.18,top=.87)
for ext in ['png','svg']:fig.savefig(R/f'figures/C-km-rmst-v2.{ext}',facecolor='white')
plt.close(fig)
print('Wrote two revised figure pairs (PNG/SVG). Original C plot retained.')
