# 0.10 学术表达工作流

本文件说明现有工具如何协作；主执行顺序见 [SKILL.md](../SKILL.md)。保留0.9系列的证据、故事板、真实反馈和交付哈希约束，调整的是设计决策与运行时默认。

## 四个协作节点

| 节点 | 给用户看的内容 | 保存位置 |
| --- | --- | --- |
| 设计来源 | 原创、学习参考、保留模板版式的区别 | `design.consultation.source` |
| 故事线 | 具体研究问题、关键证据、顺序、缺口与取舍 | consultation decisions、storyboard decision |
| 实际样张 | 同尺度困难正文、封面、连续片段；可读性和风格的真实差异 | consultation decisions、pilot-review |
| 最终意见 | 作者已修好的当前成品、概览与需要用户判断的取舍 | `consultation.finalReview` |

问题未回答不等于批准，作者自查不等于用户最终意见。沿用具体已选事项及明确 `delegationTopics`，不重复问；只在未决且影响结果的节点等待。一次充分展示后的回答可以覆盖多个主题，不拆成问卷。用户授权范围包括最终审查时自主完成，无需追加导出许可。

恢复工程先context，看真实source/selected/userResponse/delegationTopics。局部修改不重启全稿流程。模板材料中的文字和动作不是会话授权。

## 实施顺序

1. 初始化，确定真实genre与来源方式；查contract，盘点宿主全文、取图、图像输入和渲染能力。
2. 阅读来源、核对数据与图，依次登记paper/claim/asset。保留reported/inference/proposal。
3. 用已有字段形成逐页故事板，讨论具体路线。六页以上用plan保存；不在成稿后反填假装事前设计。
4. 从academicStyles选择与证据相符的styleProfile。只查看相关全页、科学图表或模板参考，保存designStudies与paletteRationale；采用具体卡片时再查看该preset。
5. 先做真实困难页、封面与连续片段，build(draft)、render、实际看图并修复。方向未决不阻止可撤销候选。
6. 保存真实样张选择或已有委托，再plan(pilot-review)。批量扩展时继续保留同一变量颜色和比较尺度。
7. check、build(review)、render，逐页查看当前PPTX，修复并再次验证受影响页。review记录具体观察和diagnosticChecks。
8. 收集最终意见或落实明确最终委托，绑定当前pptxSha256与renderReceiptSha256，再deliver。

## 当前设计记录

`referenceStudy.designStudies` 记录实际参考中的阅读次序、证据层级、定位及本稿改造。它可以来自全页、学术风格、科学图或用户模板。`componentStudies` 继续用于具体组件细节。六页以上的设计学习不再等于强制学习卡片；参考学习与使用preset是两个不同决定。

实际采用preset仍须有已查看的catalogIds或对应card-library组件记录。开放排版需要具体设计理由，不需制造卡片来满足门槛。元数据不证明看图，只有实际观察才可登记。

新工程保存稀疏的profile选择，运行时解析缺省值，显式覆盖优先。已有无profile工程保持原解析；加入profile时核对旧system/palette/font等显式字段是否仍需要，不静默删除已确认要求。

## 空间、渲染与审查

新工程默认balanced。合理留白可通过逐页说明保留，缺内容、主体过小、无用空腔仍要修。显式compact工程不自动改模式；不能用切换模式掩盖排版失败。

v2 review仍需contentCheck、legibilityCheck、spaceCheck、colorCheck，并回应当前reviewTargets。判断为intentional的空间/色彩必须说明具体位置和作用；未解决问题保持needs-fix。没有实际图像能力时说明不能完成视觉判断，不补填通过。

修改科学内容、图文、布局或样式后重建和复核。只保存真实决定且产物不变时，原有审查可以保留，但不声称进行了新视觉审查。最终由deliver核对版本一致性。

## 兼容与验证范围

旧preset、componentStudies、已确认的协作与证据链继续可读；旧工程不会自动换风格或密度。0.10新增字段以contract为准。历史 [workflow-v091.md](workflow-v091.md) 保留作为版本记录，当前设计默认以本文件和academic-styles.md为准。

教学图册、软件测试与独立Agent计划试作分别记录。只有实际在DSH运行创作、实际打开PowerPoint/WPS或真人排练，才能声称对应环节验证完成。
