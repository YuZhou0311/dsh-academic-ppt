# rc.8：36款原生卡片与参考设计入口

## 1. 卡片是内容组件

36种配方覆盖问题、方法、证据、指标、条件和进展。每种配方由外框、题签和内部内容组织共同构成，区分浮签、折角、侧签、编号、成组指标、输入输出、证据追踪、观察解释分层、条件分支等关系。它们不决定整页布局；图表、表格、流程与开放文字继续按逐页设计稿组织。

通过 `academic_ppt_cards({family:"metric"})` 查看指标家族，再用 `academic_ppt_cards({presetId:"metric-dual"})` 获取准确字段、建议尺寸和示例。`purpose` 是用途文本筛选，未匹配时改看家族或完整索引，不把它当语义搜索服务。

[离线图册](../skills/dsh-academic-ppt/references/card-library/index.html)含36张由同一渲染器产生的卡片预览、搜索、家族筛选和可展开示例。[单卡清单](../skills/dsh-academic-ppt/references/card-library/catalog.json)可供工具读取。图册内容为设计示例，实际报告须重新填写真实来源和内容。

记录卡片时使用以下结构，示例数字仅说明字段：

```json
{
  "id": "validation-readouts",
  "kind": "result",
  "preset": "metric-dual",
  "title": "两个独立终点",
  "body": "按各自分母解释，不合并为联合达标率。",
  "items": [
    {"label": "指标甲", "value": "待计算", "unit": "按实际单位", "detail": "写明对象、分母和评价窗口。"},
    {"label": "指标乙", "value": "待计算", "unit": "按实际单位", "detail": "分别报告其实际口径。"}
  ],
  "note": "在正式汇报中补齐已核实的数值与限定。",
  "claimIds": []
}
```

`items`最多6条，每条保留 `label/value/unit/detail`。`badge`用于短编号或阶段标记，`note`保留限定说明。完整内容参与测量和学术检查，不自动截断、计算指标或推断因果。推荐条目数是选型提示；超出时保留内容并提醒重新组织。

`preset`拥有内部几何；它不继承旧 `cardDefaults`，也不叠加 `style` 或模板组件。仅以 `appearance.padding/radius/elevation` 微调兼容细节，以 `card.accent`设置强调色。旧卡片没有 `preset` 时仍走原路径；新增结构字段要求同时提供 `preset`。`card-style`编辑可更换预设，但文字、指标、单位、注释和非目标对象保持锁定。

### 参考后的自主适配

卡片库提供可组合的设计起点。Agent须先判断本次题名长度、信息量、指标与限定的对应关系，再决定保留、合并、拆分或重排区块；不把示例槽位当作内容上限，也不要求每张卡为求不同而变形。

- 配色：自主编辑`design.palette`，用`design.colorRoles`保持全稿色义，`card.accent`承担局部强调。参考图已有颜色不自动固定本稿配色。
- 尺寸和留白：按完整内容调整卡片`box`、组合区域与受支持的`appearance`字段，不为了沿用示例比例删条件或缩小正文。
- 内部结构：需要不同列宽、题签位置、信息分区或单卡底色/文字色时，用原生`drawings`与`composition.regions`重新设计。预设内部recipe固定，不能用不支持的参数覆盖。

准备工具在所有分支返回`designAdaptation`，并将两条设计路径、配色策略和原生回退说明写入宿主可见文本。生图提示同步说明`preferredPresets`只是候选灵感，可按当前内容重新安排比例和分区。

准备请求可用`paletteMode:"adaptive"`（默认）将`palette`作为可修改的候选色；只有用户明确固定这些颜色时使用`paletteMode:"fixed"`，并同时提供`palette`。颜色调整需保持文字对比、比较尺度和真实图表色义。白字band/notch标题需深色强调；浅色题签配深字可用原生绘制，当前没有任意自定义颜色的自动修复保证。

将重要适配理由简记在`design.direction`或`visualPlan.rationale`。例如两个终点有不同分母时，分别保留读数与解释，将共同前提放到共享条件区；这由实际信息关系决定，而不是照着参考的卡数与位置填字。

## 2. 模板问题只在意向未知时提出

先用 `academic_ppt_contract({topic:"preparation"})` 获取完整准备请求。将请求保存为工作区JSON，再调用：

```json
{"requestPath":"design-preparation.json","outputPath":"design-preparation-plan.json"}
```

这是 `academic_ppt_prepare` 的参数。它返回下一步计划，宿主负责实际向用户提问、接收附件和调用已提供的工具。

| 用户状态 | 请求记录与行为 |
| --- | --- |
| 未明确是否有模板 | `template.status="unasked"`，返回一次模板问题与选项 |
| 已上传PPTX | `provided`及工作区`localPaths`，返回`academic_ppt_template`解析与实际渲染参数 |
| 已说没有模板 | `none`，继续当前流程 |
| 已问但未回复 | `unanswered`，继续当前流程，不重复提问 |
| 用户稍后上传 | `awaiting-upload`，先进行已有材料工作，附件可用后更新记录 |

已有附件或现有会话中已确定偏好时直接复用，不为了执行流程再次问。上传由宿主界面完成，插件使用其提供的真实本地路径，不扫描其他文件。`.pptx`由已有解析器处理；旧`.ppt`需要可用工具转换或由用户另存为`.pptx`。

宿主实际研究模板后可写入 `template.review`，包含真实 `profilePaths`、看图后的 `visualObservations` 和可选 `renderReferences`。准备工具核对profile格式与当前PPTX的SHA256，避免反复提取未变化模板；文件改变时重新研究。记录不会声称插件本身看过图像。

通常采用 `reference-guided`：学习比例、题签、局部分组、内容密度和配色角色，依据当前内容重新创作。只有用户明确希望沿用版式时选择 `template-faithful`。原文、机构、旧数据和无关图片不自动移植。

## 3. 有生图工具时优先生成内容参考

准备请求的 `imageGeneration`记录宿主已经核实的能力和来源；图像输入能力与生图能力不同。`available`须指定真实的`toolName`，不能仅凭模型名称猜测。`cards`填本次的完整标题、正文、指标槽位、来源说明和内容状态。

工具按本次主题、听众、内容和候选配色生成 `imageGeneration.batches`，每批至多4个内容单元，各有独立提示词。单批同时提供`prompt`以便调用。提示词约束保留单位、分母和边界，生成的是小卡片设计参考，不是科学证据图。

宿主按生图工具自己的参数契约实际调用，查看生成结果，再回填 `status="generated"`、`resultReferences`和`visualObservations`。随后把选中的组织方式依据原始内容重建成原生文字与形状，继续逐页叙事、渲染与检查。不能将生成图当作精确图表或最终可编辑对象。

| 能力或结果 | 处理 |
| --- | --- |
| 可用，内容已写好 | 返回宿主生图调用计划与分批提示 |
| 可用，尚无具体内容 | 先写卡片内容，再生成参考 |
| 未知或不可用 | 说明能力状态，使用36款原生库继续 |
| 生成失败 | 保存原因，回退原生库 |
| 用户不想使用生图 | 记录`declined`并继续原生设计 |
| 已生成并实际看图 | 保存观察，以原生对象重建 |

插件没有内置云生图服务，不读取密钥，不向任意endpoint发请求。可用性来自宿主实际提供的接口。参考生成失败不阻断没有此依赖的制作步骤。

## 4. 检查和复现

`npm run cards`重建随包的SVG、清单和离线图册。生成18页原生PPTX（每页两款）与真实渲染：

```sh
node scripts/build-card-library.mjs --deck-output .test-output/card-atlas --render --font-dir /absolute/font/directory
```

每一款采用真实文字测量，尊重工程的正文/标签阅读政策。说明过长时扩大卡片、改变分组或拆开任务，不通过装饰占幅或缩字绕过检查。外观丰富不代表必须增加框的数量；同一任务保持一致有助于比较。完整验证范围见 [本轮验证](VALIDATION_V07_RC8.md)。
