# 证据、解释与材料身份

## 证据链

来源登记为paper，直接观察登记为reported claim；分析/方案分别用inference/proposal并通过dependsOn连接已有claim。页面的paperIds、claimIds、argument和可见文字必须指向同一研究。放一个引用ID不能授权任意扩写。

每条claim写具体locator、实验context、reasoning.warrant与reasoning.boundary。warrant说明从观察到结论的理由，boundary保留推断范围；inference另写alternatives。verified只表示执行者确已核查，不表示工具验证了科学真实性。不能为了构建设true。

定量metrics保留label、原始value、unit、baseline、denominator和aggregation。还要在context写实验单位、样本划分、重复/不确定性；未报告时如实标注。不要用“准确率”合并不同终点。

## 会改变结论的常见差异

| 材料事实 | 表达要求 |
| --- | --- |
| 多次成像来自同一批个体 | 区分独立样本与重复观测，不用图像数扩大样本量 |
| 模拟结果或合成数据 | 明示模拟/合成，不称实地或临床验证 |
| 各指标分别达标 | 不推成同一批样本联合达标 |
| 最佳值、均值或估读值 | 保留统计口径，不互换 |
| 基线得到不同信息或预算 | 不能将全部增益归因于方法结构 |
| 训练曲线更高 | 不自动推出留出集或迁移更好 |
| 没有显著性/不确定性报告 | 不能替作者添加显著性结论 |
| 描述性/定性资料 | 保留取样与解释方法，不伪造随机试验 |

上述是推理检查，不是可复制到新报告的研究事实。核心结果的值、单位和限定需要在最终页面或紧邻图注出现，不能全藏在备注。

## 原图与可编辑重绘

先实际看原图，再登记asset.reading的用途、类型、阅读任务、关键坐标/图例、查看者；无法看图则unverified。按 [figure-selection.md](figure-selection.md) 判断主证据的最终标签尺寸。不能按文件名或比例猜图意。

每张研究图保留paperId、figure/panel、caption、sourceUrl、sourceVersion、license、cropNote。displayCaption是简短页上读图提示，原始出处与完整图注仍保存。provenance区分source、author-created、template-demo；模板教学图不能作当前研究证据。

用本地PNG/JPEG path交给工具，保留原图比例。viewport局部视窗不能裁掉解释所需坐标、单位、图例、统计标记或关键对照。密集图必要时拆页，不能仅凭像素高认为投影可读。

只有取得可追溯数值才重绘图表，绑定sourceClaimId。特殊尺度、误差线或置信区间不受支持时保留原图，不能默默删除。概念机制可用可编辑节点，明确其为解释图。生成图片只能作非证据装饰，不能假作实验照片或科学结果。

## 版本与冲突

固定实际阅读版本。正式出版信息可以来自出版页，但结论指向实际读到的稿件；未核对正式版就保留该限制。正文、图注、附录、代码相互冲突时记下双方定位，不能只采用更漂亮的值。

论文、原图、模板、字体和代码许可分别处理；插件MIT不覆盖第三方材料。交付不能附原文时提供固定链接、阅读记录和获取说明，不放空文件或伪PDF。
