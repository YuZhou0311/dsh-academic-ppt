# 材料疲劳研究进展：v0.4 离线教学示例

本目录的输入在本轮开发中专门构造，全部为**教学模拟材料**，不对应用户真实实验、机构、项目或论文。它展示协议与 CSV 如何形成来源记录、统计口径、有限推断和下一步研究方案。输入、分析代码和本例演示材料按随附 [MIT LICENSE](LICENSE) 提供。

## 成品与来源

[可编辑 PPTX](report.pptx) · [PDF](report.pdf) · [逐页讲稿](speaker-notes.md) · [8 页总览](overview.png) · [封面 PNG](cover.png) · [核心证据页 PNG](evidence.png)

随附 PPTX 的 SHA-256 为：

```text
5a187a8703e6cdd91894b8e7fc7a031651dd6cf1cafcfcacb209b789a0912a01
```

PDF、总览和两张单页 PNG 均对应这份最终 PPTX。`cover.png` 是 S01，`evidence.png` 是 S04。完整文件摘要与实际 OOXML 对象计数见 [manifest.json](manifest.json)。成品有 8 页、8 个备注页、1 个原生图表、3 个原生表格、166 个文本 run 和 1 个内嵌图表工作簿；幻灯片中没有图片截图对象。结构检查不替代 PowerPoint/WPS 应用内编辑测试。

| 文件 | 用途 |
| --- | --- |
| [protocol.md](protocol.md) | 合成资料身份、批次/工艺/应力条件、终点定义与研究进度 |
| [fatigue.csv](fatigue.csv) | 48 件独立试件的完整记录 |
| [deck.json](deck.json) | 便携创作内容：title、brief、design、papers、claims、assets、slides |
| [analyze.py](analyze.py) | 从两个同目录输入复算统计量，不请求网络 |
| [analysis.json](analysis.json) | 完整计算结果、输入 SHA-256、随机种子与分析边界 |
| [requirements.txt](requirements.txt) | 本例复算使用的 NumPy/SciPy 版本 |

`deck.json` 仅包含创作内容，来源路径是相对的 `protocol.md` 和 `fatigue.csv`。它不携带旧工程 ID、revision、history、artifact 或视觉审查记录；可作为新工程的分批导入材料。

## 八页的研究任务

| 页 | 内容 | 预算 |
| --- | --- | ---: |
| S01 | 正式题名、汇报场景与教学模拟身份 | 30 秒 |
| S02 | 研究问题、分组结构与可比范围 | 90 秒 |
| S03 | 失效/runout 终点、独立试件与分析方法 | 75 秒 |
| S04 | B 批次 200 MPa 两工艺的差异与不确定性 | 120 秒 |
| S05 | 合并差异中的批次、应力与删失影响 | 90 秒 |
| S06 | 当前可以作出的判断与尚缺证据 | 65 秒 |
| S07 | 拟议的同批同应力随机验证 | 100 秒 |
| S08 | 两份资料来源与讨论 | 30 秒 |

合计 600 秒是时间预算，未进行真人排练。S07 的实验尚未实施。

## 可复算结果与限定

CSV 有 48 个唯一试件 ID，无空字段。A 常规、B 常规、B 改性、C 改性各 12 件；A/B 为 200 MPa，C 为 180 MPa。46 件已失效，C 组另有 2 件在 500000 循环停止时未失效，这两个数值是右删失观察时间。

主要比较限定于 B 批次 200 MPa，两组均为 12 件全失效记录：

| 统计量，循环 | 常规 | 改性 | 改性减常规 |
| --- | ---: | ---: | ---: |
| 均值 | 303682.83 | 329305.08 | 25622.25（+8.44%） |
| 中位数 | 309945 | 317262 | 7317（+2.36%） |

以独立试件为单位，在两组内分别有放回重抽样 100000 次，seed 为 20261020。均值差的 95% 百分位 bootstrap 区间为 −8274.49 至 61628.68 循环；Welch 敏感性区间为 −13679.80 至 64924.30 循环。两者均跨 0，只刻画各自模型条件下的探索性不确定性，不能消除顺序取样或未记录条件的偏差，也不能证明工艺因果提升。

全部记录按工艺合并时，观察时长均值相对差为 41.52%。由于批次、180/200 MPa 应力构成不同，且包含 C 组右删失，该数值不是完整失效寿命均值的工艺效应。示例没有删去 runout，没有把它当作在 500000 循环发生失效，也没有由终点数据编造断口、组织或残余应力机制。

## 复算与重建

在已安装 [requirements.txt](requirements.txt) 依赖的 Python 环境中，指定本文件夹的脚本路径即可复算。例如在仓库根目录执行：

```bash
python3 examples/materials-v04/analyze.py
```

脚本按自身位置读取输入并覆盖同目录 `analysis.json`。依赖参考版本为 Python 3.12.14、NumPy 2.3.5、SciPy 1.17.0；算法和随机种子保留在脚本中。重新运行不会读取原开发工作区。

在仓库根目录、已安装 npm 依赖后：

```bash
npm run demo -- --output ./my-materials-demo
```

默认 demo 读取便携 deck，通过 `recordsPath` 批次新建设计、来源、claim 和页面。生成目录同时含两个输入、分析脚本和预计算结果，可在目录中继续复算；导入时仅把两个已知来源名解析为本次复制文件的实际路径，便携 deck 保持相对路径。新工程使用 `qualityProfile=academic`，图像输入能力为 `unknown`；新产物的哈希与随附 PPTX 可以不同，也没有继承原成品的视觉审查。

需要实际渲染时，使用新目录和工作区中的字体目录：

```bash
npm run demo -- --output ./my-materials-rendered --render --font-dir ./fonts
```

默认构建不要求再次渲染。选择 `--render` 时使用可选 LibreOffice kit；Noto Sans CJK SC 是本例指定字体。新生成产物仍须按自身哈希完成逐页内容和可读性审查。
