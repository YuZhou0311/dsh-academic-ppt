# PhenoAssistant 单篇精读示例：来源与资产

`science-demo.mjs` 提供 14 页、合计 670 秒（约 11 分 10 秒）的单篇精读记录，适用于 10–12 分钟的论文讨论。内容包括系统接口、三类案例、不同评价任务、失败机制、局限与待检验方案。逐页备注包含可直接讲述的正文和论文出处。

这是用于展示学术内容承载能力的单篇示例，不代替先前约定的五篇论文综述。示例未设置影响因子筛选门槛，也未编造 JCR 数值。重新生成的文件仍需按实际产物检查，记录里的 `verified` 与 `full-text` 是可审计声明，不是插件自动证明文献真实或已精读。

## 1. 论文及版本

Chen F., Stogiannidis I., Wood A., et al. **A conversational multi-agent AI system for automated plant phenotyping**. *Nature Communications* **17**, 6391 (2026). DOI: [10.1038/s41467-026-71090-y](https://doi.org/10.1038/s41467-026-71090-y).

- [官方全文与补充材料入口](https://www.nature.com/articles/s41467-026-71090-y)
- [PMC 全文存档](https://pmc.ncbi.nlm.nih.gov/articles/PMC13376813/)
- [官方代码、案例和评测记录](https://github.com/vios-s/PhenoAssistant/)
- 首次发表日期：2026-04-03；[出版方文章信息](https://www.nature.com/articles/s41467-026-71090-y#article-info) 另列 Version of record 日期为 2026-07-16。后者用于版本识别，不能当作首次发表日期；PMC 的书目日期也为 2026-04-03。
- 来源核对日期：2026-10-20。

本示例核对了正式论文的设计、Case studies 1–3、Evaluation、Discussion 与 Methods，重点检查 Fig. 3/4、Table 1、数据分析任务分母和模型选择口径。官方代码 README 说明，案例、评价和 demo 使用 **Azure OpenAI GPT-4o 2024-08-06**。这是论文实验条件，不能作为 DeepSeek 或 DSH 学术插件的效果测试。

## 2. 科学图像、作者输出与各自授权

当前示例包含三个完整源图文件、四条实际使用的资产记录。论文出版图与作者仓库独立输出分别登记许可，不能将整个 `assets` 目录一概标为 CC BY 4.0。

| 完整源文件 | 内容与来源 | 实测像素 / 文件大小 | 许可 |
| --- | --- | --- | --- |
| [pheno-figure3.png](assets/pheno-figure3.png) | Fig. 3，拟南芥生长模式分析；[出版方 Figure 3](https://www.nature.com/articles/s41467-026-71090-y/figures/3) | 1449 × 2499 px；669,088 bytes | CC BY 4.0，Chen et al., 2026 |
| [pheno-figure4.png](assets/pheno-figure4.png) | Fig. 4，马铃薯图像表型与叶片干重分析；[出版方 Figure 4](https://www.nature.com/articles/s41467-026-71090-y/figures/4) | 1615 × 2496 px；604,003 bytes | CC BY 4.0，Chen et al., 2026 |
| [author-pla_plot.png](assets/author-pla_plot.png) | 作者 Case 1 保存的独立 PLA 绘图输出，对应正文 Fig. 3 任务 2；[固定版本原图](https://raw.githubusercontent.com/vios-s/PhenoAssistant/aff85512073d9629dfcd501474641eb1919fbe87/results/Case1/pla_plot.png) | 1000 × 600 px；85,620 bytes | 作者仓库 MIT；Copyright (c) 2025 Feng Chen |

出版图按文章的 [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) 声明使用，保留作者、来源、许可及展示裁切说明；单独 credit line 的第三方材料另看其条件。本示例没有复制含 Flaticon 图标声明的 Figure 1，系统关系使用原生对象重绘。

独立 PLA 图取自论文 Code availability 指向的[官方仓库](https://github.com/vios-s/PhenoAssistant/)，固定提交为 `aff85512073d9629dfcd501474641eb1919fbe87`。已检查该版本的根目录 LICENSE 及文件树，未见 `results/Case1` 的另置许可或该图的单独排除声明；随包保留的 [LICENSE-PhenoAssistant.txt](assets/LICENSE-PhenoAssistant.txt) 与[作者该版本 LICENSE](https://github.com/vios-s/PhenoAssistant/blob/aff85512073d9629dfcd501474641eb1919fbe87/LICENSE) 内容一致。这里记录作者发布的原始输出及其来源许可，不将仓库里其他外部材料自动归为 MIT。

### 四个资产与实际展示视窗

下表与 `scienceDemo()` 返回的资产、页面一致。`viewport` 顺序为 `(x, y, w, h)`，坐标以完整源图左上角为原点；归一化值保留九位小数，像素值保留三位，均仅作清单展示。生成时仍使用 `science-demo.mjs` 中的实际值。没有另存破坏性裁切图片，也没有改变源图数据或纵横比。

| 资产 ID / 页面 | 源文件与展示内容 | 归一化 viewport | 对应完整源图像素框 `(x, y, w, h)` |
| --- | --- | --- | --- |
| `F3_TASK1` / S01 | `pheno-figure3.png`：任务 1 中的四幅输入植株照片；说明输入对象 | `(0.532846715, 0.067739204, 0.343065693, 0.052497883)` | `(772.095, 169.280, 497.102, 131.192)` |
| `F3_PLA` / S04 | `author-pla_plot.png`：保留标题、横纵轴、五组图例、均值曲线与 SD 阴影，裁去外围空白 | `(0.060000000, 0.065000000, 0.865000000, 0.910000000)` | `(60, 39, 865, 546)` |
| `F3_TEST` / S05 | `pheno-figure3.png`：任务 4 的 Summary，保留交互说明、Tukey–Kramer 分组与全部生态型名称 | `(0.506569343, 0.757832345, 0.472992701, 0.057578323)` | `(734.019, 1893.823, 685.366, 143.888)` |
| `F4_CORR` / S06 | `pheno-figure4.png`：两项 Pearson 相关系数及对应变量，省略后方重复解释段落 | `(0.012383901, 0.728365385, 0.962848297, 0.131810897)` | `(20, 1818, 1555, 329)` |

旧版的 `F3_ALL` 完整竖图缩略图已从实际示例资产中移除。两张出版方完整 PNG 仍随包保留，可从源文件检查上下文；完整竖图不再承担幻灯片上的主要读数任务。

四条资产记录各自对应的源文件 SHA-256 如下。`F3_TASK1` 与 `F3_TEST` 共享同一个完整媒体文件，因此哈希相同。

```text
F3_TASK1  pheno-figure3.png   8ac90c7b8bc90852a5fa583d16f4fb236b665c8f469f3e7e3067ce3815bdec4b
F3_PLA    author-pla_plot.png 1da6df2d4508687d7dc4806aeb5e729780f240efd24a2eeea3ae149cca1cfa77
F3_TEST   pheno-figure3.png   8ac90c7b8bc90852a5fa583d16f4fb236b665c8f469f3e7e3067ce3815bdec4b
F4_CORR   pheno-figure4.png   22596351f81256cd51f7cb9556748e1e267d40a51e0d355f3ad3214391a0bdb9
```

作者许可文件 SHA-256：`5ffa3609a98ebd168b2706bf768e2ceba2a70da852b0747fb86f16d5a03c98ba`。

### S04 的作者原始输出、辅助图例与读图边界

已实际比对独立 PLA 图与正文 Fig. 3 任务 2 的面板：标题、生态型图例及顺序、播种后天数轴、均值曲线形态与标准差带相符。正文组合图额外添加的面板标题属于合成版排版。此比对支持“作者 Case 1 原始输出；对应正文 Fig. 3”的身份，不表示两个不同排版和缩放版本的像素或文件字节相等。该文件不是补充 PDF 的截图；本次没有将未取得的 Supplementary Figs. 2–5 PDF 声称为已下载材料。

S04 的 `displayLegend` 将原图图例逐项转录为 **22 px 原生文字与独立短色线**，置于原图和简短来源图注之间。原图内部的图例也完整保留。色线颜色表示生态型身份，不表示结果好坏，也不套用“方法 / 结果 / 局限”的卡片配色。

| 原图标签 | 原生色线 | 正文对应生态型 |
| --- | --- | --- |
| `adh1` | `#1F77B4` | adh1 |
| `col0` | `#FF7F0E` | Col-0 |
| `ctr` | `#2CA02C` | ctr1 |
| `ein2` | `#D62728` | ein2.1 |
| `pgm` | `#9467BD` | pgm |

辅助图例使观众能直接对应五条曲线；轴含义和阴影含义由旁边的原生解释区补充。原图纵轴只写投影叶面积 PLA，**没有印出 cm²**；平方厘米的依据是 Fig. 3 的 Saved CSV 表头，讲稿明确区分这两个来源。页面按 `task: overview` 讲述定性趋势，不从曲线像素估算某一时点的精确数值，不把阴影重叠或曲线距离当作统计检验。

Fig. 3 中灰色区为用户任务、蓝色区为工具调用、白色区为输出；完整英文图注以[官方图页](https://www.nature.com/articles/s41467-026-71090-y/figures/3)为准。Fig. 4 的表型与相关分析出处保留在[对应图页](https://www.nature.com/articles/s41467-026-71090-y/figures/4)。S05 / S06 的可编辑转录与数值均绑定其原图摘要，不能改写为对图像像素进行精确测量所得。

完整原图文件未重画曲线、改写数值或使用生成模型编辑。PowerPoint 只改变图片对象的可见视窗，媒体仍完整保留。标题、正文、解释区、辅助图例、表格、方法图、连线和任务计数图为原生可编辑对象，没有把整页 PPT 栅格化为背景。示例没有重新分发论文 PDF，正式全文和附件通过出版方入口提供。

## 3. 科学结论的来源与口径

| 证据 | 内容 | 页面上的处理 |
| --- | --- | --- |
| C1–C2 | 固定角色的中央 manager、专用工具与流程复现 | 依据原文重绘工具路由，区分规划与计算 |
| C3–C4 | 24 株、5 生态型、26 天、每 12 小时采图，共 1248 幅 | 植株与图像观测分别报告，不把重复图像当独立植株 |
| C5 | PLA 曲线、重复测量 ANOVA、Tukey–Kramer 与生态型分组 | 原图面板放大，图例/因子转录，保留当前数据的范围 |
| C6–C7 | 32 幅马铃薯图像，r(A,W)=0.8911，r(PLA,W)=0.7577 | 保留 n 与变量，不声称两个相关系数的差异显著 |
| C8 | 冬小麦营养缺乏分类模型的训练与入库 | 展示过程，区分田间采图、模型验证与施肥控制 |
| C9 | Table 1 的工具链评分及 manager/critic 对照 | 原生表格转录四维评分与平均，明确未执行工具 |
| C10 | 模型类型 50/50；具体模型 20/20，含 15 项匹配与 5 项无合适模型 | 分开记录两个构造任务集，不作开放场景准确率 |
| C11 | 数据分析 17/20 正确，3 项细粒度读图失败 | 原生任务计数图，人工检查口径与任务分母明确 |
| C12、C14 | 失败机制和可外推范围 | 明确属于汇报者依据研究范围作出的分析 |
| C13、C15 | 研究局限与原实验模型版本 | 不包装成 DeepSeek 效果或农艺控制收益 |
| H1–H2 | 共同预算下的源数据读数核验 | 明确待验证，含对照、盲评、终点、成本与反证条件 |

C9 的工具链评分与 C11 的任务计数是不同评价对象。`4.66/5` 不能改写为“93.2% 任务成功率”，`17/20` 也不是田间控制成功率。模型选择的满分不能代替最终分析输出的正确性。

本轮没有展示未重新取得定位记录的某一失败回答日期，也没有使用未重新核对的最优验证精度数字。读图失败机制页为依据数据链的解释，不伪装成某条原始实验记录。H1–H2 的 `verified:true` 表示建议身份和问题来源已核对，**不表示假说已经证实**。

## 4. 学术模板与本次设计参考

14 页中，**11 页使用参考模板，S04 / S05 / S06 根据实际图像内容使用自定义图框**。参考页实际消费插件参考库中的几何、图像区域、节点位置、表格和解释区；图像页的布局由可见面板的比例与阅读任务决定。

| 页面 | 实际采用的模板或布局 |
| --- | --- |
| S01 | `paper-overview` |
| S02 | `method-tool-routing` |
| S03 | `experiment-cohort-design` |
| S04 | 基础 `figure-focus`，自定义 `figureBoxes: [{x:48,y:132,w:820,h:516}]`；左侧独立 PLA 曲线，右侧定性趋势、轴与误差、统计边界三类说明 |
| S05 | 基础 `figure-focus`，自定义 `figureBoxes: [{x:48,y:144,w:1184,h:228}]`；通栏 Summary 面板，下方三个解释区 |
| S06 | 基础 `figure-focus`，自定义 `figureBoxes: [{x:48,y:132,w:1184,h:324}]`；通栏相关分析结果，下方两个系数及共同解释边界 |
| S07 | `method-model-coupling` |
| S08 | `results-ablation` |
| S09 | `results-error-analysis` |
| S10 | `results-main-effect` |
| S11 | `limitations-measurement-bias` |
| S12 | `limitations-validity-audit` |
| S13 | `plan-fair-comparison` |
| S14 | `plan-reference-notes` |

图框坐标以 1280 × 720 画布为准，包含渲染器预留的图注、辅助图例和内边距，并非把图片拉伸到整个矩形。S04 / S05 / S06 的解释区都显式记录位置；S06 的三个解释区位于 y=480，高 168 px，给系数、变量和统计条件保留共同空间。S08 / S09 / S12 的指定解释区则跟随原生表格及图注的实际高度，短表不再留下固定空槽。

正文通过标题、解释标题、正文和少数关键数值形成字号层级；局部 `emphasis` 使用可编辑文字片段突出条件、分母与限制。方法、观察结果、实验条件、局限和假说使用一致的语义色与不同边框结构，图像边缘添加很轻的真实阴影。装饰用于表达证据职责，保留科学图自身的颜色含义。

用户本轮重附的两份模板已查看，共 39 页。相关版式观察与反馈对应动作记录在 [USER_TEMPLATE_STUDY.md](../docs/USER_TEMPLATE_STUDY.md)。本示例不声称将每个原模板对象无损复制进来。

原生参考库位于 [references/templates](../skills/dsh-academic-ppt/references/templates/)，共 8 类、48 页，属于插件原创的学术教学构图；不是下载或重新分发 MIT、Penn State 等机构品牌模板。设计依据的沟通原则见 [design.md](../skills/dsh-academic-ppt/references/design.md)。

`native-card-reference.pptx` 与 `create-native-reference.mjs` 保留为独立的原生组件导入示例。新的科学示例不再依赖旧版 `@evidence-sheet` / `@boundary-fold`，避免把局部卡片演示强行塞进科学原图页面。

## 5. 重建与审查的界限

字体使用 Noto Sans CJK SC，字体文件不随插件分发。原图字数、字体替换、裁切和图注都需在实际产物上查看。HTML 检查不等于实际 PPTX 检查，离线结构校验不等于科学重现，也不等于对 DeepSeek 的线上效果评价。只有对当前导出哈希实际完成的审查，才可登记到 review 记录。
