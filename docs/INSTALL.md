# 安装与首次使用

本项目是 **DeepSeek Harness（DSH）的本地插件包**，提供学术汇报技能与十四个确定性工具。材料分析与页面构图由当前 DSH 会话的模型完成；插件负责记录、可编辑渲染与检查，不保存 DeepSeek 密钥，也不另行发起模型请求。

本次候选版本为 **v0.7.0-rc.5**，从 [改进分支](https://github.com/YuZhou0311/dsh-academic-ppt/tree/feat/academic-story-and-style)取得源码；旧稳定版 v0.6.0 保留在原发布页。本地实际版本以 package.json 为准。**尚未发布 npm，不要直接用裸包名从公共 registry 安装。**

## 1. 准备本地包

安装本次 rc.5，请克隆改进分支：

```sh
git clone --branch feat/academic-story-and-style --depth 1 https://github.com/YuZhou0311/dsh-academic-ppt.git
cd dsh-academic-ppt
```

rc.5 增加整稿叙事与章节关联、目录问题、讲稿过渡、五套学术色板和默认细描边卡片，封面与导航留白改为视觉提醒。新流程见 [ACADEMIC_STORY_DESIGN.md](ACADEMIC_STORY_DESIGN.md)，验证见 [VALIDATION_V07_RC5.md](VALIDATION_V07_RC5.md)。历史示例保留其原版本身份。

插件位于本仓库根目录。完整文件夹应包含 `package.json`、`package-lock.json`、`cordis.patch.yml`、`src/`、`skills/` 和 `bin/`。

在插件目录运行：

```sh
npm ci --ignore-scripts
node bin/academic-ppt.mjs --help
npm test
```

Node 版本以 [`package.json`](../package.json) 的 `engines.node` 为准。普通 PPTX/HTML 生成不要求安装 Microsoft Office；查看和修改成品可使用 PowerPoint 或 WPS。实际 PPTX 渲染与视觉验收的验证范围见项目说明，HTML 预览不能代替 Office 渲染。

默认 `npm ci --ignore-scripts` 包含可选官方 `@deepseek-ai/libreoffice-kit`，供 `academic_ppt_render` 生成实际 PPTX 图片/PDF。只需要普通生成时改用 `npm ci --ignore-scripts --omit=optional`；未安装或引擎不可用时，渲染工具如实返回不可用状态。

渲染默认使用系统字体。最小环境缺中文字体时，可将有许可的 Noto CJK 等字体放入工作区的 `fonts/`，在 render 参数中传 `fontDirectories`，每次 1–4 个工作区内目录；日常字体齐全时不必传。工具报告字体问题后仍需检查实际页面。

v0.5 封存示例的实际渲染使用 **Noto Sans CJK SC Regular/Bold**。可按 [Noto官方字体下载说明](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md) 的 Language-specific OTFs 选择 Simplified Chinese，取得相应字重；字体遵循其 [SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)。插件包不附带字体。`fontDirectories`用于本次渲染端，不把字体嵌入PPTX；要保持可编辑PPTX的同样字形，演示电脑也应准备所用字体。随稿实际渲染PDF可用于核对固定版面。

### 直接使用安装包

也可以在本次源码根目录运行 `npm pack --ignore-scripts` 得到 `dsh-academic-ppt-0.7.0-rc.5.tgz`，再将压缩包的完整路径交给插件管理：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt-0.7.0-rc.5.tgz"
```

自行打包不改变其候选版本身份；尚无 npm 公共 registry 包。
DSH 的包管理器负责解析依赖。安装包包含运行代码、技能、文档和示例；开发测试及根 `package-lock.json` 由源码归档提供。不要把本节的安装包解压后直接套用源码流程中的 `npm ci` 或 `npm test`。

## 2. 安装到 DSH

### 桌面版

先正常启动一次 DSH Desktop，使其初始化桌面 profile，然后完全退出桌面应用。已配置 `dsh` 命令时，用**自己电脑上的真实绝对路径**安装：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt"
```

Windows 示例（替换为实际目录）：

```powershell
dsh plugin --profile desktop add "file:C:/work/dsh-academic-ppt"
```

也可以在桌面「插件 → 添加插件」的安装输入中填写完整本地包路径。官方管理界面支持包名、Git 地址、tarball 与绝对本地路径；本项目选本地路径。安装完成后启用并重启对应 profile。

### 网页版

```sh
dsh plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt"
dsh web
```

`dsh plugin` 调用 profile 中的 pnpm，所以该命令需要 pnpm 在 PATH 中。`--profile` 必须位于 `add` 前面。`file:` 安装的副本与原始源码是两个位置；修改本地源码后需要重新安装/更新并重启，不应假设已运行的宿主自动加载新代码。

### 更新已安装的 file: 包

退出对应 DSH 应用，准备好目标版本源码或新的 `.tgz`，再用真实路径重新执行上面的 `dsh plugin --profile ... add "file:..."`，启用并重启对应 profile。随后在新会话中确认技能与工具可见。分别查询 contract(topic:brief/design/slide)，检查是否含 narrative、academicPalettes、sectionId、transition 和 agenda.items.question，并确认 study/portfolio 两个工具可见，避免把旧安装副本当作本轮版本。

仅修改仓库、运行测试或生成安装包，不会替你更新正在运行的 DSH。本文提供安装步骤，不表示已在你的电脑上完成安装或验收。

官方依据：[包与安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)、[CLI 插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.zh.md#插件管理)、[本地 file: 包的官方用例](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/README.zh.md#自定义插件)、[桌面插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md#installing-a-bundle)。协议核对日期：2026-10-20。

## 3. 确认插件加载

在新会话中要求 DSH 加载 `dsh-academic-ppt` 技能。应能发现以下工具：

| 工具 | 用途 |
| --- | --- |
| `academic_ppt_init` | 新建研究问题、时长与证据要求明确的工程 |
| `academic_ppt_contract` | 按主题取得精确字段、批次限额与提交说明 |
| `academic_ppt_record` | 从 recordsPath 指定的工作区 JSON 文件登记来源、论点、图与页面 |
| `academic_ppt_context` | 获取下一阶段的精简上下文 |
| `academic_ppt_template` | 按需研究参考模板，返回候选设计变量、结构依据及可选实际页面/概览 |
| `academic_ppt_study` | 生成实际候选 SVG/PPTX 和可选真实预览，不改原工程 |
| `academic_ppt_portfolio` | 比较明确指定的工程结构与封面，提供实际复核页对 |
| `academic_ppt_reference` | 按需查询 48 个中性参考页型；显式 includeExamples 才返回教学文件 |
| `academic_ppt_build` | 生成可编辑 PPTX 与配套产物 |
| `academic_ppt_render` | 使用可选引擎渲染当前 PPTX 的实际页面 |
| `academic_ppt_edit` | 按页面/小卡片 ID 局部修改 |
| `academic_ppt_undo` | 以新修订恢复上一工程状态 |
| `academic_ppt_check` | 检查证据、版式与产物一致性 |
| `academic_ppt_review` | 登记实际完成的视觉检查及范围 |

它与原 `dsh-ppt` 使用不同技能名、工具名和插件 ID，可以共存。学术工程应持续使用 `academic_ppt_*` 工具，不能把它的 JSON 当作原插件工程交给 `ppt_edit`。

首次提示词可以直接复制：

> 使用 dsh-academic-ppt，依据提供的真实论文和数据制作12分钟正式学术汇报。先明确中心问题，规划各节要回答的问题及证据路线，再安排目录、章节定位、逐页论证和具体过渡，结尾回应开场问题。选用适合当前证据的克制学术色板，独立卡片使用细描边。封面以完整题名、留白、对齐和真实身份完成设计，图片只在有研究用途时使用。参考图只借鉴信息层级与正式程度，按本稿内容重新构图。先用study比较两个封面和两个困难证据页，再完成全稿。保留关键条件、原始证据与结论边界，实际查看最终PPTX每页后交付可编辑文件、讲稿和可恢复工程。

上述流程针对 v0.7.0-rc.5 能力。`design.mode` 控制工作指引与设计提醒，布局仍由宿主模型撰写。没有参考时默认 `content-led`；参考视觉语言用 `reference-guided`；只有明确要求沿用版式时使用 `template-faithful`。新工程默认 `density:compact`，正文证据页严重空洞需修复，不能切换 balanced 或增加装饰来绕过；封面、目录和章节页的有意留白只提醒看图判断。确实需要疏朗风格时在初始化中明确选择 balanced。

## 4. 命令行使用

在 CLI 中用 `<命令> --help` 查看该命令的顶层字段与必要条件，用 `<命令> --schema` 取得其完整 JSON Schema；均不需要 --args，也不与执行参数混用。contract 只查询 brief / paper / claim / asset / slide / design / assessment 七类记录，不接受 init、build、render 等命令名。DSH 界面已提供工具参数，CLI 查询是同源的发现入口。

所有命令使用同一套工具参数校验。DSH 注册使用其支持的 JSON Schema 子集，字符长度、数组数量等限制写入说明，并在执行入口用完整 Ajv 规则再次校验。参数保存在 UTF-8 JSON 文件中，避免在 shell 中拼接长文本、引号和论文内容。

```sh
node bin/academic-ppt.mjs init --help
node bin/academic-ppt.mjs init --schema
node bin/academic-ppt.mjs init --args init.json
node bin/academic-ppt.mjs contract --args contract.json
node bin/academic-ppt.mjs record --args records.json
node bin/academic-ppt.mjs context --args context.json
node bin/academic-ppt.mjs build --args build.json
node bin/academic-ppt.mjs check --args check.json
```

文件名只是你创建的参数文件名，**不是空白模板可以直接运行的保证**；具体参数以 [`src/schema.mjs`](../src/schema.mjs) 与随包示例为准。`edit`、`undo`、`template`、`reference`、`render`、`review` 采用相同 `--args` 形式。模板参数是 `filePath`，工程参数是 `projectPath`；源文件及输出目录必须位于调用会话的工作目录内，必要时先由用户把模板放入该工作目录。

模板研究会保存 profile，并返回可应用的 `suggestedDesign`、结构推断依据与紧凑 study。可以传 `outputPath` 指定工作区内位置；同名文件内容相同则复用，内容不同则拒绝覆盖。`render:true` 可同时返回实际源PPTX页面和编号概览；必要时提供 `fontDirectories`。

模板研究是按需步骤。看过代表页后，将 suggestedDesign 作为候选，在 `reference-guided` 模式下按当前内容调整，再写入 record 批次的 design；字体替代或结构推断修正应有实际看图依据。design.system 提供共同字号与可覆盖的构图起点，不规定每页卡片数量、正文结构或固定chrome。templateProfilePaths 只用于局部组件导入。完整流程见 [模板学习](../skills/dsh-academic-ppt/references/template-learning.md)。

正文可用 `layout:academic` 与 composition 组织不同权重的证据面板，不用先选择参考编号。`visualPlan` 保存信息关系、主面板、完整阅读顺序和简短理由，不会自动重排页面。`panel.surface` 支持 `inherit/plain/rule/tint/band`，`align` 支持 `stretch/start`；start收紧后仍须处理剩余空间，不与同面板的显式card.box或所消费机制节点的node.box共用。完整字段见 `contract(topic:slide)` 和 [组合页参考](../skills/dsh-academic-ppt/references/composition.md)。

`design.cardDefaults` 与逐卡 `appearance` 可选outline/tint/solid/plain、圆角、真实内边距、强调边和轻微层次；card.icon提供十种原生线图标。panel.surface控制外层，外层plain可以配内部有边界的解释卡。`design.chrome/slide.chrome`独立控制品牌字、章节、页码、页脚、可见引用与顶部横线。自由原生构图、实际候选和字号政策见 [RESEARCH_NATIVE_DESIGN.md](RESEARCH_NATIVE_DESIGN.md)，首次使用仍以contract为准。

封面可选split/editorial等变体，或用cover.variant:custom与cover.boxes自主分配title、subtitle、occasion、metadata、visual区域，坐标为1280×720中的{x,y,w,h}。只建立有实际内容的区域，保留完整题名和真实身份。原生结束页可用closing.variant:statement/evidence，复杂综合则用composition，不同时使用closing对象。cover/closing的主题图片通过assetId引用已登记usage:decorative资产，不进入slide.figureIds或科学证据记录。

参考页型查询不需要工程路径。把 `{}`、`{"category":"figure"}` 或 `{"templateId":"figure-detail-window"}` 写入参数文件，然后运行 `node bin/academic-ppt.mjs reference --args reference.json`。默认返回中性槽位和空字段骨架；只有 `includeExamples: true` 才返回教学文件入口。`referenceTemplateId` 与 `layout` 写入页面后，生成器实际使用对应几何；含题签的页型还需逐项填写 `panelTitles`，避免沿用示例判断。教学数据不能作为当前研究结论。

### 记录与旧工程升级

先把 `{"topic":"paper"}` 写入 contract 参数文件取得来源契约。把内容写成另一个 UTF-8 文件，例如 `batch-papers.json` 的根为 `{"papers":[...]}`，再以 `{"projectPath":"project/project.json","expectedRevision":0,"recordsPath":"batch-papers.json"}` 调用 record。批次内不放 projectPath、expectedRevision 或 recordsPath；单文件不超过 1 MiB。CLI/core 的旧内联调用继续支持，但 DSH 注册不再每轮携带所有嵌套记录 schema。

新工程默认采用 academic 质量记录：来源 `analysis`、claim 的 `reasoning`，推断/方案的 `dependsOn`，正文页的 `argument`。这不是字段填得长就通过学术评审，内容仍需对应真实材料。没有明确篇数要求时 targetPaperCount 为 0；逐篇导读仅由 requirePaperIntro 明确开启。

旧工程与旧成品保留。旧质量 profile 可以继续读取、编辑与构建，但不会报告已达到新学术交付条件；补充真实分析后通过 record 更新 brief 的 qualityProfile，并重建、实际渲染和登记 observations。本轮渲染器版本为11，旧成品与视觉验收不能自动继承为当前结果。旧文件未设新卡片/chrome字段时保留兼容分支；record更新design时省略mode、density、cardDefaults、chrome、direction、projection、colorRoles会保留已有值。迁移不能凭空补造阅读或审查。

随包历史materials-v05离线demo显式使用balanced与开放内层卡片的兼容配置，保留原有外层分组；它用于核对安装、证据记录和可编辑导出，不作为新compact自主设计的效果验收。历史像素一致记录只描述当时的v0.5重建，不承诺renderer 7重建与封存截图相同。

从三页小样补全全稿时，可在记录批次提交 `slideOrder:[全部当前页面ID]`。工具要求每页恰好出现一次，重排与同批新增页面原子保存；不用直接改 project.json。重排后的版本需要重新构建并审查。

最终 review 的每个 reviewedSlides ID 都需对应 observations：contentCheck、legibilityCheck 和 issue。未解决问题写入 issue 并登记 needs-fix。工程已保存后返回异常时先 context 确认 revision，避免盲目重放操作。

### 按图片任务组织页面

先实际查看图，需要参考候选时再向 `academic_ppt_reference` 提供 `figure`：原始 `width/height`、已核对的可选 `viewport`，以及包含 `purpose/contentType/task/verifiedBy` 的 `reading`。返回至多三个候选、必要元素和具体适配问题。没有测量过关键字形时省略 `minLabelPx`，不能编值消除提示。

若所有模板都不适合，使用不带 `referenceTemplateId` 的 `figure-focus` 或 `figure-split`，为每个图指定 `figureBoxes`、为每张卡片指定 `box`。完整例子见 [真实论文源记录](../examples/science-demo.mjs)，决策过程见 [图片选版](../skills/dsh-academic-ppt/references/figure-selection.md)。用 `card.kind/emphasis`、节点 `kind`、`asset.displayCaption/displayLegend/treatment` 实现语义层级，不需要将页面栅格化。

默认输出简明操作摘要。调用程序若需要路径、修订号与完整检查对象，可显式添加 `--json`。CLI 的相对路径按启动命令时的工作目录解析；DSH 工具按调用会话的工作目录解析。改变一个会话的目录不会更改全局进程目录。

退出码：`0` 表示操作成功；`2` 表示工具返回需要处理的领域问题；`1` 表示参数、读取、执行或取消失败。验收状态仍需阅读返回结果，不能只根据退出码声称论文或视觉已通过。

## 5. 实际能力边界

- 源码锁文件与根 `overrides` 只约束本项目作为根工程的安装。DSH profile 独立解析依赖；其包管理器不会自动采用依赖包自己的 overrides。v0.5 源码验证使用 image-size 2.0.4，而 PptxGenJS 4.0.1 的上游依赖范围为 1.x，因此应在目标 profile 中核对实际版本与审计结果，不能沿用历史依赖报告。需要统一版本时，应由宿主在对应根配置维护 overrides，保留其已有配置。[npm 官方规则](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)；[pnpm 根设置](https://pnpm.io/settings#overrides)。
- 论文检索、全文读取和图像观察由宿主已提供的能力完成；插件不根据模型名字推断“能够看图”，也不伪造全文阅读。
- 模板导入保留受支持的原生基础形状信息，复杂图片纹理、特殊效果、图表或母版关系可能无法复用；检查工具会列出边界。不能把“盘点成功”当作任意模板无损克隆。
- 原始论文图可以作为独立图片嵌入；页标题、分析、图注、标注和卡片保持原生编辑。整页截图不作为可编辑性解决方案。
- 版本、摘要和静态几何检查负责发现可计算的问题；它们不证明科学结论真实，也不等于看过最终 PPTX 的每一页。
- 设计模式、visualPlan与设计提醒支持模型作出和复核构图决策；compact的严重连续空洞有明确阻断门槛。工程诊断不构成自动审美评分，背景、卡框和图标不计有效内容。缺少实际运行与独立审查时，不报告新提示的稳定创作效果。
- 注册/API 测试与本地生成测试证明工具协议和代码行为；真实 DSH 界面、付费模型端到端运行、PowerPoint/WPS 实际显示属于各自独立的验证层，只有实际完成才可以报告通过。

## 6. 卸载

```sh
dsh plugin --profile desktop remove dsh-academic-ppt
```

网页版将 `desktop` 换成 `web`。随后重启对应 profile。工程和已经生成的 PPTX 不随插件卸载自动删除。
