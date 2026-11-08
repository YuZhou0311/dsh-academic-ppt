# 0.10.0-rc.2 安装与首次实测

本次是完整候选 bundle，不是只包含SKILL的补丁，也未发布成正式Release。使用随本轮交付的 `dsh-academic-ppt-0.10.0-rc.2.tgz`；无需解压或单独复制markdown。旧0.10.0-rc.1与0.9.1安装包不包含本轮修改。

## 安装前

备份工作区中的已有工程和PPTX。声明的Host范围仍为 `>=0.2.1-rc.2 <0.3.0-0`；Node为 `^22.19.0 || >=24.0.0`。不因本次候选自动切换模型、升级DSH或改动profile。依赖/接入实际测试见 [AUDIT_RC2](AUDIT_RC2.md)，范围声明不等于每个Host版本都实测过。

## 桌面端

在当前桌面应用的插件管理中更新/重新安装 `dsh-academic-ppt`，选取该TGZ或填写它在 **DSH所在电脑上的真实绝对路径**。若当前界面要求先卸载旧tarball插件，先完成卸载再用新包安装并启用；只操作本插件，不删除工作区。

路径示例（替换用户名与目录）：

```text
C:/Users/your-name/Downloads/dsh-academic-ppt-0.10.0-rc.2.tgz
/Users/your-name/Downloads/dsh-academic-ppt-0.10.0-rc.2.tgz
```

界面中的具体入口名称以实际DSH版本为准。完全退出后重启，并新建会话，避免旧会话已经加载的SKILL继续影响。核对插件详情版本 `0.10.0-rc.2`。

命令行用户必须使用**桌面应用自带**的dsh命令管理desktop profile，先完全退出应用：

```sh
dsh plugin --profile desktop add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.2.tgz"
```

不要用另装的npm/npx CLI修改桌面profile。详细背景及历史安装入口见 [INSTALL.md](INSTALL.md)。

## Web Host

使用启动该Web服务的同一DSH安装、DSH_HOME和profile；本地包路径必须在 **Host服务器** 上，而不是浏览器所在电脑：

```sh
dsh plugin --profile web add "file:/absolute/path/dsh-academic-ppt-0.10.0-rc.2.tgz"
```

自定义profile换成真实名称。完成后重启对应服务、启用插件并新开会话。

## 三个安装成功信号

1. 插件版本为 `0.10.0-rc.2`，19个 `academic_ppt_*` 工具可用，完整技能可按需加载。
2. `academic_ppt_contract(topic:design)` 返回当前版本、`evidence-art-direction-cases-rc2`，以及 `shared-scale / distribution-first / evidence-ledger / evidence-stage` 四个案例的实际PNG与解释路径。
3. 当前模型通过真实图片入口打开其中一页，并能指出具体画面关系；新生成PPTX能够实际render，非HTML/SVG预览替代。文件/工具成功不自动证明审美达标。

可选开发者离线检查（从插件源码/解包目录执行，正常用户不必手动操作）：

```sh
node bin/academic-ppt.mjs --version
node scripts/check-installation.mjs
node scripts/check-installation.mjs --render --output /absolute/new-smoke-dir --font-dir /absolute/local-font-dir
```

doctor只检查本地安装与可选实际渲染，不读密钥、不修改profile、不调用模型、不证明模型看懂图。没有内置字体文件；若缺字体，配置合法本地字体或选真实可用替代后复核实际渲染，不通过伪造supported或降低字号门槛解决。

## 建议直接发给DSH的首轮任务

先把真实论文、实验数据与所需参考PPTX放入该会话工作区，再发送：

```text
/dsh-academic-ppt
请用当前插件，根据工作区中我提供的真实材料，先制作3页可编辑科研汇报正文：方法页、关键结果页、多图证据页。先不要做封面，也不要扩成整套报告。

请先核对插件版本、当前构图案例入口，以及你是否真正能通过图片工具看到PNG。按相关案例的设计决策学习，不照抄整页，不运行案例生成脚本充当本次成果；你自行选择适合本次内容的配色、区域比例、证据组和阅读顺序。

本轮的设计来源选择、故事线和三页样张构图由你自主决定；已有明确材料/要求直接沿用，不把这些委托理解为我已认可成品。任何科学缺项仍须如实说明。

使用真实数据和图，保留单位、条件、误差与结论边界。先保存首稿并实际渲染，逐页看图，修正构图、图文关系与微排版后重新渲染。保留首稿、修订稿和具体修改记录。

把3页实际预览、可编辑PPTX、与参考的差异及尚未解决处给我看，然后停下来等我评价，不宣称我已经认可。
```

测试目的、迁移条件和需要回传的材料见 [首次实测指导](../skills/dsh-academic-ppt/references/first-run.md)。用新的真实材料测试；重复现有教学数据只能检验复现。保留实际模型显示名 Deepseek4.1flash1017，不擅自更换路由/模型或传入未经本次宿主验证的思考参数。
