# 0.10 学术汇报设计研究

核查日期：2026-10-30。目标基线：本仓库提交 `a1c6208`（0.9.1）。本研究检查了源码、公开技能的实际指令、研究机构教程、学术论文和论坛原答复，也查看了仓库实际渲染样张。未取得用户认为不满意的具体成稿，因此以下诊断针对插件机制，不能穷尽某一份实际PPT的问题。

## 1. 现有插件的问题在哪里

0.9.1已经具备来源核对、reported/inference/proposal分离、故事板、真实样张、图像可读性、当前PPTX渲染和交付哈希等机制。32种整页语法确实覆盖不同科学关系，不是只有同一骨架换颜色。问题在于几组相互竞争的默认。

| 源码机制 | 对Agent的可能影响 | 本次处理 |
| --- | --- | --- |
| `design-dialogue.mjs` 要求六页以上即使无卡片也填写组件细读；来源只支持卡片/局部组件/用户模板 | 将设计工作导向边框、题签和组件登记 | 接受全页、学术风格、科学图表等内容相关designStudies；具体preset仍需查看 |
| `core.mjs` 新工程默认compact，`design-geometry.mjs` 对连续空区可硬阻断 | 单公式、研究问题、清楚但稀疏的结果页可能被迫填充 | 新稿balanced；保留空间诊断和明确compact工程约束 |
| 基础system只有defense/report/plain；core实际覆盖为rule/minimal/band | 页面关系虽有变化，文字/分组/表格仍容易同质 | 六种styleProfile、标题与注释字族、开放panel、独立tableStyle |
| 表格外观复用system.panel | 想改表格也会受面板体系牵引 | 三线、轻横线、色表头独立控制 |
| 主SKILL反复要求查看48卡和20组件，参考文件重复覆盖同一工作 | 占用注意力，熟练填表仍可能弱于真实研究表达 | 精简主路径，按任务读取科学图表、文案、风格和审稿指引 |

这些是机制诊断与设计推论，不是经过随机对照实验测得的模型效果。减少强制卡片步骤也不代表禁止卡片；清楚的共同边界仍可以表达真正的科学分组。

## 2. 公开PPT技能：学机制，保留边界

以下链接固定到实际核查提交，避免把后续main的变化误认为本次依据。

| 实现 | 值得采用的机制 | 不直接移植的默认 |
| --- | --- | --- |
| [Anthropic PPTX](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/pptx/SKILL.md) | 区分新建/模板编辑/读取；分别核对内容、文件结构与最终画面；模板以原稿为基准；修复后复查 | 商业deck的视觉元素、图标与色块建议不等于学术规范；原生可编辑也不应要求从图片猜数据 |
| [K-Dense scientific-slides](https://github.com/K-Dense-AI/scientific-agent-skills/blob/5f2bc0341354fd5590aef76a533ada1e1e5b4e62/skills/scientific-slides/SKILL.md) | 按会议/研讨/答辩/精读区分任务；定量结果、公式和模板采用可编辑路径；生成图必须核对 | 生成整页图片不是DSH的默认路径；固定图文比例、引用数量或时间口诀不能成为门槛 |
| [Frontend Slides](https://github.com/zarazhangrui/frontend-slides/blob/9906a34d640d2111f724544cbc50f7f130569ae1/SKILL.md) | 样张帮助用户发现偏好；风格展开为字体、网格与密度；渐进加载参考 | 动画、背景氛围、特异字体和固定预览数量适合部分网页演示，不适合所有现场学术报告 |
| [PPTAgent](https://github.com/icip-cas/PPTAgent/blob/833cda553b343be0e486a93b0b57cac962cdd566/skills/pptagent/SKILL.md) | 短主技能；作者负责内容，工具负责渲染和当前产物绑定；修改资源使审查失效；允许不能判断 | HTML效果不证明PPTX效果；历史论文benchmark不是当前main的模型效果实测；无视觉服务不能自动通过 |
| [PptxGenJS官方图表文档](https://github.com/gitbrent/PptxGenJS/blob/gh-pages/docs/api-charts.md) | 真实数据驱动原生图表、表格和可编辑文本 | 不承诺任意科研图/网页效果都能无损转换；复杂原图作为独立资产是合理交付 |

本次独立编写指令和代码，没有复制第三方技能的提示、模板或脚本。Anthropic的PPTX目录另有 [Proprietary条款](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/pptx/LICENSE.txt)，不能因仓库其他内容的许可就按MIT搬用。其余项目本次核查的许可不自动授权复制第三方论文图、字体或模板资产。

## 3. 学术表达研究与教程

### 主张与证据对齐：有研究支持，也有适用边界

Garner与Alley（2013）的[机构研究摘要](https://pure.psu.edu/en/publications/how-the-design-of-presentation-slides-affects-audience-comprehens/)介绍了110名工科学生的对照：采用符合六条多媒体原则的assertion-evidence设计后，理解、误解、认知负荷与延迟回忆指标表现较好。这里比较的是组合原则，不能单独证明“所有页都必须结论句标题”，也不能外推所有学科。

因此本插件按页面职责选标题：结果页使用证据支持的发现；研究问题保持问题；方法、定义、数据集、假设和推导可以用明确主题名。主张要在图面上得到支持，相关性、因果、模拟、独立验证等身份不能被漂亮标题混同。

### 先确定听众、核心信息和研究逻辑

[MIT NSE：Structuring a Slide Presentation](https://mitcommlab.mit.edu/nse/commkit/structuring-a-slide-presentation/)建议先确定目的、听众与核心信息，再由结果整理支持主张的证据，补足方法和动机，并核对逻辑缺口。它明确提醒技术讲述要考虑时间与理解能力，不能只数页。

[MIT/Broad：Slideshow](https://mitcommlab.mit.edu/broad/commkit/slideshow/)强调在复杂结果前让观众知道坐标、点、线与信号的意义。插件把它落实为每个结果页的读图问题：比较什么、在哪里看、怎样解释、边界在哪里。讲稿负责口头导读，页面仍保留必要上下文。

### 经验口诀不应成为运行时硬限制

Naegle（2021）的[PLOS文章](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009554)讨论单页中心目标、标题、引用、复杂图分步解释、反复排练和备用方案。Bourne（2007）的[口头报告教程](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.0030077)强调听众、信息取舍、逻辑与排练计时。

两篇给出的页速建议并不完全相同，MIT也强调不要只看页数。0.10因此保留秒数与时间预算，要求按内容和排练估计，不强制一页一分钟、六元素、六行字、三项并列或若干种布局。更复杂的证据可以需要更多时间，用户指定的总页数仍须遵守。

### 图表应呈现科学信息

Weissgerber等（2015）的[PLOS研究](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128)调查703篇生理学论文，指出不同分布可得到相同汇总柱图。插件据此提醒：小样本连续数据应考虑真实独立点、分布或配对关系；只有汇总数据时不得编造原始点；类别计数等仍可适合柱图。

Cumming、Fidler和Vaux（2007）的[误差线教程](https://doi.org/10.1083/jcb.200611141)说明SD/SE/CI、独立样本与技术重复等区别。插件保留n的含义、区间类型、单位、基线和比较条件，不以“简洁”为由删除，不从误差线是否重叠自动生成显著性结论。[开放全文](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2064100/fullTextXML)。

[Wilke的色标章节](https://clauswilke.com/dataviz/color-basics.html)和[配色问题章节](https://clauswilke.com/dataviz/color-pitfalls.html)区分分类、连续量与中心偏差。插件要求颜色编码真实含义，跨页一致，关键区别不只靠颜色；页面主题色不能覆盖原始数据色义。

### 学术环境有具体约束，不能统一成商业演讲

[中科院大连化物所某课题组公开规范](https://deng.dicp.ac.cn/guanlibanfa20240704.pdf)的相关条款强调实验条件、具体图例、上下标、引用、问题与下一步计划。它只代表该课题组的实践，不能推成“中国答辩一律如此”。此次检索读到官方PDF相关条款；后续完整PDF下载返回503，未声称完整下载或逐页看图。

[Academia.SE答辩页数讨论](https://academia.stackexchange.com/questions/13768/number-of-slides-for-45-minute-defense-presentation)强调取舍与计时，不能靠加速塞完内容。[数学会议报告讨论](https://academia.stackexchange.com/questions/185486/how-do-i-prepare-a-slide-talk-presentation-for-conference-in-mathematics)体现定义、定理、例子和证明的学科需求。这些是论坛个人经验，并非控制实验或统一标准；本次通过StackExchange官方API核对问题和原答复。

## 4. 转化为Agent的决策顺序

1. 明确听众要理解或判断的问题。
2. 确认可获得的证据和不能支持的判断。
3. 选原图、准确数据图、表、方法关系或公式作为载体。
4. 决定共同尺度、阅读次序、旁注、前提和必要限制。
5. 用合适的全稿风格落实字体、表格、分组和导航。
6. 在实际困难页与连续片段上比较，并查看最终PPTX。

这一顺序是本项目对多来源的综合设计判断，不冒充某篇研究给出的唯一流程。

## 5. 六种风格的实质差异

六方向为research-seminar、thesis-defense、methods-whiteboard、paper-club、evidence-synthesis和field-report。它们同时提供字体角色、system、chrome、tableStyle、cardDefaults和配色起点，并说明证据组织与不适用条件；单一报告保持稳定体系，页面随研究关系变化。用户模板和显式覆盖优先。

理论页可以以公式为主，文献页可保留原面板与批注，田间页可按真实地点/年份组织观察，综述页可用条件矩阵与冲突证据。没有相应素材时不能为了风格名制造地图、照片、证明或多论文比较。样张只验证选定材料的表达和渲染，不代表通用模型能力。

## 6. 质量怎样验证

自动测试覆盖明确行为：旧工程兼容、profile解析与覆盖、表格和字体的原生输出、设计学习路径与preset检查、真实证据/协作约束。实际PPTX样张检查字体、图表、条件与阅读关系。独立Agent使用固定材料进行计划试作，检查是否过度外推、编造不确定性、强制卡片或虚构批准。

另提供 [可重复评测任务](../evals/academic-cases.json)，便于在同一DSH模型与材料上比较旧版和新版。正式对照应保存输入、宿主/模型版本、产物、实际渲染与评语；将成品匿名交给了解学科的人评价科学忠实度、论证、读图和风格适配。不要用漂亮样张、测试数量或自评总分宣称已经证明所有模型稳定优秀。

本次实际执行与未覆盖范围以 [验证记录](VALIDATION_V010.md) 为准。
