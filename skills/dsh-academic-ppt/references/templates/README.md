# 48 种学术汇报模板

这套参考包提供 **8 类 × 6 页，共 48 个内容结构**。按要解释的科学问题、证据类型和必要条件选页型。它们与运行时的 `referenceTemplateId` 共用 [reference-catalog.mjs](../../../../src/reference-catalog.mjs)，选择模板后得到的是可继续编辑的结构。

先看 [可筛选图文索引](gallery.html)，也可以下载 [48 页 PPTX 总集](academic-templates-48.pptx)。完整字段、版面尺寸和每页示例位于 [manifest.json](manifest.json) 与 [slide-records.json](slide-records.json)。

**全部书目信息为占位，全部图表数值为合成演示值。** 这些示例说明怎样呈现研究对象、样本单位、对照、效应、不确定性和解释边界。用于正式汇报时，必须替换为已经核查的论文信息、原图与数据。

## 文件与用途

| 分类 | 可编辑分包 | 六种内容结构 |
| --- | --- | --- |
| 论文导读 | [paper.pptx](paper.pptx) | 单篇全景、缺口与假说、论点证据对应、研究范围、贡献比较、精读讨论 |
| 方法与机制 | [method.pptx](method.pptx) | 智能体反馈、强化学习接口、工具路由、机理耦合、算法步骤、目标与约束 |
| 实验设计 | [experiment.pptx](experiment.pptx) | 独立样本、因子设计、数据划分、公平基线、测量链、复现协议 |
| 结果与统计 | [results.pptx](results.pptx) | 主效应、两个终点、消融、跨环境表现、代价权衡、错误分母 |
| 原图解读 | [figure.pptx](figure.pptx) | 宽幅图、双面板、互补证据、全图与局部、竖图、图例与变量 |
| 跨文献综合 | [synthesis.pptx](synthesis.pptx) | 机制对应、证据层级、同维度比较、进展、分歧、研究问题 |
| 局限与失败 | [limitations.pptx](limitations.pptx) | 失败定位、迁移边界、测量偏倚、效度审查、风险干预、复现缺口 |
| 研究计划与附录 | [plan.pptx](plan.pptx) | 可检验假说、公平实验、采集与评价、阶段产物、结论、参考文献 |

## 选型与组合

1. 先写本页希望观众理解的一个具体关系。需要解释机制时选择流程或接口结构，需要比较实测表现时选择图形与统计条件，需要保留论文原图时先看图的宽高比和面板数量。
2. 记录不可删除的信息：完整论文题名、研究对象、实验身份、独立样本单位、比较基线、指标单位、误差含义及适用条件。把每条内容绑定到对应图、表或解释区。
3. 用 `academic_ppt_reference` 查询候选模板。`manifest.json` 中的 `slots` 给出准确坐标，`requirements` 给出需要的图、卡片、流程节点和图表数量。按选中模板提供内容，避免输入内容没有落到版面上。有组合面板时，可用 `slide.panelTitles` 按面板次序写入与实际证据相符的题签。
4. 同一论文可以连续使用几种页型：`paper-overview` 介绍研究，再用 `method-agent-loop` 解释系统，接 `experiment-cohort-design` 与 `results-main-effect`，最后用 `limitations-failure-case` 限定结论。
5. 在全篇尺度检查节奏。连续几页采用相同图文比例会削弱主次。也不要为了追求变化给相同实验对照强行更换视觉编码。

科学信息够用与阅读轻松要同时满足。表格只用于严格行列映射，本包中有 8 个表格页型；其他结构使用原图、统计图、流程、横向证据链、左右不等宽组合或连续文本。短标签、淡蓝表头和细边框用来表达内容分组。

## 与提供的两份 PPT 的关系

公开模板吸收了用户提供的 39 页参考 PPT 中的图文组织规律：短题签连接说明带，细边框配浅蓝表头，左窄右宽证据区，框内图与流程并置，竖图配分步解读，结论紧贴对应证据。具体观察与生成规则见 [用户模板研究](../../../../docs/USER_TEMPLATE_STUDY.md)。

本包重新绘制这些结构。它不包含原始用户 PPT、大学标识或原始研究数据。比如 `paper-evidence-map` 用两组不等宽的图文区，并把三步解释链放进右侧证据框；`figure-portrait-reading` 为竖向原图保留完整一列；`method-model-coupling` 把计算链与接口、校准、失配条件分层呈现。

## 编辑性与图像

PPTX 中的标题、正文、边框、题签、连接线、流程节点、表格单元格与原生统计图表均保留为独立可编辑对象。科学图是独立 PNG 资产，可替换或调整位置。没有把整页渲染图作为 PPT 背景交付。

局部图通过 `viewport` 指定视窗，保留原图字节、来源、范围说明和 SHA-256。`figure-detail-window` 同时展示全图与面板视窗。修改裁切范围时，应一起核对面板标题、坐标、单位、图例和误差定义是否完整。

`assets/` 包含 7 张原创合成科学图、图形生成脚本使用的数据说明。其源代码是 [create-reference-figures.py](../../../../scripts/create-reference-figures.py)。合成图用于展示响应曲线、独立观测分布、跨环境矩阵、效应区间与多面板排版，不支持真实科学结论。

## 可视核验与重新生成

`previews/T01.svg` 至 `T48.svg` 是运行时场景的逐页预览。`montages/` 中的八张分类拼图来自导出 PPTX 的实际渲染。二者用途不同：SVG 便于选型和定位元素，实际 PPTX 渲染用于核查字体、行距、表格高度和图像裁切。`manifest.json` 记录它们对应的 PPTX 哈希、渲染引擎和审查状态。

从仓库根目录重新生成可编辑 PPTX、SVG、HTML 和样例记录：

```bash
python scripts/create-reference-figures.py
node scripts/build-references.mjs
```

重建图形需要 Python、NumPy 与 Matplotlib。插件运行时直接使用已包含的资产。实际渲染仍使用项目的 PPTX 渲染器。渲染完毕后，可用 `scripts/finalize-reference-previews.py` 从渲染收据建立对应的拼图；脚本会核对源 PPTX 的 SHA-256，避免把旧预览误当作新版本验证。

## 原则与许可

方法参考 [MIT Communication Lab 的 Slideshow 指南](https://mitcommlab.mit.edu/nse/commkit/slideshow/)、[Penn State Assertion–Evidence](https://www.assertion-evidence.com/) 与 [Bourne 的学术口头报告建议](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.0030077)。这些来源用于科学沟通原则，不是对某个固定信息密度百分比的背书。

原创布局与合成绘图资产采用本仓库的 MIT 许可。未来替换进去的论文原图、数据和机构标识应分别保留对应来源与使用条件。
