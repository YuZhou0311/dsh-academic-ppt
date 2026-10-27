# DSH 兼容性与验证

当前版本为 **0.9.1**，提供19个工具。声明的 Host 范围保持 `>=0.2.1-rc.2 <0.3.0-0`。0.9.1 的修复与实测范围见 [本次验证报告](VALIDATION_V091.md)。基础接入机制见 [0.9.0 Agent 接入验证](AGENT_INTEGRATION_V090.md)，本次在同两版官方运行时重跑；provider 响应仍使用脚本化测试输入，不冒充真实模型端到端表现。以下0.8.2部分保留为历史验证，不能当成新版已经通过的证据。

`dsh-academic-ppt 0.8.2` 使用 DSH 的 Host 插件接口，在桌面端和网页端提供同一套学术汇报技能与 16 个工具。两端使用同一个安装包；插件不依赖浏览器扩展或单独的 Electron 前端。

## 支持范围

`package.json` 声明：

```json
{
  "engines": {
    "node": "^22.19.0 || >=24.0.0",
    "dsh": ">=0.2.1-rc.2 <0.3.0-0"
  }
}
```

DSH 在安装和启动插件时检查 `engines.dsh`，其 SemVer 比较包括预发布版本；显式的 `engines.dsh` 优先于 DSH peer dependency 范围。上限 `<0.3.0-0` 同时排除 0.3 的预发布版本。[官方兼容检查实现](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/boot/app-boot/src/plugin-compatibility.ts)

声明范围用于安装判定，实际验证对应下面的确切版本。`latest`、`next` 等发行渠道可能变化，安装前应核对真实版本；范围内的其他版本不自动等于已经逐版实测。

## 0.8.2 的实际 Host 验证

验证日期：**2026-10-26**。两套独立运行时使用官方发布的 DSH Cordis 服务与真实工具执行管线，测试环境为 Linux、Node `24.22.1`、Cordis `4.0.5`。每套运行时执行 **10 次真实工具调用**。

| 已执行项目 | DSH 0.2.1-rc.2 | DSH 0.2.1-rc.3 |
| --- | --- | --- |
| 注册 16 个工具，发现并加载随包技能 | 通过 | 通过 |
| 经 Host 查询全部 48 款卡片，包含 `figure` 家族，并取得完整 preparation 契约 | 通过 | 通过 |
| 在调用会话的工作区创建工程、登记内容、恢复上下文、导出原生 PPTX 并检查产物 | 通过 | 通过 |
| 拒绝错误参数与工作区越界，保持取消信号和进程工作目录约束 | 通过 | 通过 |
| 卸载与重新挂载，不遗留过期工具或重复技能 | 通过 | 通过 |

报告分别记录插件版本 `0.8.2`、全部 DSH 服务版本、声明范围、平台与检查项目。本次使用与发布版本对应的插件源码运行；未用自行模拟的工具注册表代替 Host。仓库 CI 的 Host 矩阵同样固定为 rc.2 / rc.3，后续结果以对应提交的检查状态为准。

这些检查覆盖共享 Host 的注册、调用、工作区隔离与导出路径，**没有运行 Desktop/Web GUI 全流程、付费模型会话或 PowerPoint/WPS 编辑验收**。Host 测试中的单页草稿是软件输入，不代表学术设计质量；模型协作和最终页面应单独验收。

## 两端的安装差异

### Desktop

优先在官方桌面应用的「插件 → 添加插件」中安装本项目 Release 的 `.tgz` 地址或真实本地路径，按界面提示启用。官方桌面应用内置 pnpm，无需单独把 pnpm 加入 PATH。

需要终端操作时，先在桌面应用菜单通过 **Manage dsh Command…（管理 dsh 命令）** 安装或修复桌面随附命令。桌面应用至少启动一次后，使用「退出」完全关闭应用，再运行：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt-0.9.1.tgz"
```

随后重新打开桌面应用。只关闭窗口通常会隐藏应用，Host 仍在运行。**npm 安装的 `dsh` 不允许修改官方 Desktop 的受管 profile**；桌面随附命令才能管理它。桌面端与 Web 共用 Host / 插件管理接口，但各自维护独立的可执行依赖与插件启用状态。[官方桌面命令与安装归属](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/desktop/README.md#bundled-command-runtime)

### Web

网页端插件运行在提供 Web UI 的 Host 上。本地文件路径应是该 Host 能读取的绝对路径；连接远程服务器时，浏览器所在电脑的本地路径不能代替服务器路径。

通过插件管理界面安装，或在 Host 上运行。下面固定使用已核验的 rc.3：

```sh
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt-0.9.1.tgz"
npx --yes @deepseek-ai/dsh@0.2.1-rc.3 web
```

npm 版 CLI 的插件命令会调用 PATH 中的 pnpm；`--profile` 放在 `add` 前。使用 rc.2 或其他受支持版本时，安装与启动命令须保持同一版本、同一 `DSH_HOME` 和同一 profile。CLI 增删或更新组合包后，重启相应 Web profile；界面安装按它返回的启用或重启提示操作。[官方 CLI 插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/cli/reference/README.zh.md#插件管理) · [官方插件管理界面](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/client/ui-plugin-manager/README.md#installing-a-bundle)

下载、升级和启用检查见[安装与升级](INSTALL.md)。

## 设计协作与宿主能力

分阶段提问由当前 DSH Agent 执行，插件提供待问主题、真实回答记录与构建前检查。目录查询不会自动替模型看图，`prepare` 也不会代替用户确认或自行调用生图模型。

检索、下载、PDF 处理、图像阅读与可选生图取决于当前 Host 暴露的能力。没有生图接口时继续原生参考流程；没有取得或读过论文图时保留具体缺口，不将卡片预览当作研究证据。模型记录的查证与观察仍须对照实际来源、媒体及最终 PPTX。

## 复跑 Host 兼容检查

在已安装本项目依赖的源码目录执行。下面固定 rc.3；验证 rc.2 时，将所有 DSH 包的版本全部换成 `0.2.1-rc.2`。

```sh
npm install --prefix .test-output/dsh-runtime --ignore-scripts --omit=optional --no-audit --no-fund \
  @deepseek-ai/dsh-tools@0.2.1-rc.3 \
  @deepseek-ai/dsh-skill@0.2.1-rc.3 \
  @deepseek-ai/dsh-system-prompt@0.2.1-rc.3 \
  @deepseek-ai/dsh-app-boot@0.2.1-rc.3 \
  @deepseek-ai/dsh-fs-local@0.2.1-rc.3 \
  @deepseek-ai/dsh-working-directory@0.2.1-rc.3 \
  @deepseek-ai/dsh-session@0.2.1-rc.3 \
  @deepseek-ai/dsh-session-projection@0.2.1-rc.3 \
  @deepseek-ai/dsh-sandbox-policy@0.2.1-rc.3 \
  @deepseek-ai/cordis@4.0.5

node scripts/check-dsh-compat.mjs \
  --runtime-dir .test-output/dsh-runtime \
  --output .test-output/dsh-compat-report.json
```

检查脚本不安装软件、不读取密钥，也不修改已有 DSH profile；它只使用显式提供的独立运行时。测试工程在完成或失败时清理，指定的报告文件保留版本、用例和验证范围。
