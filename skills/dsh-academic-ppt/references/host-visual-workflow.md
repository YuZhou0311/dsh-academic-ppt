# Host实时图片收据与用户可见预览

## 两条独立链路

- `read_image`成功返回真实image附件：模型图片输入链路。插件按成功图片结果与当前单页PNG字节绑定；宿主归一化/缩放附件时，只在调用前后源文件字节未变时关联，另保留附件SHA，不接受文本路径、失败调用或联系表代替每页。
- `present`成功返回文件引用：用户文件展示链路。它不证明用户已打开或认可。官方Host可能在turn结束时才显示文件卡，因此渲染后的视觉确认不用阻塞ask_user_question；先在最终消息附宿主文件链接，结束turn，再等自然回复。

## 自动行为

`academic_ppt_render`在原有返回值外增加userPreview。默认尝试通过同一Host工具流水线、同一agent/session、同一取消信号与权限调用present。最多4份：当前全稿PDF、首张联系表、优先困难页及另一正文PNG。缺少present或失败时返回unavailable，不伪造成功，也不影响保存已经完成的渲染。内部批次可传publishPreview:false；确认前必须另行展示。

对活动工程调用ask_user_question时，问题含视觉样张/配色/版式/最终确认而已有渲染，插件拒绝阻塞弹窗并给出非阻塞反馈指令。最初的资料范围/故事线等文字澄清不拦截；这是定向辅助规则，不是万能自然语言识别器。

Host内登记vision-model/pptx-render逐页审查时，所有reviewedSlides须有当前PNG的真实图片输入收据。相同字节可复用；字节改变、只看联系表、失败图片调用、其他会话的读取，均不算。successful-image-receipt只是传输证据，不认证模型理解。

六页以上且已指定pilot的工程，不可在pilot-review之前通过record新增非样张页；取证与改已有页不受影响。新的整稿review构建若用了本地来源图，需要先记录figure-inventory；草稿可正常生成。工具不替用户批准，也不接管宿主模型配置。

## 范围与限制

收据只存在当前Host会话内存，不读用户会话历史、密钥或其他工程。插件重载/新会话需要重新打开当前单页并重新展示预览；这是安全的保守行为。CLI没有Host图片/展示链路，继续接受既有人工或调用者审查，但不得冒称通过了实时Host验证。现有源图判断与人工审稿仍是声明，不能把human当作绕过模型检查的开关。

PTC内部工具结果到模型的上下文传递由宿主管理；本插件记录成功的真实图片附件结果，不据此宣布具体provider理解了图像。本次回归重点是native流水线，不声明用户Desktop/Web界面实机验收。

上游契约：
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/deliverables/tool-present/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/en/reference/tool-execution-pipeline.md
