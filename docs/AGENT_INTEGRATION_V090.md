# 0.9.0 Agent 指导注入与工作流接入验证

核验日期：2026-10-27。审阅起点：`3464740`。本轮针对官方接入方式、模型可见请求和检查点状态流转，不重新评价科研样稿的审美质量。公开报告只包含合成软件测试，不包含用户 Session、商业模板或真实模型凭证。

## 1. 核验结论与范围

Host bundle、运行时技能、工具注册和随包资源路径符合已发布 DSH `0.2.1-rc.2` / `0.2.1-rc.3` 的接口。两版均已运行真实官方 AgentLoop，检查技能目录、完整正文、实际参考文件读取与学术工具结果确实进入 provider 接收到的请求。仅 provider 的响应内容由脚本固定；没有调用真实模型 API。

此前的 `check-dsh-compat.mjs` 只验证官方服务注册和工具管线，没有启动 AgentLoop。它继续作为服务层回归保留；新增的 `check-dsh-agent-injection.mjs` 承担请求层验证，两者不能混称。

本轮发现并修复六类问题：必需技能失败被吞、工具使用初始目录、进程内写入未核验会话策略、真实样张前的视觉确认循环、仅记录反馈却清除已有验证、恢复输出丢失具体选择。对应实现及负向回归均随本提交保存。

## 2. 官方约定与当前实现

### 按需注入的真实路径

1. Bundle patch 挂载 Host 插件；`apply` 注册技能与19个工具，并依赖 `tools`、`skills`、`workingDirectory`、`sandboxPolicy`。
2. 官方 `dsh-tool-skill` 在 Agent 步骤开始时按当前 scope 和目录提供技能名称与摘要。目录不是完整工作流。
3. 模型调用 `skill({name:"dsh-academic-ppt"})` 后，完整正文及 `resourceBase` 进入工具历史。用户显式输入 `/dsh-academic-ppt` 时，官方消费者可在当前步骤直接注入同一正文。
4. Agent 根据正文读取 `references/workflow-v090.md` 等具体资源。引用文件不递归自动加载，也不需要复制到用户技能目录。
5. 学术工具的名称、描述与 wire schema 由官方工具服务进入模型请求；执行结果通过本插件 `output.render` 进入后续请求。canonical value 与模型看到的文本分别验证。

依据：[官方技能子系统](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/docs/subsystems/skills.md)、[tool-skill 文档与调用入口](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/skill/tool-skill/README.md)、[Host bundle 规范](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/preset/agent-preset/skills/cordis-plugin-development/references/host-plugin.md)。

### 类似插件的源码对照

| 对照实现 | 已核对的做法 | 本插件的处理 |
| --- | --- | --- |
| [官方 Office skill provider](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/skill/skill-office/src/index.ts) | 随包资源目录、按需技能正文、官方 skill 消费者 | 保留同一类按需加载结构；不把所有指南常驻注入无关任务。 |
| [literaf/dsh-paper-slides](https://github.com/literaf/dsh-paper-slides/blob/6199fed304c7e588f5201531bb04fe3a1745b520/src/index.ts) | 工具加长技能，另有短 system-prompt 路由提示和伙伴工具检测 | 短提示是该包的组合选择，并非官方必需；当前采用已核验的官方技能目录与显式调用入口，工具可见性按实际 Agent scope 验证。 |
| [STARDUSTLC666/dsh-ppt](https://github.com/STARDUSTLC666/dsh-ppt/blob/062edd14fabbdc9fcacb735efb0ddcd45af40ced/src/index.ts) | 运行时技能与工具一起注册，生命周期清理；技能失败仅警告后继续 | 注册结构可参考；本插件将学术工作流视作必需能力，改为失败停止激活，避免只有工具而没有指导。 |

社区实现用于比较真实接入方式，不作为其正确性、生成质量或用户满意度的证明。

### 固定版本

| 对象 | 固定源码身份 |
| --- | --- |
| DSH rc.2 | `687f282e8625c6b8d11ff58211a90524be2e4317` |
| DSH rc.3 | `1f81c047fc48fa190a683e469daa699857e9afe8` |
| 本轮另行审阅的 master | `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` |

两版已发布包的关键技能与工具实现一致。上述 master 已拆分 native/PTC 工具执行器，不能把其架构或根目录版本字段当成已发布 rc.3 的运行证据。本轮运行测试固定 npm 包版本，不使用 `latest` 或 master 代替。

## 3. 真实 Agent 请求验证

| 项目 | rc.2 | rc.3 |
| --- | ---: | ---: |
| 官方 AgentLoop 生成的 provider 请求 | 31 | 31 |
| 实际工具管线调用 | 24 | 24 |
| 成功工具结果 | 16 | 16 |
| 预期输入、权限或图像能力拒绝 | 8 | 8 |
| provider 可见学术工具 | 19 | 19 |

机器报告：[rc.2](validation/v090/dsh-agent-injection-rc2.json)、[rc.3](validation/v090/dsh-agent-injection-rc3.json)。报告保存实际包版本、源码与技能正文摘要、逐项检查和验证边界；正文长度以各自报告为准。

实际断言覆盖：

- 初始技能目录含名称/描述，尚未装载正文；不重复发布未变化的目录。
- `skill` 返回的完整正文、资源包装与下一轮 provider 请求逐字一致；初始注册来源明确为插件自己的 runtime 定义，未用 filesystem provider 掩盖注册失败。
- 从收到的资源目录调用官方 `read`，真实读取工作流文件，逐行核对进入后续请求的内容。
- 19个工具名称、说明和参数逐项一致；卡片48项、页型32项、完整故事板契约、init/context 结果可达。
- 显式用户调用在首个请求注入全文；同一消息重复技能名不会重复注入。
- Agent scope 限制、同名运行时技能、卸载和重挂时，schema 与替换目录按官方规则变化；历史中已加载正文不会被误称已撤回。
- 文件系统技能发现另开场景验证：只发现技能不会注册19个业务工具；同名来源只产生一个目录胜出项。
- 缺失实际 `SKILL.md` 的不完整包在真实 Cordis 中激活失败，没有残留学术工具。
- 通过官方工作目录服务切换目录后，模型可见目录与 `init` 的实际输出目录一致；不改变 `process.cwd()`，初始 Session header 保持不变。
- 同一实际会话使用官方 `SandboxPolicyService` 与 `SandboxedFileSystem`，对照学术 `init` 与官方 `write`：原工作区内允许；切换到未授权目录B后均拒绝且不留下文件；切到 `read-only` 后写入被拒绝但 cards/context 可读；恢复工作区写入后立即生效。受控全访问对照仅修改隔离测试会话，随后恢复。
- 目录B先通过官方 `writableRoots` 核对，确认既不属于原工作区也不属于平台临时目录；测试不会把官方允许的临时文件误报为越权。
- 无效参数和项目路径越界成为模型可见错误，不能伪装成操作成功。

### 图片输入也核对实际内容

普通 `read` 只读文字，不能把它读取工作流文件的成功误称为看过模板。新增场景使用官方 `read_image`、`dsh-attachment-local` 和独立 `dshHome`，将一张原创8×6 PNG送入下一轮provider请求。断言原生image block确实存在，并通过实际附件store核对115字节图片、SHA-256与像素；只声明文本输入和能力未知的两条实际模型路由均被官方工具拒绝，且没有image block。

这只证明图片输入及可核验身份送到模型接口，不证明脚本化provider理解了图片，更不等于完成模板的视觉评价。指南明确区分PNG页面与卡片SVG/HTML：后两者先经实际截图/渲染得到受支持图片；profile、OCR和路径本身都不能充当看图依据。图片入口与格式规则见 [deepseek.md](../skills/dsh-academic-ppt/references/deepseek.md)。

所有 Session 都使用内存 Store；临时工作区、技能来源和目录显式指定，默认技能目录扫描与 watcher 关闭。没有加载用户 profile、持久会话、真实模型 adapter 或认证配置。

## 4. 已修复的具体问题

| 问题 | 原有影响 | 修复及验证 |
| --- | --- | --- |
| 技能读取/注册异常被吞 | 工作流缺失时仍显示工具已注册 | 必需技能失败使激活失败，回滚本插件资源；真实缺文件包与注册失败回归覆盖。 |
| `session.header.cwd` 被当成当前目录 | 会话切目录后，官方读文件与学术工具可能操作不同目录 | Host 注入 `workingDirectory`，每次调用使用 `ensure(agent, signal)`；真实目录切换用例在修复前失败、修复后两版通过。 |
| 原生文件写入没有核验 DSH 会话策略 | `read-only` 仍可能写文件；切换目录可能扩大插件自己的写入范围 | 在业务执行前取得真实 `sandboxPolicy`；只读拒绝写，工作区写入检查独立授权根与 canonical cwd，未知策略对写入拒绝。条件报告输出也按副作用分类，真实官方文件工具在同一会话内对照。 |
| checkpoints 在制作视觉候选前要求视觉确认 | 用户需要先看样张，却被提前要求选择配色、形态等 | `designDialogue.nextAction:prepare-pilot-candidates` 明确先做候选，提问时机为真实渲染之后；生图参考可用时保留其候选提示，不自动填确认。同步修正旧`card-design.md`中“先确认才返回生图批次”的矛盾段落。 |
| 只记录反馈也清除渲染与审查 | 认可同一份样张后被迫重建、重渲染、重审 | 只有协商决定或故事板决定变化且其他内容完全相同、已有构建产物完整时，保留同一产物及原审查。仍递增工程修订和历史，保留原构建修订、哈希、时间和审查结果。 |
| 恢复只返回主题名；重要信息易被长输出挤掉 | Agent 不知道具体已选方案，可能重复问或猜测 | context 返回具体决定、真实回答、理由与参考路径；持久文本优先输出决定摘要、下一步和错误修复项，并指向完整记录。 |

当前目录语义依据：[官方 WorkingDirectoryService](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/session/working-directory/src/index.ts)。纯 CLI/直接 API 继续使用调用者明确传入的工作目录；Host 目录服务失败不会回退旧目录继续写文件。

### 文件策略的适用范围

当前目录和授权根分别解析。工作区写入模式的根与固定官方版本一致：原始会话工作区、`/tmp`、`os.tmpdir()`；核心 `safePath` 再把工程及输出限制在本次调用的 cwd 内。读取工具仍可查询；会写 profile 的 `template`、会保存审查的 `review` 等均归为写入。`prepare`/`portfolio` 只有指定输出文件时归为写入，`plan` 只有提交请求时归为写入，未来未分类的工具默认按写入处理。

这是受信任插件代码的进程内文件策略核验，不是操作系统沙箱。它不对并发替换目录、第三方 renderer 内部任意行为或直接 CLI/core 调用提供系统隔离；长调用以开始时解析的策略为准。没有新增提权参数，也没有静默改变用户模式。依据：[官方 policy](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/sandbox/sandbox-policy/src/index.ts)、[官方可写根](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/sandbox/sandbox/src/roots.ts)。回归见 [host-access.test.mjs](../test/host-access.test.mjs) 和实际 Agent 请求脚本。

### 保留验证的严格边界

只把协商回答、委托和 `storyboard.decision` 视作决定元数据；`consultation.interaction` 仍参与比较，因为它决定工作流检查模式。实际色板、字体、brief、论文、论点、资产、页面、参考学习、能力记录和故事板页面均在保护范围内。这些内容变化、文件摘要变化、renderer 变化或 undo 仍使旧构建失效。`needs-fix` 原样保留，不能被反馈记录变成 passed；未知图像能力仍阻断自动视觉验收。

`pilot-review` 不会自动补全所有协商主题。必须先记录真实选择，再用实际样张渲染与逐页观察登记样张决定。保留同一画面不表示发生了一次新的看图。

最终 deliver 重新生成当前质量报告、故事板和重建工程，不复制旧质量报告中的待确认状态。原生 PPTX/PNG 与原审查可以复用，当前决定与来源记录保持准确。回归见 [checkpoint-feedback.test.mjs](../test/checkpoint-feedback.test.mjs)；用合成内容与明确标记的软件审查 fixture 检验状态，不冒充真人批准。

## 5. 复跑

从源码目录安装独立测试运行时。以下为 rc.3，测 rc.2 时替换所有 DSH 包版本：

```sh
npm install --prefix .test-output/dsh-runtime --ignore-scripts --no-audit --no-fund \
  @deepseek-ai/dsh-tools@0.2.1-rc.3 \
  @deepseek-ai/dsh-skill@0.2.1-rc.3 \
  @deepseek-ai/dsh-system-prompt@0.2.1-rc.3 \
  @deepseek-ai/dsh-app-boot@0.2.1-rc.3 \
  @deepseek-ai/dsh-agent-loop@0.2.1-rc.3 \
  @deepseek-ai/dsh-tool-skill@0.2.1-rc.3 \
  @deepseek-ai/dsh-fs-local@0.2.1-rc.3 \
  @deepseek-ai/dsh-fs-sandbox@0.2.1-rc.3 \
  @deepseek-ai/dsh-sandbox-policy@0.2.1-rc.3 \
  @deepseek-ai/dsh-attachment-local@0.2.1-rc.3 \
  @deepseek-ai/dsh-tool-fs@0.2.1-rc.3 \
  @deepseek-ai/dsh-skill-filesystem@0.2.1-rc.3 \
  @deepseek-ai/cordis@4.0.5

node scripts/check-dsh-compat.mjs \
  --runtime-dir .test-output/dsh-runtime \
  --output .test-output/dsh-host.json

node scripts/check-dsh-agent-injection.mjs \
  --runtime-dir .test-output/dsh-runtime \
  --output .test-output/dsh-agent-injection.json \
  --artifacts-dir .test-output/dsh-agent-trace

DSH_REQUIRE_REAL_RENDER=1 node --test test/checkpoint-feedback.test.mjs
```

最后一项需要本项目的可选 LibreOffice Kit 依赖和可用 DejaVu 字体，CI 的实际渲染 job 强制执行，缺失时失败。两版 Host 矩阵独立执行请求层脚本，缺包不会以 skip 代替成功。普通单测环境未安装独立 DSH 运行时时可跳过注入测试，不作为该层验证通过。

独立Host运行时安装保留optional依赖，因为官方附件实现的图片处理需要对应平台的sharp包；这与本项目可选的LibreOffice渲染引擎是不同依赖。

`--artifacts-dir` 保存合成的 provider 请求、工具结果和 Session 事件，供检查传播路径。脚本只使用显式运行时，不安装依赖或修改用户 DSH 配置。

## 6. 未覆盖的边界

- provider 返回是脚本化工具选择，未证明某个真实模型会自主遵循所有指导或做出优秀 PPT。
- 捕获位置是官方模型 adapter 接口，未验证特定服务商的 HTTP 序列化或 API。
- 未运行用户 Desktop/Web GUI 的安装升级、实际自定义 preset、远程文件 provider 或 PTC/run_code。
- PTC 中内部技能结果需按运行时规则返回或打印；仅执行成功不能证明模型看到正文。官方 [Office 文档](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/skill/skill-office/README.md)说明了该边界。
- 指令到达、工具运行、状态检查与学术审美验收是不同层次。本报告不以请求或测试数量代替用户视觉验收。
