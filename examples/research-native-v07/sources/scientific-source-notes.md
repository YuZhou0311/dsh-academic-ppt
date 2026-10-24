# 三篇论文原始材料包：来源核对与证据索引

本包只整理原始论文、图表、可核验数值和阅读注意事项，不提供汇报结构。页码均为官方 PDF 从 1 开始的实际页序，三篇主文印刷页码与实际页序一致。主文 PDF 与出版社 HTML 均已完整保存；`article-page-text.txt` 按页分隔，公式、双栏或表格的纯文本可能失真，应回看 PDF / 原图。

## 使用入口

- 每篇论文目录中的 `manifest.json`：完整作者、DOI、年份、期刊、许可、每张图的原始尺寸 / SHA256 / 来源链接 / 页号 / 图注 / 推荐文件。
- `captions.md`：官方英文图注，附图号和 PDF 页码。图注未被画进原图时，应在汇报中另加必要说明。
- `figures-contact-sheet.jpg`：8 张主图的快速视觉索引，仅用于选图，不能代替高分辨率原图。
- `figures/`：真正可嵌入汇报的主图。使用 `manifest.json` 的 `preferred_file`。
- `tables/`：原始表格结构与逐行数据；Shahhosseini Table 2–4 还提供按字段规范化的 CSV。**CSV 的 R² 字段沿用原表的百分数单位**，例如 56.2 表示 R² = 0.562。
- `table-crop-manifest.json`：8 张表格 PDF 裁切的页号、坐标、DPI 与 SHA。均来自真实 PDF，保留表题与原始数据。
- `source-manifest.json` 与 `SHA256SUMS.txt`：下载源文件与所有材料的校验信息。

## 1. Cheng et al. (2022)

**正式文献**：Cheng, E.; Zhang, B.; Peng, D.; Zhong, L.; Yu, L.; Liu, Y.; Xiao, C.; Li, C.; Li, X.; Chen, Y.; Ye, H.; Wang, H.; Yu, R.; Hu, J.; Yang, S. *Wheat yield estimation using remote sensing data based on machine learning approaches*. **Frontiers in Plant Science 13**, 1090970 (2022). DOI: **10.3389/fpls.2022.1090970**。正式发表于 **2022-12-23**。

- [出版社主文](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.1090970/full)
- [官方 PDF](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.1090970/pdf)
- [官方 JATS XML](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.1090970/xml)
- PubMed / PMC 标识：PMID 36618627；PMCID PMC9816798。PMC 本次返回浏览器检查页，**未将其视为论文全文**；所有可用内容来自出版社。

### 原文实验设计

- 研究区为北京小汤山冬小麦试验地。主文 §2.1，PDF p.3；布局见 **Fig.1，p.3**。
- 2020–2021 生长季；文中给出 2020-10-07 播种、2021-06-16 收获。收集 **15,709 个 5 m × 5 m 网格干重产量记录**，范围 **1.39–6.75 t/ha**。另有 **39 个地面样点**用于高光谱波段选择及管理因素分析。§2.2.1–2.2.2，pp.3–4。
- Sentinel-2：研究期共 **99 景**，剔除云量超过 30% 的影像，再按 2020-10 至 2021-06 的 **9 个月**计算植被指数月均值。§2.2.2 / §2.3.1.2，pp.4–5。
- ZY-1 02D：166 个波段，30 m 分辨率，4 景影像。数据描述段列出的日期为 **2021-03-24、03-30、04-08、05-01**。§2.2.2，p.4。**§3.2 的时序日期又写为 03-24、03-30、04-28、05-01；4 月日期存在原文内部不一致，报告不应默默统一。**
- 常规指数为 **EVI、SR、NDWI、REP**；公式见 **Table 2，p.5**。模型比较使用 4×9 时序输入；RF / GBDT / SVR 将其展平为 36 维向量。§2.3.3.2，p.7。
- 原文写全部特征—产量样本随机按 **9:1** 分为训练与测试。§2.3.3，p.6。其 RF 段另将留出样本称为 OOB，文字表达有歧义；不能据此自行补写成空间外推、跨年验证或标准随机森林袋外协议。
- LSTM：两层各 100 个神经元、dropout 0.3、L2 正则，学习率 0.001、batch size 64、700 epochs。RF：150 棵树、random state 200；GBDT：1250 棵树、subsample 0.6、learning rate 0.1；SVR：RBF 核、C=10⁵、gamma=0.5。pp.6–7。
- 解释分析使用置换特征重要性 PFI，工作过程为 **Fig.2，p.6**。高光谱自定义双波段指数及相关性见 **Table 3，p.11；Fig.7，p.12**。

### 可直接引用的原始结果

下面数值按原始 **Fig.4，PDF p.9** 图内标注逐项核验；摘要 p.1 的 RMSE 与之相符。所有 RMSE / MAE 单位为 t/ha。

| 模型 / Fig.4面板顺序 | R² | RMSE | MAE |
|---|---:|---:|---:|
| LSTM / 左上 | 0.930 | 0.201 | 0.1413 |
| RF / 右上 | 0.886 | 0.260 | 0.1750 |
| GBDT / 左下 | 0.839 | 0.306 | 0.2199 |
| SVR / 右下 | 0.573 | 0.489 | 0.2467 |

下面是另一组传感器 / 分辨率实验，来自 **Fig.6，PDF p.10**；不能与 Fig.4 的模型比较混为同一实验设置。

| 数据源 / Fig.6面板顺序 | R² | RMSE (t/ha) | MAE (t/ha) |
|---|---:|---:|---:|
| 10 m Sentinel-2 / 左 | 0.914 | 0.219 | 0.1563 |
| 30 m ZY-1 02D / 中 | 0.902 | 0.237 | 0.1638 |
| 30 m Sentinel-2 / 右 | 0.847 | 0.307 | 0.2128 |

### 原文与报告推算应分开的地方

- 摘要将 0.307 → 0.237 t/ha 描述为“约 5% 改善”。**按这两个 RMSE 直接计算的相对降幅为 (0.307−0.237)/0.307 = 22.80%**；R² 的差则为 0.902−0.847=0.055。不要把原文“约 5%”解释成已验证的 RMSE 相对下降。可只报告原始数值，或明确标注“依据原文数值计算”。
- LSTM 相对 RF 的 RMSE 降幅 **22.69%**，相对 SVR 为 **58.90%**，也属于报告者推算，而非额外实验结果。
- 原文 §3.1 将 R²=0.886 的模型描述为“神经网络”，但 **Fig.4 图注明确该面板为 RF**。本包数值表按 Fig.4 图注标识模型，未沿用该处文字误称。
- 此研究的随机网格留出，不直接证明跨地区或跨年份泛化能力。相邻网格相关性可能使误差估计比空间独立验证乐观；这是对实验设计的分析，不是论文新做的检验结果。
- Fig.8 的管理因素分组柱图没有提供逐组原始产量表；不得将目测柱高写成精确数值，也不应将观察关联改述为普适因果结论。

### 主图定位与原件

| 图 | 页 | 内容 | 推荐资产 |
|---|---:|---|---|
| 1 | 3 | 研究区与观测产量布局 | `cheng/figures/figure-01-pdf-original.png` |
| 2 | 6 | PFI过程 | `cheng/figures/figure-02-pdf-original.png` |
| 3 | 8 | 四模型产量空间分布 | `cheng/figures/figure-03-pdf-original.png` |
| 4 | 9 | 四模型散点验证与误差 | `cheng/figures/figure-04-pdf-original.png` |
| 5 | 10 | 三传感器设置的产量空间分布 | `cheng/figures/figure-05-pdf-original.png` |
| 6 | 10 | 三传感器设置的散点验证 | `cheng/figures/figure-06-pdf-original.png` |
| 7 | 12 | 双波段指数相关性热图 | `cheng/figures/figure-07-pdf-original.jpeg` |
| 8 | 13 | 播种、耕作、施肥、灌溉分组 | `cheng/figures/figure-08-pdf-original.png` |

这些推荐图是从出版社 PDF 原始嵌入图像流提取的完整图，尺寸最高 4016 px 宽；未重新绘制数据、插值、改色或裁掉坐标。Fig.2 在 PDF 中本来只有 736×360 px，未做虚构的高清增强。官方网页 WEBP 另存为备用，其 URL 与 SHA 也在 manifest 内。

## 2. Zhuo et al. (2019)

**正式文献**：Zhuo, W.; Huang, J.; Li, L.; Zhang, X.; Ma, H.; Gao, X.; Huang, H.; Xu, B.; Xiao, X. *Assimilating Soil Moisture Retrieved from Sentinel-1 and Sentinel-2 Data into WOFOST Model to Improve Winter Wheat Yield Estimation*. **Remote Sensing 11(13)**, 1618 (2019). DOI: **10.3390/rs11131618**。正式发表于 **2019-07-08**。

- [出版社主文](https://www.mdpi.com/2072-4292/11/13/1618)
- [官方 PDF](https://www.mdpi.com/2072-4292/11/13/1618/pdf?version=1562581027)
- [官方补充 PDF（接口 s1，已下载）](https://www.mdpi.com/2072-4292/11/13/1618/s1)

### 原文实验设计

- 河北衡水市，11 县、总面积 8815 km²，冬小麦—夏玉米轮作。§2.1，p.3；**Fig.1，p.4**。
- 2017 年 3–6 月开展地面观测。每县 2 个站点，共 **22 个站点**；每站在 100 m×100 m 区域内设置 **5 个 1 m×1 m 样点**，共 **110 个样点**。§2.2，p.5。论文 §2.3 又称其为“110 field experimental sites”，报告宜区分站点和样点两个层级。
- 土壤含水量用 TDR 测量 **0–10 cm**；产量由 1 m² 取样、干燥后干重除以面积得到。p.5。
- Sentinel-1 的 VV 后向散射和入射角，结合 Sentinel-2 的 NDVI，输入 **Water Cloud Model** 反演土壤含水量。110 样点一半训练、一半验证：**55 / 55**。§2.3，pp.5–6。
- 三次土壤水分观测对应 **2017-04-01、05-07、06-01**。时间表见 **Fig.2，p.4**；三期反演验证见 **Fig.5，p.11**。
- WOFOST 使用水分限制模式，采用已校准的作物与土壤参数。以土壤水分为状态变量，使用 **EnKF** 对 **10 m 冬小麦像元**同化。集合规模 **50**；模型土壤水分施加 10% 高斯扰动。§2.4–2.6，pp.6–8。完整同化流程为 **Fig.3，p.8**。
- 产量以 **110 个地面样点**验证；不要将“55 个 SM 验证点”误写成产量验证样本量。§3.3，p.9。
- 补充 PDF 为 3 页，含 **Table S1 土壤参数、Table S2 作物参数**。已经保存 `supplementary.pdf` 与按页文本。

### 可直接引用的原始结果

反演土壤水分的验证结果，**Fig.5，p.11；正文 §3.1，p.9**：

| 日期 | R² | 原文 RMSE（SM 百分数尺度） |
|---|---:|---:|
| 4月1日 | 0.45 | 9.16% |
| 5月7日 | 0.53 | 7.43% |
| 6月1日 | 0.49 | 8.53% |

原图以含水量百分数为坐标，RMSE 单位应保留原文尺度；不要误称为“相对误差下降百分比”。

产量估计结果，**Fig.8，p.12；摘要 p.1；讨论 p.13**：

| 设置 | R² | RMSE (kg/ha) |
|---|---:|---:|
| WOFOST，无同化 | 0.21 | 1330 |
| WOFOST + EnKF 同化 SM | 0.35 | 934 |

**报告者推算**：RMSE 绝对下降 396 kg/ha，相对下降 **29.77%**；R² 增加 **0.14**，不能写成“准确率提高14%”。Fig.7（p.12）提供同化前后产量分布；Fig.6（p.11）展示一个深州县样点的土壤水分动态。

### 原文明确的限制

§4.1–4.2，pp.13–14：SM 反演误差仍大；仅三期观测限制更新频率；有限集合规模产生协方差采样误差；**0–10 cm 表层观测与 WOFOST 根区平均含水量不完全一致**；灌溉处理简化；水云模型依赖地面标定，区域推广困难。原文还指出产量取样未考虑 yield breakdown rate，可能高估实测产量。

另一个需谨慎的原文内部差异：§3.2 p.9 先按 DOY **95、110、130** 描述灌溉，随后又写为 **3月30日、4月20日、5月12日**。这不是完全对应的日历换算；报告不需要复述具体灌溉日期时可省略，需复述时应标示不一致。

### 主图定位

Fig.1 研究区 / p.4；Fig.2 采样与遥感时序 / p.4；Fig.3 同化流程 / p.8；Fig.4 三期 SM 地图及22站点 / p.10；Fig.5 55个点 SM 验证 / p.11；Fig.6 水分轨迹 / p.11；Fig.7 产量空间分布 / p.12；Fig.8 110样点产量验证 / p.12。全部官方 `data-original` PNG 存为 `zhuo/figures/figure-01.png` 至 `figure-08.png`，未裁切或重画。

## 3. Shahhosseini et al. (2021)

**正式文献**：Shahhosseini, M.; Hu, G.; Huber, I.; Archontoulis, S. V. *Coupling machine learning and crop modeling improves crop yield prediction in the US Corn Belt*. **Scientific Reports 11**, 1606 (2021). DOI: **10.1038/s41598-020-80820-1**。正式发表于 **2021-01-15**。DOI 中的 2020 不能替代实际出版年份。

- [出版社主文](https://www.nature.com/articles/s41598-020-80820-1)
- [官方 PDF](https://www.nature.com/articles/s41598-020-80820-1.pdf)
- [Table 1](https://www.nature.com/articles/s41598-020-80820-1/tables/1) · [Table 2](https://www.nature.com/articles/s41598-020-80820-1/tables/2) · [Table 3](https://www.nature.com/articles/s41598-020-80820-1/tables/3) · [Table 4](https://www.nature.com/articles/s41598-020-80820-1/tables/4)
- [官方补充 DOCX](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41598-020-80820-1/MediaObjects/41598_2020_80820_MOESM1_ESM.docx)
- PubMed / PMC 标识：PMID 33452349；PMCID PMC7810832。PMC 返回浏览器检查，正文采用出版社资料。

### 原文实验设计

- 玉米，**Illinois、Indiana、Iowa** 三州；最终 ML 数据集为 **293 县、10,016 条县—年观测、1984–2018 年**；598 个变量包括目标产量。§Materials and methods，p.4。
- APSIM 玉米 v7.9；pSIMS 框架输出聚合到县；加入 **22 个 APSIM 变量**，完整清单在 **Table 1，p.4**，包括作物产量、生物量、物候、水分胁迫、地下水位等。
- 目标是比较相同 ML 模型在**无 APSIM 输出**与**加入 APSIM 输出**时的结果。Fig.1，p.2，为原始概念框架；**实测产量是 ML 监督目标，不是 APSIM 的直接输入**，但原文图注指出产量间接用于检验与改进作物模型。
- 5 个基础模型：线性回归、LASSO、LightGBM、RF、XGBoost；6 个集成模型：平均、优化加权，以及4个 stacking。pp.6–8。
- 2012、2017、2018 分别留作测试年，其余年份训练。2017/2018 为正常至偏湿年，2012 为极端干旱年。p.4。调参使用随机十折交叉验证与20次 Bayesian search；两阶段特征筛选最终保留80个特征。p.6。
- **研究属于使用完整测试年天气的回顾性产量预测评估**；原文 p.12 明确 APSIM 已使用当年全季天气，实际提前预报需处理天气未知所增加的不确定性。留一年测试不等于严格使用过去年份预测未来年份；报告应保留这一区别。

### 常规年份原始结果（Table 2，PDF p.9）

| 测试年 / 模型 | 基线RMSE (kg/ha) | 混合RMSE (kg/ha) | 原表RMSE下降 |
|---|---:|---:|---:|
| 2018 LightGBM | 1067 | 883 | 17.3% |
| 2018 优化加权集成 | 1033 | 909 | 12.0% |
| 2018 平均集成 | 959 | 938 | 2.2% |
| 2018 Stacked LightGBM | 1365 | 995 | 27.1% |
| 2017 平均集成 | 859 | 762 | 11.3% |
| 2017 LASSO | 835 | 771 | 7.6% |
| 2017 LightGBM | 914 | 916 | **−0.2%** |

- 原文摘要概括“7–20%”与 **Fig.4（p.10）跨2017/2018平均**的改进相对应；单年份、单模型可以大于这个范围，也有一个略微退步的例外。
- **不能写“所有模型每一年都改善”**。Table 2 的 2017 LightGBM 从914上升至916 kg/ha。
- 2018 的最低基线RMSE为平均集成959，最低混合RMSE为LightGBM883；跨模型最佳值比较的相对降幅由这些数值计算为 **7.92%**，不应与同一模型17.3%的降幅混用。
- Fig.5（p.10）为2018年选定模型基线/混合的散点密度图，已保留原图。原表所有模型、RRMSE、MBE、R²数据在 `tables/table-02-normalized.csv`。

### 极端干旱年与变量贡献

**Table 3，PDF p.11，2012年**：

| 模型 | 基线RMSE (kg/ha) | 混合RMSE (kg/ha) | 原表下降 | 混合R²（原表以%表示） |
|---|---:|---:|---:|---:|
| LightGBM | 3245 | 2608 | 19.6% | −17.5% |
| Stacked regression ensemble | 3398 | 2545 | 25.1% | −12.0% |
| Linear regression | 4869 | 2784 | 42.8% | −34.0% |
| Random forest | 3782 | 3591 | 5.0% | −122.9% |

- 正文 p.8 总结干旱年 RMSE 降低约5–43%；最佳基线3245与最佳混合2545比较，推算相对降幅 **21.57%**，原文四舍五入写22%。
- **所有混合模型的2012年R²仍为负值**，说明改善并未解决极端年份预测失效；p.12讨论也明确指出两类模型都无法充分预测2012干旱年。
- **Table 4，p.11** 为仅加入物候、作物、水土天气三类变量的消融。对 stacked regression，2018年RMSE依次 **1040、906、837 kg/ha**；RRMSE依次 **8.5%、7.4%、6.8%**。不要将这一行推广成每一个模型的组别排序；例如 RF 的水土天气组较差。
- **Fig.7，p.12** 表明人工构造的产量趋势特征在全部输入中重要性最大；**Fig.8，p.13** 聚焦APSIM变量，其中平均干旱胁迫、平均生长季地下水位深度最突出。两张图的“变量总体”不同，不能混为同一个重要性排名。
- 特征重要性表示模型依赖关系，不是因果效应大小。原图未提供每根柱子的精确底层数据，本包未凭图估造小数。

### 主图与补充材料

Fig.1 概念框架 / p.2；Fig.2 APSIM州级模拟核验 / p.3；Fig.3 年际产量趋势 / p.5；Fig.4 常规年平均模型误差 / p.10；Fig.5 2018散点密度 / p.10；Fig.6 分组输入消融 / p.12；Fig.7 全输入重要性 / p.12；Fig.8 APSIM输入重要性 / p.13。官方 full-size PNG 全部保存为 `shahhosseini/figures/figure-01.png` 至 `figure-08.png`。

补充 DOCX 原件与 `supplementary-text.txt` 已保存；其中包括测试年统计量和补充图。提取文字不含Word分页承诺，精确引用补充图表请回看原DOCX。

## 许可与署名

三篇均在出版社原文明确提供 **CC BY 4.0**：<https://creativecommons.org/licenses/by/4.0/>。原文版权段已保存于每篇 `manifest.json` 的 `license_evidence`，并可在PDF核验：Cheng p.1；Zhuo p.17；Shahhosseini p.15。

已核查主文图注与版权声明，没有发现这24张主图中单独标注“不适用CC BY”的第三方材料。Shahhosseini 的许可声明特别规定：图片及第三方材料适用该许可，除非另有署名/说明排除。此检查是对发表时声明的核对，不能替代对上游底图、数据来源所有权的独立保证。保留原图内的来源和地图标记。

图页推荐署名信息：`来源：Cheng et al., 2022, Fig.4, Front. Plant Sci., DOI:10.3389/fpls.2022.1090970, CC BY 4.0；原图完整引用。` 另两篇按实际作者、年份、图号、期刊、DOI替换。若在后续汇报中进行面板裁切、框选或中文标注，应说明该修改，保留原轴、图例和数据，且另记裁切范围。

本包主图无裁切、无重绘、无生成数据。表格裁切属于直接PDF区域渲染，详细坐标见 `table-crop-manifest.json`。图文索引中的缩略图仅供浏览，不能作为最终汇报资产。
