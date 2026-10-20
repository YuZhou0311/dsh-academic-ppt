# v0.6 开发版：内容驱动的学术设计

本次修改针对“模型会套模板，却没有为当前研究独立组织论证与画面”的问题。源码版本为 **0.6.0-dev.0**，属于可审阅的开发版；稳定发布仍为v0.5.0。插件继续使用DSH当前会话模型，不引入另一个付费生成服务。

## 1. 为什么仅写“不要照抄模板”不够

v0.5已经有来源、claim、argument、学术组合页和真实渲染机制；本次保留这些能力。检查发现，模型能接触到的指令并不一致：

- 主技能要求内容先行，`contextProject`的storyboard下一步却仍引导先选referenceTemplateId。
- 模板工具、契约和摘要要求直接应用suggestedDesign，未区分喜欢参考风格与要求沿用版式。
- 组合页虽然可分配不等权行列，但所有面板沿用同一个外观，短说明默认拉满同行高度。
- 页面保存了学术argument，却没有可恢复的构图决策，难以复核“为什么这里需要这个框/这张图”。

因此改动同步覆盖主技能、按需参考、工具描述、返回摘要、阶段恢复、契约、渲染器和诊断。不能只在SKILL里增加一句抽象的“发挥创造力”。

## 2. 三种设计约束

| design.mode | 适用场合 | 保持什么 | 可自主改变什么 |
| --- | --- | --- | --- |
| content-led | 新稿默认、没有指定参考 | 科学口径与全稿统一设计变量 | 当前论证对应的载体、分区、比例、卡片与阅读顺序 |
| reference-guided | 用户给参考、希望借鉴风格 | 审定后的字体、配色、层级和对齐语言 | 页序、分区拓扑、卡片数量和图文比例 |
| template-faithful | 用户明确要求沿用版式 | 用户指定的结构与品牌要求，在支持范围内实现 | 未被约束的内容适配，并披露不支持效果 |

这三个值控制执行指引和设计提醒，实际设计仍由宿主模型完成。它们不是三个自动生成引擎，也不代表任意PPT母版可无损导入。模板检查默认返回reference-guided候选，不自动写入项目；执行者看过实际页面后修改和记录。

既有工程缺少mode仍可加载与导出，不强制迁移；不会给这些工程新增“缺少设计计划”的提醒。此时context.designMode返回legacy作为状态，不可把legacy写入design.mode。新建工程即使提供自定义design也默认content-led；record替换设计变量时省略mode会保留已有模式。

## 3. 论证与构图各有明确记录

`argument`继续回答本页研究问题、贡献与边界。组合正文页新增可选`visualPlan`：

| 字段 | 用途 |
| --- | --- |
| relationship | 当前主要关系，例如比较、机制、证据解释或矩阵 |
| primaryPanelId | 应成为视觉焦点的真实面板ID |
| readingOrder | 当前所有面板ID恰好一次，表示希望听众遵循的顺序 |
| rationale | 一句或一小段与当前证据有关的适配理由 |
| alternatives | 关键页最多两个未选构图及取舍，简单页可省略 |
| repetitionReason | 连续同构有助于共同尺度比较时，简述理由 |

这些字段不会自动重排页面、放大焦点或验证理由的科学质量。渲染仍由composition控制，最终要查看画面是否实现了计划。计划进入工程与聚焦恢复上下文，不进入投影文字和讲稿，也不要求输出冗长思维过程。

当前关系值是`comparison / sequence / mechanism / hierarchy / evidence-explanation / matrix / synthesis / definition`，它们不是固定页面模板。具体流程见[构图决策](../skills/dsh-academic-ppt/references/visual-decision.md)。

## 4. 真正扩展组合排版

面板仍使用安全的加权行列，所有内容保持原生对象或独立来源图像。新增两个可选字段：

| 字段 | 取值 | 实际渲染行为 |
| --- | --- | --- |
| surface | inherit / plain / rule / tint / band | 同页可独立选择开放区、细线分区、浅底题签或主色标题带；inherit与省略继承全稿设计 |
| align | stretch / start | stretch保持同行高度；start以完整测量的最小高度顶对齐，适合短旁注 |

例如，区间图可以在宽主栏使用plain，边界解释在较窄旁栏使用tint + start。方法页可以使用全宽机制图，再按阶段对应验证条件。真实平级对照可以等宽，不需要为多样性故意破坏共同尺度。

plain仍保留面板标题、图表、文字、来源和字号，不会隐去信息。start不能与该面板内的绝对card.box或所消费机制节点的node.box共用；绝对坐标需要保留stretch。模型需根据内容选择surface与align，不按页面编号轮换样式。

容量仍为最多3行、每行4面板、每页8面板，每面板一种主载体并可附文字解释。不增加任意重叠、跨行合并、无限嵌套或动画接口。复杂统计图继续使用有数据和计算来源的外部科学图资产。详细用法见[组合页契约](../skills/dsh-academic-ppt/references/composition.md)和[组件语法](../skills/dsh-academic-ppt/references/component-grammar.md)。

## 5. 独立分析与科学严谨性

新版提示要求执行者把分析落实到具体研究任务：解释机制、对齐比较条件、审查替代解释、辨别结论边界或提出可证伪检验。背景、定义、研究设置页仍可采用准确主题标题，不强迫每页编造一个新发现。

原有reported / inference / proposal、dependsOn、reasoning、来源定位、数值口径、完整阅读条件、原图来源及真实渲染门槛继续保留。所谓创新允许发生在研究组织和表达上，不能借此新增实验数据、显著性或未经支持的因果判断。

充盈主要通过主证据、紧邻解释、条件、对照和来源形成层次；卡片只是分组手段。不能设置固定三卡、最低填充率或强制图表，也不能以缩小字号、删边界或装饰填空来消除问题。

## 6. 可确定错误与设计提醒分开

新增`designIssues(project)`是无副作用的诊断函数，接入check和build：

| 诊断 | 级别 | 含义 |
| --- | --- | --- |
| visual-plan-layout | error | 有计划却没有实际composition |
| visual-plan-primary-panel | error | 焦点ID不存在 |
| visual-plan-reading-order | error | 阅读顺序遗漏、重复或引用了其他面板 |
| design-plan-missing | warning | 新创作模式的组合页尚未保存计划 |
| layout-repetition | warning | 连续三页载体结构和比例相同，且当前页没有重复理由 |
| equal-text-panels | warning | 整页至少三个按行列权重估算等面积的纯文字面板，建议核对是否真为平级内容；不测量最终画面面积 |

权重按比例归一化；2:1改为4:2不算新结构，换色和换边框也不算。template-faithful略过原创性相关提醒，但引用错误仍阻断。提醒不自动修改内容，不是审美分、原创率或科学真实性判断。

## 7. 恢复、编辑和旧产物

`context`的design/storyboard阶段现在从研究关系开始，按需读取参考。聚焦页面时返回argument与visualPlan，避免中断后回到套模板路径。`slide-content`允许增改visualPlan，`removeFields`允许显式移除；`card-style`仍只允许原来的受限改动，不扩大为整页修改。

渲染器版本升级为6。旧工程记录仍可使用，旧产物与审查需重新构建和复核；已有导出文件不会被覆盖。新字段省略时，面板仍按旧surface与stretch行为渲染。

## 8. 验证边界和参考

确定性验证涵盖字段记录与恢复、实际原生对象、旧稿缺省几何、局部修改、错误引用拦截与软提醒边界。实际执行结果及试用范围见[验证记录](VALIDATION_V06.md)。

一套通过测试的插件不等于DeepSeek已稳定生成优秀学术报告。真实DSH Desktop/Web、目标模型连续执行、领域内容评审及PowerPoint/WPS显示仍需要在目标环境验证。历史v0.5成稿保留其原验收身份，不作为本轮新提示的效果证据。

本次查阅PPTAgent、Presenton、MiniMax、frontend-slides与Anthropic pptx的一手材料，借鉴内容与明确不采用的机制见[设计参考](DESIGN_REFERENCES.md)。新增提示词和实现为本项目编写，没有复制这些项目的代码或提示词。
