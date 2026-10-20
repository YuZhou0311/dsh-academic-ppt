# 设计机制参考

查阅日期：**2026-10-20 UTC**。

本文记录本次插件重构参考的一手文档与源码，以及适用于学术汇报的取舍。链接指向查阅时的主分支，后续可能变化；以下内容为原创归纳，不包含第三方代码或提示词原文。设计参考不等于功能验收，具体能力以本仓库实现和实际验证结果为准。

## 1. PPTAgent / DeepPresenter

**一手来源**

- [PPTAgent 技能入口](https://github.com/icip-cas/PPTAgent/blob/main/skills/pptagent/SKILL.md)
- [任务与页面源文件契约](https://github.com/icip-cas/PPTAgent/blob/main/skills/pptagent/references/task-contract.md)
- [运行核心与复审状态检查](https://github.com/icip-cas/PPTAgent/blob/main/skills/pptagent/scripts/pptagent_runtime/core.py)
- [DeepPresenter 论文](https://arxiv.org/abs/2602.22839)

**观察到的机制**：宿主 agent 研究并编写 HTML 页面，工具负责渲染、转换和交付检查。源文件与共享资源的哈希参与复审有效性判断；导出的 PPTX 另外检查。论文强调根据实际渲染结果修正页面。

**借鉴**：允许 agent 根据内容自主构图；将内容检查、页面截图检查、最终导出检查分别处理；页面修改后重新检查相关结果。

**不采用**：不把其完整 HTML 转换运行环境设为 DSH 插件的必需依赖，也不将“成功渲染”直接视为“视觉质量合格”。

**许可确认**：已读取仓库 [LICENSE](https://github.com/icip-cas/PPTAgent/blob/main/LICENSE)，为 MIT。

## 2. Presenton Template V2

**一手来源**

- [Template V2 架构与流程](https://github.com/presenton/presenton/blob/main/docs/template-v2.md)
- [可编辑内容 schema 生成实现](https://github.com/presenton/presenton/blob/main/servers/fastapi/templates/v2/schema.py)

**观察到的机制**：将内容与装饰分开，识别语义组件、可重复区域、文本容量和主题角色；用结构化约束限制文本、列表、表格及重复组容量。其模板生成路径会保持原稿结构并填充内容。

**借鉴**：组件应说明表达任务、必需信息、容量和可变维度；设计变量可统一管理。内容较多时需要调整组织方式，而不是无止境缩小字体。

**不采用**：不以克隆模板、选择槽位、填满固定卡片为默认创作流程。忠实复刻只适用于用户明确要求沿用原稿结构的任务。

**许可确认**：已读取仓库 [LICENSE](https://github.com/presenton/presenton/blob/main/LICENSE)，为 Apache-2.0。

## 3. MiniMax pptx-generator

**一手来源**

- [技能入口及主题对象契约](https://github.com/MiniMax-AI/skills/blob/main/skills/pptx-generator/SKILL.md)
- [颜色、字体、间距与组件样式](https://github.com/MiniMax-AI/skills/blob/main/skills/pptx-generator/references/design-system.md)

**观察到的机制**：页面模块共享主题接口；设计系统分别定义颜色、字体、间距、圆角与密度，使不同页面具有一致的视觉语言。

**借鉴**：稳定字体层级、语义颜色、边距和组件细节，同时允许页面关系、主视觉和信息区域按内容变化。

**不采用**：不强制固定五类页面、固定位置的页码徽章或产品界面式按钮；不把“先选视觉风格”置于学术论证组织之前。

**许可确认**：技能头部标注 MIT，且已读取仓库 [LICENSE](https://github.com/MiniMax-AI/skills/blob/main/LICENSE) 确认。

## 4. frontend-slides

**一手来源**

- [SKILL.md：密度、视觉探索与页面检查](https://github.com/zarazhangrui/frontend-slides/blob/main/SKILL.md)

**观察到的机制**：区分讲演型与阅读型密度，通过视觉预览比较方向，按需加载模板资料，并为自定义设计保留空间。文档提醒，单一溢出尺寸检查无法发现所有面板遮挡。

**借鉴**：将“充盈”解释为足够的证据、清楚的组织与丰富的层级；关键页可以比较不同构图；用截图检查真实阅读顺序与空间冲突。

**不采用**：不要求每次任务都停下来让用户挑三种风格；不默认采用复杂动画、氛围背景或为求新奇而更换字体。自主设计仍需服从学术场景与可读性。

**许可确认**：已读取仓库 [LICENSE](https://github.com/zarazhangrui/frontend-slides/blob/main/LICENSE)，为 MIT。

## 5. Anthropic pptx

**一手来源**

- [SKILL.md：内容、文件与视觉检查](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md)

**观察到的机制**：分别检查内容完整性、文件结构和实际页面图像，关注溢出、遮挡、页脚冲突、模板残留及字体替换造成的渲染差异。

**借鉴**：质量检查使用具体可观察的问题；源文件检查与实际渲染互相补充；检查重点页，也从整套页面观察一致性。

**不采用**：不把每页必须添加装饰视觉、大数字或固定背景节奏作为学术汇报规则；不直接复制该技能正文或脚本。

**许可确认**：技能头部标注 Proprietary；已读取技能专属 [LICENSE.txt](https://github.com/anthropics/skills/blob/main/skills/pptx/LICENSE.txt)，其使用受 Anthropic 相关服务协议约束。这里仅记录机制层面的参考，不将其作为开放许可代码来源。

## 对本项目的设计取舍

1. **先组织证据，再设计页面。** 页面先明确问题、主结论或解释任务、支持材料、信息关系与限制条件，再决定布局。
2. **模板默认提供设计语言。** 继承字体、配色和间距等变量；是否继承整页结构由任务要求决定。
3. **卡片数量随语义变化。** 可以采用不等大的证据区、图表与注释，也允许没有卡片；不能为了填槽补造内容。
4. **用适配程度判断原创性。** 评价构图是否帮助读者理解比较、流程或证据；不以机械的原创率或强制每页不同衡量质量。
5. **学术严谨与视觉创作分别约束。** 布局可以创新，事实、统计口径、单位、来源和结论边界必须有依据。归纳、推断与未验证假设应清楚区分。
6. **质量结论来自实际检查。** 可读性、内容完整性和导出结果需要验证；无法完成的检查应如实记录。

这些取舍针对本项目的学术汇报目标综合形成，不代表上述通用工具都提供了学术事实核验能力。
