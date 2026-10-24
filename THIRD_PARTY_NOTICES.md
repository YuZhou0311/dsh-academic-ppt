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

源码根目录的具体版本与完整传递依赖以 [package-lock.json](package-lock.json) 为准。该根工程通过 overrides 将 PptxGenJS 的传递依赖 image-size 固定为 2.0.4，以使用公开公告列出的修复版本；[公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)。这是源码安装的约束：插件作为依赖被 DSH profile 安装时，其 overrides 不会自动约束宿主的依赖树，不能直接继承本次根工程的审计结果，详见[安装说明](docs/INSTALL.md#5-实际能力边界)。依赖由包管理器安装，保留所安装软件包中的 LICENSE/NOTICE。

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

## 4. v0.7 真实论文重建示例

[research-native-v07](examples/research-native-v07/README.md) 使用三篇正式论文的公开图像、数据表与全文提取文本：

| 作者与论文 | 出版信息与来源 |
| --- | --- |
| Cheng, Enhui, et al. *Wheat yield estimation using remote sensing data based on machine learning approaches* | Frontiers in Plant Science 13:1090970，2022；[10.3389/fpls.2022.1090970](https://doi.org/10.3389/fpls.2022.1090970) |
| Zhuo, Wen, et al. *Assimilating Soil Moisture Retrieved from Sentinel-1 and Sentinel-2 Data into WOFOST Model to Improve Winter Wheat Yield Estimation* | Remote Sensing 11(13):1618，2019；[10.3390/rs11131618](https://doi.org/10.3390/rs11131618) |
| Shahhosseini, Mohsen; Hu, Guiping; Huber, Isaiah; Archontoulis, Sotirios V. *Coupling machine learning and crop modeling improves crop yield prediction in the US Corn Belt* | Scientific Reports 11:1606，2021；[10.1038/s41598-020-80820-1](https://doi.org/10.1038/s41598-020-80820-1) |

三篇采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。所用主图图注和版权声明未见具体第三方排除条款，原图内已有地理底图等署名继续保留。完整作者、出版方 PDF 链接、版本与许可原文见 [来源记录](examples/research-native-v07/sources/README.md)。本包提供实际使用的 7 份完整源图像与带页码的提取文本；PDF 原件提供来源链接和 SHA-256，不重复分发。

修改限于页面显示视窗、原生中文说明、经核验的数表与外置坐标标签；没有生成或改写原始散点、柱高、拟合线。每次使用的图号、页码、许可和裁切说明见 [A manifest](examples/research-native-v07/a/manifest.json)、[B manifest](examples/research-native-v07/b/manifest.json)。论文图和文本不适用本插件 MIT 许可；再分发时应继续保留作者、来源、CC BY 4.0 链接及修改说明。

## 5. 模板与字体

历史版本曾实际读取并渲染用户提供的两份学术 PPTX，共 39 页，依据其标题、图文分区和小题签结构改良版式。原文件在本轮重建时已丢失，v0.7 不声称重新观察过这些页面。保留的 48 页参考包、六组件示范页与教学图资产由本项目提供；源 PPTX、人物照片、机构标识和其原有研究图片不随包重新分发。历史观察见 [原模板研究](docs/USER_TEMPLATE_STUDY.md)。实际用户工程可以在本地继续使用其授权模板，按组件支持范围处理。

默认字体名为 `Noto Sans CJK SC`。字体不随插件源码分发；使用者可以安装 [Noto CJK 官方字体](https://github.com/notofonts/noto-cjk) 或指定已有合法字体。示例渲染测试使用官方 Noto Sans CJK SC Regular / Bold，遵循其 SIL Open Font License。字体文件未被改写或重命名为其他字体。

## 6. 方法论来源

学术工作流源自同一用户此前的汇报制作和返工反馈，并以本次工程化设计继续完善。DeepSeek、DSH 协议与模型能力说明的官方出处、核对日期及适用边界列于 [docs/DESIGN.md](docs/DESIGN.md)。
