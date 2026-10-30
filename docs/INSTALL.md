# 安装与使用

## 0.10.0-rc.1 候选源码

本分支为候选版，尚未发布对应Release。可在独立源码目录运行 `npm ci`、`npm test`、`npm run check` 后执行 `npm pack`，将生成的 `dsh-academic-ppt-0.10.0-rc.1.tgz` 通过下文的本地包路径方式安装。不要把下文0.9.1下载链接当作0.10候选。新字段和兼容说明见 [当前工作流](../skills/dsh-academic-ppt/references/workflow-v010.md)，实际验证见 [VALIDATION_V010.md](VALIDATION_V010.md)。

## 已发布的0.9.1安装说明

> **版本：0.9.1。** 从 [正式 Release](https://github.com/YuZhou0311/dsh-academic-ppt/releases/tag/v0.9.1) 下载 [DSH 安装包](https://github.com/YuZhou0311/dsh-academic-ppt/releases/download/v0.9.1/dsh-academic-ppt-0.9.1.tgz)。使用固定版本地址或下载后的真实本地路径；升级后核对插件详情中的版本。

**dsh-academic-ppt 0.9.1** 为 DeepSeek Harness 提供学术汇报技能和 19 个 `academic_ppt_*` 工具，支持官方桌面端和网页端。声明的 DSH Host 范围为 `>=0.2.1-rc.2 <0.3.0-0`。插件在 Host 中运行，使用当前会话的工作目录；论文、模板和生成文件应放在该工作目录中。

[查看实际发布状态](https://github.com/YuZhou0311/dsh-academic-ppt/releases) · [插件介绍与展示](../README.md) · [DSH 兼容性与验证](DSH_COMPATIBILITY.md)

## 指导如何进入 Agent

本插件按 DSH 官方的按需技能机制接入：插件注册完整技能及工具，官方 `dsh-tool-skill` 向 Agent 提供名称和摘要；调用 `skill({name:"dsh-academic-ppt"})` 后，完整正文及资源目录进入下一轮模型请求。正文引用的 `references/` 再按任务通过文件读取工具加载，不会把所有参考资料一次塞进系统提示词。

在标准 DSH 会话里，可显式使用以下入口，让官方技能消费者在当前步骤直接注入全文：

```text
/dsh-academic-ppt
请根据工作区里的论文和实验数据制作一份12分钟组会汇报，先核对证据与故事线，再展示真实正文样张供我选择方向。
```

应安装完整 DSH bundle。仅将 `SKILL.md` 放入文件系统技能目录只会发现技能，不会注册19个 `academic_ppt_*` 工具。自定义 Agent preset 还须保留官方 `dsh-tool-skill`、文件读取能力和所需学术工具；标准本地组合提供的 `workingDirectory` 服务负责当前会话目录，插件跟随该服务的目录变化，不使用初始目录替代当前目录。

插件同时依赖官方 `sandboxPolicy`。切换当前目录不会改变原会话的授权工作区；在 `read-only` 模式仍可查询卡片、契约和现有工程，保存工程、解析并保存模板 profile、导出或登记审查等写入会返回明确拒绝。需要写入时由用户在宿主选择合适模式，插件不会自行改变权限。

要让 Agent 查看模板和PPTX页面，在官方本地组合中还需要实际可用的 `read_image`：`dsh-tool-fs` 启用 `readImage`、官方 attachments 服务可用，且当前路由模型明确支持图像输入。`read`只读文字，返回图片路径也不代表模型看到了图像。没有图像输入仍可研究和编辑，但不能登记模型视觉验收；具体规则见[宿主能力指南](../skills/dsh-academic-ppt/references/deepseek.md)。

若使用 PTC，内部 `tools.skill(...)` 的完整结果须按该运行时要求返回或打印，才能进入模型上下文；仅调用而丢弃返回值不等于加载完成。本轮自动化验证覆盖 native 调用链，PTC 和用户 Desktop/Web 界面不在实测范围内。注入路径、已修问题与复跑方法见 [Agent 接入验证](AGENT_INTEGRATION_V090.md)。

## 选择安装方式

| 使用环境 | 推荐入口 | 安装位置 |
| --- | --- | --- |
| 官方 DSH 桌面端 | 应用内「插件 → 添加插件」 | 当前桌面应用管理的 `desktop` profile |
| DSH 网页端 | 网页内「插件 → 添加插件」，或启动该服务的 DSH CLI | Web Host 使用的 `web` 或自定义 profile |
| 开发与独立 CLI | 获取源码后安装依赖 | 独立源码目录，可额外安装到指定 profile |

本版在 DSH **0.2.1-rc.2 / 0.2.1-rc.3** 的独立真实 Host 运行时中完成工具注册、执行和原生导出检查，具体范围见兼容说明。桌面应用版本在「关于 DeepSeek Harness」中查看，应用更新使用桌面自身的更新入口。安装前核对版本是否处于声明范围；发行渠道名称不代替版本判定。

## 1. 官方桌面端

### 从界面安装

1. 从 [DeepSeek Harness 官网](https://www.deepseek.com/harness/)安装或更新官方桌面应用，启动并进入工作区。
2. 打开侧栏「插件」，选择「添加插件」或其菜单中的「安装第三方插件」。
3. 在包地址输入框填写固定版本的安装包地址：

   ```text
   https://github.com/YuZhou0311/dsh-academic-ppt/releases/download/v0.9.1/dsh-academic-ppt-0.9.1.tgz
   ```

4. 核对名称为 `dsh-academic-ppt`、版本为 `0.9.1`，安装后选择「立即启用」。
5. 按界面提示重启应用，在新会话中加载 `dsh-academic-ppt` 技能。

如果应用无法访问 GitHub，可先下载 `.tgz`，在输入框填写该文件在 **DSH 所在电脑**上的绝对路径，例如 `C:/Users/your-name/Downloads/dsh-academic-ppt-0.9.1.tgz` 或 `/Users/your-name/Downloads/dsh-academic-ppt-0.9.1.tgz`。将用户名和目录换成实际值。插件尚未发布到 npm registry，请使用发布包地址或真实文件路径安装。

### 使用桌面自带命令

先在应用菜单「管理 dsh 命令…」中安装或修复命令，打开新终端运行 `dsh --version`。这个命令复用桌面应用的运行时和内置 pnpm。

先启动一次桌面应用以初始化 profile，再从应用菜单或托盘中**完全退出**；关闭窗口可能只是隐藏应用。退出后运行：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt-0.9.1.tgz"
```

重新打开桌面应用。**通过 npm/npx 单独安装的 DSH CLI 不能修改桌面端的 `desktop` profile**；桌面端使用应用内插件管理或桌面自带命令。桌面自带 pnpm，无需为这条安装路径另行配置全局 pnpm。

## 2. 网页端

### 从界面安装

在 DSH 网页侧栏打开「插件 → 添加插件」，填入上面的 `0.9.1` 安装包地址，安装并启用。网页与桌面使用同一个插件包。

Web Host 在远程服务器运行时，本地路径指向**服务器上的文件**，不是访问网页的电脑上的文件。HTTPS 安装包地址由 Host 下载；使用本地 `.tgz` 时先把文件放到服务器，再填写绝对路径。

### 从命令行安装

使用运行 Web Host 的同一 DSH 安装、同一 `DSH_HOME` 和同一 profile。npm 版 DSH 的包管理依赖 PATH 中可用的 pnpm。准备 Node.js 和 pnpm 后运行：

```sh
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt-0.9.1.tgz"
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 web
```

已安装 `dsh` 命令时：

```sh
dsh plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt-0.9.1.tgz"
dsh web
```

`--profile` 放在 `add` 之前。自定义 profile 将 `web` 改为实际名称，再用 `dsh --profile <实际名称>` 启动。安装后重启已经运行的 Web 服务。

上例固定在已核验的 `0.2.1-rc.3`。使用 `0.2.1-rc.2` 时，将安装与启动命令中的 DSH 版本一起替换；已有 Web Host 则复用其实际运行时，不混用不同 profile 或管理命令。插件版本仍为 `0.9.1`。

## 3. 升级与确认

通过界面安装的 tarball、本地目录或 Git 包不使用 npm registry 的自动版本列表。更新时，在该 profile 的插件页卸载原有 `dsh-academic-ppt`，再用新包地址安装并启用。已有工程和导出的 PPTX 位于工作目录，不属于插件安装目录。

使用 CLI 时，停止对应应用或 Web 服务后，用新包地址再次执行 `dsh plugin --profile <实际名称> add ...`，然后重启。桌面 profile 仍须使用桌面自带命令。

在插件详情核对版本为 `0.9.1`，新建会话并发送：

> /dsh-academic-ppt 请创建一份新的学术汇报项目。先问我按插件默认原创还是提供模板，再与我讨论故事线和实际样张的配色、风格与排版。

已经加载的旧技能正文属于旧会话历史，升级或重新挂载不会改写那段历史。新建会话能避免新旧工作流混用；继续旧任务时，重新显式调用技能并用当前工程的 `context` 恢复真实决定，不把旧摘要当作新指南。

应能发现新增的 `academic_ppt_plan`、`academic_ppt_layouts`、`academic_ppt_deliver`，以及原有工具。整页语法索引返回32项。局部卡片索引返回 **48** 款预设，包含 `figure` 家族的 **12** 种图片嵌入卡；`academic_ppt_contract` 的 `preparation` / `design` 主题包含分阶段协商与参考学习约定。若仍显示旧版本，检查所选 profile、启用状态和是否已重启。

## 4. 第一次制作汇报

把论文、数据和参考 PPTX 上传到当前 DSH 会话，或放进会话工作目录，再说明汇报对象、时长和研究任务。例如：

> /dsh-academic-ppt 请根据工作区里的论文和实验数据制作一份 12 分钟组会汇报，并与我逐步确定设计方向。

Agent 会围绕故事线与真实困难样张讨论完整方向，并在最终使用时呈现可用成品和剩余科学取舍。一次方向选择可以落实多个设计字段。已有偏好继续沿用，明确委托后自主完成。查证、全文阅读和取图可在讨论期间继续；不要把设计对话理解为暂停研究。

插件提供证据故事板、整页语法和按需局部参考，当前宿主 Agent 执行提问、读取上传文件和实际看图。它需要根据当前论文调整配色、图文比例和内容组织。论文图可放入图卡，也可开放排版；只有明确需要探索局部构图时才使用补充生图参考，没有模板或生图能力时继续原生流程。插件不需要额外模型密钥，也不包含独立的生图服务。

用户模板支持 `.pptx`；旧 `.ppt` 先用 PowerPoint 或 WPS 另存为 `.pptx`。参考用于学习层级、比例、分组和视觉语言，当前研究的文字、数据、配色和内部结构由实际内容决定。

## 5. 发布文件与源码

| 文件 | 用途 |
| --- | --- |
| `dsh-academic-ppt-0.9.1.tgz` | DSH 安装包，直接交给插件管理器，无需解压 |
| `dsh-academic-ppt-0.9.1-source.zip` | 含锁文件与测试的源码，可运行 `npm ci` 和 `npm test` |
| `SHA256SUMS` | 发布文件的 SHA-256 校验值 |
| `release-manifest.json` | 包版本、源提交、文件大小和摘要 |
| `RELEASE_NOTES.md` | 本版功能、安装入口与验证范围 |

单包校验可用 `sha256sum dsh-academic-ppt-0.9.1.tgz`（Linux）、`shasum -a 256 dsh-academic-ppt-0.9.1.tgz`（macOS），或 PowerShell 的 `Get-FileHash .\dsh-academic-ppt-0.9.1.tgz -Algorithm SHA256`，与 `SHA256SUMS` 中同名文件的值比较。

源码也可从发布标签获取：

```sh
git clone --branch v0.9.1 --depth 1 https://github.com/YuZhou0311/dsh-academic-ppt.git
cd dsh-academic-ppt
npm ci --ignore-scripts
npm test
npm run check
node bin/academic-ppt.mjs --help
```

Node.js 要求以 [`package.json`](../package.json) 为准：`^22.19.0 || >=24.0.0`。源码安装到 DSH 时，把安装命令的 tarball 地址换为 `file:/真实绝对路径/dsh-academic-ppt`。开发更新从 `main` 获取，发布标签用于固定版本。

安装包不包含根锁文件和开发测试；执行 `npm ci`、`npm test` 时使用源码 ZIP 或 Git checkout。独立 CLI 的每个命令提供 `--help` 和 `--schema`，执行时从 UTF-8 JSON 参数文件读取：

```sh
node bin/academic-ppt.mjs init --help
node bin/academic-ppt.mjs contract --schema
node bin/academic-ppt.mjs init --args init.json
node bin/academic-ppt.mjs record --args records.json
node bin/academic-ppt.mjs build --args build.json
node bin/academic-ppt.mjs check --args check.json
```

参数文件由调用者准备，以命令返回的 schema 为准。CLI 相对路径按启动目录解析，DSH 工具按会话工作目录解析。需要完整机器可读输出时添加 `--json`。

## 6. 渲染与字体

生成可编辑 PPTX 和 HTML 不要求安装 Microsoft Office。`academic_ppt_render` 使用可选的官方 `@deepseek-ai/libreoffice-kit` 把实际 PPTX 转成页面图片/PDF。普通源码安装包含该可选依赖；仅需生成时可用 `npm ci --ignore-scripts --omit=optional`，届时 HTML 预览不能当作已完成 PPTX 实际渲染。

渲染端需要汇报使用的字体。可安装有许可的中文字体，例如 [Noto Sans CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md)，或将字体放入工作区目录并在 render 参数中提供 `fontDirectories`。这个参数不把字体嵌入 PPTX，演示电脑也应安装相应字体。遇到字体缺失或替换，检查实际页面后再交付。

## 7. 工具速查

| 阶段 | 工具 |
| --- | --- |
| 设计协商、模板与生图参考准备 | `academic_ppt_prepare` |
| 卡片与布局参考 | `academic_ppt_cards`、`academic_ppt_reference` |
| 研究上传模板 | `academic_ppt_template` |
| 建立和恢复工程 | `academic_ppt_init`、`academic_ppt_context` |
| 字段契约与内容登记 | `academic_ppt_contract`、`academic_ppt_record` |
| 比较实际设计候选 | `academic_ppt_study` |
| 生成与实际渲染 | `academic_ppt_build`、`academic_ppt_render` |
| 检查和逐页观察记录 | `academic_ppt_check`、`academic_ppt_review` |
| 局部修改与撤销 | `academic_ppt_edit`、`academic_ppt_undo` |
| 比较指定工程的结构重复 | `academic_ppt_portfolio` |

与 `dsh-ppt` 的技能名、工具名和插件 ID 分开，可以同时安装。学术工程持续使用 `academic_ppt_*` 工具处理。内容证据和最终页面仍需实际核对，完整创作字段可按需查询 contract。

## 8. 卸载

在当前应用的插件页卸载，或停止应用后执行：

```sh
dsh plugin --profile web remove dsh-academic-ppt
```

桌面端换成 `--profile desktop`，并使用桌面自带命令。卸载插件不会主动删除工作目录中的工程、PPTX、PDF 或讲稿。

## 官方安装依据

安装机制固定参考官方仓库提交 `22ddee3792402c3e70ec5f86a63c3e3e895a2f60`；插件 0.9.1 对已发布运行时的实测范围与日期见 [兼容说明](DSH_COMPATIBILITY.md)。

- [桌面命令与运行时归属](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/desktop/README.zh.md#bundled-command-runtime)
- [插件管理界面的安装流程](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/client/ui-plugin-manager/README.md#installing-a-bundle)
- [CLI 插件管理与 Web profile](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/cli/reference/README.zh.md#插件管理)
- [DSH bundle 与宿主版本约束](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/docs/user/develop/basic/publish.md)
