# v0.1.0 · 学术汇报插件首个公开预览版

面向 DeepSeek Harness 的独立学术汇报插件，将论文证据、原图、模板组件、页面和讲稿放进同一个可恢复工程。可与原 `dsh-ppt` 共存。

## 本版功能

- 10 个确定性工具与同构 CLI；短核心 SKILL 加 6 份阶段参考。
- 完整论文题名、全文记录、IF 条件与来源链检查；区分作者报告、解释和待检验提议。
- 真实 PPTX 基础组件提取；12 种页型、8 种小卡片结构；文字、形状、连接线与支持图表原生可编辑。
- 按卡片/页面 ID 局部修改、版本校验、撤销、旧成品保护。
- 独立论文图、讲稿、证据与资产清单；真实 PPTX PNG/PDF 渲染及绑定版本的视觉审查记录。
- 一篇真实 Nature Communications 论文的 9 页示例、原图授权和可重建的原生参考模板。

## 验证

42 项确定性测试通过；示例完成 9 页实际 PPTX 渲染与逐页观察，最终没有报告缺失字体。完整验证边界及审查记录见 `docs/VALIDATION.md`。

## 安装

下载安装包，或克隆本仓库的 `v0.1.0` 标签。普通生成只需要受支持的 Node；实际 PPTX 渲染使用可选官方 LibreOffice Kit。DSH 选择模型和管理账户，插件不另调私有模型 API。

```sh
git clone --branch v0.1.0 https://github.com/YuZhou0311/dsh-academic-ppt.git
cd dsh-academic-ppt
npm ci --ignore-scripts
```

将完整插件文件夹以实际本地路径安装到已初始化的 profile：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt"
```

随后重启 DSH。可先运行 `npm run demo` 查看本地生成结果。Windows 和字体设置详见 `docs/INSTALL.md`。

## 本版边界

模板导入是明确的基础原生对象子集；论文图内部仍是作者图像。记录门槛不自动证明学术结论真实。已做本地协议与渲染验证，尚未做真实 DSH GUI / DeepSeek 端到端效果评测。本版公开发布在 GitHub，未发布到 npm registry。
