# v0.8.3 局部编辑式卡片验证记录

这次更新针对**局部卡片参考**，不是完整学术汇报的再次前向验收。已制作20款视觉参考并复刻成5页原生可编辑PowerPoint，每页展示4张局部组件；另有20个SVG、可筛选HTML、JSON内容结构和重建脚本。

## 检查范围

- 卡片数量：20个；结构清单全部标有 `componentOnly: true`。这说明参考定位，不是约束每张卡必须占固定宽度。
- 原有 API：48个 `CARD_PRESETS` 与16个 DSH 工具未改动，20个新增 C 编号仅作为视觉参考和原生重组指导。
- PPTX：5张图册页，四卡同页；素材有独立图片对象及原生可编辑标题、文字、边框和定位线。已审阅该版本的渲染总览及关键单卡，不表示在PowerPoint/WPS桌面实测。
- 论文证据：卡内图为确定性合成占位，绝不作为科研结论；使用时需换为实际核对和授权的论文图。
- 版式：禁止把整张卡片当完整 PPT 页。先规划正文阅读路径、源图大小与比较对象，再决定卡片尺寸与邻近组件。
- 自动化：`test/editorial-components.test.mjs` 和包完整性检查验证全部20个SVG、离线图册及真实 PPTX 的5页、原生形状与独立图片存在性。GitHub CI可复核测试与打包，不取代审美和内容复核。

`0.8.2` 的12页前向报告是此前版本的单独验收，见 [v0.8.2 验证记录](VALIDATION_V082.md)，不是本次新增20张卡片的实机应用效果。

## 本次交付

[可编辑PPTX图册](../skills/dsh-academic-ppt/references/editorial-v083/editorial-card-components-20.pptx) · [卡片目录](../skills/dsh-academic-ppt/references/editorial-v083/index.html) · [重建脚本](../scripts/build-editorial-cards.mjs)

新版参考指导已经接入 Skill 主流程，并保留原有研究、取图、故事线、设计协商、候选比较及审查路径。正式端到端的 DSH Desktop/Web GUI 和实际模型生成仍需单独验收。
