# 技术过程记录

初始使用只读plugin-v060-forward-snapshot，公开CLI生成r5的3页小样。首次真实render因运行环境/tmp不存在而ENOENT，原始stderr保留于receipts/08-prototype-render-stderr.txt。设置TMPDIR为本任务delivery/runtime-tmp后，公开render成功，wasm 0.1.5，missingFonts为空。

2026-10-21按主线程通知切换只读plugin-v060-forward-snapshot-r2；通知说明技术补丁仅修复封面/结尾上下文图片viewport裁切与宽高比，公开接口不变。本报告未使用该图像字段，内容与自主布局不因补丁改变。最终build/render/review均由r2公开CLI执行。未修改任一插件源码、检查器或质量回执。

代表页实际查看后仅发现B批区间图展示完整浮点尾数影响可读性，使用公开slide-content把该原生图输入展示数值四舍五入至两位小数；精确计算未改变，claim与analysis继续保留全精度。扩大分布图空间。最终全稿仍需重新逐页确认。

随后主线程通知切换plugin-v060-forward-snapshot-r3：仅修复显式chrome下figureBoxes的实际contentBox边界检查，并保留旧工程原安全区。报告使用原生图表而非figureBoxes，内容未因技术补丁变更；最终再次由r3公开build/render/review完成。r2全稿已渲染历史保留。
