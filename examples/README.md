# 离线示例与实际成稿

## rc.6 工作区试作记录（样稿暂未公开）

9页主讲预算10分钟，加1页来源备查。原始输入为教学模拟协议与48件CSV；作者重新分析、比较真实候选、检查连续页面，并生成全稿。多区域按比较、解释、流程和综合判断等关系组合，保留正式标题层级和原生可编辑对象。首轮候选和完整稿均有返工，不宣称一次自动完成或目标模型稳定成功率。

本次工作已完成这份10页样稿的制作、实际渲染、内容复核及新目录重建验证，相关文件暂未收入公开仓库。上述结果属于工作区实测，不是当前可下载或运行的公开示例；检查范围、保留的提醒和限制见[本轮验证记录](../docs/VALIDATION_V07_RC6.md)。下列公开示例继续保留各自历史身份。

## 安装核对用的默认离线 demo：历史 v0.6

`npm run demo` 继续使用[历史v0.6材料案例](materials-v06/README.md)，以保持纯Node记录导入流程。它用于验证安装、公开core记录批次与可编辑导出，不是当前模型新做一稿，也不作为rc.6工作流的成稿验收。

```bash
npm run demo -- --output ./my-materials-demo
npm run demo -- --output ./my-materials-rendered --render --font-dir ./fonts
```

默认只生成和静态检查；`--render`需要可选LibreOffice引擎及适合的字体。所有输出写入新目录，既有目录不覆盖，视觉状态不继承。可用`--example materials-v05`选择历史C4重建路径。

## 历史成稿

| 版本 | 内容与链接 | 保留身份 |
| --- | --- | --- |
| rc.5 | [8页叙事样稿](story-v07/README.md)；[封面/导航/描边组件](academic-style-v07/README.md) | 用户随后指出信息不足、表达重复，是本轮继续修订的基线 |
| v0.6 | [9页材料进展](materials-v06/README.md)；[早期内容驱动试作](content-led-v06/README.md) | 当时的独立制作与渲染结果，不转记为当前工作流成功 |
| v0.5 | [材料C4](materials-v05/README.md)；[理论精读指定页面](theory-v05-preview/README.md) | 保留原版科学与视觉审查范围 |
| v0.4 | [材料模拟示例](materials-v04/README.md)；[PPTX](materials-v04/report.pptx)；[复算脚本](materials-v04/analyze.py) | 历史静态内容，不是当前默认demo |
| v0.3 | [PhenoAssistant PPTX](report.pptx)；[HTML](report.html)；[讲稿](speaker-notes.md)；[当时验收](VISUAL_QA.md) | 历史论文精读；图像出处和许可见[ASSETS.md](ASSETS.md) |

历史数据、原图及限制以各自说明为准；旧检查不会自动变成新版本的验收结论。

## 原生组件与参考库

[小组件参考PPTX](native-card-reference.pptx)是历史单页原生组件演示，包含细框表头、短题签、侧签与开放解释区。它不是完整研究报告的固定布局建议。

```bash
node examples/create-native-reference.mjs ./native-reference-new.pptx
```

[48页参考库](../skills/dsh-academic-ppt/references/templates/README.md)可辅助理解构图；当前材料决定页面关系、信息量和载体，教学正文、图像及数值不迁入新的研究结论。
