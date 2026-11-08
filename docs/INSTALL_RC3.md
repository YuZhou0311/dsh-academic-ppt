# 0.10.0-rc.3 安装与三页重试

这是完整候选bundle。使用本轮提供的`dsh-academic-ppt-0.10.0-rc.3.tgz`，无需解压；旧rc.2不含当前修复。没有合并主分支或发布正式Release。

## 安装

先备份已有工作区工程，保留论文、图像及取图笔记。通过当前DSH应用的插件管理更新/重新安装本插件，选取TGZ或填写它在DSH所在电脑上的真实绝对路径。Web Host在服务器运行时，路径必须位于服务器。完全退出并重启，新建会话；不要继续使用已经加载旧SKILL正文的长会话。

桌面CLI必须用桌面应用自带命令，完全退出应用后：

```sh
dsh plugin --profile desktop add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.3.tgz"
```

Web复用该服务实际的DSH_HOME、运行时及profile：

```sh
dsh plugin --profile web add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.3.tgz"
```

路径改为真实值；界面入口以实际版本为准。不要用另装CLI去修改桌面profile。声明Host范围仍为`>=0.2.1-rc.2 <0.3.0-0`，Node为`^22.19.0 || >=24.0.0`。新实时链路在官方0.2.1-rc.3隔离环境测试，未验证每个声明范围内的版本，也未验证你的界面显示。

## 核对三个标志

插件版本`0.10.0-rc.3`；指导修订`source-figures-visible-feedback-rc3`；design契约返回6个构图教材，包括method-feedback和paired-evidence。19个academic_ppt工具仍存在。模型设置沿用当前实际路由，不读密钥、不额外配置模型服务。

`academic_ppt_render`结果中会出现userPreview。presented只说明文件成功交给宿主，不是用户已看或认可。视觉确认应在助手消息结束后查看PDF/PNG并自然语言回复，不弹阻塞选择框。若unavailable，应由Agent给出当前文件路径和具体缺少的展示入口，不能要求盲批。

## 直接发给DSH

先将原工作区论文、已下载图片与取图笔记保留在当前可读工作区。可以使用新的项目目录，避免覆盖上次报告。

```text
/dsh-academic-ppt
核对插件0.10.0-rc.3及指导source-figures-visible-feedback-rc3。继续使用工作区已经取得的论文、图片和笔记，不从头重复大规模检索，也不要覆盖上次报告。

先扫描真实取图目录，建立figure-inventory；逐图核对图注、能解释的内容、适用页面和未采用原因。下载成功但缺图注，不得写成没有取得图片；缺失的图注只补查相应来源，不猜方法与结果。

这次只重做3页正文：有来源支持的方法关系页、以原图为主体的结果页、两组相关证据共同解释的多图页。根据真实信息重新构图，不套教学坐标，不把一段方法写成三个编号句，不把论文图缩成装饰。不够支撑的部分如实说清，不凑图。

设计和三页故事线由你自主选择；这不是对成品的认可。先保存首稿，实际渲染并逐页read_image；发现问题后先改构图和图文关系，再改细节，重新渲染并查看变化页。只给实际看过的当前单页登记审稿。

用present给出当前完整预览PDF、正文PNG和候选PPTX，在最终消息附可打开的宿主文件链接，然后结束本轮等我自然语言评价。不要调用视觉确认弹窗，也不要先制作整套16页后才问。
```

若恢复旧工程触发缺清单/缺单页收据，按报错补充，不更换reviewer、伪造确认或跳过工具。收据是会话内存，重启或换会话须重新打开当前图片。

## 开发者检查（正常安装无需手动执行）

```sh
node bin/academic-ppt.mjs --version
node scripts/check-installation.mjs
node scripts/check-installation.mjs --render --output /absolute/new-directory --font-dir /absolute/local-font-directory
node scripts/check-host-visual-path.mjs --runtime-dir .test-output/dsh-runtime --output .test-output/visual-path.json
```

不分发字体文件；字体目录只用于合法本地渲染。doctor不调用模型，不证明审美达标。完整验证和限制见[AUDIT_RC3.md](AUDIT_RC3.md)。
