# 真实论文示例：来源与资产

本目录提供一篇真实论文的 9 页、约 7 分钟深读示例，用于检验插件如何组织学术证据和生成可编辑 PPTX。它不代替先前约定的 5 篇论文综述。示例没有设置影响因子筛选门槛，也没有编造 JCR 数值。

## 论文

Chen F., Stogiannidis I., Wood A., et al. **A conversational multi-agent AI system for automated plant phenotyping**. *Nature Communications* **17**, 6391 (2026). DOI: [10.1038/s41467-026-71090-y](https://doi.org/10.1038/s41467-026-71090-y).

官方全文：<https://www.nature.com/articles/s41467-026-71090-y>。本示例依据 Version of Record，版本记录 updated 2026-07-16；制作时在 2026-10-20 核对官方全文中的 Design、Case studies、Evaluation、Discussion 与 Methods。

## 原图

`assets/pheno-figure3.png`：**Fig. 3: Case study 1—A. thaliana growth pattern analysis.**

- 原图页面：<https://www.nature.com/articles/s41467-026-71090-y/figures/3>
- 来源作者：Chen F., Stogiannidis I., Wood A., et al. (2026)
- 授权：[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- 整幅图片完整保留，未裁切、未修改；PPT 仅等比缩放。图像内原有图例、颜色和文字全部保留。
- 版面为横向学术汇报，竖向多任务原图用于定位流程；口头解读放在旁边的原生文字中。逐字阅读原图时，请打开本目录中的原始 PNG 或官方图页。

图注解读：

图中依次展示图像表型提取、统计绘图、图表解读、生态型统计检验和文献对照五类任务。灰色区表示用户任务，蓝色区表示系统调用的工具，白色区呈现输出。原文说明，任务 2 的放大图在补充图 2–5。完整英文原图注请见[官方 Figure 3 页面](https://www.nature.com/articles/s41467-026-71090-y/figures/3)。

示例不使用可能涉及第三方图标的 Figure 1。没有下载或重新打包原论文 PDF；请从官方全文页面获取授权版本。

## 自制原生参考模板

`native-card-reference.pptx` 为本插件专门创作，包含「证据纸页」与「边界便笺」两种原生卡片；与插件代码同属 MIT 许可。可通过 `create-native-reference.mjs` 重建到新的文件路径。

当前工程没有用户此前两份模板的原文件。这里不声称恢复、读取或复用了那两份模板。真实模板复用的演示方式是：模板工具读取上述自制 PPTX → 保存来源与组件几何 → record 导入 profile → 在 S02 卡片上消费两个实际的原生组件。旧模板文字只用于定位可替换的文字区，不被复制到报告中。

## 科学标识与可编辑性

`science-demo.mjs` 保留论文、证据、统计分母、定位章节、使用范围和逐页讲稿。C1–C4 为原文报告，C5 为适用范围判断，C6 为原文局限，H1–H2 为明确标注的待验证研究提议。H1–H2 的 `verified:true` 表示来源定位和提议标识已核对，**不表示假说已经实验证实**。

S05 图表是对 17 项正确与 3 项失败的原生数据图重绘；分母为 20 项数据分析任务。S03/S08 为可编辑原理或研究设计流程图。原图作为独立图片对象，正文、标题、卡片、流程线与图表保持原生可编辑。

字体采用 Noto Sans CJK SC；字体文件不随插件分发。没有执行实际 PPTX 渲染和逐页视觉审查的重新生成版本，不会自动标记为视觉通过。
