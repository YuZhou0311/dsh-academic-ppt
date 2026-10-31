# 0.10.0-rc.1 候选变更

这是候选源码说明，尚不代表创建了Release或发布到npm。

- 增加六类可执行学术styleProfile、标题/注释字族、开放panel与独立表格样式；显式覆盖和旧工程兼容。
- 新工程默认balanced；保留已有compact选择与证据/投影约束。
- 内容相关designStudies可代替强制卡片细读；采用preset仍核对实际查看。
- 重构主技能，补充科学图表、学术文案、风格与分层审稿指导。
- 增加同内容多风格教学样张与固定行为评测任务。

详见 [研究依据](RESEARCH_V010.md) 与 [验证记录](VALIDATION_V010.md)。以下保留正式0.9.1的历史发布说明。

---

# dsh-academic-ppt v0.9.1

v0.9.1 修复 v0.9.0 的协作缺失、卡片空腔与配色过淡问题，保留研究证据、学术边界、可编辑对象和 19 个工具。

[正式 Release](https://github.com/YuZhou0311/dsh-academic-ppt/releases/tag/v0.9.1) · [DSH 安装包](https://github.com/YuZhou0311/dsh-academic-ppt/releases/download/v0.9.1/dsh-academic-ppt-0.9.1.tgz) · [安装与升级](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.1/docs/INSTALL.md)

## 1. 恢复真实的 human-in-the-loop

新项目自动使用 `consultation.workflowVersion:2`，按四个节点与用户协作：

1. **设计来源**：开场区分插件默认原创、学习用户模板、明确保留模板版式。未回答或尚未上传不能自动转成默认选择。
2. **故事线**：展示中心问题、证据路线、顺序和取舍，保留真实回答。
3. **真实样张**：同时讨论配色、深浅用量、布局、风格、密度、卡片尺度和留白；新增 layout 主题，一次真实回答可以覆盖充分展示的多项选择。实际样张渲染并自查后，工具状态切换为 ask-pilot-direction，要求展示样张并等待回答，不停留在继续制作候选。
4. **最终用户审查**：作者先逐页自查并修复，再展示当前成品收集最后意见。记录绑定 PPTX 和实际渲染清单双哈希，Agent 自查不能代替用户反馈。

全权或局部委托保留原话与 `delegationTopics`，只覆盖明确范围；普通“帮我做 PPT”不是全部设计和最终审查授权。已有选择不重复问，没有提问工具时直接在聊天中询问并等待。

## 2. 卡片与父面板按内容适配

自动文字卡不再平均吸收面板剩余高度，按当前宽度重排并采用自然内容高度；没有明确拉伸要求的文本父面板同步收紧。

默认图卡根据实际区域、图注和源图比例适配图槽，保留完整原图与可读字号。图片达到有效宽度后停止无效增高；总览/局部图的行高按源图需求分配。后续卡片位置使用最终适配高度，避免收缩后留下额外间隙。

12 个图卡示例移除无依据的固定 mediaHeight，并重建相关 SVG、目录与原创图卡 PPTX。显式 box、mediaHeight、align:stretch 仍是可用约束；保留大框时须解释用途，不能默默裁证据或缩小关键字体。

## 3. 留白与颜色进入逐页审查

新增可定位的卡片空腔警告，并将整页空区、卡内空白、文字对比风险汇总为 `reviewTargets`。

v2 的逐页观察须填写 `spaceCheck` 与 `colorCheck`，并以 `diagnosticChecks` 回应当前风险目标。有意留白说明具体阅读作用；缺陷记录 needs-fix 并修复后重渲染，不能只填一句“整体通过”。明确的低对比错误不能以“有意保留”放行。

检测是几何和对比辅助，不是自动审美评分。封面留白、共同尺度比较、原图内部科学间距仍须结合真实画面判断，不鼓励堆装饰填满页面。

## 4. 深浅配色有实际可用的实现

新默认以深色题签配白色正文建立层次，辅助区域可使用开放白底、细线或适度填色。五套学术色板各提供部分深色题签、深色重点面、中间色条件组和开放证据区的可执行配置。

按实际背景、局部填色、透明度与文字分段检查对比；图片和复杂混合背景转为真实看图提醒。原图的数据色义保持独立，不因页面换色而改变变量含义。

## 5. 防止反馈丢失和确认循环

局部设计更新保留省略的 system、branding、templateProfile 及已有协商状态；v2 decisions 按 topic 更新，同一批重复主题显式拒绝。密度检查与保存使用同一合并状态。

只记录真实反馈且内容未变化时保留当前构建、渲染与原自查；修改内容、设计或重新渲染后相应确认失效。旧模板路径作为历史来源，不阻断无关的最终确认；首次或实际改变来源仍检查文件。

## 兼容与验证范围

- 工具仍为 19 个，工程 `schemaVersion:1` 保持；新增字段按需通过 contract 获取。
- 旧工程不自动补造历史对话；准备既有工程时传 existingProject:true 保留旧协议。新项目始终启用 v2。
- 渲染实现版本更新；旧构建在新版重新核验或交付时需按当前实现重建、渲染和审查。
- DSH 声明范围保持 `>=0.2.1-rc.2 <0.3.0-0`，实际回归固定 `0.2.1-rc.2` 与 `0.2.1-rc.3`。
- 回归包含真实 PPTX 渲染、工作流状态、两版官方 Agent 注入、组件适配和完整发布附件校验。具体执行结果与边界见 [本次验证记录](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.1/docs/VALIDATION_V091.md)。

## 更新后使用

安装 v0.9.1 包并核对插件版本，在新会话调用 `/dsh-academic-ppt`。新建整稿应先询问设计来源；如果已经明确选择或授权相应事项，继续沿用。

[四节点工作流](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.1/skills/dsh-academic-ppt/references/workflow-v091.md) · [留白与深浅层次指南](https://github.com/YuZhou0311/dsh-academic-ppt/blob/v0.9.1/skills/dsh-academic-ppt/references/space-and-tone.md)

五项发行附件为安装 TGZ、源码 ZIP、更新说明、release-manifest.json 与 SHA256SUMS。来自同一源码提交，不等于 npm registry 发布。
