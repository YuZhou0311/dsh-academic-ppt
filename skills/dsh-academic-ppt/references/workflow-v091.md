# 0.9.1 协作生产流程

> 历史版本记录。0.10及以后使用 [当前工作流](workflow-v010.md)；本文的强制组件学习、默认深色题签等不再作为新工程默认。

## 四个实际对话节点

新工程默认 `workflowVersion:2`、`mode:collaborative`。提出问题不等于取得答案，生成候选不等于用户选定，Agent 自查不等于用户最终审查。没有提问 UI 时直接在聊天中展示问题并等待，不能因此跳过对话。

| 节点 | 用户看到的具体内容 | 保存位置 | 下一步 |
| --- | --- | --- | --- |
| 0 设计来源 | 默认原创、模板参考提炼、明确保留模板版式三种方式及区别 | `design.consultation.source` | 回答后选实际设计路径；等附件时可整理证据 |
| A 故事线 | 中心问题、章节顺序、每段作用、关键证据与边界、时间预算 | `consultation.decisions` 和 `storyboard.decision` | 依据真实回答准备样张 |
| B 配色、风格和布局 | 同尺度封面、困难正文和连续三页，说明深浅用量、图文占幅、卡片大小、阅读顺序、密度和边框 | `consultation.decisions`，随后 `plan(kind:pilot-review)` | 真实回答或明确主题委托后展开整稿 |
| C 最终审查 | 已自查修好的成品、全稿概览、故事线与关注页，具体询问还需调整什么 | `consultation.finalReview` | 当前成品确认或明确最终审查委托后 `deliver` |

每轮只问当前需要的少量问题。展示充分的一个方案回答可覆盖多个主题，不按字段拆成问卷；配色、布局与风格也不能只用“整体方向”带过。题目和时长不等于故事线和审美选择。

## 开场与委托

推荐开场：“这份汇报可以按插件的学术设计方式原创，也可以参考你提供的 PPT。你想选哪种？如果有模板，希望学习配色和版式语法，还是保留具体版式？”只补问真正未知且会改变结果的听众、时长或研究材料。

已提供文件且用途明确时直接沿用。“我有模板”表示等附件；“帮我做”“开始吧”“专业一点”仍保留关键对话。不得把未回复、没有提问工具、没有上传文件解释为默认选择或全权委托。

来源模式为 `content-led` / `reference-guided` / `template-faithful`，对应 `design.mode`。参考或套模板时保存真实 `templatePaths`，实际解析、渲染并看图。套版仍须忠实科学内容，不能保留模板旧人物、旧数据与无关图片。付费模板不进入公开发行包。

`mode:delegated` 须记录真实 `delegation` 和明确 `delegationTopics`。例如“配色你定”只授权 palette；“按方案 A 做”只覆盖 A 明确展示的事项；明确涵盖最终审查的授权才包含 final-review。缺少字段时不能让作者自己扩大授权范围。

## 故事板与真实样张

先核对论文身份、全文、研究单位和原图，登记 paper/claim/asset，保留 reported / inference / proposal 的区别。六页及以上整稿用 `plan` 提交完整故事板；逐页记录任务、主张、证据、推理、边界、承接、时间和必须可见条件。短稿仍讨论实际故事线，机器页数门槛不是免除协作的理由。字段以 `contract(storyboard)` 为准。

样张覆盖封面、最难结果/机制页和连续三页，可重叠。使用真实内容，先 `build(draft)`、`render`、看图、修复并逐页 review，再展示比较和等待回答。未决视觉主题不阻止制作可撤销候选；不能为了制作候选提前填 confirmed。

回答后先 `record` 保存对应设计主题，再提交 `pilot-review`。只记录反馈而科学和设计不变时，可保留同一成品及原审查；改变配色、字体、布局、图文或研究内容时重新构建和复核。增加后续页不使已有样张无故失效。

## 按内容布局

先定整页阅读关系，再选局部组件。真实查看参考页和卡片，用 `componentStudies` 保存页号、边框/填充、题签、间距和改造，用 `paletteRationale` 说明颜色职责。仅写 recipe ID 或模糊形容词不足以证明学习。

卡片按当前宽度和真实内容测量；短文本收紧自然高度，图卡按目标区域和原图比例调整图槽。显式 box 或 mediaHeight 是有意约束，不要从示例照抄。收紧卡片后还须重排整页，不能在下方留无作用空区。默认深色题签承托结构、白色正文承载证据；按需要使用开放、部分填色和少量深色重点面，见 [space-and-tone.md](space-and-tone.md)。

## 自审、用户审查与交付

依次 `check → build → render`，实际查看概览及每页可读尺寸的 PNG。文本 `read` 不能代替 `read_image`。作者先修好缺字、重叠、错误连线、原图不可读和无作用大空区，再向用户展示。

v2 的逐页 observations 除 contentCheck / legibilityCheck / issue，还须 `spaceCheck` 和 `colorCheck`。当前 `reviewTargets` 逐项用 `diagnosticChecks:{targetId,decision,reason}` 回应：有阅读作用的保留写 intentional，未解决的写 needs-fix。有缺陷时不能 passed；仍出现的风险不能写“已修复”逃过重建。

工具提供几何与对比风险，不自动判定审美。封面、章节和科学图内部留白可有合理作用；提醒不要求用无关装饰填满页面。实际主体过小或卡片空腔须重排，见 [delivery.md](delivery.md)。

当前成品完成自查后，check/context 才返回最终用户审查。展示成品并收集真实意见；finalReview 保存 status、userResponse、当前 pptxSha256 和 renderReceiptSha256。只有明确涵盖 final-review 的委托可使用 delegated。哈希改变后旧确认失效；按修改范围重新看图和讨论。

deliver 封装一致的 PPTX、讲稿、来源、实际预览、故事板与工程，不用草稿重命名代替。用户已请求导出，无需问“允许导出吗”；最终讨论针对作品本身。

## 恢复与兼容

恢复先用 context 读取具体 source / selected / userResponse / delegationTopics / finalReview，不凭主题名猜决定，不重问已有选择。旧工程无 workflowVersion 时保留原协议；v0.9.1 新建工程自动启用新协议，不得删除标记绕过要求。
