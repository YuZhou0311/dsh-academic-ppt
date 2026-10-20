"""Reproducible descriptive analysis of supplied teaching-simulation records."""
from pathlib import Path
import csv, hashlib, json
import numpy as np
from scipy import stats

ROOT=Path(__file__).resolve().parent
OUT=ROOT
SRC=ROOT
rows=list(csv.DictReader((SRC/'fatigue.csv').open(encoding='utf-8-sig')))
for r in rows:
    r['cycles_observed']=int(r['cycles_observed'])
    r['stress_MPa']=int(r['stress_MPa'])

groups=[]
for batch,process in [('A','conventional'),('B','conventional'),('B','modified'),('C','modified')]:
    sample=[r for r in rows if r['batch']==batch and r['process']==process]
    x=np.array([r['cycles_observed'] for r in sample])
    groups.append(dict(batch=batch,process=process,n=len(sample),stress_MPa=sample[0]['stress_MPa'],
        failed=sum(r['endpoint']=='failed' for r in sample),runout=sum(r['endpoint']=='runout' for r in sample),
        observed_mean=float(x.mean()),observed_median=float(np.median(x)),
        minimum=int(x.min()),maximum=int(x.max()),observed_sd=float(x.std(ddof=1)),
        values=[int(v) for v in x]))

x=np.array([r['cycles_observed'] for r in rows if r['batch']=='B' and r['process']=='conventional'])
y=np.array([r['cycles_observed'] for r in rows if r['batch']=='B' and r['process']=='modified'])
vx=x.var(ddof=1)/len(x); vy=y.var(ddof=1)/len(y)
se=float(np.sqrt(vx+vy)); df=float((vx+vy)**2/(vx**2/(len(x)-1)+vy**2/(len(y)-1)))
mean_delta=float(y.mean()-x.mean())
welch_half=float(stats.t.ppf(.975,df)*se)
rng=np.random.default_rng(20261020)
reps=100000
boot_x=rng.choice(x,(reps,len(x)),replace=True).mean(axis=1)
boot_y=rng.choice(y,(reps,len(y)),replace=True).mean(axis=1)
bootstrap_ci=np.quantile(boot_y-boot_x,[.025,.975]).tolist()
pooled={p:np.array([r['cycles_observed'] for r in rows if r['process']==p]) for p in ['conventional','modified']}

result={
  'identity':'教学模拟数据；合成记录，不对应真实实验、机构、项目或论文',
  'sources':{f:{'path':f,'sha256':hashlib.sha256((SRC/f).read_bytes()).hexdigest()} for f in ['protocol.md','fatigue.csv']},
  'validation':{
    'n':len(rows),'unique_specimen_ids':len({r['specimen_id'] for r in rows}),
    'missing_fields':sum(v=='' for r in rows for v in r.values()),
    'all_cycles_positive':all(r['cycles_observed']>0 for r in rows),
    'endpoint_counts':{e:sum(r['endpoint']==e for r in rows) for e in ['failed','runout']},
    'runouts_at_predefined_stop':all(r['cycles_observed']==500000 for r in rows if r['endpoint']=='runout')},
  'groups':groups,
  'batch_B':{
    'n_conventional':len(x),'n_modified':len(y),'stress_MPa':200,'all_failed':True,
    'mean_conventional':float(x.mean()),'mean_modified':float(y.mean()),'mean_difference':mean_delta,
    'mean_ratio':float(y.mean()/x.mean()),'relative_mean_difference_pct':float((y.mean()/x.mean()-1)*100),
    'median_conventional':float(np.median(x)),'median_modified':float(np.median(y)),
    'median_difference':float(np.median(y)-np.median(x)),
    'relative_median_difference_pct':float((np.median(y)/np.median(x)-1)*100),
    'bootstrap_percentile_95_ci_mean_difference':bootstrap_ci,
    'bootstrap_replicates':reps,'bootstrap_seed':20261020,
    'bootstrap_unit':'independent specimen, resampled separately within each B process group',
    'welch_95_ci_mean_difference':[mean_delta-welch_half,mean_delta+welch_half],'welch_df':df,
    'uncertainty_boundary':'模型条件下的探索性区间，只反映组内试件差异；不能消除加工顺序与未测条件偏差或建立因果归因'},
  'pooled_observed_means':{
    'conventional':float(pooled['conventional'].mean()),'modified':float(pooled['modified'].mean()),
    'relative_difference_pct':float((pooled['modified'].mean()/pooled['conventional'].mean()-1)*100),
    'interpretation':'仅为停止点500000下观察时长的描述，不是未截尾失效寿命总体均值；混合批次与应力，不可归因于工艺'},
  'C_runout':{'n':12,'failed':10,'right_censored':2,'time_limit':500000,
    'failure_lifetimes_of_runout':'unknown, strictly greater than 500000 if absence of failure at stop is observed',
    'survival_at_500000':2/12,
    'restriction':'仅180 MPa改性C批次的描述，无常规对照，不能识别应力效应、批次效应或工艺效应'}
}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
