# 视觉语言先于旧风格基底

新工程优先按 `design.artDirection` 选择structured/editorial/open，再用palette匹配任务和原图。其字体、页眉与组题签默认值覆盖旧styleProfile的默认值，用户显式system、字体和chrome仍优先。旧styleProfile只为兼容与语义起点。不要从下文“开放、无填充”推导出所有科研页面必须素白。详见 [visual-craft.md](visual-craft.md)。

# 学术风格：全稿规则与内容表达

先按用户参考和当前证据确定构图、层级与颜色职责，再选择可覆盖的运行时基底。六种方向是可覆盖的起点，名称不是学科标签，也不是质量等级。不要按页轮换方向。院校模板、用户具体参考和明确参数优先。

## 六种方向

| styleProfile | 适用情形 | 主要阅读方式 | 可执行特征与应避免的问题 |
| --- | --- | --- | --- |
| `research-seminar` | 会议、开放讨论、以一项发现为中心的报告 | 具体标题与开放大图，图旁直接解释关键比较 | 清楚的无衬线层级、轻导航、开放分组、轻表格；不把短讲做成口号与装饰图 |
| `thesis-defense` | 多项工作构成完整研究链条，需交代个人贡献 | 明确章节，研究问题与方法、证据和边界可追踪 | 稳定章节身份、正式题名与结构化表格；不把每段话加深色横条，不强制高密度 |
| `methods-whiteboard` | 理论、算法、作物模型、机制与推导 | 假设、符号、变换、验证逐步展开 | 开放画布、克制线条、公式与变量定义相邻；不用通用流程框掩盖真实计算或跳过关键推导 |
| `paper-club` | 文献精读、journal club、论文评议 | 原文多面板、放大局部、作者解释与汇报者评议分开 | 论文式题名、面板身份、边注与来源；不重画未知数据，不把整页论文截图缩到无法读数 |
| `evidence-synthesis` | 综述、多实验比较、分歧与稳健性讨论 | 矩阵、共同尺度、条件列与跨来源关系 | 三线表、稳定列对齐、明确可比性；不把不可比研究做成排行榜，不把综述变成逐篇简介 |
| `field-report` | 农业、生态、遥感、空间和时间研究 | 地点/年份/处理与实际观察共同定位 | 空间或时间对应、真实场景、共享图例与简洁注释；无空间数据不伪造地图，无实拍不生成“现场照片” |

运行时在 `academic_ppt_contract(topic:design).academicStyles` 返回实际默认值、适用条件及推荐。可编辑参数包括 `styleProfile`、`fontFamily`、`titleFontFamily`、`annotationFontFamily`、`tableStyle`、`system`、`chrome` 和 `palette`。以当前 contract 为字段依据，不根据本文猜测字段值。

## 实际应用

```json
{
  "styleProfile": "paper-club",
  "density": "balanced",
  "tableStyle": "three-line"
}
```

这个对象是 design 片段。新建工程或更新时通过受支持工具提交。profile 提供缺省值，显式字体、系统、配色或表格参数优先；旧工程没有 styleProfile 时保留原来的解析逻辑。改变 profile 后检查已有显式覆盖是否仍有意保留，不能声称只改一个 ID 就已完成视觉重设计。

字体角色是选择，不是强制外链依赖。`fontFamily` 负责正文，`titleFontFamily` 负责标题，`annotationFontFamily` 负责辅助注释。数学与代码需要真实字形支持；衬线标题可以用思源宋体/Noto Serif CJK，正文可用思源黑体/Noto Sans CJK 或实际安装的兼容字体。缺字体时选可用替代并查看实际PPTX，不以系统的字体名字存在就声称渲染无替换。

表格单独选 `three-line`、`ruled` 或 `banded`。这改变表格的规则线/表头处理，不改变科学字段，也不联动给其他内容加面板。

## 怎样观察一个好参考

看困难正文和连续片段，回答以下问题：

1. 听众首先看到什么？它是否正是本页要判断的证据或前提？
2. 图、表、条件、解释各占什么位置？比较是否同尺度？
3. 哪些界线是数据关系，哪些是文字分组？去掉装饰后关系是否仍清楚？
4. 标题、正文、变量、图注与来源怎样形成层级？
5. 哪个原则能迁移到本次材料，哪个效果依赖原参考内容而不能搬用？

需要设计研究记录时，用 `referenceStudy.designStudies` 保存 `source`、`referenceId`、`previewPath`、`readingOrder`、`evidenceHierarchy`、`adaptation`。支持 `page-recipe`、`academic-style`、`design-case`、`user-template`、`scientific-reference`。必须填写实际看过的文件/页面定位；目录名、截图路径或好听的形容词都不证明看过。旧 `componentStudies` 继续适用于具体卡片和边框细读。

不要为满足记录而下载无关模板。选择最有帮助的参考，写清本稿怎样吸收它。原生开放排版也可形成专业风格。

## 样张与全稿一致性

同内容比较时，两个候选保留同一结论、原图/数据、单位、必要条件和来源。若一个方向删掉误差、对照或局限，它不能作为更好的候选。

先看困难页能否讲清，再检查前后两页。全稿保持变量颜色、图例、字体角色与轴处理稳定；允许内容的关系改变布局。相同实验连续使用相同骨架有利于比较，不因重复次数强制换版。

当前审美学习入口是 [构图案例与迁移说明](design-cases/README.md)，由 `contract(design).designCases` 给出可读取的实际PNG路径。旧 [六类图册](academic-styles/index.html) 仅保留为兼容、数据及可编辑性测试，不能作为当前审美正样本。案例不是新枚举styleProfile，也不是待套用的整页模板；科学内容必须来自本次材料。
