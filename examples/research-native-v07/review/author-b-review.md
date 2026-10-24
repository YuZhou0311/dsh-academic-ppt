# 作者 B 最终科学复核

**结论：通过。初稿发现的3项必须修正均已核实关闭；主要结果数值没有发现抄录错误。**

## 实际审阅范围

- 初稿完整视觉审阅：r12-ed772b60 / render-597ee0fb的全部15页PNG。
- 修订稿定点视觉审阅：r14-7ee69fca / render-28dda3bf的第1、6、8、11、12页PNG。
- 最终来源审阅：project r15的全部slide文字/讲稿、claims、papers、active assets及sources.mjs/slides.mjs。79个结果数值重新与原图/原表核对，全部一致。
- 最新z-design来源定位已核实为“§2.2–2.3 pp.5–6；§3.3 p.9”，project与sources.mjs一致。
- 未声称查看全部最终页，也未将r15来源记录视为另一次全稿PNG审阅。

## 已关闭问题

| 编号 | 初稿问题 | 修复与实际验证 |
|---|---|---|
| B-M01 · P1 | 第6页EnKF公式a/f上标显示缺字方框。 | r14第6页实际PNG已看，中文“分析SM=预报SM+K×(观测SM−预报SM)”清晰，科学意义与原Eq.13一致。 |
| B-M02 · P2 | z-design写“随机分半”，原文未说明随机。 | 最终claim改为“一半训练、一半验证；原文未说明随机”，且定位补全pp.5–6。 |
| B-M03 · P2 | 第11页RMSE数字缺少页面单位。 | r14第11页实际PNG已看，副标题补充“RMSE单位为kg/ha”，R²继续标原表%。 |
| B-O02 · P3 | 第12页“仅物候”等可能被理解为移除了基础输入。 | r14第12页实际PNG已看，明确“保留基线，增添一组”与“仅加…”标签。 |

另核第1页使用Zhuo单站轨迹，出处和用途明确；第8页重新标注的6000/8000/10000线性坐标与原始图8一致，全部原始点位、拟合线、1:1线与统计文字保留。

## 可选措辞优化

- “同田同季”可更精确为“同试验区同季”，避免将多个试验地块误听为一块田；验证范围限定已经正确。
- “生长季地下水位”可写为“生长季地下水埋深”，对应AvgWTInseason的物理定义；重要性轴本身无量纲。

## 已核验的科学内容

| 主题 | 核对结果 | 原文定位 |
|---|---|---|
| Cheng设计 | 小汤山2020–2021单季，15,709个5m×5m干重产量网格；随机9:1。39地面点用于波段选择，不能当作主结果测试量。 | §2.1–2.3，pp.3–7 |
| Cheng两个实验 | 四VI×九个月模型比较的LSTM RMSE为0.201 t/ha；独立的传感器实验为0.219、0.237、0.307 t/ha，不能合并。 | Fig.4 p.9；§3.2 p.9、Fig.6 p.10 |
| Cheng原文不一致 | 未把摘要“约5%”重复为0.307→0.237的相对RMSE降幅；四月日期差异已记入讲稿/来源。按印刷RMSE计算约22.8%属于推算，不是新增实验。 | 摘要；§2.2与§3.2 |
| Zhuo样本与状态 | 22站点×5样点=110；SM55/55与产量验证110分别表达。TDR0–10cm与WOFOST根区平均SM不完全一致。 | §2.2–2.3 pp.5–6；§4 pp.13–14 |
| Zhuo EnKF | 50成员、模型10%与观测7%扰动；观测出现时更新SM并返回WOFOST，产量由模型输出。 | §2.5–2.6 pp.7–8，Eq.13 |
| Zhuo结果 | RMSE1330→934 kg/ha、R²0.21→0.35；单站轨迹不替代区域验证，三期SM误差9.16%、7.43%、8.53%不作相对收益解释。 | Figs.5–6 p.11；Fig.8 p.12 |
| Shah设计与输入 | 293县、10,016县年、1984–2018；逐次留2012/2017/2018。原研究没有遥感输入，APSIM使用完整测试年天气。 | Methods pp.3–8；Discussion pp.12–13 |
| Shah常规与干旱年 | 2017 LightGBM 914→916 kg/ha的例外保留；2012全部11个混合R²为负，百分数单位与小数R²明确区分。 | Table2 p.9；Table3 p.11 |
| Shah消融与重要性 | Stacked regression 1040/906/837与RF1562/1208/1603 kg/ha正确。分组是加APSIM变量；置换重要性不等于因果。 | Table4 p.11；Figs.7–8 pp.12–13 |
| 归纳与新方案 | 不以跨论文绝对RMSE排总名次；新统一实验方案明确为尚未实施，不冒充原文结论。 | 本稿推理/方案记录及三篇原始设计 |

## 图件与科学复核边界

已核图件原始尺寸、图号、裁切范围、源文件SHA及工程嵌入字节一致性。图中散点、柱高没有重画或臆造；关键值与单位另以原生文字呈现。原图部分英文标签和刻度在投影尺度下仍然较小，本复核不等同于每一处原图小字都能从会场后排辨认。未重跑论文模型或数字化散点。

三篇书目作者、年份、标题、DOI均与原始来源一致；许可均为CC BY4.0。检查图注与版权声明后，未见所用主图另有特定第三方排除条款。原署名、来源与裁切/重标注说明应继续保留。

## 原始来源

- [Wheat yield estimation using remote sensing data based on machine learning approaches](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.1090970/full)，DOI 10.3389/fpls.2022.1090970。
- [Assimilating Soil Moisture Retrieved from Sentinel-1 and Sentinel-2 Data into WOFOST Model to Improve Winter Wheat Yield Estimation](https://www.mdpi.com/2072-4292/11/13/1618)，DOI 10.3390/rs11131618。
- [Coupling machine learning and crop modeling improves crop yield prediction in the US Corn Belt](https://www.nature.com/articles/s41598-020-80820-1)，DOI 10.1038/s41598-020-80820-1。

冻结时间：2026-10-23T14:37:08.883442+00:00。本文件仅涉及对应作者稿件，可单独转交。
