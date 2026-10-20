#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const HELP = `DSH Academic PPT — 学术汇报工程工具

用法：
  academic-ppt <命令> --args <JSON 文件> [--json]
  node bin/academic-ppt.mjs <命令> --args <JSON 文件>

命令：
  init      创建工程与汇报要求
  contract  按需读取一类记录的完整字段契约
  record    从recordsPath批次登记论文、论点、素材与页面（兼容内联CLI）
  context   获取下一阶段的精简上下文
  build     导出可编辑 PPTX、HTML 与检查材料
  edit      按稳定 ID 与修订号局部修改
  undo      以新修订恢复上一工程状态
  check     检查证据、版式和产物一致性
  template  提取模板设计语法与受支持原生组件
  reference 检索48种中性页型（includeExamples显式查看示范）
  render    用可选引擎渲染当前 PPTX 的实际页面
  review    记录实际完成的视觉检查

--args 必须指向 UTF-8 JSON 对象文件，路径相对当前目录解析。
--json 输出结构化结果，供程序使用；默认输出精简摘要。
不会读取 API 密钥或主动调用模型，不替代论文阅读与视觉验收。
`

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.length === 1 && ['--help', '-h', 'help'].includes(args[0])) { process.stdout.write(HELP); return }
  const command = args.shift()
  let input, asJson = false
  while (args.length) {
    const flag = args.shift()
    if (flag === '--args' && input === undefined && args.length && !args[0].startsWith('--')) input = args.shift()
    else if (flag === '--json' && !asJson) asJson = true
    else throw new Error(`未知或重复参数：${flag}。用 --help 查看用法。`)
  }
  if (!input) throw new Error('请提供 --args JSON_FILE。')
  const { buildAcademicTools, TOOL_COMMANDS, formatToolResult } = await import('../src/tools.mjs')
  const toolName = TOOL_COMMANDS[command]
  if (!toolName) throw new Error(`未知命令：${command}。用 --help 查看用法。`)
  const controller = new AbortController()
  const cancel = () => controller.abort(new Error('操作已取消。'))
  process.once('SIGINT', cancel)
  process.once('SIGTERM', cancel)
  try {
    const path = resolve(process.cwd(), input), info = await stat(path)
    if (!info.isFile() || info.size === 0 || info.size > 16 * 1024 * 1024) throw new Error('--args 需要非空普通文件，且不超过 16 MiB。')
    const bytes = await readFile(path, { signal: controller.signal })
    if (bytes.length !== info.size || bytes.length > 16 * 1024 * 1024) throw new Error('--args 文件在读取时发生变化。')
    let payload
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')) }
    catch { throw new Error('--args 文件不是有效的 UTF-8 JSON。') }
    const tool = buildAcademicTools().find(item => item.name === toolName)
    const value = await tool.execute(payload, { signal: controller.signal, agent: { session: { header: { cwd: process.cwd() } } } })
    process.stdout.write(asJson ? JSON.stringify(value, null, 2) + '\n' : formatToolResult(toolName, value) + '\n')
    if (value?.ok === false) process.exitCode = 2
  } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
}

main().catch(error => {
  process.stderr.write(`academic-ppt：${String(error?.message || error).slice(0, 1200)}\n`)
  process.exitCode = 1
})
