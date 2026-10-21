#!/usr/bin/env python3
"""Recompute descriptive statistics and the exploratory Welch interval.

Reads only the original teaching protocol and 48-row CSV.
Does not edit plugin code, project.json, checkers, or rendered PPTX.
"""
from pathlib import Path
import csv, json, hashlib, math, statistics as st
from scipy.stats import t

ROOT = Path(__file__).resolve().parent.parent
D = ROOT
def dump(name, value):
    p=D/name; p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

rows=list(csv.DictReader((ROOT/'inputs/fatigue.csv').open(encoding='utf-8-sig')))
for r in rows:
    r['cycles_observed']=int(r['cycles_observed']);r['stress_MPa']=int(r['stress_MPa'])
assert len(rows)==48 and len({r['specimen_id'] for r in rows})==48
assert all(r['endpoint'] in ('failed','runout') for r in rows)
assert all(r['cycles_observed']<=500000 for r in rows)
assert all(r['cycles_observed']==500000 for r in rows if r['endpoint']=='runout')
groups={}
for r in rows:groups.setdefault((r['batch'],r['process']),[]).append(r)
gstats={}
for k,rs in groups.items():
    v=[r['cycles_observed'] for r in rs]
    gstats['-'.join(k)]={'n':len(v),'failed':sum(r['endpoint']=='failed' for r in rs),
        'runout':sum(r['endpoint']=='runout' for r in rs),'stress_MPa':rs[0]['stress_MPa'],
        'restricted_mean_cycles':st.mean(v),'sd_of_truncated_cycles':st.stdev(v),
        'median_observed_cycles':st.median(v),'values':v}
def welch(a,b):
    difference=st.mean(a)-st.mean(b)
    va=st.variance(a)/len(a);vb=st.variance(b)/len(b)
    se=math.sqrt(va+vb);df=(va+vb)**2/(va**2/(len(a)-1)+vb**2/(len(b)-1))
    q=float(t.ppf(.975,df))
    return dict(difference=difference,standard_error=se,degrees_of_freedom=df,
        lower=difference-q*se,upper=difference+q*se,
        two_sided_p=float(2*t.sf(abs(difference/se),df)))
bcon=gstats['B-conventional']['values'];bmod=gstats['B-modified']['values']
effect=welch(bmod,bcon)
effect['relative_to_B_conventional']=effect['difference']/st.mean(bcon)
pooled={p:st.mean([r['cycles_observed'] for r in rows if r['process']==p]) for p in ['conventional','modified']}
summary={'identity':'教学模拟数据；不对应真实实验、机构、项目或论文',
    'source_version':'资料版本1，2026-10-20',
    'input_sha256':{n:sha(ROOT/'inputs'/n) for n in ['protocol.md','fatigue.csv']},
    'n':len(rows),'independent_unit':'一件试件；无重复试验',
    'administrative_stop_cycles':500000,'failed':46,'runout':2,
    'groups':gstats,'B_modified_minus_conventional_Welch_95CI':effect,
    'pooled_restricted_means':pooled,
    'pooled_restricted_mean_difference':pooled['modified']-pooled['conventional'],
    'B_minus_A_conventional_mean_difference':st.mean(bcon)-gstats['A-conventional']['restricted_mean_cycles']}
dump('analysis/summary.json',summary)

with (D/'analysis/group-summary.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f);w.writerow(['batch_process','stress_MPa','n','failed','runout','restricted_mean_cycles','sd_of_truncated_cycles','median_observed_cycles'])
    for k,v in gstats.items():w.writerow([k]+[v[x] for x in ['stress_MPa','n','failed','runout','restricted_mean_cycles','sd_of_truncated_cycles','median_observed_cycles']])

report=f'''# 计算说明与证据边界

## 资料身份与复现
全部结果来自教学模拟资料，不对应真实实验、机构、项目或论文。原始协议版本1，2026-10-20。读取48件独立试件，48个唯一ID，无重复试验，无缺失字段；46件失效，2件runout均位于C批、180 MPa、500000循环。未合并旧分析、未查询外部论文。

输入SHA-256：
- protocol.md：{summary['input_sha256']['protocol.md']}
- fatigue.csv：{summary['input_sha256']['fatigue.csv']}

运行 `python analysis/calculate.py` 可从两个原始输入重算数值。SciPy仅用于t分布分位数。精确数值见summary.json，展示统一换算为万次（除以10000），按2位小数取舍，未对输入值取整后再推断。

## 分析单位与比较范围
每行是一件独立试件。A批：常规12件，200 MPa；B批：常规12件、改性12件，200 MPa；C批：改性12件，180 MPa。仅B批在同批次、同应力下拥有两工艺。原协议按可用加工顺序取样，未作随机跨批分配，也未报告B批内随机分配，因此即使B批比较仍是观察关联。设备和环境未另作差异记录，不等同于已证明完全一致。

## 右删失与限制平均寿命
令真实失效寿命为T，τ=500000循环，定义Y=min(T,τ)。所有失效均在τ前，全部runout均完整观察至共同停止点，没有提前删失，因此每件Y可观测，其样本平均是τ以内限制平均寿命的经验估计。这里无需把runout当作失效；它的Y等于50万次，但真实T尚未知。此时经验Kaplan–Meier曲线在[0,τ]下的积分与平均Y相同。该等价依赖本资料没有提前删失；存在提前删失时不能沿用简单均值计算。

| 组别 | 应力/MPa | n | 失效/runout | τ内平均/万次 | 截断值SD/万次 |
|---|---:|---:|---:|---:|---:|
'''
for k,v in gstats.items():
    report+=f"| {k} | {v['stress_MPa']} | {v['n']} | {v['failed']}/{v['runout']} | {v['restricted_mean_cycles']/1e4:.5f} | {v['sd_of_truncated_cycles']/1e4:.5f} |\n"
report+=f'''
全部工艺混合比较：常规26.99744万次，改性38.20647万次，限制均值差11.20903万次。两组各24件，但工艺、批次、应力分布同时改变，不应赋予工艺因果解释，也不能把它与B批差值相减来估计“批次贡献”。

## B批主要比较
B批所有24件都在50万次前失效，故本样本的截断均值与观测失效寿命均值相同。常规均值{st.mean(bcon)/1e4:.8f}万次，改性均值{st.mean(bmod)/1e4:.8f}万次；改性减常规为{effect['difference']/1e4:.8f}万次，相对常规均值+{effect['relative_to_B_conventional']*100:.8f}%。

探索性Welch 95%区间：Δ ± t(0.975,ν) × sqrt(s_m²/n_m + s_c²/n_c)。标准误{effect['standard_error']:.8f}次，自由度{effect['degrees_of_freedom']:.8f}，区间[{effect['lower']/1e4:.8f}, {effect['upper']/1e4:.8f}]万次，双侧p={effect['two_sided_p']:.8f}。P值只作复算信息，不作为报告主结论。推断依赖独立样本与Welch小样本均值近似，未声称分布正态已验证；本模拟样本也不代表真实工程总体。区间包含0，也容许负向差异与较大正向差异，故不能确认增益、不能宣布等效，更不能归因于具体微观机制。

A与B中的常规工艺均为200 MPa，均值差B−A为{summary['B_minus_A_conventional_mean_difference']/1e4:.8f}万次。这只说明当前记录中跨批差异存在；不能单凭该对照确认某一批次因素的因果作用。未把本次多项描述性比较包装为预注册验证。

## 下一批验证：未实施的方案
主要问题：在一批新试件、200 MPa下，改性是否增加50万循环范围内限制平均寿命？同原材料与几何条件；按加工时段分层/区组后，在区组内以1:1随机分配工艺；记录分配、加工顺序、试验顺序、设备与环境，尽可能对失效判定盲法。两组采用相同停止规则，保留失败与runout的事件标识。主要估计量Δ=RMST_改性(50万)−RMST_常规(50万)，按随机组比较。

样本量不直接照搬12/组，也不以当前8.44%作为真效应。先由课题组确定实际有意义的差值及精度目标，再使用B批方差作敏感性分析，并对更大方差和不同删失比例仿真确定样本量。这些设计值目前尚未商定。所有个体仅在共同τ行政停止、无提前删失时，采用组均值与预定区间方法；如发生提前删失，采用预先约定的KM-RMST及不确定性计算，并审核独立删失假设。若关键假设失效，则报告问题与敏感性分析，暂停目标因果判定。单批随机结果也不能自动推广到其它批次、应力或工艺机制。

## 预先声明的判定分支与反例
设主要差值95%区间为[L,U]，先检查随机化、共同应力与终点、事件标记及删失前提。
1. 前提成立且L>0：支持该批、200 MPa、50万次内的正向差异。工程意义另外对照预先确定的阈值；不自动确认机制。
2. 前提成立且U<0：支持反向差异，应复核工艺并讨论停止推广。不能归入“没有显著收益”。
3. 前提成立且L≤0≤U：方向证据不足。未显著不是等效；若要判等效，须事前确定等效界并另行设计检验。
4. 前提不成立：不进入以上效应判断，核查/补充记录并按预案作敏感性分析，必要时重做试验。

反例核查（仅检查规则，非已得结果）：[1,5]万次→正向；[−5,−1]万次→反向；[−2,4]万次→证据不足；[0,4]或[−3,0]→仍含0，归证据不足；任何区间但分配/删失前提失效→先修设计或分析，不能直接宣称增益。页面、讲稿与本说明采用同一规则。

## 证据与未测量内容
本资料没有断口显微图、微观组织或残余应力测量；未提出已证实的材料机制。提议将这些项目作为后续机制子研究，并与寿命主试验区分。正式汇报仅使用协议和CSV两项来源，完整源文件随可恢复工程保留。
'''
(D/'analysis/calculation-notes.md').write_text(report,encoding='utf-8')


print('Recomputed the 48-row teaching dataset; see analysis/summary.json and calculation-notes.md')
