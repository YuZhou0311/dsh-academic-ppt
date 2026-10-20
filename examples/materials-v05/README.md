# 材料工程研究进展：可移植公共样例

**本例来自 C4/r13 封存报告，已获独立科学与全部 10 页实际 PPTX 渲染的视觉审查接受：blocking 0、must-fix 0、optional 3。三个可选建议未用于改写原稿或成品。**

这是 10 页、讲稿预算 600 秒的教学模拟资料报告。原始资料是 protocol.md 与 48 件试件的 fatigue.csv；数据不代表真实实验、机构、项目或工艺结果。此目录保留封存记录和成品，路径迁移不构成一次新的模型制作。

## 查看内容

- `report.pptx`、`report.pdf`、`speaker-notes.md`：封存成品的逐字节副本。
- `analysis-explanation.md`：作者完整分析说明，原文保留。
- `overview.png` 与 `previews/page-0001.png` 至 `page-0010.png`：同一最终 PPTX 的实际渲染，没有重新制图替换。
- `deck.json`：仅含 title、brief、design、papers、claims、assets、slides 七个 authored keys。
- `inputs/`：原始公共教学方案与 CSV。
- `assets/`：原记录的精确 PNG 字节及当前两幅图的 SVG。
- `analysis/`：作者分析/绘图源码、精确统计结果、分组摘要和分析 stdout 数值记录。
- `manifest.json`：相对路径 → 字节数和 SHA-256；manifest 本身不列在 files 中。

## 内容等价与原始成品

七个 authored 字段均按封存工程保存。仅迁移 2 个论文 reading.source、3 个资产 sourceUrl 和 3 个资产 sourcePath 本地路径；3 个资产 data 转为 assets/ 的精确 PNG 文件。还原这些路径并重新编码相同字节后，整个七字段对象与封存原工程完全相同，包括全部设计、科学数值、claim、页面、顺序、notes 和图像阅读元数据。

旧 C-km 图未用于最终页面，但仍属于封存的 assets 数组；其 PNG 是重建该数组的必要文件，因此保留。没有额外打包该图的旧 SVG 或中间渲染。

原 PPTX 的第 3、5 页自动图源备注保留了本任务原制作位置的绝对工作区路径，指向教学 CSV。它是非敏感运行元数据，不含用户参考模板名称或私有研究内容；下载后不保证该原路径可打开。本目录不声称消除了原 PPTX 中全部绝对路径。portable deck 的对应 sourceUrl 已迁移为 `inputs/fatigue.csv`，原 PPTX 字节和哈希保持不变。

| 封存成品 | SHA-256 |
| --- | --- |
| report.pptx | `2e83d70d3fc676d36c000312c6187f44b5392b5a514367c36ba1f6efcb2fe990` |
| report.pdf | `f9d4ba280b23cc6ae4741ee4c38fe7e2574e3eb989a0e1613bda6b646344ae96` |
| speaker-notes.md | `e8d2d09f1226ca6cb5f35ac6237fe71ab40b6c201318e786c8ae4a9253e635c2` |

## 确定性重建

这里的重建是重新导入已经著述的记录。在安装好依赖的插件根目录运行 `npm run demo -- --output NEW_DIRECTORY`，入口会读取随包的 `examples/materials-v05`，按照 manifest.rebuildFiles 复制支持文件，经 recordsPath 批次创建新工程并 build。NEW_DIRECTORY 必须是工作目录内尚不存在的目录。该命令是固定记录重建；实际重建的验证记录见插件文档。

新工程具有独立状态，不继承原工程的视觉审阅或能力声明。入口将图像输入能力设为 unknown；需要实际渲染和重新查看才可对新产物判断。这里没有提供原插件副本、执行依赖、恢复 ZIP、原始用户视觉参考 PPTX、模板预览或私有审阅报告；现有 authored design 自身足以参与重建。

## 按原作者代码复算

作者代码没有改写。其位置由 `scripts/analyze.py`、`scripts/plot_revisions.py` 分别迁移为 `analysis/analyze.py`、`analysis/plot_revisions.py`；两者的 `Path(__file__).resolve().parents[1]` 仍指向本样例根目录。

作者记录的环境：Python 3.12.14、NumPy 2.3.5、SciPy 1.17.0、Matplotlib 3.10.8。Python 依赖版本列在 requirements.txt。字体不随包分发；在工作副本的 fonts/ 下准备 NotoSansCJKsc-Regular.otf、NotoSansCJKsc-Bold.otf。顺序为：

```sh
python analysis/analyze.py
python analysis/plot_revisions.py
```

首个脚本读取 inputs/，覆盖 analysis/statistics.json 与 group-summary.csv，再加载字体并创建/输出 figures/；若缺少字体，数值文件可能已经被重写。第二个脚本依赖这些结果与 figures/，生成当前两幅图。请在工作副本复算，保留本目录的封存文件。重新生成的图写入 figures/，不会自动替换 assets/ 中的封存图像；字节身份应以 manifest 为准。本次整理没有运行这两份作者代码。

原样保留的 analysis-explanation.md 仍引用制作时的 scripts/ 路径。其 analyze/plot 脚本按上表迁移；其中 verify_delivery.py、recover_project.py 与私有交付审计文件不在本公共样例中。固定记录重建使用上述公共 demo 入口。

## 可编辑对象范围

独立解析实际 PPTX 得到 10 页、10 页内嵌备注、322 个原生 shape、0 个 connector、4 个原生表格和 2 个图片。第 4 页 B 的点与区间为原生形状；第 3、5 页的科学图以 PNG 嵌入，图中标记不能全部在 PowerPoint 中逐点编辑，随附 SVG 与源码用于修改。PPTX 中没有原生 c:chart 部件、嵌入工作簿或独立嵌入字体文件。

## 许可和审计边界

LICENSE 沿用项目现有公共样例的 MIT License。原始教学输入、作者分析与图像的来源说明均保留；用户视觉参考作品不在此目录，也不由此获得分发许可。记录中的图像阅读说明和作者分析文档属于原著述内容，不等同于本次独立接受。本次独立接受覆盖科学内容及与上述 PPTX 哈希对应的全部 10 页实际渲染；文件整理者没有重复执行审稿。接受结果不改写原稿，后续确定性重建也不构成新的盲制作。
