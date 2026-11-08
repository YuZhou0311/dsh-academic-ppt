# 当前构图案例入口：学决策，不套整页

前四页来自用户反馈方向较好的十二页版面实验中完全原创的结果页。全部是同一套明确标记的教学构造数据；没有携带用户上传稿件的原图、截图、Logo、模板或字体。rc.3另加两页完全原创的闭环方法、多面板组织教材；它们只是教学示意，不是用户已认可的效果，也不是实际论文结果。rc.5补充共享指标的弱稿/改稿对照与方法—验证两种关系，明确教授题签、字级、色面和收紧高度。仍不能声称覆盖所有学科。

| 案例 | 阅读关系 | 实际预览 | 设计解释 |
| --- | --- | --- | --- |
| shared-scale | 汇总图与原始数值并列 | [PNG](shared-scale/preview.png) | [决策与迁移](shared-scale/README.md) |
| distribution-first | 站点分布引出汇总 | [PNG](distribution-first/preview.png) | [决策与迁移](distribution-first/README.md) |
| evidence-ledger | 数值与图形共享行 | [PNG](evidence-ledger/preview.png) | [决策与迁移](evidence-ledger/README.md) |
| evidence-stage | 大幅主证据与支撑底栏 | [PNG](evidence-stage/preview.png) | [决策与迁移](evidence-stage/README.md) |
| method-feedback | 方法闭环与独立验证分层 | [PNG](method-feedback/preview.png) | [决策与迁移](method-feedback/README.md) |
| paired-evidence | 相关面板与共同读图路径 | [PNG](paired-evidence/preview.png) | [决策与迁移](paired-evidence/README.md) |
| craft-shared-metrics | 左侧弱例与右侧共享比较：学修改，不复制整页 | [PNG](craft-shared-metrics/preview.png) | [决策与迁移](craft-shared-metrics/README.md) |
| craft-method-bridge | 反馈主图与独立验证，题签/色面有主次 | [PNG](craft-method-bridge/preview.png) | [决策与迁移](craft-method-bridge/README.md) |

只按当前困难页的关系选择一到两个相关案例，实际看 PNG，读对应解释，写清保留什么、改变什么、不采用什么，再用新材料构图。不能把案例在全稿轮流套用。方法、多图页按任务选择对应关系示例；已有用户相关正文优先。

`academic_ppt_contract(topic:design)` 提供绝对 `previewPath` 与 `explanationPath`；`read_image` 读 PNG，不把 HTML/SVG 当作看过图。正文指导见 [art-direction.md](../art-direction.md) 和 [page-polish.md](../page-polish.md)。旧 `academic-styles` 六类稀疏样张仅为兼容/科学数据与可编辑性测试，不是当前审美目标。

数据、图与输入都可核查，但教学素材不能成为真实科研结果。当前声明只是助手编排案例和实际渲染；不代表 DeepSeek4.1flash1017 已端到端复现，也不代表用户已批准新稿。构建脚本不产生视觉 passed。

## 重建

从插件根目录执行：

```sh
node scripts/build-design-cases.mjs --output /absolute/new-directory --render --font-dir /absolute/local-font-directory
```

输出目录必须不存在。脚本不联网，不调用模型，不下载字体。提供实际本地安装的 Noto Sans/Serif CJK SC 的 Regular/Bold；字体二进制不在包中。缺少字体时需自行配置合法可用字体并实看结果，不虚构字重检查。构建与 PNG 绑定由 catalog 的 SHA-256 保存；这不是美学评分。
