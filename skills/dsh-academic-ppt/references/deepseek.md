# 按 DeepSeek 与 DSH 的真实能力执行

## 1. 模型能力与业务分开

DSH 是 DeepSeek Harness。模型、凭据、历史、工具与审批由宿主管理；本插件负责学术记录、排版、修订和检查，不自行发起付费 LLM 调用，不另收 Key 或读取宿主凭据。

读取本次宿主公布的模型、工具和能力。依据宿主所用模型目录或实际 `/models` 返回及端点支持情况核对，保留来源；插件不自作主张选模型或另调私有 LLM API。`capabilities.imageInput` 记录 supported/unsupported/unknown，它不是模型能力开关，手填 supported 不能给文本模型赋予视觉。

截至 2026-10-20，官方推荐 `deepseek-flash`，服务版本 V4.1-Flash-1017，接受图像；`deepseek-v4-pro` 当前为文本模型。`/models` 提供上下文、输出上限、输入模态、推理档位和协议能力。上述是核对日事实，不作为永久默认值。[模型发现](https://api-docs.deepseek.com/api/list-models/) · [能力说明](https://api-docs.deepseek.com/quick_start/pricing/)

内置目录、自定义网关和登录账户的能力来源不同。自定义声明未必与真实端点一致；未知时保留 unknown，完成结构检查并说明视觉未完成。[DSH 配置](https://deepseek-harness.github.io/deepseek-harness/en/guide/providers)

## 2. 小任务与持久化产物

每次给可核验动作：精读一篇方法、核对一组结果、设计两页、修一组卡片。将结果写入记录，成功后用 `academic_ppt_context` 继续。

上下文仅放中心问题、当前约束、相关 ID、必要原文、待办与阶段参考。全文与工程在工作区按页或字段读；不要每轮重贴五篇全文、全部手册和 base64 图像。

先登记 papers，再登记 claims/assets，最后 slides；稳定 ID 复用，避免重复。`record` 是对象数组，单批最多 5/20/8/8 条，不是字符串；每次按最新 expectedRevision 提交。

分段方便定位、恢复和控制修改范围，不承诺固定准确率或节省比例。长上下文不是一次塞满材料的理由，缓存也不保证命中。[缓存说明](https://api-docs.deepseek.com/guides/kv_cache/)

## 3. 合理分配思考

相关性、跨文献归纳、因果归因、分母审查和研究方案适合审慎推理；宿主支持且用户选择允许时采用较高 effort。查 ID、比例计算、边界与导出交给工具。

当前 thinking 支持工具，默认 high；temperature 等参数在该模式下可能无效。不要沿用旧 R1 的“不支持工具”，也不宣传降温消除幻觉。[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

Chat Completions 带 tools 时须回传此前所有轮次 reasoning_content，包括未实际调用工具的轮次。这由 DSH 适配器管理；业务不裁剪重组。工程只存可审核的依据与决策摘要，不把内部推理写进讲稿和公开包。

## 4. JSON 之后还有语义检查

官方 JSON 模式要求 json 指令和格式例子，仍可能空内容或截断。合法 JSON 不代表符合业务 schema，更不代表证据正确。本插件按宿主工具 schema 接收有类型参数，经校验落盘。[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)

输出空、截断或缺引用时缩小批次并给明确修复项，不猜字段后标 verified。strict 工具模式有 beta 与 schema 限制，由宿主决定协议，不为技能擅改 endpoint；本地继续检查引用、数值和范围。[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)

## 5. 视觉检查必须实际看图

只有模型和端点支持图像、宿主有查看路径时，才让模型看模板、论文图和预览。SVG 文本或 OCR 不是完整视觉查看。

小轴字和图例可能受输入缩放影响，必要时裁切加全图定位，并对照正文、图注或 source data。视觉读出的数字需要核对原始值。[Vision](https://api-docs.deepseek.com/guides/vision/)

检查遮挡、密度、对齐、层级、图例与连续页重复；代码检查边界和文件。结果分开记录。`reviewer: vision-model` 必须有实际视觉查看，unknown/unsupported 时不能填完成。

`basis: html-preview` 与 `pptx-render` 分别表示预览和真实导出渲染，不能互换。后者先调用可选 `academic_ppt_render`，引擎不可用就写 unavailable。`reviewedSlides` 只包含看过的页。

图像输入不是生图能力。科学图来自论文或精确可编辑绘制；外部生图只作非证据装饰/设计参考，注明角色。

## 6. 测试效果边界

本地 fixture、schema、渲染与修改测试只证明所测路径。没有真实 DSH 会话、DeepSeek 输出和检查记录，就不称端到端模型效果评测通过。

升级模型、宿主或网关后重新核查能力。按 provider 错误处理图像拒绝或升级要求，不读取其他凭据、不绕过权限、不伪造工具成功。
