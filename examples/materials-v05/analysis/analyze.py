"""Reproduce the teaching-data analysis and one survival figure.

This script reads only the two stated inputs and writes analysis/ and figures/.
It does not create or modify the Academic PPT project.
"""
from __future__ import annotations
import csv
import hashlib
import json
import math
from pathlib import Path
import platform
import numpy as np
import scipy
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis"
FIG = ROOT / "figures"
OUT.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)
TAU = 500_000
DELTA = 30_000  # Discussion value, not established by protocol or engineering validation.
SEED = 20261020
BOOTSTRAPS = 100_000

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = list(csv.DictReader((ROOT / "inputs/fatigue.csv").open(encoding="utf-8-sig")))
for r in rows:
    r["cycles_observed"] = int(r["cycles_observed"])
    r["stress_MPa"] = int(r["stress_MPa"])
assert len(rows) == 48
assert len({r["specimen_id"] for r in rows}) == 48
assert all(r["endpoint"] in {"failed", "runout"} for r in rows)
assert all(0 < r["cycles_observed"] <= TAU for r in rows)
assert all(r["endpoint"] != "runout" or r["cycles_observed"] == TAU for r in rows)

groups = {}
for batch, process in [("A", "conventional"), ("B", "conventional"), ("B", "modified"), ("C", "modified")]:
    rr = [r for r in rows if r["batch"] == batch and r["process"] == process]
    x = np.array([r["cycles_observed"] for r in rr], dtype=float)
    groups[f"{batch}_{process}"] = dict(
        batch=batch, process=process, n=len(x), failed=sum(r["endpoint"] == "failed" for r in rr),
        runout=sum(r["endpoint"] == "runout" for r in rr), stress_MPa=rr[0]["stress_MPa"],
        mean=float(x.mean()), sd=float(x.std(ddof=1)), median=float(np.median(x)),
        minimum=float(x.min()), maximum=float(x.max()), values=x.tolist(),
        specimen_ids=[r["specimen_id"] for r in rr],
    )

def welch(a, b):
    """Difference b - a, two-sided exploratory Welch interval."""
    a, b = np.asarray(a), np.asarray(b)
    va, vb = float(a.var(ddof=1) / len(a)), float(b.var(ddof=1) / len(b))
    se = math.sqrt(va + vb)
    dof = (va + vb) ** 2 / (va ** 2 / (len(a) - 1) + vb ** 2 / (len(b) - 1))
    diff = float(b.mean() - a.mean())
    critical = float(stats.t.ppf(0.975, dof))
    return dict(estimate=diff, se=se, degrees_of_freedom=dof,
                lower=diff - critical * se, upper=diff + critical * se,
                p_two_sided=float(2 * stats.t.sf(abs(diff / se), dof)),
                method="Welch t, two-sided 95%; exploratory model-based interval, not causal")

bcon = np.array(groups["B_conventional"]["values"])
bmod = np.array(groups["B_modified"]["values"])
b = welch(bcon, bmod)
b["relative_point_difference"] = b["estimate"] / bcon.mean()
rng = np.random.default_rng(SEED)
boot = bmod[rng.integers(0, len(bmod), size=(BOOTSTRAPS, len(bmod)))].mean(axis=1) - bcon[rng.integers(0, len(bcon), size=(BOOTSTRAPS, len(bcon)))].mean(axis=1)
b["bootstrap_percentile_95"] = np.quantile(boot, [.025, .975]).tolist()
b["bootstrap_seed"] = SEED
b["bootstrap_resamples"] = BOOTSTRAPS
logr = welch(np.log(bcon), np.log(bmod))
b["geometric_mean_ratio_sensitivity"] = {k: math.exp(logr[k]) for k in ["estimate", "lower", "upper"]}
b["median_difference_descriptive"] = float(np.median(bmod) - np.median(bcon))
b["leave_one_out_sensitivity"] = {
    "modified_max_id": "B-mod-04",
    "modified_max_value": float(bmod.max()),
    "difference_if_only_max_omitted": float(bmod[bmod != bmod.max()].mean() - bcon.mean()),
    "note": "Sensitivity only; all 24 B specimens are retained in primary analysis. No source supports excluding the maximum."
}

pooled = {}
for p in ["conventional", "modified"]:
    xx = np.array([r["cycles_observed"] for r in rows if r["process"] == p])
    pooled[p] = dict(n=len(xx), restricted_mean=float(xx.mean()))
pooled["difference"] = pooled["modified"]["restricted_mean"] - pooled["conventional"]["restricted_mean"]
pooled["relative_point_difference"] = pooled["difference"] / pooled["conventional"]["restricted_mean"]
decomposition = {
    "within_B": b["estimate"],
    "half_conventional_B_minus_A": .5 * (groups["B_conventional"]["mean"] - groups["A_conventional"]["mean"]),
    "half_modified_C_minus_B": .5 * (groups["C_modified"]["mean"] - groups["B_modified"]["mean"])
}
assert abs(sum(decomposition.values()) - pooled["difference"]) < 1e-7

# C: all censoring is administrative at the common horizon. The KM area up to
# that horizon equals the empirical mean of min(T, tau); the mean of T is not known.
cr = [r for r in rows if r["batch"] == "C"]
events = sorted(r["cycles_observed"] for r in cr if r["endpoint"] == "failed")
xx, yy = [0.], [1.]
surv, last, area, at_risk = 1., 0., 0., len(cr)
km_rows = []
for t in events:
    area += (t - last) * surv
    surv *= (at_risk - 1) / at_risk
    at_risk -= 1
    xx.append(float(t)); yy.append(surv)
    km_rows.append(dict(cycles=t, event=1, remaining=at_risk, survival=surv))
    last = t
area += (TAU - last) * surv
xx.append(float(TAU)); yy.append(surv)
assert abs(area - groups["C_modified"]["mean"]) < 1e-7

# Planning numbers are scenarios, not a sample-size guarantee or approved protocol.
sigma = math.sqrt((bcon.var(ddof=1) + bmod.var(ddof=1)) / 2)
zsum = stats.norm.ppf(.975) + stats.norm.ppf(.8)
planning = []
for multiplier in [1., 1.25, 1.5]:
    s = sigma * multiplier
    n = math.ceil(2 * zsum ** 2 * s ** 2 / DELTA ** 2)
    planning.append(dict(sd_multiplier=multiplier, assumed_sd=float(s), n_per_arm_normal_approx=n))

def classify_interval(lower, upper, prerequisites=True):
    if not prerequisites:
        return "评价前提未满足：暂停确认性判定，先处理偏差与缺失"
    if lower > DELTA:
        return "支持超过实际阈值的正向收益"
    if upper < -DELTA:
        return "支持超过实际阈值的反向损害"
    if lower >= -DELTA and upper <= DELTA:
        return "区间位于实际近似带内（以预先同意的阈值为前提）"
    if lower > 0:
        return "方向为正，是否超过实际阈值仍未定"
    if upper < 0:
        return "方向为负，是否超过反向实际阈值仍未定"
    return "包含零且越过实际阈值：方向及实际幅度未定"

decision_examples = []
for lo, hi in [(4,7),(-7,-4),(-2,2),(1,5),(-5,-1),(-5,4),(3,4),(-4,-3)]:
    decision_examples.append(dict(interval_in_10k=[lo,hi], judgement=classify_interval(lo*1e4, hi*1e4), hypothetical=True))

summary = dict(
    identity="教学模拟数据，不对应真实实验、机构、项目或论文", version="资料版本1，2026-10-20",
    input_sha256={str(p.relative_to(ROOT)): sha(p) for p in [ROOT/"inputs/protocol.md", ROOT/"inputs/fatigue.csv"]},
    data_checks=dict(records=48, unique_specimens=48, failed=46, runout=2, no_other_censoring_recorded=True,
                     all_runouts_at_tau=True, independent_unit="specimen, as stipulated in protocol"),
    tau=TAU, groups=groups, within_B=b, pooled=pooled, descriptive_decomposition=decomposition,
    C=dict(km_rmst_to_tau=area, survival_just_before_tau=surv, runout_ids=[r["specimen_id"] for r in cr if r["endpoint"]=="runout"], km_event_table=km_rows),
    planning=dict(delta_discussion_value=DELTA, delta_justification="Unvalidated discussion value; protocol provides no engineering relevance threshold.",
                  alpha_two_sided=.05, target_power=.8, baseline_pooled_sd=float(sigma), scenarios=planning,
                  caveat="Normal approximation for a simple independent equal-size two-arm comparison; ignores small-sample t correction, future censoring/loss, and batch variability; final design must be recalculated."),
    decision_examples=decision_examples, current_B_under_proposed_rule=classify_interval(b["lower"],b["upper"]),
    runtime=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__, matplotlib=matplotlib.__version__),
)
(OUT/"statistics.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
with (OUT/"group-summary.csv").open("w",encoding="utf-8-sig",newline="") as f:
    w=csv.writer(f);w.writerow(["batch","process","n","stress_MPa","failed","runout","restricted_mean_cycles","sd_cycles","median_observed_cycles"])
    for g in groups.values(): w.writerow([g[k] for k in ["batch","process","n","stress_MPa","failed","runout","mean","sd","median"]])

font_manager.fontManager.addfont(str(ROOT/"fonts/NotoSansCJKsc-Regular.otf"))
font_manager.fontManager.addfont(str(ROOT/"fonts/NotoSansCJKsc-Bold.otf"))
plt.rcParams.update({"font.family":"Noto Sans CJK SC", "font.size":16, "axes.spines.top":False,"axes.spines.right":False,
                     "axes.unicode_minus":False, "svg.fonttype":"none"})
fig, ax=plt.subplots(figsize=(10.5,5.8),dpi=180)
x=np.array(xx)/10000
ax.step(x,yy,where="post",color="#034A90",lw=3.2,label="C批改性 · 180 MPa · n=12")
ax.fill_between(x,yy,step="post",alpha=.12,color="#034A90")
ax.plot([50],[surv],marker="|",ms=22,mew=3,color="#B45132",clip_on=False)
ax.annotate("2件 runout\n在50万次停止观察",xy=(50,surv),xytext=(33, .48),fontsize=17,color="#B45132",
            arrowprops=dict(arrowstyle="->",color="#B45132",lw=1.8),ha="left")
ax.text(14,.16,"曲线下方面积\n受限平均寿命 43.48万次",fontsize=18,color="#034A90")
ax.set(xlim=(0,52),ylim=(0,1.05),xticks=[0,10,20,30,40,50],yticks=[0,.25,.5,.75,1],
       xlabel="循环次数 / 万次",ylabel="未失效比例（Kaplan–Meier）")
ax.grid(axis="y",color="#DDE5EC",lw=.8)
ax.legend(loc="upper left",bbox_to_anchor=(0,1.17),borderaxespad=0,frameon=False,fontsize=17)
fig.subplots_adjust(left=.12,right=.98,bottom=.16,top=.86)
for suffix in ["png","svg"]: fig.savefig(FIG/f"C-km-rmst.{suffix}",facecolor="white")
plt.close(fig)
print(json.dumps({"within_B":b,"pooled":pooled,"decomposition":decomposition,"C_RMST":area,"planning":planning},ensure_ascii=False,indent=2))
