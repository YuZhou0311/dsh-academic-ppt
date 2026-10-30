# 0.10.0-rc.1 验证记录

本次基于 `a1c62087b74455295f7104ada260fcf29a50fb78` 修改。代码候选版本为 **0.10.0-rc.1**，不是已发布的 GitHub Release 或 npm 包。本页分别说明代码行为、官方宿主接入、受控样张与独立计划试作，避免将它们合并成一个“专业度分数”。

研究来源和设计判断见 [RESEARCH_V010.md](RESEARCH_V010.md)。本次没有取得用户不满意的具体成稿；机制诊断以仓库源码、原有参考和公开资料为依据。

## 1. 代码回归

最终完整运行：**553 项，551 通过、0 失败、2 跳过**。Node 为 `v24.22.1`，测试要求真实 PPTX 渲染，未以缺少渲染器为理由跳过相关流程。[原始日志](validation/v010/full-regression.txt)。

```sh
mkdir -p .test-output/tmp
TMPDIR="$PWD/.test-output/tmp" DSH_REQUIRE_REAL_RENDER=1 npm test
```

覆盖范围包括：

- 六种 profile 的实际解析、切换和显式覆盖；仅保存授权或密度的初始化也采用新默认。
- 无 profile 的旧工程继续使用既有解析；明确的 compact 参数、模板及用户覆盖保持生效。
- 标题、正文和图注的字体角色；科学图注测量与输出使用同一字体。
- `plain` 开放分组，以及独立于 panel 的三线、轻横线和色表头表格；SVG 和原生 PPTX 对象输出。
- 保存记录、context、scene、设计检查与整稿比较使用一致的有效设计。
- 内容相关 designStudies 可满足完整新稿的设计学习要求；实际使用 card preset 仍需对应查看记录。
- 原有来源证据、科学数值、用户协作、故事板、实际渲染、版本审查和交付流程。

两项跳过是测试默认路径下未安装的 DSH rc.2 / rc.3 宿主运行时；它们不是视觉测试或科学事实检查。下面使用独立安装目录额外执行了 rc.3 AgentLoop 检查，rc.2 未在本轮重新安装验证。

修订过程中曾有一次审查生命周期测试返回 `REVISION_CONFLICT`。未删除或放松并发保护；该文件独立重跑及最终完整回归均通过。这里记录发生过的情况，不用最终成功掩盖它，也不据此宣称已穷尽并发风险。

## 2. 官方 DSH AgentLoop 接入

[完整报告](validation/v010/dsh-agent-injection.json)绑定本轮技能、工作流及关键源码 SHA-256。使用官方 `@deepseek-ai/dsh-*` **0.2.1-rc.3** 与 `@deepseek-ai/cordis` **4.0.5**，通过现有脚本执行真实注册、技能加载、AgentLoop、工具分发和请求装配。

| 项目 | 本次结果 |
| --- | --- |
| 插件工具 | 19 个，定义进入实际 provider 请求 |
| provider 请求 / 工具流水线调用 | 31 / 24 |
| 成功 / 预期拒绝的工具结果 | 16 / 8；拒绝用于验证路径、参数与会话权限边界 |
| 技能正文 | 完整正文 5567 字符；显式调用和按需加载均检查 |
| 当前工作流 | 官方文件读取工具读取 `workflow-v010.md` |
| 图像传递 | 真实 `read_image`、attachment store 与请求图像块；原始字节校验 |
| 工作目录与权限 | 当前目录变化生效，不能借切换目录扩大授权；只读会话拒绝写入 |

**provider 的回复和工具选择是预设测试数据。** 没有请求真实 DSH 模型，没有验证其指令遵循、图像理解或最终 PPT 质量。图像测试只证明像素与路径经过官方传输链正确到达请求边界，不证明模型看懂图。

所有会话、权限切换、附件目录及文件写入都在隔离测试对象中进行，不读取模型密钥、不修改用户 Desktop/Web profile。未覆盖 PTC/run_code、真实 provider HTTP 图像序列化和原生桌面界面。

复跑前需在一个独立目录安装同版官方运行时；本次使用 `.test-output/dsh-runtime`。准备方法见 [既有接入验证](AGENT_INTEGRATION_V090.md)，不要将历史结果当成本轮结果。

```sh
mkdir -p .test-output/temp
TMPDIR="$PWD/.test-output/temp" node scripts/check-dsh-agent-injection.mjs \
  --runtime-dir .test-output/dsh-runtime \
  --output .test-output/dsh-agent-injection-v010.json
```

## 3. 六方向、十二页实际样张

[样张说明与文件](../skills/dsh-academic-ppt/references/academic-styles/README.md)提供六套可编辑 PPTX、输入、实际 PNG/PDF、数据和渲染收据。每种方向各两页，分别验证结果表达与方法/边界；不是只展示封面。

所有方向使用同一份明确标记的教学构造数据，数值、条件与科学边界不随风格改变：24 个假想样本在两种协议下形成 48 条记录，按 4 个站点计算差值与区间。**统计单位是站点，不能将 48 条记录当成 48 个独立样本。** 数据与计算公式均随包提供。

| 项目 | 本次结果与边界 |
| --- | --- |
| 实际渲染 | 6 份 PPTX、12 页，LibreOffice Kit 0.1.5 WASM，1601 × 901 PNG |
| scene 检查 | 六套均为 0 errors、0 warnings；不替代视觉检查 |
| 字体 | 显式提供 Noto Sans/Serif CJK SC 的 Regular 与 Bold 共四个字体文件，六份清单均 `missingFonts=[]`；字体二进制未打包 |
| 原生对象 | 281 个形状、7 个原生表格、0 个图片对象 |
| 图表可编辑性 | 点、轴、线和文字是原生形状；没有冒称带 Excel 数据工作簿的原生 chart |
| 版本绑定 | catalog 与 review 中的 PPTX/PNG SHA-256 对应实际文件，移动后再次验证收据 |
| 视觉检查 | 视觉模型逐页查看实际渲染；不是人工评审或用户确认 |

逐页查看发现并修复了下标字形缺失、答辩页侧栏过密及短尾行。主审复看总览、论文精读结果页、公式方法页和证据综合边界页时，又发现粗体宋体的笔形不符合预期。补齐 Serif Bold 后对同一份 PPTX 重渲染，PDF 字体记录从 Serif Regular 变为 Serif Bold，证实是缺少真实粗体字面；不能据此说换成了 Sans 家族。

最后六份 PPTX 本身的哈希均未改变；8 页 PNG 随字形变化更新，全部重新打开检查，其余 4 页与已查看版本完全相同。主审又打开最终方法页及证据综合页核对。在所查画面未发现可见裁切、重叠或缺字。修复前后的 `missingFonts` 均为空，这证明字体家族检测不能代替字重和实际字形检查；[字体审计](../skills/dsh-academic-ppt/references/academic-styles/font-weight-audit.json)保留前后图像哈希、像素差分范围、PDF 字体记录及四份字体的来源和哈希。

程序生成的 `build-quality.json` 仍将 `visualReview` 保留为 `not-reviewed`。看图观察单独写在 [render-review.json](../skills/dsh-academic-ppt/references/academic-styles/render-review.json)，不把程序通过等同于视觉批准。任何重建都应对当前文件重新审查，不能沿用旧哈希对应的结论。

这些是由助手编排、由插件渲染的受控样张。它们展示当前表达能力和文件质量，不是 DSH 模型端到端作者实验，也没有经过 PowerPoint / WPS 实机逐页验证。

## 4. 独立 Agent 计划试作

另开一个不继承研究诊断的 Agent，只提供当前 SKILL、按需参考和固定教学任务，要求完成 **4 页 / 8 分钟故事板与困难结果页设计**。作者未读取本次研究报告、其他 Agent 输出或评测答案。[原始任务](validation/v010/forward-authoring-task.txt)、[完整计划](validation/v010/forward-authoring-plan.md)与[审阅记录](validation/v010/forward-authoring-review.json)均保留。

材料刻意包含不利结果：A 在随机划分中 RMSE 更低，但在三个整站留出中均更高；没有原始预测、误差线、p 值或跨年度独立验证。试作观察到：

- 完整保留 8 个原始 RMSE 读数、单位与 4 个精确差值，没有捏造误差线或显著性。
- 明确写出“本次三个整站留出未保留 A 的优势”，没有以“略有波动”淡化，也没有外推为所有新站点均更差。
- 区分 120 条记录、3 个站点、2 年数据覆盖与独立跨年验证；不将不同协议混成重复实验。
- 使用共同零线差值图加原始数值表，理由针对比较任务；没有为农业题材虚构照片、地图或网络结构。
- 四页时间预算合计 480 秒；按问题、方法、结果与边界安排标题。用户已明确委托的决定没有再次索取批准。
- 如实说明只完成设计计划，未声称已渲染、投影验证或用户验收。

这只是 **一次计划行为检查**。没有生成 PPTX，没有运行 DSH 模型，没有旧版对照或盲审，不能用来估算总体成功率或新版提升幅度。后续同模型评测可使用 [八个固定任务](../evals/academic-cases.json)；需要论文、模板和既有工程的任务必须先补齐真实输入。

## 5. 包结构与可复现性

`npm run check` 检查工具数量、版本和 lockfile、参考资产一致性、文档本地链接及六类新样张的文件/哈希绑定。`npm pack` 用于验证候选包确实包含新运行时、主技能、指导、样张、研究及评测资料；它不执行发布。

技能 frontmatter 经技能创建工具的 validator 检查通过；CLI 的 design contract 实际返回六方向及当前 schema。相关机器记录、最终回归与计划试作保存在本目录的 [validation/v010](validation/v010/README.md)。

正式效果判断仍需要：同一 DSH 模型在真实论文上生成整稿，检查实际 PPTX，邀请熟悉学科的讲者盲评科学忠实度、论证、读图与风格适配，并记录失败案例。本轮提供可执行版本和可复核证据，不预先宣称“彻底去 AI 化”。
