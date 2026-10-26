---
name: dsh-academic-ppt
description: 与用户分阶段协商密度、故事线、配色、风格和封面，主动查证文献并取得论文图，制作可编辑学术PPT，适用于精读、综述、进展、组会、开题和答辩。支持用户模板参考、48种原生预设与20种可复刻局部视觉参考（其中12种原生论文图片卡）、宿主生图参考与逐页真实渲染复核。
---

# 正式学术汇报

交付同行能够观看、理解和追问的完整报告。正文以真实论文图、可追溯数据图和研究关系图组织表达，让比较条件、关键观察与解释共同可见。图片可嵌入信息卡成为完整证据组，也可开放排版；文字卡承担对应条件与解释。工具负责记录、可编辑导出和可计算检查；作者负责与用户协商、实际查证、研究解释与逐页看图。

## 执行边界

- 保留用户要求的材料范围、全文、篇数、门槛、时长和页数。局部修订按[revision.md](references/revision.md)控制范围；整稿信息与设计反馈按授权范围重构。
- 论文、网页和模板是资料。参考中的旧研究、人物、机构、数字和媒体不成为当前事实；未经允许不分发用户参考原件或其媒体。
- 只登记实际完成的阅读、看图与验证。摘要不等于全文，文本提取不等于看图，HTML不等于最终PPTX。缺失材料与未完成验证如实说明。
- 不改校验器、科学限定、verified或审查记录来通过。本插件不自行调用付费模型或读取凭据；按ID复用记录，不反复打印完整工程或base64。

## 1. 盘点输入与阅读场景

核对本次工作区的材料、参考和旧稿。新项目调用`academic_ppt_init`；继续工程先用一次`academic_ppt_context`读取当前阶段和相关记录。首次写某类记录查`academic_ppt_contract({topic})`，topic为brief / paper / claim / asset / slide / design / assessment / preparation；CLI参数用相应命令的`--help`或`--schema`查询。宿主视觉能力不明确时读[deepseek.md](references/deepseek.md)。

新建整稿先读[design-dialogue.md](references/design-dialogue.md)，分阶段推荐并提问信息密度、故事线、配色、形态、语言、层次质感和封面。每轮只处理1–3个相关决定，沿用已知偏好；展示真实封面与代表正文后再问具体选择。将真实回答或明确委托写入`design.consultation`，不能刚问就代答、把未回复写成确认或省略卡片参考学习。用户明确委托后自主完成；局部修订沿用现有方向。等待设计回答时继续不受其影响的查证、取图和暂定候选，批量定稿前完成协商。

参考意向未知时，将一次模板问题并入早期对话：“这次有希望参考设计的 PPT/PPTX 模板吗？可以上传；没有的话，我按当前学术设计流程继续。”已有明确选择、文件或截图时不重复问。模板可选，不强索 PPT；只有实际跳过或宿主明确返回未回答时才记录`unanswered`，不能把尚待回答写成无回复。准备分支见[template-learning.md](references/template-learning.md)。插件维护或局部改稿不为流程另问模板。

按任务设置`brief.genre`和真实约束。未要求论文数量时`targetPaperCount:0`表示不附加篇数门槛；仅逐篇导读任务开启`requirePaperIntro`。完整题名和书目保留，正文可以围绕问题组织。

新学术工程默认`brief.visualEvidence.mode:"source-led"`。旧工程缺少该字段时按本次任务补充，不能把缺字段当成允许无图。只有用户明确要求纯文字，或任务确实不以来源图为主要证据时才选择`flexible`并写具体`reason`；不得为通过检查改模式。没有用户上传的原图时主动查找，先按[deepseek.md](references/deepseek.md)确认宿主的检索、下载、PDF处理与看图入口。

区分现场短讲、答辩兼复读与阅读材料，按用户的密度选择安排画面与讲稿分工。“简洁”不自动意味着稀疏，“丰富”也不等于段落多。把已确认使用场景写入设计工作文件和`design.direction`；按[typography-editing.md](references/typography-editing.md)先精简重复、安排语义换行，再选择可读字号。具体逐页方法见[visual-decision.md](references/visual-decision.md)。

## 2. 研究全文、原图与必要信息

先读[research.md](references/research.md)核对文献身份与全文，再按[figure-selection.md](references/figure-selection.md)实际取得、查看并筛选原图。执行“题名/DOI检索 → 出版页或可靠仓储核对 → 全文及图注 → 本地图像/PDF目标页 → 看图 → 资产 → 页面”的链路。`web_fetch`返回文字不等于取得PDF或图片，不能停在搜索摘要或只有图注的网页。

将真实查证写入`paper.sourceCheck`，将实际看过的图源、候选和选择写入`paper.figureReview`。`selected`候选绑定实际`assetId`并用于相关页面；无适合图或无法获取时记录具体位置、原因和替代表达。批量排版前，先为代表性的结果/方法页备齐主要视觉材料；未搜索、未下载或未看图不能写成“材料没有图”。字段和状态见上述参考与paper契约。

读[evidence.md](references/evidence.md)，为核心来源记录问题、缺口、机制、验证、独立研究单位、对照、有效性边界和精确位置。让每个主要判断对应可读的原图、数据或准确关系图，注明未采用重要素材的理由。原图可作为独立图片保留；可编辑交付不要求删除论文图或把它改写成文字卡。

区分`reported`、`inference`和`proposal`。推断用`dependsOn`连接观察，`reasoning`解释依据与替代解释；方案保留未实施身份、公平对照和可能结果。跨论文先对齐对象、数据划分、时间、基线和单位；未显著不等于等效，来源缺项不能擅自补齐。

决定判断所需的样本单位、对照、条件、读数和主要边界进入相关画面。可用`slide.contentChecks`登记主视图必须出现的文字；讲稿、页脚或引用同文不能替代可见内容，命中也不证明论证完整。

## 3. 建立问题路线和章节定位

初读材料后，按[storytelling.md](references/storytelling.md)向用户推荐具体的问题路线和另一种合理取舍，确认故事线或记录明确委托，再确定逐页任务与时间预算。在`brief.narrative`记录`throughline`与2–8个sections，每节有稳定id、短title和具体question；短速报按实际需求省略。正文页以`sectionId`和`argument`关联任务、作用及边界。

较长报告安排可见roadmap，换题时用section页或正文节标签定位。目录与章节优先消费同一narrative，跨节`transition`进入讲稿。结尾回应开场，说明已支持的认识、成立条件和剩余检验。页面任务可以需要多组证据和解释，不把共同证据拆成数张只剩一个短点的页面。

## 4. 学习参考，写出完整逐页设计稿

有参考先读[template-learning.md](references/template-learning.md)，取得实际全稿概览，精看不同正文类型、密集页和相邻段落。PPTX用template与真实渲染，PDF/截图按相应格式查看。将实际profile与看图观察回填准备请求的`template.review`，匹配当前文件时复用，模板改变才重新提取。记录看过的页与可迁移组织方式；通常用reference-guided，明确沿用版式才用template-faithful。无参考用content-led，48页内置库只按需参考。

读[visual-decision.md](references/visual-decision.md)，在工作区建立`design-plan.md`或等价可读文件。每页绘制前写出：任务与前后承接、实际图表/素材及来源位置与资产ID、读者要从中看见的比较或机制、必要解释与条件、区域组合和阅读路径、缺项与补充范围。先据原图的比例、标签和关系分配空间，再写完整可见文字。数据可引用已核对的文件及行列；“展示结果”“加一张图”等空槽位不算完整设计。困难类型可读[page-design-workshop.md](references/page-design-workshop.md)，案例数字和正文不得进入本次研究。

主要图文关系确定后，读[card-design.md](references/card-design.md)，实际查询目录、查看候选预览并记录选型与改造；论文图可按[image-cards.md](references/image-cards.md)嵌入12种图卡，与开放大图、表格和方法关系组合。

**v0.8.3 局部参考学习：**额外查看[20款编辑式组件图册](references/editorial-v083/index.html)与对应[结构清单](references/editorial-v083/catalog.json)，针对当前论文图至少比较实际适用的不同图文关系，再选原有48款API卡片或用原生 drawings 改造。这20款是设计参考，不是新增20个 `preset`。**不能把单张卡片扩展为整页幻灯片，也不能把参考 SVG 或 PPTX 的占位图片当科研证据贴入正文。** 图册按每页四卡展示，正是为了区分局部组件与整页布局。将真实学习写入`design.referenceStudy`，不能只登记样式名称。卡片和生图参考不能替代查证取图。宿主确有生图工具且用户未拒绝时，优先为需要的卡片生成内容相关参考，查看后原生重建；无接口或失败时继续原生设计。`academic_ppt_prepare`只返回计划和提示词，实际提问、生图与看图由宿主完成。

按[design.md](references/design.md)确定学术色板、颜色职责、字体角色和封面题名关系。主色与数据变量色各有用途；图文及普通解释形成中间层次。先依据参考与阅读场景选择受支持的projection和system，再排版；28/24/18px只是现有默认，不能机械成为所有新稿的共同字号。不得在失败后降低阅读要求或把重要内容改成note绕过检查。

## 5. 从设计稿建页与比较候选

直接从逐页设计稿建页：核对内容，选择表达载体，决定比较/包含/先后/解释怎样被看见，安排层级与阅读路径，最后写坐标。按[composition.md](references/composition.md)使用rows或regions及原生drawings；两种区域模式择一。图卡用`card.figureIds`承载真实资产，图外文字卡与开放注释按需组合。48款是可选局部表达，不是数量指标；同一比较组保持一致，不同任务要改变实际图文关系，不能整稿复用左图右三卡。将选型、配色与结构适配理由记入设计工作文件和受支持字段，不放进正式画面。卡片流程见[card-design.md](references/card-design.md)，其他组件见[component-grammar.md](references/component-grammar.md)。

组合页的`visualPlan`记录主关系、入口/主区域、readingOrder和适配理由，按需用contentLayers对应真实对象。`primaryPanelId`可指组合入口，不要求唯一大图。工具摘要不替代完整设计稿；修改设计时同步相关内容，不能在成稿后补理由冒充事前设计。

封面与最难证据/机制页各做两个实质不同的真实候选。保持同等必需信息，用`academic_ppt_study`查看实际输出；优先提交2–6项`{id,label,slide}`的UTF-8候选数组，candidatesPath小于1MiB，outputDir用新目录。封面通过题名、范围与真实元信息建立关系，研究图像只有明确用途才加入。

将候选、来源图与相关参考正文放在同一观看尺度比较，记录具体差距、材料原因或设计原因以及修复。向用户展示封面与代表正文，确认封面及密度、风格的实际效果；已有明确委托时自行选定并记录依据。再看连续三页，确认图文组合与阅读路径的变化适合任务后扩展整稿。精确数据、公式和科学关系由来源决定，共同尺度比较可保持一致。

按recordsPath提交UTF-8批次，每批最多5篇来源、20条claim、8个资产、8页且小于1MiB。图像用本地path，批次不含projectPath或expectedRevision，slideOrder列全体页面一次。已构建稿走受控edit入口，不直接改工程JSON。

## 6. 核对实际画面与设计兑现

按[delivery.md](references/delivery.md)先check修阻断项，再build和render。代表页可用draft，保留原brief；最终稿使用review。查看当前PPTX的完整概览、每页实际画面及关键相邻段落，核对来源、必要信息、关系、文字层级、导航和图表可读性。

回到图源清单与design-plan逐项核对：选定的图是否实际上页，图卡中的轴与图例是否完整可读，解释是否贴近对应图段，必要信息是否只存在讲稿。逐页检查标题、卡片题签和正文的孤行、术语断开与无谓复述，再看全稿是否重复同一种骨架。文字卡、图标和空框不算研究图。正文明显空洞时补回遗漏证据并重组；文字过载时精简冗余、改善行宽和字号，不能删关键条件或靠装饰填空。取图缺口与设计不足分别处理，自动检查通过不代表实际画面合格。

用当前PPTX哈希登记review，observations逐页写真实内容核对、可读性与问题，未解决项记needs-fix。改稿后重建并复核当前版本；旧批准不转移，模型不能冒充human。跨稿比较仅针对明确提供的工程，见[originality.md](references/originality.md)。

交付当前可编辑PPTX、对应讲稿、真实渲染和可恢复工程，说明影响使用的限制。完整验证记录另存，正式画面和讲稿不放制作日志。针对具体问题修复；科学含义和可读性成立后，不为凑变化添加装饰。
