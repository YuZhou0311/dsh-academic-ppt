# 学术构图的选型与使用

插件提供 8 类、48 个原创原生参考构图。它们规定内容角色和几何关系，不提供未经核实的论文结论，也不能代替用户已指定的 PPT 模板。

本轮已实际查看两份用户模板，共 39 页。模板的图文分区、原图面积、蓝色细框与少量暗红强调，以及历次反馈对应的改动，见 [USER_TEMPLATE_STUDY.md](../../../docs/USER_TEMPLATE_STUDY.md)。这些观察用于本轮设计选择，不意味着任意组件已经无损导入。

## 1. 渐进读取

先用 `academic_ppt_reference` 读取一个相关类别，例如 `{ "category": "figure" }`，再以 `{ "templateId": "figure-detail-window" }` 读取所选页。工具返回 `layout`、`slots`、`requirements` 和内容提示。不要一次让模型重述 48 页的全部几何。

给页面写入相同的 `referenceTemplateId` 与返回的 `layout`。按实际数量提供图像、卡片、节点，以及构图要求的 `chart` 或 `table`。卡片记录是文本承载区，按语义选择平面文字、细框、题签或侧签；不意味着每个区域都需要彩色框。不要通过塞入空白、重复内容或不相关图片来满足数量。

有图文背板的构图还可设置 `slide.panelTitles`，按 `slots.panels` 的顺序逐一给出题签，数量必须一致。题签应描述实际内容；两张面板不自动构成“独立验证”，局部视窗也不能题为“完整原图”。

当前 14 种样式由三种平面文字区、三种学术细框/题签/侧签和八种局部卡片结构组成。优先沿用所选构图的 `cardStyles`，再按语义调整；不要把全部页面覆写成同一款式。

完整资产位于项目的 `references/templates/`：

- `manifest.json`：类别、选型信息、几何要求和资产位置。
- `slide-records.json`：可检查和复用的示例记录。
- `gallery.html`：按类别浏览构图。
- `academic-templates-48.pptx` 与 8 类 PPTX：原生可编辑参考页。

参考页中的占位内容仅说明如何填写，正式汇报必须替换为真实文献、数据与图像。

## 2. 按最难承载的内容选型

| 类别 | 常见任务 | 优先查看的 ID |
| --- | --- | --- |
| `paper` 论文导读 | 完整题名、研究对象、贡献和证据范围 | `paper-overview`、`paper-study-scope`、`paper-journal-club` |
| `method` 方法机制 | 智能体路由、反馈、状态动作奖励、目标约束 | `method-tool-routing`、`method-agent-loop`、`method-rl-interface` |
| `experiment` 实验设计 | 独立单位、重复测量、训练测试、公平基线 | `experiment-cohort-design`、`experiment-train-test-split`、`experiment-baseline-controls` |
| `results` 结果统计 | 主效应、组件贡献、跨条件误差、评价口径 | `results-main-effect`、`results-ablation`、`results-error-analysis` |
| `figure` 原图解读 | 宽图、面板比较、全图定位与局部放大 | `figure-wide-annotated`、`figure-two-panels`、`figure-detail-window` |
| `synthesis` 跨文献综合 | 方法接口、证据等级、冲突和缺口 | `synthesis-mechanism-map`、`synthesis-evidence-ladder`、`synthesis-agreement-conflict` |
| `limitations` 局限失败 | 失败过程、测量偏倚、外推和复现边界 | `limitations-failure-case`、`limitations-measurement-bias`、`limitations-validity-audit` |
| `plan` 研究计划附录 | 可证伪假设、公平对照、数据计划和来源 | `plan-hypothesis-test`、`plan-fair-comparison`、`plan-reference-notes` |

例如：主证据是含轴和图例的宽图，先选图像空间足够的页；独立样本和重复测量易混淆，先选队列结构；真正需要逐维对应的结果，再选表格页。不能因为某款小卡片更好看，就让它决定研究叙事。

## 3. 几个需要谨慎的选择

**`figure-detail-window`** 同时保留全图与细节视窗，适合复合图定位。细节记录使用同一原图文件和明确 `viewport`，登记准确面板与裁切说明。局部必须承载可读证据，不能让两张小图共同占位却都无法判读。

**`figure-portrait-reading`** 给竖图整列高度，但它不保证所有长图都能读清。若关键图例仍很小，换成局部面板或补充放大图。完整图可留作定位，页面正文提供必要变量解释。

**`results-ablation`** 要求同一评价对象和可比较条件。不同论文、不同数据集的最高数值不适合填进这类表。

**`method-rl-interface`** 只有原文确实存在状态、动作、奖励、策略和交互过程时使用。LLM 工具调用、分类模型和固定流程不自动属于强化学习。

**`plan-fair-comparison`** 图中的对照应锁定共同数据、可用信息、工具和预算。待验证干预的额外成本要计入终点，不能用更多人工或隐藏源数据制造“智能体优势”。

**`paper-study-scope`** 需要五类实质信息。材料不足时换构图；不要把同一句贡献拆成五个相似区域。

## 4. 适配之后检查什么

先核实际槽位是否呈现全部输入，再看科学和视觉质量。检查文字区是否仍有信息、图的有效分辨率、对象之间的阅读关系，以及重要条件是否从正文掉进脚注。空白多时合并薄页或补方法证据，拥挤时去重复或拆问题。固定构图是起点，真实产物仍需逐页检查。

已有认可版只修改小卡片时，不重新选择整页 `referenceTemplateId`。遵循 [revision.md](revision.md) 的范围保全规则。
