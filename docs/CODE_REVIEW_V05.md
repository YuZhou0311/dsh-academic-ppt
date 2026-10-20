# v0.5 发布候选只读代码审查

审查日期：2026-10-20。仓库：[YuZhou0311/dsh-academic-ppt](https://github.com/YuZhou0311/dsh-academic-ppt)。审查时 HEAD 为 `ea1d048`，工作区为尚未提交的 v0.5 候选；下文位置按本次读取的工作区文件。

**状态更新：同日完成五文件门槛修复的独立窄复核，原两项 must-fix 与两项 optional 均已关闭；未发现补丁新增 blocking/must-fix。以下原始发现与摘要作为修复前快照保留，修复后的依据、摘要和限制见本文末尾“后续窄复核”。这不替代最终报告的材料和视觉验收。**

## 结论与分级

**未发现按论文题名、材料数据集、已知文件摘要、预期统计答案或特定节点 ID 启用的特殊科学内容分支。新增设计推断、组合布局、原生机制图和科学图的实现依据显式结构、通用几何及调用者的数据。** 这个结论限于下述静态审查与最小复核范围，不等同于证明所有输入都正确，也不以已通过的测试数量替代代码审查。

| 分级 | 数量 | 结论 |
| --- | ---: | --- |
| blocking | 0 | 未确认针对测试材料的作弊分支、隐藏固定科学答案或本次修改造成的系统性破坏。 |
| must-fix | 2 | 教学图片的路径来源检查在正常登记后失效；同一 PPTX 重新渲染后可能沿用旧画面的视觉审查。建议发布前修复。 |
| optional | 2 | review 帮助对 observations 的条件性必填要求不明确；帮助中的安装命令名与 package 的 bin 名称不同。 |

两项 must-fix 均经 `git show HEAD:…` 确认对应逻辑已存在于当前 v0.4 基线。它们是**当前候选仍存在的实际门槛缺口**，不是将其归因于 v0.5 的新回归，也不是开发者故意作弊的证据。

## Must-fix 1：教学图片的路径识别在正常登记时丢失

**位置与实际调用链**

- `src/schema.mjs:34`：asset 的 `provenance` 可省略。
- `src/core.mjs:48`、`:60`：正常 record 会经 `embedAssets` 嵌入图片。
- `src/io.mjs:140`、`:145`：读取调用者的 path 后，嵌入对象执行 `delete embedded.path`，没有根据该路径保留教学来源身份。
- `src/academic-quality.mjs:63`：`template-as-evidence` 仅依据 `provenance === 'template-demo'`，或尚存在的 `references/templates/assets/` 路径作判断。
- `skills/dsh-academic-ppt/references/template-learning.md:49`、`:51` 声明教学图不能作为当前研究证据，且质量检查会检测其误用。

**最小复核（内存执行，不创建工程或导出文件）**

使用仓库既有的普通合法测试记录，仅将资产输入改成随包教学图片 `skills/dsh-academic-ppt/references/templates/assets/distribution.png` 的路径，省略可选 provenance，并去掉待重算的 data/hash/dimensions。执行 `academicIssues → embedAssets → academicIssues/evidenceIssues`：

```json
{
  "before": ["template-as-evidence"],
  "after": [],
  "storedPath": null,
  "storedProvenance": null,
  "evidenceErrors": []
}
```

这说明仅遗漏可选来源类型，就会使**输入时已经能识别的随包教学图**在正常登记后不再被该门槛识别。无需编辑 project.json、修改校验器、伪造回执或更换教学图片的字节。此复核没有把测试记录当作真实研究，也没有构建可交付报告。

**建议**

在资产嵌入、删除输入路径之前，对已解析路径属于随包教学资源根目录的图片保留不可丢失的 `template-demo` 来源身份，或在其声明为 figure 时直接拒绝。判断应基于插件自有教学资源的规范路径，避免加入当前论文、数据集或预期答案的黑名单。随后仅需一个经过正常 record 路径的回归验证，覆盖“教学路径 + 省略 provenance”；对改名、重编码或虚假源元数据的全面鉴伪不在此建议的保证范围内。

## Must-fix 2：同一 PPTX 再次渲染后，旧视觉审查仍可能满足交付条件

**位置与实际调用链**

- `src/core.mjs:235`、`:236`：每次 render 均可传入新的 `fontDirectories`。
- `src/vendor/dsh-ppt-render.mjs:166`：该参数实际传给转换器，可能改变字体选择和页面画面。
- `src/core.mjs:239`：成功渲染后只替换 `next.artifact.render`，未清除旧 `visualReviews`。
- `src/schema.mjs:65`、`src/core.mjs:226`：审查记录只绑定 `pptxSha256`，没有绑定渲染收据或各页图片的摘要。
- `src/core.mjs:162` 至 `:165`：check 按 PPTX hash 汇总旧的逐页 passed，再结合**最新** render.status 和 missingFonts 计算 readyForDelivery。

**后果**

正常接口可以形成以下状态：PPTX 已经逐页记录 passed；随后补充字体或换字体目录并重新渲染；新画面尚未查看，但源 PPTX hash 不变，旧 reviews 仍覆盖全部页。如果其他条件满足，readyForDelivery 仍可能为 true。

一个尤其常见的路径是：第一次转换缺字体，审查者看过替代字体画面并登记通过，但交付因 missingFonts 阻断；补齐字体后重渲染消除了 missingFonts，同时可能改变字形、换行与遮挡，旧审查却立即被用于新画面。这里确认的是完整代码路径允许旧审查计入新渲染；本次没有实际运行两个字体环境，未断言某份当前报告已经发生了这种情况。

**建议**

成功替换实际渲染时使旧 `pptx-render` 审查失效，或将其绑定到本次渲染收据/实际页面输出摘要，并在 check 时匹配。内容和 PPTX hash 未变不能单独证明渲染画面未变。用一个正常的“审查 → 重渲染 → 检查”回归验证确保新画面必须重新登记后才能交付；无需重写全部审查体系。

## Optional 1：review 帮助把当前工程实际必需的 observations 标为可选

- `src/schema.mjs:65` 的 required 不含 observations。
- `bin/academic-ppt.mjs:59`、`:60` 根据该 required 输出帮助。
- `src/core.mjs:18` 的新建工程固定为 academic；`:221` 至 `:224` 对这类工程要求 reviewedSlides 与 observations 一一对应。
- `src/tool-contract.mjs:33` 及 `skills/dsh-academic-ppt/SKILL.md:81` 已正确写出逐页要求。

实际只读执行 `node bin/academic-ppt.mjs review --help` 得到：

```text
observations [可选] array<object>；minItems=1；maxItems=120
```

为兼容旧工程，schema 保持可选可以有合理原因；但字段说明和命令帮助应标明“当前学术工程必填，每个 reviewedSlides 需一条”。这不会绕过运行时门槛，却会造成按帮助组装的请求在运行时失败。

## Optional 2：安装后的命令名与帮助示例不同

- `package.json:13`、`:14` 只登记 `dsh-academic-ppt`。
- `bin/academic-ppt.mjs:13` 至 `:15`、`:55`、`:56` 的帮助使用 `academic-ppt`。

按 npm 的 bin 登记，默认安装提供的是前者。直接复制帮助中的后者可能得到“命令不存在”；`node bin/academic-ppt.mjs …` 仍可运行。建议统一名称或明确登记别名。该不一致在旧顶层帮助中也已存在，本次命令专属帮助延续了它。

## 已核查的通用实现与保护措施

### 设计推断与教学示例隔离

- `src/design-system.mjs:63` 至 `:158` 使用原生形状位置、重复页数、颜色、文字角色和字号作推断；sha256 仅写入来源元数据，未参与设计选择。字号适配在 `:143` 至 `:146` 披露边界和原值，返回 `visualReview: 'not-performed'`（`:158`）。
- `src/template-study.mjs:204` 至 `:286` 的角色候选来自 placeholder、几何、实际样式和文字长度。未见根据源题名、研究学科或具体结论词匹配当前材料的特殊分支。
- 对同一结构改任意 sha256 及 shape 的 sourceName，最小内存复核得到完全相同的 suggestedDesign，visualReview 仍为 not-performed；这是狭窄的辅助复核，不能替代上述源码审查。
- `src/reference.mjs:11` 至 `:38` 返回中性槽位和空字段；`:49` 至 `:79` 仅在 includeExamples 显式为 true 时返回示例资源路径。实际查询 `method-agent-loop`：files 不存在，cards 的 title/body 与 nodes.label 均为空，panel 槽未携带教学标题。
- `src/reference-catalog.mjs:8` 的 semanticKind 根据**随包固定参考页的任务标题**给几何槽位选择语义色，不是按当前研究内容分支。48 页库中的教学节点、图和合成数值是公开示例，不能据其存在本身认定作弊。新 composition 不依赖这些模板 ID。
- `src/academic-quality.mjs:14` 至 `:21`、`:59`、`:60` 将长段文字与随包示例比较，目的为拒绝示例复用；未见匹配后注入研究答案的实现。图资产路径保护的缺口已单列为 must-fix 1，不能据文字检测存在就声称来源隔离完备。

### 内容完整性与原生图形

- `src/academic-composition.mjs:398` 至 `:459` 对 cards、figures、plots 及 chart/table/diagram 记录消费、重复分配和未分配错误；一面板多种主载体也报错。`:460` 至 `:470` 先按完整测量分配，超高保留内容并报错，不自动截断或下调字号。
- `src/scientific-plot.mjs:29` 至 `:59` 区分原始观测和显式区间；`:176` 至 `:195` 以所有输入值规划数轴和密度；`:292` 至 `:318` 逐点/逐区间生成原生对象。纵向错位只为防重叠，x 仍按真实数值映射（`:108` 至 `:126`）；过密时报 error。未见自动求显著性、计算固定区间、连接独立观测、删离群点或用预设数值代替来源。
- `src/core.mjs:104` 至 `:110`、`:148` 及 `src/academic-quality.mjs:29` 将新 plots 的 sourceClaimIds 纳入证据链与数值口径门槛，推导前提通过 expandClaimIds 展开。存在引用和 metrics 不代表工具独立证明其科学真实性。
- `src/academic-diagram.mjs:9` 至 `:12`、`:23` 至 `:72`、`:93` 至 `:113` 按作者显式 rows/edges 排布，不根据节点文字创造边。`:192` 至 `:241` 检查完整标签、节点穿越和图区边界。flow/feedback/association 的方向分别通过显式 kind 控制，没有把 association 自动画成因果箭头。
- `src/scene.mjs:105` 至 `:141` 的 wrapText 保留字符；`:156` 至 `:169` 记录字号/全文并报溢出。`:743` 至 `:760` 检查未显示图片、卡片、图表、机制对象、subtitle/takeaway及越界；`:647` 至 `:674` 检查内容区域、文字和证据遮挡。这些是估计检查，不是像素级视觉认证。
- `src/render.mjs:173` 至 `:175` 使用完整分行和 `fit:'none'`，未添加以自动缩字隐藏错误的逻辑。`:24` 至 `:35` 的 OOXML 修正只给原生类别轴明确写 rot=0，保留已有旋转，意图让类别标签不被渲染器自动省略；没有改工作簿数据或审查收据。
- 新 `chart.valueDecimals` 是调用者显式选择的显示精度，SVG 与 PPTX 共享该参数，series 的数值仍直接进入原生图表（`src/render.mjs:12`、`:13`、`:199` 至 `:204`）。技能 `references/composition.md:64` 提醒不得借此隐藏有意义的小量。未发现按预期统计结果自动设置精度。
- `src/montage.mjs:10` 至 `:28` 从真实 PNG 制作编号概览，保留各页 PNG；没有将概览当逐页检查回执。小图只是导航，不足以验收细字。

### CLI、DSH、能力与交付门槛

- `src/index.mjs:42` 与 CLI `bin/academic-ppt.mjs:83`、`:102` 使用同一 `buildAcademicTools()`；`src/tools.mjs:245` 至 `:267` 调用同一 runtime 参数验证和执行器。
- `src/tools.mjs:58` 至 `:87` 对 DSH wire schema 作有限投影，减少宿主输入体积；执行仍使用完整 `toolSchemas`。record 的文件批次与 CLI 内联兼容由同一 core 路径验证。
- `src/core.mjs:18` 默认 imageInput 为 unknown，`:56` 仅接收显式登记；`:218` 拒绝 unknown/unsupported 下的 vision-model 审查。未见 template、build、PNG 生成或 provider 名称自动把能力提升为 supported。
- 能力登记仍是调用者的有据声明，不是宿主模态探测；`src/tool-contract.mjs:34` 至 `:38` 与技能明确区分成功生成 PNG、OCR、模型名称和实际图像输入能力。
- 正常内容修改通过 `src/core.mjs:24` 删除旧 artifact/reviews；build 在 `:178` 阻断 review 模式静态错误，并在 `:188` 清除旧审查。check 的 `:165` 确实要求 academic、零错误、当前产物、review 模式、PPTX 渲染、逐页通过及无缺失字体。
- `src/core.mjs:215` 至 `:229` 的正常审查入口要求当前 hash、合法页号和真实 PPTX 渲染；academic 工程逐页 observations 一一对应，有非空 issue 不能同时 passed。重渲染状态转换缺口已单列为 must-fix 2。

## 边界、未做事项与发布结论的用途

1. 全程未修改 src/bin/skills/package/lock、生产者文件或任何回执；仅写本报告。未打开、搜索或读取 `audit/blind-v05-final/materials` 的文件，不向该材料制作者提供提示。独立协作者只审查 CLI/契约/审查路径，未取得本轮盲测任务或其目录内容。
2. 未把 `docs/VALIDATION.md`、`docs/INDEPENDENT_REVIEW_V05.md` 仍待当前材料轮次完成，以及默认 demo 尚待真正通过后更新，列为本次新缺陷；这些发布步骤由主线程完成。
3. 本次完整读取新的 design/chrome/composition/diagram/scientificplot/montage 模块；核对相关 core、schema、scene、render、template-study、template、reference、academic-quality、tools、tool-contract 代码及 SKILL/references，必要处对照 HEAD。没有完整审计第三方渲染器、Office 实际编辑或所有历史代码路径。
4. 最小独立检查仅包括：教学资产登记前后来源门槛、一个中性 reference 输出、同结构不同来源元数据的设计推断、CLI review 帮助与同源契约核对。未重复全套测试，未开展新一轮宽泛视觉/数据测试；“192 项已通过”不作为本报告无缺陷的依据。
5. 本地 project.json 的 `artifact/visualReviews` 不在内容 schema 内（`src/schema.mjs:48`、`:84`、`:85`）；直接篡改它们不是普通 record/edit 操作。当前工具是非对抗式、有具名声明的审查记录，不能当作抵抗项目所有者篡改的独立视觉认证。`src/core.mjs:166`、`:226` 已明确其自报性质。本报告不把这项已知信任边界夸大为新增的普通接口漏洞。
6. 以上“未发现作弊分支”不意味着执行者不会在 records、讲稿或外部计算中犯科学错误。当前盲测成稿与其最终版本须由主线程按真实材料独立验收；本报告不对未读取的材料或报告作通过判断。

## 审查快照摘要

以下摘要用于识别本报告覆盖的代码，不参与插件逻辑，也不是针对科学材料的特例。若生产源码随后修复，需要按变更复核相应发现。

| 文件 | SHA-256 |
| --- | --- |
| src/design-system.mjs | 52fca323e4297733a5c2ed4b17221c34c99108c92360ba9f31b25063d39d1e5e |
| src/academic-chrome.mjs | 953853c49562c7c518eced82d4b0303660f58d6d1c530e35937d6ddfdbbe9703 |
| src/academic-composition.mjs | 9428252f654a2eedd4717e4b42e2e8da22e53abe654f9144d49f9bd85b61899b |
| src/academic-diagram.mjs | ab9988a75ef7b691a6b99849f39cde5c4c115759e68d721442159ab4ef1ed295 |
| src/scientific-plot.mjs | ea4e0d9def8f629329eaa12e2961e6959fa9ea4993067054f2a58c6c1e841039 |
| src/montage.mjs | 011793ac8bc794f740a6d9024b8e758ed1e4b26c0057797f792438ccdc818a51 |
| src/core.mjs | 92eede53a6d6b94e16626de9762606356fa7817fb75872f5856f1cea915ad0cb |
| src/schema.mjs | 9400c9d18ff8aece170fc7bf9d1d482e8444c55c74c25d8c2f188b98fd757447 |
| src/scene.mjs | 6c5adb23232f26049f55759b1fd74df91780f3f96701783c2c96ca131500a1bc |
| src/render.mjs | 80bea7ee381b753861ed318b2649d190e55ae1c79196b5459f18cf134672ece5 |
| src/tools.mjs | a5d53cf889fd5c47363ceffa582952dece3f9cfa5ecc1a56ba401a81769d573f |
| src/tool-contract.mjs | 073e1947a86c2827f094eee379c4ca25fe58f8f0b1266790506f14d69e5a6eb7 |
| src/io.mjs | c2c3e8c708fe21d821cbad5bacb771f50cfab36050a748944f65670fa9b451f3 |
| src/academic-quality.mjs | 84b348d9d775a2119e48d52cacdaf93944a529dc5701d2778b1962a3c022d10c |
| skills/dsh-academic-ppt/SKILL.md | 6dc9d8a406cb3ec16a3dd25043f1b5c623d32a1973028146b5cd1c53db9d7a9c |
| skills/dsh-academic-ppt/references/composition.md | 08f1eaecb10b686403b6f3df79dbe37dd0e99e9a86e3d20d3be4660713b3b882 |
| bin/academic-ppt.mjs | 3c2fd7cc29c54b83942beb92b61d60c9f7e797d5919ef05c06a99be43d9ef779 |

## 后续窄复核：门槛修复后的独立判断

日期：2026-10-20。范围仅为修复后的 `src/core.mjs`、`src/io.mjs`、`src/schema.mjs`、`src/academic-quality.mjs`、`bin/academic-ppt.mjs`，并读取新增针对性测试和修复记录作为辅助证据。未读取任何当前生产材料目录，也未改动生产代码。

先逐文件对照修复者保存的 `.test-output/v05-gate-fix-baseline/`，独立计算五份修复前文件的摘要，**全部与本报告原始审计快照一致**，因此本节评价的是原发现之后的窄补丁，不是将 v0.4 HEAD 与整轮 v0.5 变更混为一体。

### 关闭状态

| 原发现 | 当前状态 | 独立判断依据 |
| --- | --- | --- |
| must-fix 1：登记时丢失教学路径 | **关闭，限已知来源的正常登记路径** | 输入 path 先规范解析并记录 sourcePath；嵌入后的该字段进入教学来源检查，再次 data-only 嵌入仍保留。 |
| must-fix 2：新渲染沿用旧 PPTX 审查 | **关闭** | 成功新渲染和概览之后，原子保存的新状态移除所有 pptx-render reviews；check 因此必须等待新一轮逐页审查。 |
| optional 1：observations 帮助误标可选 | **关闭** | CLI 实际输出“当前 academic 工程必填”，共享 schema 的 description 同时解释旧工程兼容；没有降低运行时要求。 |
| optional 2：帮助命令名不一致 | **关闭** | 帮助、示例和错误前缀使用 package 已登记的 dsh-academic-ppt，保留 node 文件入口。 |

**本次补丁未发现新增的 blocking 或 must-fix。** 原审计所确认的两个问题仍明确属于基线缺口；本次关闭不改写其历史成因，也不将“已修复门槛”扩大成对盲测成稿的通过结论。

### 1. 教学来源路径修复

`src/io.mjs:139` 在输入含 path 时调用既有 safePath，已解析结果覆盖调用者提交的 sourcePath。`src/io.mjs:146` 将它保留到嵌入资产，随后仍删除用于输入的 path；只有实际读文件时要求原文件存在（`:139`、`:141`）。输入已经只有 data 时直接保留现有 sourcePath，不重新打开历史源文件，因此工程迁移或原文件删除不会仅因这个来源字段破坏已嵌入资产。

`src/schema.mjs:34` 为此增加可选、受长度限制的 sourcePath。`src/academic-quality.mjs:63` 同时检查 path/sourcePath 与显式 template-demo。其显式 provenance 保持原样，不能利用填成 source 覆盖已知教学路径；新增的是原有来源门槛的持久化，不是对当前题材、样本数据或科学答案的特殊识别。

独立重复原始内存复核，结果为：

```json
[
  {"provenance":"omitted","hasTeachingGate":true,"sameSourcePath":true},
  {"provenance":"source","hasTeachingGate":true,"sameSourcePath":true}
]
```

另向输入加入伪装的 `sourcePath:"ordinary/false-origin.png"`，实际保存值仍为真实教学资源的规范路径；再次 embed 后持续产生 template-as-evidence，完整 evidenceIssues 包含该阻断错误。上述操作只在内存执行，没有创建工程、构建成稿或写回资产。

还读取了 `test/gate-state.test.mjs:23` 至 `:95`，确认测试走公开 tool.execute + recordsPath 路径，覆盖省略/显式 provenance、规范路径和符号链接、伪装 sourcePath、data+path、原文件删除、重复登记、同 ID 擦除来源被 IMMUTABLE_ASSET 拒绝，以及 undo。测试不是只重复单行正则断言。普通来源的对照将新增来源元数据以外的嵌入内容、场景与原生 PPTX 内容作比较，符合修复范围。

**继续保留的限制：** 旧嵌入工程已经删除且未保留的原始 path 无法由补丁倒推出；教学字节若在登记前改名/复制并丢弃全部来源，不在这项路径保护的识别保证内。调用者数据来源的真实性仍需人工或执行者核对。当前修复关闭的是已明确复现的“来源本来已知、正常登记却丢失”的缺口。

### 2. 重新渲染的审查状态修复

`src/core.mjs:237` 在实际渲染不成功时原样返回；`:238` 完成概览后，`:239` 构造本地新状态，`:241` 过滤 basis 为 pptx-render 的旧 reviews；`:242` 通过原有 fingerprint 检查和 atomicJson 一次保存新渲染与新审查状态。没有预先修改 state.p，也没有在失败路径保存部分清理状态。HTML reviews 对应未变的 HTML，可继续保留。

结合原有 `checkProject` 的 `src/core.mjs:162` 至 `:165`：新状态没有覆盖全部页的 pptx-render passed，visual 必然为 not-verified，readyForDelivery 不会仅靠旧画面的通过记录变成 true。补丁未更改缺字体判断、视觉能力状态、回执格式、PPTX 内容或质量门槛。

读取 `test/gate-state.test.mjs:97` 至 `:123` 和修复者的针对性 TAP 记录，确认其测试使用真实 renderProjectArtifact 两次转换同一 PPTX，检查新 receipt 路径、相同 PPTX hash、旧 PPTX 审查清除、HTML 审查保留、readyForDelivery=false，另检查无效字体目录和取消不改变已保存工程字节。审查记录被明确标注为合成的状态转换测试，未把它当作对用户报告的真实看图；没有伪造 renderer receipt。

本次独立复核不重复昂贵渲染，关闭判断来自完整事务路径的代码核对；上述测试内容与已记录的实际通过结果是辅助支持。修复者报告的早期 CLI 跳过项在后续允许的 CLI/契约运行中执行并通过，未将跳过本身算作通过。主线程另报 200/200 全测，这个数量仍不替代审查判断。

### 3. CLI 与兼容性复核

独立只读执行 `node bin/academic-ppt.mjs review --help`，实际得到：

```text
dsh-academic-ppt review — academic_ppt_review
observations [当前 academic 工程必填] array<object>；minItems=1；maxItems=120
当前 academic 工程必填：每个 reviewedSlides ID 恰好一条，逐页填写 contentCheck、legibilityCheck 与 issue。仅未启用 academic 质量档案的旧工程兼容省略。
```

`bin/academic-ppt.mjs:9`、`:55` 至 `:67` 的名称与 `package.json` 的 bin 登记一致。`src/schema.mjs:65` 的 observations 仍保留旧 schema 可选性，但其 description 通过同一 DSH 参数投影可见；当前 academic 工程的运行时逐页要求没有变化。没有新增将 unknown 视觉能力自动提升为 supported 的代码。

### 修复后快照与验证范围

| 文件 | 修复后 SHA-256 |
| --- | --- |
| src/core.mjs | 24c1febd07ef7017f2f000a6ba594cd73e4581eb2e32aa4f8235942859c2f1b5 |
| src/io.mjs | 784c3230133ba76217947ee869002f3816cb2b0be60bc08ccd322e8b1ba865dd |
| src/schema.mjs | e52aa9e0f1029f6ebf6766bb381839290ca6d40fe5fdca4d204108b2f6e22954 |
| src/academic-quality.mjs | 20993e89e157be7a1a741bec7a174a482229f492d7fe428b996acc7baf537314 |
| bin/academic-ppt.mjs | 411941860ef96d9a7db4e8d0ed08866d6fa183125004f4f5e441d317ac87ed7f |

原审计列出的另外 12 个文件也重新计算了摘要，均与初次快照一致，包括 design/chrome/composition/diagram/plot/montage、scene/render、tools/tool-contract、SKILL 与 composition 参考。**这只是明确列出的文件范围，不等于声称全部 120 个文件或全部生产产物未变。**

本次只追加本审计报告，未修改任何生产代码、回执或生产者文件，未读取当前盲测生产目录。原报告对统计真实性、来源自报、本地 JSON 信任边界、像素级视觉检查及跨渲染器行为的限定继续有效。最终交付应基于发布候选重新建立的工程及其当前实际渲染、逐页审查，不能继承旧成品的通过叙述。
