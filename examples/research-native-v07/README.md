# v0.7：三篇真实论文，两份完整学术报告

两位新上下文作者收到相同的研究问题和三篇正式论文，分别完成 **16 页和 15 页**报告，均为 **840 秒讲稿预算**。初稿作者没有读取另一稿；随后科学复核和跨稿比较触发了返工。这里提供最终 PPTX、实际渲染 PDF、全部 31 页 PNG、讲稿、可重建记录和审阅材料。

| 稿件 | 完整文件 | 实际页面 | 记录 |
| --- | --- | --- | --- |
| A：按信息进入位置组织证据与外推边界，16 页 | [PPTX](a/report.pptx) · [PDF](a/report.pdf) · [讲稿](a/speaker-notes.md) | [全稿概览](a/overview.png) · [逐页 PNG](a/previews/) | [说明](a/README.md) · [源记录](a/deck.json) · [文件摘要](a/manifest.json) |
| B：按观测接口解释可纠正的误差，15 页 | [PPTX](b/report.pptx) · [PDF](b/report.pdf) · [讲稿](b/speaker-notes.md) | [全稿概览](b/overview.png) · [逐页 PNG](b/previews/) | [说明](b/README.md) · [源记录](b/deck.json) · [文件摘要](b/manifest.json) |

## 实际效果

两稿最初都选择了左侧题名、右侧地图。跨稿检查和实际并列审阅发现这一重复后，B 另做封面候选，改为上方真实水分轨迹、下方题名。**终稿有评审介入，不能称为零干预独立成功。**

| A：研究区与题名并置 | B：过程轨迹引出研究问题 |
| --- | --- |
| ![A 最终封面](a/previews/page-0001.png) | ![B 最终封面](b/previews/page-0001.png) |

主证据页保留完整比较。A 的极旱年页列出全部 11 个模型，误差下降和负 R² 同时可查；B 的同化页放大原始散点绘图区，并按原图轴中心位置配置原生坐标标签。

![A：全部 11 个模型的干旱年结果](a/previews/page-0012.png)

![B：保留原始点位的同化前后比较](b/previews/page-0008.png)

## 候选、构图与可编辑范围

A 实际完成两种封面和两种困难证据构图，迭代后四张候选保存在 [候选概览](a/candidates/study-v3/overview.png)；B 第一轮四张候选与第二轮两张封面对照分别保存在 [第一轮](b/candidates/study-01/overview.png) 和 [封面返工](b/candidates/study-02/overview.png)。本包有 10 张候选页 PNG，其中 B 第二轮包含旧封面。未选候选中的问题也在 [A 取舍](a/review/design-decisions.json) 和 [B 取舍](b/review/design-decisions.json) 中保留。

两稿通过插件公开 API 使用自由区域和原生 drawing，没有使用固定模板编号。A 有 **473 个原生形状、7 个图片对象、16 页备注**；B 有 **357 个原生形状、8 个图片对象、15 页备注**。本例的表格、数据标记、关系线和文字由可编辑形状组成，并非 Office 的原生 table/chart 对象。论文图内部点位与文字仍为位图。具体结构见 [A 对象核对](a/review/native-object-audit.json)、[B 对象核对](b/review/native-object-audit.json)。

## 复核结果与边界

两位作者分别打开当前最终版本的全部 16 张和 15 张 PNG，登记了对应 PPTX 哈希的逐页观察：[A](a/review/visual-review.json)、[B](b/review/visual-review.json)。科学审稿者查看初稿全部 31 页，并定点检查修订稿；最终记录中 **249 个结果数值与原始图表一致，5 项必须修正均已关闭**。实际范围与定位见 [科学复核](review/scientific-review.json)、[数字核对](review/numeric-audit.json)、[图件核对](review/crop-audit.json)、[A 科学说明](review/author-a-review.md)、[B 科学说明](review/author-b-review.md)。

修正包括产量由 WOFOST 输出的关系、EnKF 公式缺字、无依据的“随机分半”、RMSE 单位、来源页码和零刻度裁切。不同研究单位及数据划分、完整测试年天气、没有遥感输入的第三篇研究、2017 年 LightGBM 例外、2012 年全部混合模型负 R² 均保留。没有将跨论文 RMSE 排成总榜，也没有将待验证方案写成已做实验。

最终静态检查为 A **0 错误／7 提醒**、B **0 错误／6 提醒**。提醒包含原图细字估计、自绘表格未被自动识别和局部留白；对应实际画面已审阅，不以装饰填充消除提醒。原生正文、标签、注释的目标分别为 **28／24／18 CSS px**，换算为 **21／18／13.5 pt**。部分原图的次级标签和刻度仍低于目标，关键数值、单位与条件另用原生文字呈现，不能声称所有源图细字都适合会场后排阅读。

[初稿跨稿报告](review/portfolio-initial.json) 提示封面主要构图相似；[终稿报告](review/portfolio-final.json) 未再触发高相似提示。该工具比较作者记录中的结构，不衡量像素、审美、模型独立性或原创性分数。

## 离线重建

在仓库根目录完成依赖安装后，分别使用全新的输出目录：

```sh
node scripts/build-research-demo.mjs --author a --output ./research-demo-a
node scripts/build-research-demo.mjs --author b --output ./research-demo-b
```

需要实际 PDF/PNG 渲染时加 `--render --font-dir ./fonts`，字体目录应在工作区内，并包含有许可的中文字体。示例使用 Noto Sans CJK SC Regular／Bold，字体二进制不随包分发。

重建入口校验支持文件 SHA-256，通过公开 records/build API 导入作者记录，输出新工程。**这是离线记录重放，不是一次新的模型制作或全文阅读**，不请求网络或模型，也不继承原稿的视觉审阅。两稿已实际重建成功，分别为 0 错误／7 提醒和 0 错误／6 提醒；每稿检查的 24 个 slide XML 与 media 部件全部逐字节一致，完整 PPTX ZIP 因新构建元数据拥有不同哈希。未渲染、未重新审阅的重放工程保持 `readyForDelivery: false`。[重建核验](review/replay-verification.json)

未使用用户 DeepSeek 收费账户，未执行真实 DSH Desktop/Web GUI、PowerPoint/WPS GUI 或现场投影验收。840 秒只是讲稿预算。原用户参考 PPT 已丢失，本轮未重新观察；两位作者使用同一宿主模型，不是多模型盲测。源码回归和完整验证边界见 [本轮验证](../../docs/VALIDATION_V07.md)。

## 来源与许可

三篇论文、图件和提取文本按各自 **CC BY 4.0** 声明保留署名、出处与修改说明；来源位图不适用插件代码的 MIT 许可。完整书目、出版方链接、PDF 哈希、原图与裁切说明见 [来源说明](sources/README.md)、[来源笔记](sources/scientific-source-notes.md) 和两稿 manifest。原始 PDF 提供下载链接及摘要，本包只分发所用图像和带页码的提取文本。
