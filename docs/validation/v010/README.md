# 本轮验证证据

解释与限制以 [VALIDATION_V010.md](../../VALIDATION_V010.md) 为准。以下是可复核的运行输出和试作材料，不是自动生成的质量认证。

| 文件 | 内容 |
| --- | --- |
| [full-regression.txt](full-regression.txt) | 最后一次完整回归原始输出：553 项，551 通过，0 失败，2 跳过 |
| [dsh-agent-injection.json](dsh-agent-injection.json) | 官方 rc.3 AgentLoop 接入检查；provider 回复是预设测试数据 |
| [forward-authoring-task.txt](forward-authoring-task.txt) | 独立作者收到的完整原始任务；只要求计划，不要求生成 PPTX |
| [forward-authoring-plan.md](forward-authoring-plan.md) | 作者原始计划，未为评测结论改写 |
| [forward-authoring-review.json](forward-authoring-review.json) | 主审对任务与计划的具体观察及未验证项，无总分或普遍效果推断 |
| [source-manifest.json](source-manifest.json) | 运行时、技能、主要验证脚本及上述证据的 SHA-256，便于识别后续变化 |

六类样张的原生对象、渲染收据及视觉观察在[样张目录](../../../skills/dsh-academic-ppt/references/academic-styles/README.md)。样张记录区分程序检查和视觉模型审阅，没有登记用户批准。

源文件及其哈希是测试边界：修改后应运行对应检查，不能仅沿用本目录中的旧成功记录。本轮没有进行真实 DSH 模型的旧版/新版盲测、用户 Desktop/Web 安装实验、PowerPoint/WPS 实机验证或真人投影试讲。
