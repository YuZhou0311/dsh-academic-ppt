# 六种学术阅读方式，同一份证据

这是一组通过本插件 `renderProject` 制作的原创、可编辑样张。六个方向各有两页：结果页，以及方法或边界页。所有方向使用同一套教学构造数据，并保留相同的比较对象、单位、样本数、区间与外推限制。它们不是封面换色，也不代表 DSH Agent 已经能够稳定生成同等质量的整套报告。

先打开 [总览](index.html) 或 [实际 PPTX 渲染全稿](montage.png)，再按当前报告的阅读任务选择方向。

| 方向 | 结果页的阅读路径 | 方法与边界页的组织 |
| --- | --- | --- |
| [研究研讨](research-seminar/research-seminar.pptx) | 大幅区间图为主，解释就近放置 | 原生三线表与计算步骤并列 |
| [正式答辩](thesis-defense/thesis-defense.pptx) | 明确验证问题，整幅图后给出两项判断 | 站点表、评委可追问的条件与外推范围 |
| [理论与方法](methods-whiteboard/methods-whiteboard.pptx) | 先定义比较量及正负意义，再读估计 | 公式推导在前，站点差值表用于复核 |
| [论文精读](paper-club/paper-club.pptx) | 以图 T1 为阅读中心，页边做批注和质疑 | 将原始记录、讲者判断和证据边界分开 |
| [证据综合](evidence-synthesis/evidence-synthesis.pptx) | 原生矩阵同时展示基线、方法、差值和区间 | 先核对可比性，再给出保留协议条件的综合结论 |
| [田间观测](field-report/field-report.pptx) | 四个站点逐一展示，保留异质性 | 用四行、每行六个点说明嵌套，再检查站点表 |

样张展示的是六种论证组织方式。不要将每一页原封不动套到其他学科，也不要为了凑够风格数量在同一报告中轮换六种样式。真实项目仍需根据研究问题、证据类型、听众与汇报时长重新编排。

## 数据身份与可重算内容

[teaching-data.json](teaching-data.json) 包含全部构造观测、构造方式、站点聚合结果与区间公式。没有训练模型，没有开展真实田间试验，也没有借用论文的研究结果。

- 共 4 个假想站点，每站 6 个观测；同一组 24 个假想样本在两种协议下各有一组误差值，因此有 48 条记录，不能算作 48 个独立样本。
- 每个站点先分别求方法与基线的 MAE，再计算 `d(s) = 方法 MAE − 基线 MAE`；单位为 `t/ha`。负值表示方法误差更低。
- 四个站点差值等权平均。95% t 区间为 `均值 ± 3.182446305284263 × 样本标准差 / √4`，自由度为 3。
- 随机划分的均值为 `−0.300 t/ha`，区间约为 `[−0.365, −0.235]`；整站留出的均值为 `+0.050 t/ha`，区间约为 `[−0.109, +0.209]`。
- 区间只是演示常规计算。站点独立性和差值分布是计算假设，四个构造站点无法验证它们。这里不能得出真实跨站点泛化结论。

蓝色始终表示随机划分，赭色始终表示整站留出；换风格不会改变数据色义、零线、点估计、区间或结论强度。

## 文件与可编辑性

每个方向的目录包含 `deck.json` 输入记录、两页 PPTX、HTML/SVG 预览，以及 `render/` 下的实际 PPTX PNG、PDF、清单和收据。根目录的 [catalog.json](catalog.json) 使用相对路径记录文件与 SHA-256；总览显示的是实际 PPTX 渲染 PNG，不是浏览器截图。

结果图中的点、线、坐标轴、文字和公式是可编辑的 PowerPoint 原生形状与文本。表格是原生 PowerPoint 表格。它们没有被合成成整页位图。区间图没有声称具有 Excel 数据工作簿式的原生图表绑定；数值修改应通过输入与脚本重建，或同步调整原生对象。该批文件的 OOXML 检查结果见 [native-editability.json](native-editability.json)：共 281 个形状、7 个原生表格、0 个图片对象。

## 重建

在仓库根目录安装依赖后运行：

```bash
npm ci
node scripts/build-academic-styles.mjs --output ./academic-styles-new --render --font-dir /path/to/noto-fonts
```

输出目录必须不存在；脚本不会覆盖旧样张。省略 `--render` 时只生成 PPTX、HTML/SVG 与数据，页面会明确标注尚非实际 PPTX 渲染，也不会生成渲染通过或视觉通过结论。脚本不请求模型，也不会下载字体或其他外部素材。

本批渲染使用 `@deepseek-ai/libreoffice-kit` 0.1.5 的 WASM 后端，PNG 为 1601 × 901。`Noto Sans CJK SC` 和 `Noto Serif CJK SC` 的 **Regular 与 Bold 四个字体文件均需提供**；本批通过 `--font-dir` 传给渲染器，不依赖生成机器的绝对路径。仅提供 Regular 不能保证粗体字形正确。字体二进制未收入仓库；可从字体维护者的原始仓库获取：

- [Noto Sans CJK SC Regular](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf)
- [Noto Sans CJK SC Bold](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf)
- [Noto Serif CJK SC Regular](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf)
- [Noto Serif CJK SC Bold](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Bold.otf)
- [Noto CJK 上游仓库](https://github.com/notofonts/noto-cjk)

如果运行环境没有默认临时目录，可先创建一个本地可写目录，并将 `TMPDIR` 指向它再运行命令。这是渲染环境设置，不属于 PPTX 内容。渲染清单可能保留本次生成时的临时输入路径作为历史记录；重建只需本仓库、依赖、输入和字体。

## 本批质量记录及其边界

[build-quality.json](build-quality.json) 保留自动检查的结果：六套样张均为 0 scene errors、0 scene warnings，但 `visualReview` 始终是 `not-reviewed`，因为构建脚本本身不会看图。

[render-review.json](render-review.json) 单独记录助手使用视觉模型查看实际 PPTX 渲染图后的观察，并绑定到当前 PPTX/PNG 的哈希。12 页均在修订过程中逐页查看；最终补齐字体后，变化的 8 页全部重新打开检查，其余 4 页与已查看版本的 PNG SHA-256 完全一致。还检查了最终全稿概览。记录的 reviewer 是 `vision-model`，并非人工评审或用户认可。

实际看图后修正了 Unicode 下标字形缺失、答辩页侧栏过密，以及两处短尾行问题。独立复看又发现了粗宋体字形不符合预期：初次环境只有 Serif Regular。用同一 PPTX 补充官方 Serif Bold 后重渲染，方法页仅标题区域的像素变化；PDF 字体记录从 `NotoSerifCJKsc-Regular` 变为 `NotoSerifCJKsc-Bold`，字号和位置不变。随后对六套现有 PPTX 全部重新渲染，未改动 PPTX 或科学内容。逐页像素差、PDF 字体证据和所用字体的上游 URL / SHA-256 见 [font-weight-audit.json](font-weight-audit.json)。

这说明 `missingFonts=[]` 不能证明字重和字形覆盖正确；文本框未越界和程序运行成功也不能代替看图。当前版本未发现可见裁切、重叠或缺字，但仍有这些限制：没有在原生 PowerPoint 或 WPS 应用中逐页验证；没有运行 DSH Agent 的端到端生成实验；这组受控样张不能证明对任意论文和风格都稳定。重新生成后需要重新检查，不能沿用这份视觉记录。
