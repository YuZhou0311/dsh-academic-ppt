# 0.10.0-rc.4 安装与试作

本轮是完整本地候选 bundle，不是补丁。安装 `dsh-academic-ppt-0.10.0-rc.4.tgz`，无需解压。未合并远程主分支、更新原 PR 或发布 Release。旧包不含正文构图入口。

## 安装与识别

备份原工作区工程，保留已经取得的论文、图片和笔记。使用当前 DSH 的插件管理更新/重新安装完整 TGZ，启用后完全退出、重启，再开新会话。Web Host 使用服务器实际路径；桌面使用本机路径，不把 ChatGPT 的 sandbox 链接当作本地文件。

桌面命令必须使用桌面应用管理的 dsh，退出应用后：

```sh
dsh plugin --profile desktop add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.4.tgz"
```

Web 复用正在运行服务的实际 DSH_HOME、运行时和 profile：

```sh
dsh plugin --profile web add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.4.tgz"
```

界面与升级入口以本次宿主实际版本为准；不要另装 CLI 修改桌面 profile。声明兼容范围保持 `>=0.2.1-rc.2 <0.3.0-0`；本轮官方原生工具链检查针对 rc.3，未覆盖全部声明版本或用户桌面界面。

核对：版本 **0.10.0-rc.4**；指导标识 **content-composer-rc4**；19 个工具；`contract(topic:authoring)` 返回递归内容树契约、引用 schema 与真实示例路径。没有这个 topic，说明仍加载旧版。

正常 `academic_ppt_init` 新建工程默认 `authoringMode:content-tree`。旧工程不会自动迁移；建议新建工程复用原材料，而不是沿用旧自动布局。底层 SDK 直接调用与历史文件保持兼容；这与 Agent 默认入口不同。

## 简短试作任务

无需用户替 Agent 指定几何参数、反复强调卡片或每一处字号。把真实材料放在当前工作区，发送：

```text
/dsh-academic-ppt
核对0.10.0-rc.4。复用工作区已有论文、原图和取证笔记，新建工程，不覆盖旧报告。
这次只重做方法、结果、多图证据3页。设计与故事线由你自主判断，但不代表我认可成品。按当前技能通过正常构图工具完成，不复制教学数据或运行样张脚本冒充新报告。
保存首稿和修订稿，实际逐页看图后修改。展示当前PPTX、PDF和PNG链接，结束本轮等我评价，不扩成整稿，也不要弹视觉确认框。
```

观察实际工具记录，应出现 `contract(authoring)` 与 `plan` 的 `compose-page` 请求。只出现 `record(slides)` + `figure-focus`，不是新的默认制作路径；明显失败时应按报错重排，不能降级 authoringMode、改 reviewer 或登记假批准。

`render` 的 `userPreview.presented` 只说明文件交给宿主，不代表你已打开或认可。图像接收收据也只证明图片被读入，不证明模型理解。最终审美仍看实际三页。

## 开发者核对

```sh
node bin/academic-ppt.mjs --version
node scripts/check-installation.mjs
node scripts/check-package.mjs
node --test test/page-authoring.test.mjs test/host-visual-workflow.test.mjs
node scripts/check-host-visual-path.mjs --runtime-dir .test-output/dsh-runtime --output .test-output/host-rc4.json
```

官方 Host 脚本不调用模型网络；它验证构图输入、导出、实际渲染、read_image、present 和反馈时序。不能称为真实 DeepSeek 自主创作测试。字体由本机提供，不随包分发。
