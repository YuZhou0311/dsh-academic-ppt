# 离线示例

## v0.4 默认示例：材料疲劳研究进展

[可编辑 PPTX](materials-v04/report.pptx) · [PDF](materials-v04/report.pdf) · [逐页讲稿](materials-v04/speaker-notes.md) · [示例说明与复算方法](materials-v04/README.md) · [文件哈希与原生对象清单](materials-v04/manifest.json)

![8 页材料疲劳示例总览](materials-v04/overview.png)

[查看封面原图](materials-v04/cover.png) · [查看核心证据页原图](materials-v04/evidence.png)

该示例使用本轮新建的**教学模拟输入**：[protocol.md](materials-v04/protocol.md) 与 [fatigue.csv](materials-v04/fatigue.csv)。48 件合成试件不对应用户真实实验、机构、项目或论文。8 页汇报的时间预算为 600 秒，展示怎样从协议和 CSV 建立来源记录、描述性比较、推断边界与待实施方案；没有外部论文篇数或影响因子门槛。

核心比较限定在 B 批次、200 MPa，两工艺各 12 件且均已失效。改性组样本均值较高 8.44%，中位数较高 2.36%；均值差的 95% bootstrap 区间跨 0。全体合并的观察时长差异为 41.52%，但混合了批次、应力及 C 组的两个右删失终点，不能表述为工艺因果提升。完整计算口径见 [analysis.json](materials-v04/analysis.json)。

### 新建并生成

安装项目依赖后，在仓库目录运行：

```bash
npm run demo
```

脚本不请求网络或模型，默认创建唯一的新目录。它读取 [便携 deck.json](materials-v04/deck.json)，通过 `recordsPath` 文件批次依次登记设计、来源、claim 和页面，生成新的工程、原生 PPTX、HTML、讲稿、证据/资产清单与质量报告。输入和可复算分析脚本也会复制到新目录，工程中的两个来源指向本次复制文件的实际路径，已有目录不会被覆盖。

新工程保留 `qualityProfile=academic`，图像输入能力如实设为 `unknown`。便携记录不包含原工程历史、产物摘要或视觉审查；新生成文件需要按自身哈希重新渲染和审查。

指定新目录，并选择是否渲染实际 PPTX：

```bash
npm run demo -- --output ./my-materials-demo
npm run demo -- --output ./my-materials-rendered --render --font-dir ./fonts
```

`--render` 使用可选 LibreOffice kit。字体目录相对调用工作区解析；依赖或字体不足会明确返回结果。默认 demo 只生成和静态检查，视觉状态为 `not-verified`，不会继承随附成品的审查结论。Noto Sans CJK SC 是本例指定字体；PDF 保留随附最终渲染的外观。

### 复算统计量

Python 环境安装 [requirements.txt](materials-v04/requirements.txt) 中的 NumPy 和 SciPy 后，运行：

```bash
python3 examples/materials-v04/analyze.py
```

脚本按自身所在目录读取两个输入文件，并重写同目录的 `analysis.json`；从其他当前目录调用也可运行。均值差 bootstrap 固定为组内独立试件重抽样 100000 次、seed 20261020。默认 `npm run demo` 读取已保存的内容，不需要运行 Python。

## 历史静态示例：v0.3 PhenoAssistant

以下文件保留为 **v0.3 历史静态示例**，`npm run demo` 已改用上面的 v0.4 材料模拟案例。

[历史可编辑 PPTX](report.pptx) · [HTML 播放器](report.html) · [约 11 分钟讲稿](speaker-notes.md) · [当时的实际 PPTX 验收记录](VISUAL_QA.md)

![v0.3 PhenoAssistant 四页代表性实际 PPTX 渲染](preview.png)

[历史 14 页总览](overview.png) · [PLA 原图页](pla-page.png) · [原始创作记录](science-demo.mjs)

该历史示例精读 Chen 等的 **A conversational multi-agent AI system for automated plant phenotyping**，*Nature Communications* 17, 6391 (2026)，[正式论文](https://www.nature.com/articles/s41467-026-71090-y)，DOI: 10.1038/s41467-026-71090-y。它展示单篇论文深读流程，保留表型观测、任务评价与待验证研究提议各自的口径。

[ASSETS.md](ASSETS.md) 和 [assets](assets) 保留历史原图的出处、图注、许可及局部视窗。原文图像仍是图片；文字、图例、流程、表格和计数图表为独立对象。旧源码和当时的验收记录用于查看历史示例，不表示它已按 v0.4 新增的 analysis/reasoning/argument 门槛重新验收。

## 原生小组件与参考库

[小组件参考 PPTX](native-card-reference.pptx) 是专门制作的单页原生样例，包含细框表头、短题签、侧签和开放解释区，用于展示支持的组件范围。

```bash
node examples/create-native-reference.mjs ./native-reference-new.pptx
```

更多页型见 [48 页学术模板库](../skills/dsh-academic-ppt/references/templates/README.md)。模板提供构图参考，示例正文、图像和研究结论需要按当前材料重新组织。
