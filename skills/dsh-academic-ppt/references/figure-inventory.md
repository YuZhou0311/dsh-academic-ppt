# 下载清单 → 实际阅读 → 页面用途

本工具不联网、不发现未知文件夹、不评价图片语义。必须由Agent提供本次真实下载目录及已登记paperId。不要只指向最终采用图的临时目录，否则无法检查没有采用的原图。

在工作区写`inventory-request.json`，调用 `academic_ppt_plan({projectPath,expectedRevision,requestPath})`：

```json
{
  "kind": "figure-inventory",
  "sources": [
    {"paperId": "paperA", "directory": "sources/figures", "filenamePrefix": "A-"},
    {"paperId": "paperB", "directory": "sources/paperB"}
  ]
}
```

只扫描PNG/JPG/JPEG，最多160文件、4层目录；拒绝越界和符号链接。它输出每个文件的稳定inventoryId、字节哈希、像素尺寸、绝对路径、缩略总览与inventory.json，并保存工程快照。更新后使用返回revision。格式不支持的原图先用现有合法工具转换，并保留原始出处，不伪装扩展名。

从返回清单复制真实ID到对应paper记录的figureReview.candidates：

```json
{
  "figure": "Fig. 2b",
  "locator": "已核对的文章图号及面板",
  "caption": "从实际图注核对的内容；未取得则直说未取得",
  "captionStatus": "verified",
  "inventoryId": "从返回结果复制的真实ID",
  "decision": "selected",
  "assetId": "已登记的本篇真实资产ID"
}
```

这是**候选条目片段**，不是独立record API。原paper的必需字段、sourceCheck、figureReview.checkedSources等仍按contract(paper)提交。也可以用实际localPath或已登记assetId的SHA关联；使用inventoryId最明确。校验不允许把已下载文件再写成decision=unavailable。

captionStatus有verified/partial/unavailable。decision有selected/not-used/pending；unavailable仅对应未成功取得的候选。没有图注但下载成功时，继续获取图注、检查图内标签和正文；确实无法解释则not-used并说明哪项语义无法核定。不要把缺图注变成可自由编造机制的许可。

筛选时问：这幅图展示研究对象、方法结构、对照、时序、分布、权衡还是外部验证？全稿哪些页面会需要？一页不适合不等于全稿没用途。只用Graphical abstract而忽略已有结果图时，重新检查论证是否只停留在方法介绍。多个面板同属一项论证可以成组；不需要每张单独一页。

`context/check/build`会返回获取数、selected数、not-used数、pending数与原因。这里统计文件记录，不是去重后的科学证据数量；asset实际上页另外检查。下载清单完整不等于语义核实，逐图写了原因也不保证判断好。没有任意图片数量或占幅配额；必要证据优先，不能用装饰图冲数量。
