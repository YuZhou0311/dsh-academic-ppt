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

源码根目录的具体版本与完整传递依赖以 [v0.1.0 的 package-lock.json](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.1.0/package-lock.json) 为准。该根工程通过 overrides 将 PptxGenJS 的传递依赖 image-size 固定为 2.0.4，以使用公开公告列出的修复版本；[公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)。这是源码安装的约束：插件作为依赖被 DSH profile 安装时，其 overrides 不会自动约束宿主的依赖树，不能直接继承本次根工程的审计结果，详见[安装说明](docs/INSTALL.md#5-实际能力边界)。依赖由包管理器安装，保留所安装软件包中的 LICENSE/NOTICE。

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

示例使用 Chen F., Stogiannidis I., Wood A., et al., *A conversational multi-agent AI system for automated plant phenotyping*, Nature Communications 17, 6391 (2026), DOI [10.1038/s41467-026-71090-y](https://doi.org/10.1038/s41467-026-71090-y)。以 2026-10-20 访问的正式网页版本为阅读依据；最终书目和图号以示例的证据/资产清单为准。

论文页面声明 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，原图按文章许可与其中的具体第三方署名条件使用。示例只使用 Fig. 3，注明作者、出处、图号和许可；保留原图比例，不改写图中数据。示例的原生解释层是汇报者整理，研究方案明确标注为待验证。它是单篇论文的软件功能与版式示例，不是此前五篇综述的重新交付。

论文原图不是插件 MIT 代码的一部分。再次分发或改用其他论文图时，仍须检查实际图注中的单独署名和使用范围。文章中的其他素材不因链接存在而自动包含在示例包中。

## 4. 模板与字体

示例中的原生组件模板由本项目制作，用于展示从 PPTX 实际提取和复用组件。它不冒充用户此前提供的两份模板；那两份原文件不包含在本版本中。实际任务应重新提供本次要使用的模板，并按组件支持范围处理。

默认字体名为 `Noto Sans CJK SC`。字体不随插件源码分发；使用者可以安装 [Noto CJK 官方字体](https://github.com/notofonts/noto-cjk) 或指定已有合法字体。示例渲染测试使用官方 Noto Sans CJK SC Regular / Bold，遵循其 SIL Open Font License。字体文件未被改写或重命名为其他字体。

## 5. 方法论来源

学术工作流源自同一用户此前的汇报制作和返工反馈，并以本次工程化设计继续完善。DeepSeek、DSH 协议与模型能力说明的官方出处、核对日期及适用边界列于 [docs/DESIGN.md](docs/DESIGN.md)。
