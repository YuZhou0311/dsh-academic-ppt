# 一篇真实论文，完整走通学术汇报工作流

随附成品：[可编辑 PPTX](./report.pptx) · [HTML 播放器](./report.html) · [7 分钟讲稿](./speaker-notes.md) · [实际 PPTX 验收记录](./VISUAL_QA.md)。

![9 页真实 PPTX 渲染总览](./preview.png)

```bash
npm run demo
```

脚本没有网络请求或模型调用。默认在调用目录下新建唯一目录，生成项目、PPTX、HTML 播放器、逐页讲稿、证据清单、原图清单、静态质量报告和原生模板 profile。已有文件不会被覆盖。

自定义新的输出目录，并实际渲染 PPTX：

```bash
npm run demo -- --output ./my-academic-demo --render
```

如果中文字体在当前工作区中的专门目录：

```bash
npm run demo -- --output ./my-academic-demo --render --font-dir ./fonts
```

`--render` 使用可选的 LibreOffice kit，并返回真实 PPTX 对应的 PNG/PDF 与校验收据。依赖或字体不足会明确报告。脚本不会把生成成功冒充视觉通过：需要逐页检查实际 PPTX 渲染，再对相同文件哈希记录审查。

## 示例结构

| 页 | 任务 | 主要表达形式 |
|---|---|---|
| S01 | 明确问题和单篇深读范围 | 学术封面 |
| S02 | 完整英文论文题名、进展与证据边界 | 两种真实导入的原生模板组件 |
| S03 | manager 与工具库如何分工 | 原生流程、少量解读 |
| S04 | Case 1 的重复测量单位及任务链 | 完整原图、可编辑数字与读图引导 |
| S05 | 20 项分析任务的人工核查结果 | 可编辑数据图、分母与失败类别 |
| S06 | 适用范围、分布外数据与控制收益边界 | 不对称论证布局 |
| S07 | 从失败类型提出待验证研究问题 | 假说、触发条件与人工负担 |
| S08 | 规定公平比较与评价对象 | 可编辑研究设计流程 |
| S09 | 书目、版本、读过的章节、原图授权 | 来源记录 |

来源、完整原图图注、授权和自制模板的说明在 [ASSETS.md](./ASSETS.md)。数据和讲稿在 [science-demo.mjs](./science-demo.mjs)，全部数字有统计口径。示例针对一篇系统评价论文，展示如何限制结论范围；未声称完成五篇文献综述，也未编造农业控制实验或研究提议的结果。

要重建自制参考 PPTX 到一个新的文件：

```bash
node examples/create-native-reference.mjs ./native-reference-new.pptx
```

此参考模板专为插件创作。之前用户的两份 PPT 模板当前不可用，没有被冒充为此文件。
