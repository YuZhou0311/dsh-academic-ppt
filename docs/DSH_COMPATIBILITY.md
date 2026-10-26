# DSH Desktop / Web 兼容性

`dsh-academic-ppt 0.8.0` 使用 DSH 的 Host 插件接口，在桌面端和网页端提供同一套学术汇报技能与 16 个工具。两端使用同一个安装包；插件不依赖浏览器扩展或单独的 Electron 前端。

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

以下版本信息核对于 **2026-10-26**。支持范围用于安装判定，实测结果对应表中的确切版本。

| 发行入口 | 核对结果 | 插件验证 |
| --- | --- | --- |
| npm 默认 `latest` | `@deepseek-ai/dsh@0.2.1-rc.2` | 真实 Host 服务及工具执行管线通过 |
| npm 预览 `next` | `@deepseek-ai/dsh@0.2.1-rc.3` | 真实 Host 服务及工具执行管线通过 |
| 官方 GitHub 最新发行 | `dsh-v0.2.1-rc.3`，2026-10-23 发布 | 对应 rc.3 Host 核验 |
| 官网 Windows 桌面安装包 | 文件版本与产品版本均为 `0.2.1-rc.3` | 共享 Host 协议核验；桌面 GUI 未运行 |
| 官网 macOS 桌面安装包 | 官方提供 Apple 芯片下载入口；本次未解包确认其版本 | 按官方桌面插件安装机制支持；本机 GUI 未运行 |

版本依据：[npm 官方包元数据](https://registry.npmjs.org/@deepseek-ai/dsh)、[官方 rc.3 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.3)、[官方网站](https://www.deepseek.com/harness/)。Windows 版本读取自官网链接的[安装包](https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe)前 256 KiB 的 PE `FileVersion` / `ProductVersion` 资源；只读取版本信息，未执行安装包。

## 两端的安装差异

### Desktop

优先在官方桌面应用的「插件 → 添加插件」中安装本项目 Release 的 `.tgz` 地址或真实本地路径，按界面提示启用。官方桌面应用内置 pnpm，无需单独把 pnpm 加入 PATH。

需要终端操作时，先在桌面应用菜单通过 **Manage dsh Command…（管理 dsh 命令）** 安装或修复桌面随附命令。桌面应用至少启动一次后，使用「退出」完全关闭应用，再运行：

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-academic-ppt-0.8.0.tgz"
```

随后重新打开桌面应用。只关闭窗口通常会隐藏应用，Host 仍在运行。**npm 安装的 `dsh` 不允许修改官方 Desktop 的受管 profile**；桌面随附命令才能管理它。官方桌面端与 Web 共用 Host / 插件管理接口，但各自维护独立的可执行依赖与插件启用状态。[官方桌面命令与安装归属](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/desktop/README.md#bundled-command-runtime)

### Web

网页端插件运行在提供 Web UI 的 Host 上。本地文件路径应是该 Host 能读取的绝对路径；连接远程服务器时，浏览器所在电脑的本地路径不能代替服务器路径。

通过插件管理界面安装，或在 Host 上运行：

```sh
npx @deepseek-ai/dsh@latest plugin --profile web add "file:/absolute/path/to/dsh-academic-ppt-0.8.0.tgz"
npx @deepseek-ai/dsh@latest web
```

npm 版 CLI 的插件命令会调用 PATH 中的 pnpm；`--profile` 放在 `add` 前。使用最新预览版时，将两条命令中的 `@latest` 一并换成 `@next`，保持管理与启动运行时一致。CLI 增删或更新组合包后，重启相应 Web profile。界面安装按它返回的启用或重启提示操作。[官方 CLI 插件管理](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/apps/cli/reference/README.zh.md#插件管理) · [官方插件管理界面](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/client/ui-plugin-manager/README.md#installing-a-bundle)

下载、升级和启用检查见[安装与升级](INSTALL.md)。

## 实际验证了什么

两套独立运行时均使用 npm 发布的 DSH 包，未用自行模拟的注册表代替 Host。测试环境为 Linux、Node `24.22.1`、Cordis `4.0.5`；每套运行时执行 10 次真实工具调用。

| 验证路径 | rc.2 | rc.3 |
| --- | --- | --- |
| `ctx.tools.register` 接受 16 个工具，模型参数 schema 可读 | 通过 | 通过 |
| `ctx.skills.register` 可发现、加载技能正文并定位随包资源 | 通过 | 通过 |
| Host 执行查询返回 36 款卡片与完整 preparation 契约 | 通过 | 通过 |
| 以调用会话的 `session.header.cwd` 创建工程，读取记录批次、恢复上下文 | 通过 | 通过 |
| 经 Host 导出 PPTX 草稿，核验 OOXML 中原生形状和中文题名 | 通过 | 通过 |
| 检查当前产物，同时保持 `visual: not-verified` | 通过 | 通过 |
| 错误参数、工作区越界被拒绝；已取消调用不创建工程 | 通过 | 通过 |
| 卸载与重新挂载不遗留工具或重复技能 | 通过 | 通过 |
| 官方 app-boot 接受声明范围，并拒绝过早与 0.3 版本 | 通过 | 通过 |

现有工具注册、规范 JSON 输出、会话目录与取消信号接口可以沿用；本版补充明确的宿主版本声明、正确的两端安装说明和可重复的真实 Host 测试。上游 `master` 的协议还在迭代，源码核对固定在 `22ddee3792402c3e70ec5f86a63c3e3e895a2f60`；它的未发布内部实现不等同于 npm rc.3。

这些结果覆盖插件安装门槛和共享 Host 的注册、调用及导出路径；没有运行付费模型会话、桌面/Web GUI 全流程或 PowerPoint/WPS 编辑验收。此处的单页草稿是软件测试输入，不作为学术设计展示。

## 复跑 Host 兼容检查

在已安装本项目依赖的源码目录执行。下面固定 rc.3；验证默认发行版时，将四个 DSH 包的版本全部换成 `0.2.1-rc.2`。

```sh
npm install --prefix .test-output/dsh-runtime --ignore-scripts --omit=optional --no-audit --no-fund \
  @deepseek-ai/dsh-tools@0.2.1-rc.3 \
  @deepseek-ai/dsh-skill@0.2.1-rc.3 \
  @deepseek-ai/dsh-system-prompt@0.2.1-rc.3 \
  @deepseek-ai/dsh-app-boot@0.2.1-rc.3 \
  @deepseek-ai/cordis@4.0.5

node scripts/check-dsh-compat.mjs \
  --runtime-dir .test-output/dsh-runtime \
  --output .test-output/dsh-compat-report.json
```

检查脚本不安装软件、不读取密钥，也不修改已有 DSH profile；它只使用显式提供的独立运行时。测试工程在完成或失败时清理，指定的报告文件保留版本、用例和验证范围。
