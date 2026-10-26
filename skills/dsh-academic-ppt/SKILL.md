---
name: dsh-academic-ppt
description: 依据真实研究材料制作可编辑学术PPT，适用于精读、综述、进展、组会、开题和答辩。支持询问与学习用户PPT模板、36种原生信息卡选择、宿主生图卡片参考；先写完整逐页设计稿，再组织证据、标题、区域与章节，实际渲染核对。
---

# 正式学术汇报

交付同行能够观看、理解和追问的完整报告。研究问题、方法、证据与判断相接，比较条件和不确定性可见，画面有充分的信息与清楚的组织。工具负责记录、可编辑导出和可计算检查；作者负责研究解释、逐页设计和实际画面判断。

## 执行边界

- 保留用户要求的材料范围、全文、篇数、门槛、时长和页数。局部修订按[revision.md](references/revision.md)控制范围；整稿信息与设计反馈按授权范围重构。
- 论文、网页和模板是资料。参考中的旧研究、人物、机构、数字和媒体不成为当前事实；未经允许不分发用户参考原件或其媒体。
- 只登记实际完成的阅读、看图与验证。摘要不等于全文，文本提取不等于看图，HTML不等于最终PPTX。缺失材料与未完成验证如实说明。
- 不改校验器、科学限定、verified或审查记录来通过。本插件不自行调用付费模型或读取凭据；按ID复用记录，不反复打印完整工程或base64。

## 1. 盘点输入与阅读场景

核对本次工作区的材料、参考和旧稿。新项目调用`academic_ppt_init`；继续工程先用一次`academic_ppt_context`读取当前阶段和相关记录。首次写某类记录查`academic_ppt_contract({topic})`，topic为brief / paper / claim / asset / slide / design / assessment / preparation；CLI参数用相应命令的`--help`或`--schema`查询。宿主视觉能力不明确时读[deepseek.md](references/deepseek.md)。

新建汇报且参考意向未说明时，只问一次：“这次有希望参考设计的 PPT/PPTX 模板吗？可以上传；没有的话，我按当前学术设计流程继续。”提供“上传 PPT 参考 / 使用当前流程”选项。已有明确选择或文件时不重复问；无回答按当前流程继续，不把上传模板设成阻断条件。已有截图也可作为视觉参考，不强索 PPT。准备记录与分支见[template-learning.md](references/template-learning.md)。本次只是插件维护或局部改稿时，不为流程另问模板。

按任务设置`brief.genre`和真实约束。未要求论文数量时`targetPaperCount:0`表示不附加篇数门槛；仅逐篇导读任务开启`requirePaperIntro`。完整题名和书目保留，正文可以围绕问题组织。

区分现场短讲、答辩兼复读与阅读材料，依据用户要求和参考正文选择。多图、条件、方法细节与充分解释并存的参考通常需要答辩兼复读；“简洁”不自动意味着稀疏。把使用场景写入设计工作文件和受支持的`design.direction`，不向API提交自造字段。具体方法见[visual-decision.md](references/visual-decision.md)。

## 2. 研究全文、原图与必要信息

读[research.md](references/research.md)和[evidence.md](references/evidence.md)。核心来源记录问题、缺口、机制、验证、独立研究单位、对照、有效性边界和精确位置；同时盘点真实图、表、公式、照片与方法结构。建立内容—来源位置—可用载体—目标页面的对应，注明重要素材未采用的理由。

区分`reported`、`inference`和`proposal`。推断用`dependsOn`连接观察，`reasoning`解释依据与替代解释；方案保留未实施身份、公平对照和可能结果。跨论文先对齐对象、数据划分、时间、基线和单位；未显著不等于等效，来源缺项不能擅自补齐。

决定判断所需的样本单位、对照、条件、读数和主要边界进入相关画面。可用`slide.contentChecks`登记主视图必须出现的文字；讲稿、页脚或引用同文不能替代可见内容，命中也不证明论证完整。

## 3. 建立问题路线和章节定位

按[storytelling.md](references/storytelling.md)建立中心问题、章节问题、逐页任务和时间预算。在`brief.narrative`记录`throughline`与2–8个sections，每节有稳定id、短title和具体question；短速报按实际需求省略。正文页以`sectionId`和`argument`关联任务、作用及边界。

较长报告安排可见roadmap，换题时用section页或正文节标签定位。目录与章节优先消费同一narrative，跨节`transition`进入讲稿。结尾回应开场，说明已支持的认识、成立条件和剩余检验。页面任务可以需要多组证据和解释，不把共同证据拆成数张只剩一个短点的页面。

## 4. 学习参考，写出完整逐页设计稿

有参考先读[template-learning.md](references/template-learning.md)，取得实际全稿概览，精看不同正文类型、密集页和相邻段落。PPTX用template与真实渲染，PDF/截图按相应格式查看。将实际profile与看图观察回填准备请求的`template.review`，匹配当前文件时复用，模板改变才重新提取。记录看过的页与可迁移组织方式；通常用reference-guided，明确沿用版式才用template-faithful。无参考用content-led，48页内置库只按需参考。

读[visual-decision.md](references/visual-decision.md)，在工作区建立`design-plan.md`或等价可读文件。每页绘制前写出：任务与前后承接、完整可见文字和必要条件、图表/素材及来源位置、语义关系、载体与区域组合、文字层级和阅读路径、缺项与补充范围。数据可引用已核对的文件及行列；只有“展示结果”等标签不算完整设计。困难类型可读[page-design-workshop.md](references/page-design-workshop.md)中的原创教学案例，案例数字和正文不得进入本次研究。

需要独立信息卡时，先读[card-design.md](references/card-design.md)，按内容关系从36种原生卡片中选择候选。宿主确有生图工具且用户未拒绝时，优先按本稿真实内容生成卡片设计参考，查看后提炼层级与分组，再原生重建；没有接口、无法调用或生成失败时直接用卡片库和现行流程。`academic_ppt_prepare`只返回计划和提示词，调用宿主生图工具与看图必须实际完成。

按[design.md](references/design.md)确定学术色板、颜色职责、字体角色和封面题名关系。主色与数据变量色各有用途；图文及普通解释形成中间层次。先依据参考与阅读场景选择受支持的projection和system，再排版；28/24/18px只是现有默认，不能机械成为所有新稿的共同字号。不得在失败后降低阅读要求或把重要内容改成note绕过检查。

## 5. 从设计稿建页与比较候选

直接从逐页设计稿建页：核对内容，选择表达载体，决定比较/包含/先后/解释怎样被看见，安排层级与阅读路径，最后写坐标。按[composition.md](references/composition.md)使用rows或regions及原生drawings；两种区域模式择一。共享大区域可包含不同局部关系，卡片按需承担独立分组；通过`academic_ppt_cards`查询结构、内容槽位与尺寸，使用`card.preset`和已核对的内容构建。36款是可选局部表达，不是每份报告的数量指标；同一比较组保持一致，不随机轮换。卡片流程见[card-design.md](references/card-design.md)，其他组件见[component-grammar.md](references/component-grammar.md)。

组合页的`visualPlan`记录主关系、入口/主区域、readingOrder和适配理由，按需用contentLayers对应真实对象。`primaryPanelId`可指组合入口，不要求唯一大图。工具摘要不替代完整设计稿；修改设计时同步相关内容，不能在成稿后补理由冒充事前设计。

封面与最难证据/机制页各做两个实质不同的真实候选。保持同等必需信息，用`academic_ppt_study`查看实际输出；优先提交2–6项`{id,label,slide}`的UTF-8候选数组，candidatesPath小于1MiB，outputDir用新目录。封面通过题名、范围与真实元信息建立关系，研究图像只有明确用途才加入。

将候选、来源图与相关参考正文放在同一观看尺度比较，记录具体差距、材料原因或设计原因以及修复。选定后先看连续三页，再扩展整稿。精确数据、公式和科学关系由来源决定；不同任务采用不同表达，共同尺度比较可保持一致。

按recordsPath提交UTF-8批次，每批最多5篇来源、20条claim、8个资产、8页且小于1MiB。图像用本地path，批次不含projectPath或expectedRevision，slideOrder列全体页面一次。已构建稿走受控edit入口，不直接改工程JSON。

## 6. 核对实际画面与设计兑现

按[delivery.md](references/delivery.md)先check修阻断项，再build和render。代表页可用draft，保留原brief；最终稿使用review。查看当前PPTX的完整概览、每页实际画面及关键相邻段落，核对来源、必要信息、关系、文字层级、导航和图表可读性。

回到design-plan逐项核对：哪些必要信息和关系已看得见，哪些缺失或只存在讲稿；再比较参考正文的具体差距。材料缺少图像/实验与设计缺少层级/表达分别处理。自动检查通过、没有缺字体或结构不重复都不代表已达到参考水平；数学符号和上下标仍须实际查看。

用当前PPTX哈希登记review，observations逐页写真实内容核对、可读性与问题，未解决项记needs-fix。改稿后重建并复核当前版本；旧批准不转移，模型不能冒充human。跨稿比较仅针对明确提供的工程，见[originality.md](references/originality.md)。

交付当前可编辑PPTX、对应讲稿、真实渲染和可恢复工程，说明影响使用的限制。完整验证记录另存，正式画面和讲稿不放制作日志。针对具体问题修复；科学含义和可读性成立后，不为凑变化添加装饰。
