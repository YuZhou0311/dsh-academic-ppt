# v0.7.0-rc.4 重建验证记录

本次从远端 v0.6.0、提交 `33c03dd978b83b8d1ed652736ece7009add12a2f` 重新实施。旧工作区丢失，未恢复旧 rc.3 成稿或其验证结果。新实现说明见 [RESEARCH_NATIVE_DESIGN.md](RESEARCH_NATIVE_DESIGN.md)。

## 验证层次

1. 确定性回归：原生对象、完整标题、来源、数字单位、字号政策、局部编辑、候选隔离、跨稿结构和兼容性。
2. 包结构：十四个注册工具、CLI、技能、参考资产摘要与文档本地链接。
3. 两个新上下文作者：相同真实论文和研究问题，各自组织叙事、实际候选与完整报告。
4. 成稿：查看实际 PPTX 渲染，复核研究条件、科学关系、图表裁切和讲稿；保留返工和未解决问题。

## 代码与接口

当前代码完整回归为 **291项通过、0失败、0跳过**（Node 24.19.0，`npm test`，并发2）。注册工具14个；常驻工具定义压紧JSON为15,613 UTF-8字节，按需slide契约27,033字节。这些是字节统计，不是模型token或费用。包检查覆盖运行模块、48种参考页型、9个PPTX资产摘要和文档链接。

首次默认高并发全套测试未取得完整结果，已改用受控并发运行；旧卡片默认断言和按需契约长度预算已随真实接口变化修正。没有把旧版本测试数量计入本版结论。

## 两份真实论文终稿

[本轮完整示例](../examples/research-native-v07/README.md) 使用 Cheng（2022）、Zhuo（2019）、Shahhosseini（2021）三篇正式论文。两位新上下文作者获得相同研究问题与原始来源，未读取另一稿，随后接受科学与跨稿评审反馈。它们是两次实际作者任务，不能写成十次真实模型独立成稿，也不是多模型盲测。

| 项目 | A | B |
| --- | --- | --- |
| 最终版本与页数 | r15，16 页 | r15，15 页 |
| 讲稿预算 | 840 秒 | 840 秒 |
| 实际终稿逐页看图 | 作者打开全部 16 张 PNG | 作者打开全部 15 张 PNG |
| 静态检查 | 0 错误／7 提醒 | 0 错误／6 提醒 |
| PPTX 原生形状／图片对象 | 473／7 | 357／8 |
| PPTX 备注 | 16 页 | 15 页 |
| 文件 | [PPTX](../examples/research-native-v07/a/report.pptx) · [PDF](../examples/research-native-v07/a/report.pdf) | [PPTX](../examples/research-native-v07/b/report.pptx) · [PDF](../examples/research-native-v07/b/report.pdf) |
| 哈希绑定审阅 | [A 审阅](../examples/research-native-v07/a/review/visual-review.json) | [B 审阅](../examples/research-native-v07/b/review/visual-review.json) |

两稿表格、图表标记和关系线由原生形状组成，不是 Office table/chart 对象；论文原图内部仍为位图。实际 PPTX 通过可选 LibreOffice Kit wasm 0.1.5 渲染，缺失字体列表为空，随后由作者逐页查看。最终对应哈希的记录汇总为 `readyForDelivery: true`，这是过程汇总，不是科学真伪或审美评分。

科学审稿者查看初稿 A r9 全部 16 页和 B r12 全部 15 页，修订后定点复核 A r15 第 7、13 页及 B r14 第 1、6、8、11、12 页；最终来源记录核至双方 r15。**不能把这项科学复查写成另一次终稿全 31 页看图。** 249 个结果数值与原始图表一致，5 项必须修正全部关闭。[科学范围及修复记录](../examples/research-native-v07/review/scientific-review.json) · [数值核对](../examples/research-native-v07/review/numeric-audit.json)

实际返工包括 A 方法图改由 WOFOST 输出产量、A 来源页码与零刻度裁切、B EnKF 上标缺字、删除没有原文依据的“随机分半”、B 主视图 RMSE 单位，以及消融中保留基础输入的限定。来源使用纠正版 asset ID，公开重建记录只带最终在用资产。A 制作中还发生一次写入结束后的残留锁，确认无活动写入后保留原锁并恢复操作；不能描述为零中断完成。

## 跨稿构图与候选

A 实际完成两种封面、两种困难证据构图，三轮候选迭代均查看实际 PNG；公开包保留最终四张。B 第一轮四张候选，第二轮另做封面并与旧封面对照，共六张实际候选页。候选具有拒选记录，不等同于全部通过的正式页。

两份独立初稿都选择左题名右地图。`portfolio` 提示封面主要结构相似后，实际并列复核触发 B 改成上轨迹下题名。终稿报告未再触发高相似提示；这只是作者结构的比较结果，**不提供原创性分数、不证明像素差异或作者独立性**。[初稿报告](../examples/research-native-v07/review/portfolio-initial.json) · [终稿报告](../examples/research-native-v07/review/portfolio-final.json)

## 可重建性

两稿的 `deck.json`、最终在用原图、来源文本和哈希随包提供。`scripts/build-research-demo.mjs` 通过公开记录与构建 API 在新目录重放，两稿均已实际构建成功，分别为 0 错误／7 提醒和 0 错误／6 提醒。每稿检查的 24 个 slide XML 与 media 部件全部逐字节相同；完整 PPTX ZIP 因新构建元数据而拥有不同哈希，不能称整个文件字节相同。此操作不请求模型或网络，不代表新一次创作、阅读或视觉验收。未重新渲染与审阅的重放工程保持 `readyForDelivery: false`，原稿审阅不会被继承。[重放核验记录](../examples/research-native-v07/review/replay-verification.json)

## 范围限制

未使用用户 DeepSeek 收费账户，未执行真实 DSH Desktop/Web GUI 端到端测试，也未在 PowerPoint/WPS GUI 或现场投影设备验收。840 秒只是预算，未做真人计时排练。作者和代码审阅使用同一宿主模型，不等同于多模型盲测。

原生正文／标签／注释的目标为 28／24／18 **CSS px**，对应 21／18／13.5 pt。部分原图次级细字仍小于目标；主要数值、单位、条件与限制用较大原生文字补充，但没有宣称每个原始刻度都能从会场后排读出。保留的静态提醒包括源图细字、自绘数表未识别和局部留白，具体解释在逐页审阅内。没有用装饰元素刷占幅或消除提醒。

原始用户参考 PPT 已不在当前环境，本次不能声称重新观察了这些页面。真实来源全文和出版方原图重新取得，来源、版权说明和复核材料随公开示例提供。
