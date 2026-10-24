# v0.6.0：内容驱动的学术设计

> 历史 v0.6 设计记录。文中的“本轮/当前/默认”指当时版本；rc.4 的自由构图、字号与候选流程以 [RESEARCH_NATIVE_DESIGN.md](RESEARCH_NATIVE_DESIGN.md) 为准。

本轮针对两类实际问题：模型会照模板填内容，也会把“避免装饰”理解成没有边界的小卡片、大片空白与同质化页面。本文说明本版的实际接口与执行规则，发布状态和验证结果分别见[版本说明](RELEASE_NOTES.md)与[验证记录](VALIDATION_V06.md)。插件继续使用 DSH 当前会话模型，不引入另一个付费生成服务。

## 1. 为什么仅写“不要照抄模板”不够

v0.5 已有来源、claim、argument、学术组合页与真实渲染；初轮内容驱动改造又加入设计模式、visualPlan 和局部面板样式。实际报告仍暴露出指令与能力之间的缺口：

- 开放面板加 plain 卡片使读图说明和条件成为散落文字；“避免套框”压过了真实的分组需求。
- start 只收紧局部，未重新安排剩余空间，结果正文集中在页面上方，短句占据高侧栏。
- 统一页眉和身份带被理解为全稿必须重复；封面与结尾缺乏独立构图。
- 只检查连续三页与精确比例，难以发现分散出现的相同骨架；换色、换框、微调比例不能解决问题。
- 没有溢出被当作设计完成，实际卡片边界、有效内容分布和全稿节奏未被认真检查。

因此本轮同时修改提示词、组件、默认值、工具契约、恢复提示与检查器。模型需要决定内容怎样分组，工具也必须真的画出这些分组。

## 2. 模式与密度是不同约束

| 字段 | 取值 | 意义 |
| --- | --- | --- |
| design.mode | content-led | 新稿默认，从当前证据组织载体、分组和阅读顺序 |
| design.mode | reference-guided | 借鉴审定后的字体、配色、层级和对齐，当前内容决定结构 |
| design.mode | template-faithful | 在支持范围内服从用户明确指定的版式，不声称无损导入 |
| design.density | compact | 新工程默认，严重连续空洞需要修复，封面与结束页也受约束 |
| design.density | balanced | 初始化时明确选择疏朗设计；空洞保留提醒，不做密度阻断 |

设计模式不自动生成布局。compact 也不等于把每像素填满：必要边距、组间距和科学图内部留白应保留。已有 compact 工程不能通过 record 改为 balanced 来绕过失败；确实改变设计要求时另建工程，保留原记录。

旧工程缺少 mode 仍可读取和导出，context.designMode 返回 legacy 只是状态，不可写入 design.mode。旧文件缺少 density 时按 balanced 诊断。record 更新设计时省略 mode、density、cardDefaults、chrome 会保留已有设置；其余必需字段仍按 design 契约提供。

## 3. 论证与构图各有明确记录

argument 回答本页研究问题、贡献与边界。有 composition 的页面可用 visualPlan 保存简短设计判断：

| 字段 | 用途 |
| --- | --- |
| relationship | 主要关系：comparison / sequence / mechanism / hierarchy / evidence-explanation / matrix / synthesis / definition |
| primaryPanelId | 希望成为视觉焦点的实际面板 ID |
| readingOrder | 当前所有面板 ID 恰好一次，记录希望听众遵循的顺序 |
| rationale | 与本页证据有关的适配理由，不复制“清晰、美观、有层次” |
| alternatives | 关键页最多两个未选构图及取舍，普通页可省略 |
| repetitionReason | 说明共同尺度或比较任务为何需要相同结构，不豁免空洞与可读性问题 |

这些字段不会移动对象、放大主面板或验证推理质量。实际几何仍由 composition 决定，最终要看画面是否实现计划。原生封面、原生 closing 和无 composition 的固定页型不填 visualPlan；可在本地设计笔记保留简短决策。设计说明不进入正式投影内容与讲稿。

## 4. 面板负责关系，卡片负责局部分组

正文仍使用 layout:academic 与 composition.rows。最多 3 行、每行 4 面板、全页 8 面板；每面板一种主载体并可附文字解释。图、表、科学图与机制节点应有明确归属，不创建空面板填空间。

| 字段 | 取值 | 用法 |
| --- | --- | --- |
| panel.surface | inherit / plain / rule / tint / band | 选择区域外层：继承、开放、线条、浅色题签、标题色带 |
| panel.align | stretch / start | stretch 利用同行高度；start 按完整最小高度收紧局部 |

plain 去掉外层框线，但保留面板标题与内容。它不要求内部解释卡也无边界。常见组合是开放主图与独立浅底解读卡；外层已有明显容器时，内部可开放，避免多层重复框。

start 不能重新分配收紧后留下的空区。短组用后仍须重排行列、扩大真实主证据或合并页面，不能全稿 start。它不与同一面板的显式 card.box 或所消费机制节点的 node.box 共用；需要绝对坐标时保留 stretch。完整契约见[组合页参考](../skills/dsh-academic-ppt/references/composition.md)。

## 5. 自主设计可编辑小卡片

design.cardDefaults 提供局部组件的共同语言，card.appearance 逐字段覆盖。新工程默认使用 outline、12px 圆角、16px 内边距、左强调边、无阴影；这是可修改起点，不是一套必须沿用的卡片模板。

| appearance 字段 | 取值 | 实际职责 |
| --- | --- | --- |
| surface | outline / tint / solid / plain | 轮廓、浅底、强调实底、开放内容 |
| radius | 0–18 | 圆角半径，单位 px |
| padding | 12–24 | 测量正文容量时纳入的内边距，单位 px |
| accent | left / top / none | 强调边的位置 |
| elevation | boolean | 轻微层次，不改变内容身份 |

下面是卡片外观片段，需合入包含 id、kind、title、body、claimIds 的真实卡片：

```json
{
  "appearance": {
    "surface": "tint",
    "radius": 10,
    "padding": 18,
    "accent": "none",
    "elevation": false
  },
  "icon": "boundary"
}
```

card.icon 支持 question / method / evidence / comparison / boundary / hypothesis / satellite / leaf / water / model。它们由原生线条和形状组成，可编辑，避免依赖 emoji 字形。图标帮助识别概念，不算科学证据，也不是每张卡的必选项。

独立的读图说明、条件与限制应形成可辨认分组，卡片尺寸和数量随内容决定。一个有主次的解释卡组不必等宽等高；一句话也不应被拉成大空框。旧 style 与新 appearance 分别承担旧排法和新外观，不能混淆；既有复杂样式保留兼容分支。具体组合见[组件语法](../skills/dsh-academic-ppt/references/component-grammar.md)。

## 6. 封面、结尾和页角可独立设计

design.chrome 定义全稿起点，slide.chrome 按页覆盖：

| 字段 | 取值或用途 |
| --- | --- |
| header | band / rule / plain |
| showBrand / showSection | 是否显示品牌与章节信息 |
| showPageNumber / showFooter | 是否显示页码与页脚 |
| showSources / showTopRule | 是否显示页脚引用与顶部横线 |
| brandLabel | 按页改写品牌字，空字符串清除 |

新工程默认 plain 页眉且不显示顶部横线。统一字体、色义与间距，并不要求所有页都显示同一角标。删除无用 chrome 后回收正文空间；关闭可见来源时仍须保留图注等适当来源线索、完整书目与证据记录。

cover.variant 在既有 formal/minimal/framed/project 之外支持 split/editorial 与 custom。cover.titleLines 按语义断行，合起来与完整 slide.title 一致；未知身份省略并移除空身份基座。cover.assetId、cover.visualCaption 与 cover.icon 可支持主题视觉，不以一个固定身份色带代替封面设计。

custom 可自主设计角色区域，不只是从两个新增模板中选择。cover.boxes 中的每个区域为1280×720画布里的{x,y,w,h}：title必需，按实际内容增设subtitle、occasion、metadata、visual；cover.align为left/center/right，默认left。metadata依次显示报告人、单位、日期，visual包含主题图片或图标及其图注。没有相应内容就不留空box；有内容就必须提供对应box。完整文字会参与测量，缺区、越界、相撞和溢出均会报告，不能通过删题或缩字通过。boxes与align仅用于custom，该模式不添加预设横线、色块、logo、角标、页码或页脚。图片与图标二择一，也可都不使用。

原生结束页使用 layout:closing 和 closing 对象：

```json
{
  "closing": {
    "variant": "statement",
    "statement": "填写已有证据支持且保留适用范围的核心判断",
    "question": "填写值得讨论或进一步检验的具体问题",
    "icon": "evidence"
  }
}
```

closing.variant 为 statement 或 evidence，可配 slide.cards，并可提供 assetId / visualCaption / icon。复杂综合也可用 composition；此时不要同时设置 closing 对象。结束页要重新收束判断与证据，不能默认三列短句或只写“谢谢”。

封面/结尾的 assetId 指向预先登记的 usage:decorative 资产，不列入 slide.figureIds。通过本地 path 导入时仍登记 id、caption、sourceUrl、sourceVersion、license、usage、cropNote；原图作为研究证据时则走普通 figure 流程。主题图片不冒充研究区、遥感产品或实验观测。详见[视觉设计](../skills/dsh-academic-ppt/references/design.md)。

## 7. 检查内容分布，不靠装饰刷占幅

designGeometryReport(project, scenes) 使用与 PPTX 共用的场景，估计正文区的内容分布与最大连续空矩形。文字按实际估计行范围计入，原图、表格、图表和科学统计图视为完整载体。背景、卡框、图标、空文本框与正文装饰不计有效内容。

| 页面 | 开始提醒 | compact 阻断 |
| --- | --- | --- |
| 正文与 closing | 连续空区占正文区 20% | 25%，即四分之一 |
| cover | 28% | 50%，即二分之一 |
| section | 34% | 60% |
| references | 28% | 只提醒，可合并或重排书目 |

封面的上下文图片可以计入视觉空间分配，单独记录 contextVisualCoverage，始终不计为科学证据；正文与结尾的装饰图片不能消除空洞。科学图内部的留白不作页面空洞，不能为通过诊断裁去图例或改变数据。

报告给出内容区、最大空区坐标、占比与阈值。算法采用 8px 网格和光学余量，是可解释的工程检查，不是普适美学定理。修复优先扩大真实主证据、重排行列与卡片、就近放置解释，必要时补齐缺失分析或合并页面。不得用装饰、重复文字、假观点或降低密度要求通过。

## 8. 确定错误与设计提醒分开

| 诊断 | 级别 | 含义 |
| --- | --- | --- |
| visual-plan-layout / visual-plan-primary-panel / visual-plan-reading-order | error | 计划无实际 composition、焦点不存在或阅读顺序不完整 |
| large-unused-region | error | compact 页面达到相应严重连续空洞门槛 |
| unused-region-review | warning | 连续空洞需要查看实际渲染 |
| design-plan-missing | warning | 新创作模式的组合页尚未保存计划 |
| layout-repetition | warning | 连续三页使用近似主结构与比例 |
| deck-layout-dominance | warning | 至少五张正文中，至少四张且占六成使用同一近似骨架，含非相邻页 |
| equal-text-panels | warning | 至少三个按行列比例估计等面积的纯文字面板 |
| unframed-card-stack | warning | compact 页的开放面板中有多个缺少可见边界的文字组 |
| repetition-reason-thin | warning | 重复理由过短，尚不足以审阅具体比较任务 |

相同比例缩放、颜色、边框、细小权重扰动和空卡片不能算新结构。template-faithful 略过原创结构相关提醒，仍保留科学、引用和空间约束。至少 16 个非空白字符的重复理由只是可审阅门槛，不是语义正确性证明，更不能豁免空洞阻断。

## 9. 科学边界与真实验收

reported / inference / proposal、dependsOn、reasoning、来源定位、数值口径、全文条件和原图来源继续保留。自主创新发生在研究组织与表达中，不授权补造实验数据、显著性或因果发现。背景和定义页可以准确说明概念，不强迫每页制造一个新结论。

先做封面、最难证据页、机制或综合页等代表页，实际包含将使用的卡片、图标、图注和主题视觉。全稿完成后查看概览与当前 PPTX 的每页：卡片是否清楚，主证据是否足够大，空区是否割裂内容，封面与结束页是否独立设计，不同任务是否反复套同一骨架。没有溢出不等于设计完成。

## 10. 编辑、恢复与验证边界

card-style 允许 style / accent / templateComponentId / appearance / icon，继续保护文字、数值、外框、其他场景对象与备注。内边距或图标会改变卡内排法；若引起其他对象变化，保留检查会拒绝。整页 composition、chrome、cover、closing 与 visualPlan 用 slide-content 修改，可选字段通过 removeFields 明确移除。

本轮渲染器版本为 7。旧项目未设置新字段时保留兼容分支；新建工程才获得新默认值。旧产物与审查不自动转移，须重新构建、实际渲染和登记当前逐页观察。代码行为、实际效果及未验证范围见[验证记录](VALIDATION_V06.md)。

独立试用应只给新上下文执行者任务、插件和允许的原始材料，不把失败诊断、旧稿或主线程排好的答案交给它；评审再核对源证据与实际渲染。一次成功不等于真实 DSH / DeepSeek 的稳定成功率，历史 v0.5 和 renderer 6 成稿也不转用为本轮能力的证明。[设计参考](DESIGN_REFERENCES.md)记录了机制借鉴，新增提示与实现为本项目编写。
