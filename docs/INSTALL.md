# 安装与首次使用

本项目是 **DeepSeek Harness（DSH）的本地插件包**，提供学术汇报技能与十一个确定性工具。它使用当前 DSH 会话中的模型和宿主工具；插件本身不保存 DeepSeek 密钥，也不另行发起模型请求。

当前交付方式是 [GitHub v0.2.0 发布页](https://github.com/YuZhou0311/dsh-academic-ppt/releases/tag/v0.2.0)提供的源码和本地安装包。**尚未发布 npm，不要直接用裸包名从公共 registry 安装。**

## 1. 准备本地包

推荐克隆固定版本，或下载发布页的 Source code 归档后解压：

```sh
git clone --branch v0.2.0 https://github.com/YuZhou0311/dsh-academic-ppt.git
cd dsh-academic-ppt
```

插件位于本仓库根目录。完整文件夹应包含 `package.json`、`package-lock.json`、`cordis.patch.yml`、`src/`、`skills/` 和 `bin/`。

在插件目录运行：

```sh
npm ci --ignore-scripts
node bin/academic-ppt.mjs --help
npm test
```

Node 版本以 [`package.json`](../package.json) 的 `engines.node` 为准。普通 PPTX/HTML 生成不要求安装 Microsoft Office；查看和修改成品可使用 PowerPoint 或 WPS。实际 PPTX 渲染与视觉验收的验证范围见项目说明，HTML 预览不能代替 Office 渲染。

默认 `npm ci --ignore-scripts` 包含可选官方 `@deepseek-ai/libreoffice-kit`，供 `academic_ppt_render` 生成实际 PPTX 图片/PDF。只需要普通生成时改用 `npm ci --ignore-scripts --omit=optional`；未安装或引擎不可用时，渲染工具如实返回不可用状态。

渲染默认使用系统字体。最小环境缺中文字体时，可将有许可的 Noto CJK 等字体放入工作区的 `fonts/`，在 render 参数中传 `fontDirectories`，每次 1–4 个工作区内目录；日常字体齐全时不必传。工具报告字体问题后仍需检查实际页面。

### 直接使用安装包

只需安装插件时，可下载 `dsh-academic-ppt-0.2.0.tgz`，直接把压缩包的完整本地路径交给 DSH 插件管理，或在已经初始化的 desktop profile 中运行：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt-0.2.0.tgz"
```

DSH 的包管理器负责解析依赖。安装包包含运行代码、技能、文档和示例；开发测试及根 `package-lock.json` 由源码归档提供。不要把本节的安装包解压后直接套用源码流程中的 `npm ci` 或 `npm test`。

## 2. 安装到 DSH

### 桌面版

先正常启动一次 DSH Desktop，使其初始化桌面 profile，然后完全退出桌面应用。已配置 `dsh` 命令时，用**自己电脑上的真实绝对路径**安装：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt"
```

Windows 示例（替换为实际目录）：

```powershell
dsh plugin --profile desktop add "file:C:/work/dsh-academic-ppt"
```

也可以在桌面「插件 → 添加插件」的安装输入中填写完整本地包路径。官方管理界面支持包名、Git 地址、tarball 与绝对本地路径；本项目选本地路径。安装完成后启用并重启对应 profile。

### 网页版

```sh
dsh plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt"
dsh web
```

`dsh plugin` 调用 profile 中的 pnpm，所以该命令需要 pnpm 在 PATH 中。`--profile` 必须位于 `add` 前面。`file:` 安装的副本与原始源码是两个位置；修改本地源码后需要重新安装/更新并重启，不应假设已运行的宿主自动加载新代码。

官方依据：[包与安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)、[CLI 插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.zh.md#插件管理)、[本地 file: 包的官方用例](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/README.zh.md#自定义插件)、[桌面插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md#installing-a-bundle)。协议核对日期：2026-10-20。

## 3. 确认插件加载

在新会话中要求 DSH 加载 `dsh-academic-ppt` 技能。应能发现以下工具：

| 工具 | 用途 |
| --- | --- |
| `academic_ppt_init` | 新建研究问题、时长与证据要求明确的工程 |
| `academic_ppt_record` | 分批登记论文、论点、论文图与页面 |
| `academic_ppt_context` | 获取下一阶段的精简上下文 |
| `academic_ppt_template` | 盘点本地 PPTX 模板及支持的原生组件 |
| `academic_ppt_reference` | 列出或选择 48 个学术参考页型，获取原生 PPTX 与布局字段 |
| `academic_ppt_build` | 生成可编辑 PPTX 与配套产物 |
| `academic_ppt_render` | 使用可选引擎渲染当前 PPTX 的实际页面 |
| `academic_ppt_edit` | 按页面/小卡片 ID 局部修改 |
| `academic_ppt_undo` | 以新修订恢复上一工程状态 |
| `academic_ppt_check` | 检查证据、版式与产物一致性 |
| `academic_ppt_review` | 登记实际完成的视觉检查及范围 |

它与原 `dsh-ppt` 使用不同技能名、工具名和插件 ID，可以共存。学术工程应持续使用 `academic_ppt_*` 工具，不能把它的 JSON 当作原插件工程交给 `ppt_edit`。

首次提示词可以直接复制：

> 使用 dsh-academic-ppt 做一场 12 分钟的学术组会汇报。优先围绕我提供的论文与 PPT 模板展开；先记录论文完整标题、阅读版本、方法、实验设置、关键结果及局限，再编排可追溯的论文图和研究切入点。每页一个判断，控制信息密度，保持文字、标注、卡片和示意图可编辑。先给出代表性页面，然后保持已认可结构，只修改明确指定的小卡片。生成后检查证据、版式与讲稿时间；没有完成的全文阅读或最终 PPTX 视觉检查要如实标明。

## 4. 命令行使用

所有命令使用同一套工具参数校验。DSH 注册使用其支持的 JSON Schema 子集，字符长度、数组数量等限制写入说明，并在执行入口用完整 Ajv 规则再次校验。参数保存在 UTF-8 JSON 文件中，避免在 shell 中拼接长文本、引号和论文内容。

```sh
node bin/academic-ppt.mjs init --args init.json
node bin/academic-ppt.mjs record --args records.json
node bin/academic-ppt.mjs context --args context.json
node bin/academic-ppt.mjs build --args build.json
node bin/academic-ppt.mjs check --args check.json
```

文件名只是你创建的参数文件名，**不是空白模板可以直接运行的保证**；具体参数以 [`src/schema.mjs`](../src/schema.mjs) 与随包示例为准。`edit`、`undo`、`template`、`reference`、`render`、`review` 采用相同 `--args` 形式。模板参数是 `filePath`，工程参数是 `projectPath`；源文件及输出目录必须位于调用会话的工作目录内，必要时先由用户把模板放入该工作目录。

模板盘点会保存 `template-profile-<源文件摘要前 12 位>.json`。可用 `outputPath` 指定另一个工作区内位置；同名文件内容相同则复用，内容不同则拒绝覆盖。之后将返回的路径放入 `academic_ppt_record` 的 `templateProfilePaths`（一次 1–4 个），插件读取并合并组件，模型只需选择 `templateComponentId`，不必重新抄写形状几何。原模板和模板中的旧文字不会被改写。

参考页型查询不需要工程路径。把 `{}`、`{"category":"figure"}` 或 `{"templateId":"figure-detail-window"}` 写入参数文件，然后运行 `node bin/academic-ppt.mjs reference --args reference.json`。返回的 `files` 指向已安装包内资源；`referenceTemplateId` 与 `layout` 写入页面后，生成器实际使用对应几何。模板示例数据必须换成真实证据，不能直接作为论文结论。

默认输出简明操作摘要。调用程序若需要路径、修订号与完整检查对象，可显式添加 `--json`。CLI 的相对路径按启动命令时的工作目录解析；DSH 工具按调用会话的工作目录解析。改变一个会话的目录不会更改全局进程目录。

退出码：`0` 表示操作成功；`2` 表示工具返回需要处理的领域问题；`1` 表示参数、读取、执行或取消失败。验收状态仍需阅读返回结果，不能只根据退出码声称论文或视觉已通过。

## 5. 实际能力边界

- 源码锁文件与根 `overrides` 只约束本项目作为根工程的安装。DSH profile 独立解析依赖；其包管理器不会自动采用依赖包自己的 overrides。本次源码测试使用 image-size 2.0.4，但上游 PptxGenJS 4.0.1 的依赖范围仍为 1.x，因此应在目标 profile 中核对实际版本与审计结果；不能沿用本仓库的零报告数。需要统一版本时，应由宿主在对应根配置维护 overrides，保留其已有配置。[npm 官方规则](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)；[pnpm 根设置](https://pnpm.io/settings#overrides)。
- 论文检索、全文读取和图像观察由宿主已提供的能力完成；插件不根据模型名字推断“能够看图”，也不伪造全文阅读。
- 模板导入保留受支持的原生基础形状信息，复杂图片纹理、特殊效果、图表或母版关系可能无法复用；检查工具会列出边界。不能把“盘点成功”当作任意模板无损克隆。
- 原始论文图可以作为独立图片嵌入；页标题、分析、图注、标注和卡片保持原生编辑。整页截图不作为可编辑性解决方案。
- 版本、摘要和静态几何检查负责发现可计算的问题；它们不证明科学结论真实，也不等于看过最终 PPTX 的每一页。
- 注册/API 测试与本地生成测试证明工具协议和代码行为；真实 DSH 界面、付费模型端到端运行、PowerPoint/WPS 实际显示属于各自独立的验证层，只有实际完成才可以报告通过。

## 6. 卸载

```sh
dsh plugin --profile desktop remove dsh-academic-ppt
```

网页版将 `desktop` 换成 `web`。随后重启对应 profile。工程和已经生成的 PPTX 不随插件卸载自动删除。
