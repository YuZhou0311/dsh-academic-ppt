# 作者 B：观测接口与可纠正的误差

**最终 r15，15 页，840 秒讲稿预算。** [PPTX](report.pptx) · [PDF](report.pdf) · [讲稿](speaker-notes.md) · [全页概览](overview.png) · [可重建记录](deck.json) · [摘要与来源清单](manifest.json)

本稿围绕观测进入输入、状态或表征的位置组织三篇研究，再比较证据边界。真实数据绘图区、原生读数、研究条件与局部解释共同构成主视图。

![最终封面](previews/page-0001.png)

## 关键页

| 页面 | 内容与选择 |
| --- | --- |
| [第 6 页](previews/page-0006.png) | 水云模型、EnKF 与 WOFOST 的状态返回关系；中文 SM 更新式经过实际渲染确认。 |
| [第 8 页](previews/page-0008.png) | 同化前后原始散点绘图区放大，按原图轴中心位置配置原生 6000／8000／10000 标签，点位和拟合线保持原始数据。 |
| [第 11 页](previews/page-0011.png) | 完整 11 模型干旱年表，主视图明确 RMSE kg/ha，全部混合 R² 仍为负。 |
| [第 12 页](previews/page-0012.png) | 变量重要性与分组消融；明确保留基线、增加一组机理变量。 |

第一轮完成 [两封面、两证据候选](candidates/study-01/overview.png)。独立初稿后，跨稿评审发现其左题名右地图结构重复，随后增加 [旧封面与第三封面对照](candidates/study-02/overview.png)，选择上方水分轨迹、下方题名。作者未查看另一稿，但终稿封面接受了跨稿反馈，不宣称零干预独立选择。[完整取舍](review/design-decisions.json)

## 审阅与可编辑范围

作者实际打开最终版本全部 15 张 PNG，另看整稿概览，并登记 [逐页审阅](review/visual-review.json)。[渲染回执](review/render-receipt.json) 绑定当前 PPTX 哈希；科学审稿者的 [实际范围](../review/author-b-review.md) 为初稿全页和修订定点，未冒充另一次终稿全页看图。[坐标配准记录](review/coordinate-calibration.json) 保留图 8 的像素定位。

PPTX 有 357 个原生形状、8 个图片对象和 15 页备注。精确数表、数据标记和关系图可编辑，均以形状组成，不是 Office table/chart 对象；原图内部仍为位图。[对象核对](review/native-object-audit.json)

最终 0 错误／6 提醒：3 项源图标签估计、2 项原生数表载体未识别、1 项第 14 页留白。关键数值、单位和条件以 24–28 CSS px 原生文字呈现；原始次级细字未保证全部达到 24 px。未验证现场投影、PowerPoint/WPS 或真人计时。

```sh
node scripts/build-research-demo.mjs --author b --output ./research-demo-b
```

请从仓库根目录运行，目标目录必须尚不存在；离线重放不继承本次视觉通过。[共同来源与许可](../sources/README.md) · [完整验证说明](../../../docs/VALIDATION_V07.md)
