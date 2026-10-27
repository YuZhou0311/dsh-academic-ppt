# dsh-academic-ppt v0.9.0

0.9.0 将制作流程从局部组件选择推进到“研究证据 → 故事板 → 真实样张 → 整稿 → 可验证交付”。保留学术来源链、原图、原生可编辑对象和 `schemaVersion: 1`，注册工具从16个增加到19个。

本文件对应 **v0.9.0 正式版本**。[下载 DSH 安装包](https://github.com/YuZhou0311/dsh-academic-ppt/releases/download/v0.9.0/dsh-academic-ppt-0.9.0.tgz) · [Release 与五项发布文件](https://github.com/YuZhou0311/dsh-academic-ppt/releases/tag/v0.9.0)。安装包、源码ZIP与校验清单来自同一发布提交，具体提交和文件摘要见 `release-manifest.json` 与 `SHA256SUMS`。

## 官方 Agent 接入复核

在固定官方 DSH `0.2.1-rc.2` / `0.2.1-rc.3` 上新增真实 AgentLoop 回归，逐步核对技能目录、完整正文、参考文件、19个工具的 schema 及模型可见结果。每版31个 provider 请求、24次实际工具调用；包含原生图片内容送达和视觉能力拒绝对照，provider 响应使用合成脚本，未调用真实模型API。详见 [Agent 接入核验](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/docs/AGENT_INTEGRATION_V090.md)。

修复必需技能失败后仍暴露工具、会话切目录后仍使用旧目录、未核验只读/工作区写入策略，以及样张前确认循环和反馈使相同产物失效的问题。恢复输出增加具体已选方案和回答依据。CI固定两版实际接入测试，并强制执行真实渲染下的反馈、样张与交付回归。

## 核心变化

### 1. 可审阅、可执行的证据故事板

新增 `academic_ppt_plan`：每页写明问题、判断、证据与图片、推理、边界、必须保留的正文条件、时间预算和承接。生成便于人读的 Markdown，同时保留结构化记录。实际页面顺序、证据丢失、已选图未上页、重要条件被移入备注都会进入检查。

六页及以上整稿的最终交付需要完整故事板和当前真实样张。短稿不为满足形式增加页面。规划中的未来页可以继续编排，尚未登记的来源仍明确显示为缺口。

### 2. 以真实样张进行人机协作

新工程与独立 `prepare` 默认 `consultation.interaction: checkpoints`。把故事线和使用场景一起讨论，再看封面、困难正文与连续三页，选择完整方向。七个既有 topic 保留为兼容字段，一次真实回答可以落实多项选择；不要求七次问卷。

已有偏好直接沿用，明确委托后自主推进。样张记录绑定科学内容、视觉系统与故事板；增加已规划的其他页不会让样张过期，改变其关键内容则需复核。用户回答和看图观察仍是调用者记录，插件不伪称独立识别了人的批准。

### 3. 32 种内容驱动的整页语法

新增 `academic_ppt_layouts` 和 `compilePageRecipe()`。语法覆盖主证据与旁注、共尺度比较、多面板、总体与局部、实验分叉汇合、方法泳道、反馈循环、机制证明、消融、稳健性、跨研究综合、方案判定与任务依赖等关系。

每种语法提供适用条件、不适用情形、证据需求、槽位、容量与可替代关系。编译器绑定现有真实载体，拒绝空绑定、重复消费、未知载体和非法几何。比例可以改，页面可以自主设计，不设置整稿必须使用多少种版式的配额。

配套32页原创原生可编辑PPTX、可检索HTML图册、JSON目录、精选SVG与真实渲染概览。所有示例都是明确标注的结构示意，不含用户商业模板或实测科研数据。原有48种卡片、48页参考和20款局部组件继续保留，作为按需参考。

### 4. 从具体组件学习到可执行的视觉细节

保留原48款卡片与20款局部组合的学习入口，新增具体`componentStudies`及`paletteRationale`。记录源组件/模板页、实际预览、填充与框线、题签、间距及本稿改造。新checkpoints流程的计划或实际页数达到六页时要求这些细读；整页recipe不能代替组件观察，不强制采用preset或凑卡片种类。旧工程保留兼容提醒。

普通卡、preset和嵌图卡新增`fill/stroke/strokeWidth/dash/shadow`，可直接表达真正无填充虚线、白底细实线与独立轻阴影。保留内部内容关系、图像尺寸与原始媒体。原生drawing的矩形/椭圆同样支持阴影；实际PPTX明确输出noFill、线型与零值阴影参数。

配套[视觉语言指南](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/skills/dsh-academic-ppt/references/academic-visual-language.md)及四页原创可编辑细节图册，说明边界、纸面、浮签、侧签与嵌套的用途。深蓝、黑灰、白与克制暗红提供正式方向的起点，实际色义与用户偏好优先；颜色与边框丰富度不作为自动审美分。

### 5. 检查原图最终能否承担读图任务

图像诊断增加真实图片框、图注/图例占用、面积比例、原像素、缩放、投影标签尺寸与目标显示要求。对承担读数或多面板比较任务、已经落入小图风险区且标签未测量的图片，返回 `figure-readability-unverified` 错误。

这不是强制所有图片占据固定面积。总览图、定位图和虽小但已证明可读的图保留各自用途；无法读出所需内容时必须调整版面、拆页或选择有依据的局部。

### 6. 正式交付成为单独操作

新增 `academic_ppt_deliver`。只有当前未改动的 review 构建、真实PPTX渲染、完整逐页审查、无缺字体，以及必要的故事板/样张全部满足，才创建正式交付包。`needs-fix`、旧hash、缺页、损坏预览和未解决科学来源问题都不会被打包成合格交付。

交付包含PPTX、PDF（渲染器提供时）、逐页PNG、讲稿、来源、故事板、质量与审查记录、带内嵌资产的可重建工程和逐文件SHA-256清单。既有目录拒绝覆盖。重建后的版本需要重新渲染和审查。

草稿文件名改为 `preview-not-for-delivery.pptx`，构建返回值始终明确它不能交付。不能因为一个PPTX成功写盘就宣称完成。

### 7. 学术与工程修复

- 对多篇来源重复使用同一套推理和边界给出人工复核提示，不把通用字段填满当作学术论证完成。
- 修复样张批准时未覆盖关联 claim/paper/asset 错误的问题。
- 区分样张与整稿：明确分配到后续页的已核对原图与完整书目可延后呈现，但最终交付仍须完成；移除未来分配后不能沿用这个阶段例外。
- 修复故事板文件名冲突后工程已经提交的非原子写入问题。
- 整页语法ID在计划与参考学习中都验证来源，错误选择返回可执行诊断。
- 同步核心工具、按需完整契约、CLI帮助和技能文档，保持较小的初始工具上下文。

## 验证与实际边界

已执行源码回归、原生PPTX检查、实际LibreOffice渲染、独立工作流验收，以及DSH官方Host `0.2.1-rc.2` / `0.2.1-rc.3` 注册与调用测试。具体数量、样稿、字体与环境范围以 [0.9.0验证记录](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/docs/VALIDATION_V090.md) 为准。

这不等于已测试用户的Desktop/Web界面、DeepSeek模型会话、PowerPoint/WPS和所有字体组合。插件可检查过程、文件和来源记录，不能自动证明科学结论、审美水平或用户确认真实发生；实际看图和专业判断仍不可省略。

## 升级入口

- [安装与升级](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/docs/INSTALL.md)
- [0.8.x工程迁移](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/docs/MIGRATION_V090.md)
- [32页原创语法图册](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/skills/dsh-academic-ppt/references/page-recipes/index.html)
- [设计依据与开源参考](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.0/docs/DESIGN_RATIONALE_V090.md)

运行范围保持 Node.js `^22.19.0 || >=24.0.0`、DSH Host `>=0.2.1-rc.2 <0.3.0-0`。本次提高 renderer 版本，旧导出保留，但不能沿用为新版的最终审查凭证。
