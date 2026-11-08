> 当前新增：见 [reference-composition.md](reference-composition.md)。支持 compose-opening、自然高度、flow方向、逐字短语强调与显式比较尺度；以contract返回schema为准。

# 正文构图：把内容关系交给工具实现

这不是换一种固定模板。模型选择内容关系、主次和色义，编译器计算网格、内边距、图片等比框、文字高度、共享行、连接端点。不要让模型把精力耗在重复手算坐标，也不要由程序替研究者编造论证。

## 正常入口

`contract(topic:authoring)` → 写 UTF-8 JSON → `plan(projectPath, expectedRevision, requestPath)`。
注册的 Agent init 对新工程默认使用 `design.authoringMode:content-tree`（不依赖模型主动填写）。底层 SDK 直接调用仍保留兼容默认，读取旧工程也不自动改写。这使缺少显式构图的正文（或没有完整定位的 academic drawings）在构建时（包括草稿）被拒绝，防止模型再次退回 figure-focus 自动侧栏；不会强迫颜色、图片数量或特定布局。已有工程保持兼容；用户明确要求套版时可用 custom 并保留模板实际 composition；需要旧自动布局的兼容工程可在初始化时明确 legacy，不得把已经选择的内容构图模式降级来消除报错。

根对象只有 `kind:compose-page`、`mode:create/replace`、`slide`、`intent`、`body`；replace 另需 `changeNote`。slide 包含当前真实 id/title/paperIds/claimIds/notes/seconds，可带 argument/section/transition。不含 layout/cards；工具编译为现有原生 drawings/composition。输入以 revision 命名保存在工程的 page-authoring 目录，修改该文件副本后再次提交。

## 八种可组合部件

| 部件 | 编排职责 | 关键字段 |
|---|---|---|
| split | 行/列分区；内容复杂度不同，不必等宽等高 | axis:x/y、children、gap；子项 weight 分剩余空间，extent 固定本级轴向尺寸；纵向行可用 extent:"content" 按内容测量 |
| group | 真实分组、题签、层级底板 | tone:plain/paper/soft/accent/ink；headingStyle:band/tab/rail/rule/text；title、padding、child |
| text | 论点、读图解释、条件、数值 | text、role:body/label/note/title；可设置 bold/color/align/vertical |
| figure | 原图完整展示或已核对面板 | assetId、caption、align:top/center/bottom、captionGap；图注紧随实际图像，保持 contain，不能猜裁切 |
| table | 精确读数/条件共享行列 | columns/rows/columnWeights/headerTone/claimIds；rowHeaders、rowTones、columnAlign |
| comparison | 2–4种方法按同口径指标共享行，精确读数与单位相邻 | items:方法id/label/tone；metrics:label/unit/values/note；values必须完整对应，不自动计算或填补 |
| statement | 简短命题或必要条件带，不重复标题结论 | label、text、tone、claimIds；内容必须由作者提供 |
| flow | 有证据的单行方法关系及反馈 | nodes、edges、claimIds；flow/feedback/association 的含义不能互换 |

不支持的新关系不要硬塞：树可以表达嵌套行列；任意拓扑、公式、多层网络和原生chart继续使用已有 drawings/composition，而不是退回自动卡片。flow 单行最多5节点；非相邻连接需分组或显式布线，不能让线穿过中间节点。

## 设计之前只做三项具体决定

1. 当前页要让听众完成哪一个判断？标题和图中的比较对象是否一致？
2. 哪些东西必须共享一行/一列/一个尺度？主证据是谁？在 intent 中指向真实节点。
3. 证据、解释、条件如何贴合？它们是编辑检查，不是每页必须显示的三个栏目。

参考样张决定质量，不决定照抄位置。结果少不代表要堆大数字；方法复杂不代表缩成不可读截图；白底并非错，但大小/分组/色块不能没有职责。

## 收紧高度、保留图文邻接

先读 [视觉工艺](visual-craft.md)。纵向 split 中，短说明、table、comparison、statement、可测量 group 可用 `extent:"content"`。工具按当前列宽计算文字和表格所需高度，flex区域分配剩余空间；超过页高会返回逐节点高度，不能缩字。横向不能用 content 猜列宽，用 weight 或明确尺寸。flow仍需足够的弹性或显式高度。

figure的默认align为top；居中或底对齐时，图片与图注作为整体移动，captionGap默认为8px。普通figure不会拉伸或隐式裁切。图注不再被推到高槽底端。

## 图像和裁切

先 record 原图资产，保持下载、图注核对、是否采用三种状态分开。figure-inventory 不只扫描已选三张。被排除图需说明不适配什么任务；在全稿范围寻找用途，不为数量上图。

viewport 只能从实际看过的原图确定。必须保留当前子流程/面板的输入、输出、标签、坐标和必要图例。几何合法不等于语义完整。方法截图只剩细条时，回看原图；不能用两段旁注补救被截断的方法。定位图可小，但要有可读主证据。

## 精修不是填表

compose 返回实际 contentBox、每个节点的 box、每张图最终 imageBox/captionBox、图注间距和字号/比例警告；authoringMap保留主角及阅读顺序的真实节点/对象ID。溢出时调整权重、层级、文本表达或拆页；不自动缩字。正文工作起点28px，标签24px，注释18px，标题32px。

之后 `build(draft) → render → read_image`。第一轮先看整页重心和信息关系；第二轮看图内标签/图文对应；最后修断词、行距、边距。没有缺陷不机械凑修改轮数。每个改动说清“哪个节点、原来怎样、现在怎样”。已保存页面重排用 replace；证据/图像/来源仍走原登记与审查，工具不会填 verified 或 confirmed。

## 同内容迁移练习

提供原始材料，不提供该任务的完整布局答案。把比较对象从2个变5个、改变图像比例、延长必要条件。必须重新规划 split 权重、共享行数、图文关系，而不是整体缩放旧画面。保留首稿、修订稿与全部工具事件；这才检验模型是否会迁移。

示例 JSON 在插件根目录 examples/content-authoring；新增 craft-shared-metrics.json 与 craft-method-bridge.json 对应实际教材PNG。它们是原创结构教学，不是科研数据；复制时替换所有内容和来源，不能直接运行示例冒充报告。诊断和样张只证明生成器能执行，不证明真实模型已学会。

修改全稿字体、标题或网格后，重新提交保存的内容树（replace）使内容区重新计算；不要以旧几何报告替代当前布局。当前 table 编译成原生形状/文字，而不是 PowerPoint 表格对象；figure 内部仍为源图片，均不冒充原生可编辑科学曲线。
