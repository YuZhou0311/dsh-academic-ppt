# 作者 A：信息进入位置与外推边界

**最终 r15，16 页，840 秒讲稿预算。** [PPTX](report.pptx) · [PDF](report.pdf) · [讲稿](speaker-notes.md) · [全页概览](overview.png) · [可重建记录](deck.json) · [摘要与来源清单](manifest.json)

本稿从直接学习、状态同化、机理特征三种进入方式展开，用真实地图、散点、水分轨迹、完整误差表和原生配对图解释各自证据。蓝色表示观测、绿色表示状态及机理信息、赭色表示边界；局部分组随研究关系变化。

![最终封面](previews/page-0001.png)

## 关键页

| 页面 | 内容与选择 |
| --- | --- |
| [第 7 页](previews/page-0007.png) | 观测与预报进入 EnKF，分析 SM 返回 WOFOST，产量另由 WOFOST 输出；端口方向经过修正。 |
| [第 11 页](previews/page-0011.png) | 11 模型、两年份的配对 RMSE；同尺度显示改善幅度，并保留 914→916 的例外。 |
| [第 12 页](previews/page-0012.png) | 11 行完整干旱年表，同时显示 RMSE 降幅和所有混合模型负 R²。 |
| [第 15 页](previews/page-0015.png) | 尚未实施的四组对照，固定信息截止日，区分有利、不利和无效判定。 |

[四张实际候选](candidates/study-v3/overview.png) 与 [取舍记录](review/design-decisions.json) 保留封面和困难证据页的不同方案。选择完整 11 模型表，理由是保留全部反向结果；未选的四模型图未充当正式通过页。

## 审阅与可编辑范围

作者实际打开最终版本全部 16 张 PNG，并登记 [逐页审阅](review/visual-review.json)。[渲染回执](review/render-receipt.json) 绑定当前 PPTX 哈希；[科学复核](../review/author-a-review.md) 明确区分初稿全页审阅与修订定点复查。

PPTX 有 473 个原生形状、7 个图片对象和 16 页备注。表格与数据图由可编辑文字、线条和标记组成，不是 Office table/chart 对象；论文图保持位图。[对象核对](review/native-object-audit.json)

最终 0 错误／7 提醒：5 项涉及原图细字，另有自绘表格载体未识别、完整书目下留白。主要数值、条件与单位使用 24–28 CSS px 原生文字；部分源图内部细字约 12.07–16.91 CSS px，精细读图仍需放大电子版。未验证会场后排阅读、PowerPoint/WPS 或真人计时。

```sh
node scripts/build-research-demo.mjs --author a --output ./research-demo-a
```

请从仓库根目录运行，目标目录必须尚不存在；离线重放不继承本次视觉通过。[共同来源与许可](../sources/README.md) · [完整验证说明](../../../docs/VALIDATION_V07.md)
