# DSH执行、模型能力与成本

## 使用实际能力

模型、认证和付费由DSH宿主管理。本插件不主动调用LLM、不索取Key、不读取宿主凭据。模型名称、价格和输入模态会变化，以本次宿主/provider及实际端点能力为准；通过capabilities记录支持状态与来源，不把手填supported当成视觉能力开关。[模型发现](https://api-docs.deepseek.com/api/list-models/)

需要实际看模板、论文图与当前PPTX时，必须有真实图像输入路径。文本提取/OCR可辅助核对，不能声称完成遮挡、配色和图例视觉审查。图像输入也不是生图权限。

尽早核实并登记本次实际输入能力。`capabilities`可随init提供，也可通过recordsPath批次的根级字段登记；精确schema与记录规则见`contract(topic:assessment)`返回的`capabilityRecord`，CLI也可用`init --schema`或`record --schema`查询。`imageInput`只接受supported / unsupported / unknown，`source`写实际provider或图像输入入口及核实依据。确实收到并看过图像时，可以记录具体入口与观察；“生成了PNG”“模型名称带视觉”或“为了让review通过”都不是依据。能力更新产生新修订，应在首次构建前完成；构建后才更新需重新构建、渲染和审查当前版本。

## 主动检索、获取与查看是不同动作

按当前宿主实际公布的工具查找搜索、网页读取、文件下载、PDF处理和图像查看入口，使用各自真实契约。官方[`web_search`与`web_fetch`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/tool-web/README.md)用于发现来源和读取网页文本；`web_fetch`不提供PDF/图像二进制下载。工具存在也不保证后端可用，检查真实返回、错误和截断状态。

用户未附全文或原图时，主动完成已授权研究所需的检索与获取，不先要求用户逐篇找图。检索得到来源后按[research.md](research.md)核对身份，用宿主可用的下载/文件能力保存从真实来源发现的原图或PDF，再按[figure-selection.md](figure-selection.md)查看图像和图注。命令工具受宿主权限控制；不能绕过限制、猜测凭据或调用未提供的模型接口。

只有网页文本时，继续寻找该来源的合法全文/图像入口；只有本地PDF时，渲染或提取目标图后实际查看。下载与看图分别成功后才能登记相应状态。能力缺失、返回不支持格式或确实获取失败时保存具体缺口，说明需要的入口或材料；继续已核实内容，不能静默交付全篇文字卡并称已完成查证。

## 小而稳定的上下文

常驻只需主SKILL、中心问题、硬要求、当前阶段、稳定ID和待解决项。按需contract读取一次某类schema；数据写本地JSON通过recordsPath提交。不要每轮重复论文全文、模板示例集、原始profile、整个project或图片base64。

保持工具列表稳定，将大记录契约延后读取。DSH会把工具schemas放进系统提示，execute返回canonical JSON，render负责模型可见摘要。[DSH工具契约](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-tool)

缓存命中降低重复输入计费，但并不免费，也不保证每次命中。不要用缓存作为无限扩充上下文的理由；按真实usage区分input/cacheRead/output，不能重复累计stream与最终message中的同一记录。[缓存说明](https://api-docs.deepseek.com/guides/kv_cache/)

## 减少调用而不降低证据标准

- 来源检索：共享已查候选和缺口；有全文后缓存一次提取，后续定向页码。每篇通常两条获取路线足够判断需要补材料，停止无目的换镜像。
- 分析：让主代理负责中心论证，子代理领取不同来源或独立复核；不要主/子重复搜同一篇全文与期刊指标。子代理返回短证据表与路径，不回传整篇摘要集。
- 工具：一次批量登记当前已准备好的记录；先静态check，再构建。不要试错猜schema、读全库源码或全量打印profile。
- 视觉：一次代表页检查后扩展到全稿；小样应包含本任务的最长标题、最密证据或特殊符号。正式渲染前集中核对页面与讲稿的单位、条件和措辞，避免备注晚改导致整个PPTX哈希失效。全稿有具体失败页才进入修复，先收齐同一轮问题再合并修改。保持模板决策稳定，不反复生成装饰候选。
- 恢复：保存阶段结果，使用context读取至多4个相关ID。已提交后工具异常时先取revision，不能重复执行写入。

只对研究机制、归因、不同文献证据和研究设计投入审慎推理。比例、边界、排序、文件操作交给确定性工具。宿主推理/缓存协议由适配器管理，插件不自行删改隐藏推理或重写接口。

## 错误的正确处理

projectPath必须为init返回的project.json文件，不是目录。recordsPath是工作区UTF-8 JSON批次，不含projectPath/expectedRevision。INVALID_INPUT时只改报错字段；REVISION_CONFLICT时读取最新状态；USE_SCOPED_EDIT时改用edit；材料门槛失败时修证据，不改门槛。

工具返回只允许lossless JSON；可选对象字段省略，不能带undefined。数组undefined、NaN和Infinity是错误，不能静默替换为null。文件生成成功只是导出结果，非科学或视觉验收。

## 费用与测试边界

不预报“一份固定几毛钱”或“降低某百分比”，不为展示省钱改换模型、降低阅读门槛或跳过检查。比较成本时固定请求、模型/provider、工具版本、可用材料和缓存条件，记录unique message usage、工具次数、build/render次数、失败类型与最终质量。

子智能体测试只证明该测试模型的行为。没有真实DSH+DeepSeek新会话和账单，不能称已测DeepSeek端到端效果或人民币节省。跨学科测试不得把原模板示例或预期答案泄漏给执行者。
