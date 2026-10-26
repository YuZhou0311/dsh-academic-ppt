# dsh-academic-ppt v0.8.3

版本 `0.8.3`；保留原项目 schemaVersion 1、16 个 DSH 工具与 48 款原生预设。此次更新专注于更优秀、可适配实际内容的**局部信息卡参考**，不改变研究优先、来源追踪、主动取图与分阶段设计讨论的基础工作流。

## 本版新增

- 根据多轮图片设计探索，重新用 PowerPoint 原生文字、线框与图位复刻 **20 款原创编辑式局部卡片**。5 页参考 PPTX 每页四卡，专门防止被理解成整页模板。
- 卡片包括双图证据、总览与局部、图与成对读数、交叉证据矩阵、方法阶段、图中短注、条件与证据边界、多源观测、热图与色标等不同阅读关系。
- 同步提供20个独立SVG预览、搜索图册、JSON结构说明与可重建脚本 `npm run cards:editorial`。
- Skill 与卡片设计指南明确：先理解本页论证，再学习卡片内部关系；只在当前页所需的局部区域使用，不要直接整页照搬。配色、宽高、标题与图位可按实际论文图片调整。
- 合成图片、曲线和空间纹理**仅供构图演示**，不能当作实测、论文原图或有效指标。正式 PPT 要替换为查证的研究图；所有来源、轴和图例须正确。
- 原有 **48 款 `CARD_PRESETS` API 均不变**。新增20款属于视觉参考，不冒充额外20个已注册原生 preset。

## 运行与验证

新增包检查与测试核对20款卡片组件、5页PPTX、至少20个源图位与大量原生可编辑形状，避免图册遗漏或把整页截图作为可编辑资产。内部预览与原生PPTX已检查；宿主与端到端模型输出仍需在实际DSH环境验收，不能仅凭组件图册证明全稿质量。

兼容范围保持 DSH Host `>=0.2.1-rc.2 <0.3.0-0`、Node.js 22.19+ 或 24+，Desktop/Web 使用同一插件源码。原有验证详见 [v0.8.2 实际验证](VALIDATION_V082.md)，新增资源清单和本次验证边界见 [v0.8.3 验证记录](VALIDATION_V083.md)。

> 截至本次源码同步，`main` 版本更新为0.8.3。GitHub `v0.8.3` Release与TGZ如未另行创建，请使用仓库源码或本次0.8.3更新包，勿把旧0.8.2的TGZ称作0.8.3。

## 主要入口

- [20款局部卡片（离线图册）](../skills/dsh-academic-ppt/references/editorial-v083/index.html)
- [5页可编辑PPTX参考](../skills/dsh-academic-ppt/references/editorial-v083/editorial-card-components-20.pptx)
- [20款卡片内容结构](../skills/dsh-academic-ppt/references/editorial-v083/catalog.json)
- [DSH Desktop/Web安装说明](INSTALL.md)
