# 第三方代码、资料与素材

本插件自己的代码与文档采用根目录 [MIT License](LICENSE)。以下材料保留各自许可；插件代码的 MIT 许可不改变论文图、字体或第三方引擎的使用条件。

## 1. dsh-ppt

- 项目：[STARDUSTLC666/dsh-ppt](https://github.com/STARDUSTLC666/dsh-ppt)。
- 参考版本：0.12.1；固定提交：`a3f0f614381ce352cf465f3248cb168d131f26e9`。
- 版权：Copyright (c) 2026 stardustlc；MIT。
- 保留的代码：[src/vendor/dsh-ppt-render.mjs](src/vendor/dsh-ppt-render.mjs)，来自上游 `skills/dsh-ppt/scripts/deck-render.mjs`；上游许可完整保存在 [src/vendor/LICENSE-dsh-ppt](src/vendor/LICENSE-dsh-ppt)。
- 本项目对该文件的改动：在文件头标注适配，并把经过工作区路径校验的可选 `fontDirectories` 转发给 converter。保留原有实际 PPTX 渲染、文件哈希与渲染记录机制。
- 新的学术数据模型、页面/卡片渲染、受控模板提取、证据检查、局部修改和工作流均位于本插件自己的模块。参考上游的 DSH 注册模式不代表已向上游合并或由其维护者背书。

## 2. 运行时依赖

源码根目录的具体版本与完整传递依赖以 [package-lock.json](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.8.2/package-lock.json) 为准。安装包不附带根锁文件，源码归档包含该文件。该根工程通过 overrides 将 PptxGenJS 的传递依赖 image-size 固定为 2.0.4，以使用公开公告列出的修复版本；[公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)。这是源码安装的约束：插件作为依赖被 DSH profile 安装时，其 overrides 不会自动约束宿主的依赖树，不能直接继承根工程的审计结果。依赖由包管理器安装，保留所安装软件包中的 LICENSE/NOTICE。

| 依赖 | 固定版本 | 许可 / 来源 |
| --- | --- | --- |
| Ajv | 8.20.0 | MIT；[官方仓库](https://github.com/ajv-validator/ajv) |
| fast-xml-parser | 5.11.2 | MIT；[官方仓库](https://github.com/NaturalIntelligence/fast-xml-parser) |
| fflate | 0.8.3 | MIT；[官方仓库](https://github.com/101arrowz/fflate) |
| PptxGenJS | 4.0.1 | MIT；[官方仓库](https://github.com/gitbrent/PptxGenJS) |
| pngjs | 7.0.0 | MIT；[官方仓库](https://github.com/pngjs/pngjs) |
| jpeg-js | 0.4.4 | 软件包标记 BSD-3-Clause；解码器另保留 Apache-2.0 来源声明；[官方仓库及完整说明](https://github.com/jpeg-js/jpeg-js#license) |
| @deepseek-ai/libreoffice-kit（可选） | 0.1.5 | MPL-2.0；[官方仓库](https://github.com/deepseek-ai/dsh-libreoffice-kit) |

可选 Kit 的平台引擎和 WASM 载荷自带源码、许可与完整性资料；本插件不将这些引擎二进制重新打包进自己的源代码目录。采用 Kit 不意味着本插件由 DeepSeek 官方开发或认证。

## 3. 真实论文示例

示例使用 Chen F., Stogiannidis I., Wood A., et al., *A conversational multi-agent AI system for automated plant phenotyping*, Nature Communications 17, 6391 (2026), DOI [10.1038/s41467-026-71090-y](https://doi.org/10.1038/s41467-026-71090-y)。[出版方书目记录](https://www.nature.com/articles/s41467-026-71090-y#article-info) 的首次发表日期为 **2026-04-03**，另列 Version of record 日期 **2026-07-16**；后者不作为首发表日期。本示例以 2026-10-20 核对的正式全文为阅读依据；完整源文件、四个实际资产 ID、页面、显示视窗与 SHA-256 见 [examples/ASSETS.md](examples/ASSETS.md)。

### 论文出版图：CC BY 4.0

`examples/assets/pheno-figure3.png`（1449 × 2499 px）与 `pheno-figure4.png`（1615 × 2496 px）为论文 Fig. 3 / Fig. 4 的完整图像，作者署名为 Chen et al., 2026。按文章的 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 声明及具体材料的 credit line 使用；示例保留作者、出处、图号、许可和原生视窗裁切说明。原图媒体完整保留，未改写图中数据。论文 Figure 1 含第三方 Flaticon 图标署名，本示例不复制该图，系统关系另用原生对象重绘。

论文出版图不是本插件 MIT 代码的一部分。再次分发或改用其他论文素材时，仍需检查该材料的具体署名与许可范围；文章中的其他素材不因链接存在而自动包含在示例包中。

### 作者独立 PLA 输出：作者仓库 MIT

S04 使用的 `examples/assets/author-pla_plot.png` 为作者在官方 [vios-s/PhenoAssistant](https://github.com/vios-s/PhenoAssistant/) 仓库中发布的 Case 1 独立绘图输出，1000 × 600 px。其身份为“作者 Case 1 原始输出；对应正文 Fig. 3”，与上述两张出版方合成图分别登记许可。

- 固定提交：`aff85512073d9629dfcd501474641eb1919fbe87`。
- 原文件：[results/Case1/pla_plot.png](https://raw.githubusercontent.com/vios-s/PhenoAssistant/aff85512073d9629dfcd501474641eb1919fbe87/results/Case1/pla_plot.png)。
- SHA-256：`1da6df2d4508687d7dc4806aeb5e729780f240efd24a2eeea3ae149cca1cfa77`。
- 作者仓库许可：MIT；Copyright (c) 2025 Feng Chen。许可全文原样保存在 [examples/assets/LICENSE-PhenoAssistant.txt](examples/assets/LICENSE-PhenoAssistant.txt)，与[该固定版本 LICENSE](https://github.com/vios-s/PhenoAssistant/blob/aff85512073d9629dfcd501474641eb1919fbe87/LICENSE) 一致。

论文 Code availability 与仓库 README 支持该仓库及输出的官方来源。已检查该版本根目录许可与文件树，未见 `results/Case1` 的另置许可或该图的单独排除声明；本记录针对这项作者发布的输出，不声称仓库中的所有外部素材均被 MIT 覆盖。

示例只裁去该图外围空白，完整源文件、曲线、标准差带、标题、坐标和图例仍保留，未重算或重画曲线。原生 `displayLegend` 以 22 px 可编辑文字和对应原图色线辅助转录生态型身份，备注注明“据原图转录”。图本身纵轴未印 cm²，讲稿中的平方厘米依据对应 Fig. 3 的 CSV 表头；本页讨论定性趋势，不声称由曲线像素得到精确读数。没有把作者 PNG 标成已取得的补充 PDF，也没有使用生成模型编辑科学图像。

示例的原生解释层由汇报者整理，研究方案标注为待验证。它是单篇论文的软件功能与版式示例，不是此前五篇综述的重新交付，也不是对 DeepSeek 或本插件的科学效果评价。

## 4. 模板与字体

### 0.8.2 前向验收公开页面

`docs/showcase/v082-report-cover.png` 为本项目验收稿的原创题名页。`docs/showcase/v082-image-card.png` 为同一验收稿的第 6 页实际渲染，包含以下第三方论文材料：

- Haizhu Pan, Zhongxin Chen, Allard de Wit, Jianqiang Ren (2019). *Joint Assimilation of Leaf Area Index and Soil Moisture from Sentinel-1 and Sentinel-2 Data into the WOFOST Model for Winter Wheat Yield Estimation*. **Sensors 19(14), 3161**. DOI [10.3390/s19143161](https://doi.org/10.3390/s19143161)。[出版方原文与许可](https://www.mdpi.com/1424-8220/19/14/3161)。
- 使用 Fig. 5b 与 Fig. 5f，两者均为“仅同化 LAI”方案下的状态轨迹。论文许可为 [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)。
- 改动：从完整 Fig. 5 中分别摘取 b/f 面板，保留各自坐标、单位、日期轴与数据曲线；等比缩放放入共同证据卡，依据原图转录共同图例，添加中文解释、图号、来源与适用条件。没有改写实验曲线或把两幅面板标成联合同化结果。
- 原生卡片、题名及解释是本项目为报告设计的新增内容；论文图仍保留上述许可，不属于插件 MIT 代码。引用与重新排版不表示原作者认可本插件或验收结论。

验收使用的其他全文、完整汇报文件和用户上传素材不包含在这两张公开展示图中，也未作为本次新增公开素材打包。

插件内置的 48 页版式参考包、48 款原生卡片预览和 12 页图卡参考 PPTX 由本项目提供。图卡预览中的图片来自 [原创结构示意生成器](scripts/card-demo-assets.mjs)，用于展示图文关系，不含实验观测、真实数据或论文结论；这些示意与本项目代码采用 MIT 许可。

用户提供的模板及其中的人物照片、机构标识和研究图片不随插件重新分发。用户工程可在授权范围内使用其模板；模板参考功能不改变源文件和媒体的许可。

默认字体名为 `Noto Sans CJK SC`。字体不随插件源码分发；使用者可以安装 [Noto CJK 官方字体](https://github.com/notofonts/noto-cjk) 或指定已有合法字体。示例渲染测试使用官方 Noto Sans CJK SC Regular / Bold，遵循其 SIL Open Font License。字体文件未被改写或重命名为其他字体。

## 5. 方法论来源

学术工作流结合研究汇报的来源追溯、图像阅读、叙事组织与实际渲染复核需求设计。文字与参考学习指导还阅读了以下原始资料，采用其一般方法，没有复制第三方模板、脚本或示例素材：

- [Harvard Catalyst：科学汇报幻灯片](https://catalyst.harvard.edu/writing-communication-center/visualize-science/slides/)：视觉证据、标签与面向听众的表达。
- [Microsoft：创建和展示有效演示文稿](https://support.microsoft.com/en-us/powerpoint/tips-for-creating-and-delivering-an-effective-presentation)：观看距离、字体、精简文字与最终环境复核。
- [Anthropic 官方 PPTX skill](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md)：整稿观察、按内容安排版式与检查实际输出。该项目有其自身许可，本插件没有重新分发其脚本或资产。

DSH 公开协议与安装机制的固定来源见 [兼容说明](docs/DSH_COMPATIBILITY.md) 和 [安装说明](docs/INSTALL.md)。

## 6. v0.8.3 编辑式局部卡片

`skills/dsh-academic-ppt/references/editorial-v083/` 内的20款卡片由本项目根据生图概念探索重新使用 PowerPoint 原生文字、图形和独立的合成图位制作，均是**设计示意而不是研究材料**。图册未使用用户上传的论文图片、商业PPT模板或真实遥感观测数据；任何曲线、地图、遥感纹理均为本项目确定性生成的合成占位图。设计参考图不构成科学出处，使用者应自行取得并核验论文原图、图例和许可。原有第三方科研示例授权范围不因此改变。
