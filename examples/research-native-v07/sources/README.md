# 论文来源、图像与许可

两稿使用以下三篇正式出版论文。完整作者表、版本日期、出版方 PDF 链接、PDF SHA-256 和许可原文分别保存在各篇 `provenance.json`，汇总见 [papers.json](papers.json)。PDF 物理页码从 1 开始；提取文本增加分页标识，便于核对。

| 论文 | 出版信息 | 来源记录与提取文本 |
| --- | --- | --- |
| Cheng, Enhui, et al. *Wheat yield estimation using remote sensing data based on machine learning approaches* | Frontiers in Plant Science 13:1090970，2022；[DOI 10.3389/fpls.2022.1090970](https://doi.org/10.3389/fpls.2022.1090970) | [版本与许可](cheng/provenance.json) · [按页文本](cheng/article-page-text.txt) |
| Zhuo, Wen, et al. *Assimilating Soil Moisture Retrieved from Sentinel-1 and Sentinel-2 Data into WOFOST Model to Improve Winter Wheat Yield Estimation* | Remote Sensing 11(13):1618，2019；[DOI 10.3390/rs11131618](https://doi.org/10.3390/rs11131618) | [版本与许可](zhuo/provenance.json) · [按页文本](zhuo/article-page-text.txt) |
| Shahhosseini, Mohsen; Hu, Guiping; Huber, Isaiah; Archontoulis, Sotirios V. *Coupling machine learning and crop modeling improves crop yield prediction in the US Corn Belt* | Scientific Reports 11:1606，2021；[DOI 10.1038/s41598-020-80820-1](https://doi.org/10.1038/s41598-020-80820-1) | [版本与许可](shahhosseini/provenance.json) · [按页文本](shahhosseini/article-page-text.txt) |

第三篇的正式发表年份为 **2021**，不根据 DOI 中的 `2020` 推断出版年份。三篇 RMSE 的单位、尺度和验证条件不同，不能直接比较数值排名。原文数据与应保留的内部不一致见 [科学来源笔记](scientific-source-notes.md)。

## 许可与修改说明

三篇论文采用 [Creative Commons Attribution 4.0 International（CC BY 4.0）](https://creativecommons.org/licenses/by/4.0/)。已检查所用主图图注和版权声明，未见具体图件另有第三方排除条款；这是对发表声明的核对，不是对全部上游材料所有权的独立鉴定。原图内地理底图等已有署名继续保留。

本包分发带页码的 PDF 提取文本和实际采用的 7 份完整源图像，原始 PDF 提供出版方下载链接与 SHA-256。图像以内容哈希存于 [assets](../assets/)；每次页面使用的图号、出版页码、来源 URL、许可、裁切和重标注说明见 [A manifest](../a/manifest.json) 与 [B manifest](../b/manifest.json)。不同 asset ID 可以引用相同源文件，但拥有不同显示视窗。

数据点、回归线、1:1 线和原始柱高未通过图像模型生成或改写。修改限于页面显示视窗、中文解释、经核验的原生数表与坐标标签。B 的 Zhuo Fig.8 以原始轴中心像素标定外部标签，详见 [坐标配准](../b/review/coordinate-calibration.json)；A 的来源页码和零刻度裁切修订见 [科学复核](../review/author-a-review.md)。

重新使用这些材料时请继续保留作者、论文、图号、来源和 CC BY 4.0 链接，并说明自己的改动。论文图与文本不适用插件代码的 MIT 许可；字体不在此包中分发。[仓库第三方说明](../../../THIRD_PARTY_NOTICES.md)
