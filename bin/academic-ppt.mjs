#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildAcademicTools, TOOL_COMMANDS, formatToolResult } from '../src/tools.mjs'
import { toolSchemas } from '../src/schema.mjs'

const CONTRACT_TOPICS = toolSchemas.academic_ppt_contract.properties.topic.enum.join(' / ')
const CLI_NAME = 'dsh-academic-ppt'

const HELP = `DSH Academic PPT — 学术汇报工程工具

用法：
  ${CLI_NAME} <命令> --args <JSON 文件> [--json]
  ${CLI_NAME} <命令> --help
  ${CLI_NAME} <命令> --schema
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
  prepare   分阶段讨论设计与模板偏好，规划宿主参考学习和生图
  cards     查询48种卡片（含12款图片嵌入卡）的用途、尺寸和槽位
  template  提取模板设计语法与受支持原生组件
  reference 检索48种中性页型（includeExamples显式查看示范）
  render    用可选引擎渲染当前 PPTX 的实际页面
  study     比较实际候选SVG/PPTX，可生成真实预览
  portfolio 比较指定工程的主体结构，供视觉复核
  review    记录实际完成的视觉检查
  plan      登记问题与证据故事板，确认当前真实样张
  layouts   按内容关系查询32种整页学术语法
  deliver   通过最终检查后生成可恢复交付包，阻止草稿冒充成品

--args 必须指向 UTF-8 JSON 对象文件，路径相对当前目录解析。
--json 输出结构化结果，供程序使用；默认输出精简摘要。
<命令> --help 查看该命令的必填与可选参数；--schema 输出该命令的完整 JSON Schema。
这两个查询不需要 --args，也不能与 --args 或 --json 混用。
contract 的 topic 仅支持：${CONTRACT_TOPICS}。
init、build、render 等命令参数请用该命令的 --help 或 --schema 查询。
不会读取 API 密钥或主动调用模型，不替代论文阅读与视觉验收。
`

function fieldSummary(field) {
  const type = field.type === 'array' ? `array<${field.items?.type || 'value'}>` : field.type || 'value'
  const details = [type]
  if (field.enum) details.push(`可选值 ${JSON.stringify(field.enum)}`)
  for (const key of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (field[key] !== undefined) details.push(`${key}=${field[key]}`)
  }
  return details.join('；')
}

function commandHelp(command, tool, schema) {
  const required = new Set(schema.required || [])
  const lines = [
    `${CLI_NAME} ${command} — ${tool.name}`, '', tool.description, '',
    '用法：', `  ${CLI_NAME} ${command} --args <JSON 文件> [--json]`,
    `  ${CLI_NAME} ${command} --schema`, '',
    '参数（写入 --args 指定的 JSON 对象）：',
  ]
  for (const [key, field] of Object.entries(schema.properties || {})) {
    const requirement = command === 'review' && key === 'observations' ? '当前 academic 工程必填' : required.has(key) ? '必填' : '可选'
    lines.push(`  ${key} [${requirement}] ${fieldSummary(field)}`)
    const description = key === 'projectPath' ? 'init返回的project.json文件路径，不是工程目录。' : (tool.parameters.properties?.[key]?.description || field.description || '').split('Runtime validation:')[0].trim()
    if (description) lines.push(`    ${description}`)
  }
  if (command === 'record') lines.push('', '推荐通过 recordsPath 提交内容批次；保留内联 CLI 参数兼容。recordsPath 与内联内容不能同时提交。')
  lines.push('', `完整参数与嵌套字段：${CLI_NAME} ${command} --schema`, `contract 只查询记录字段，其 topic 仅支持：${CONTRACT_TOPICS}。`)
  return lines.join('\n') + '\n'
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.length === 1 && ['--help', '-h', 'help'].includes(args[0])) { process.stdout.write(HELP); return }
  const command = args.shift()
  const toolName = Object.hasOwn(TOOL_COMMANDS, command) ? TOOL_COMMANDS[command] : undefined
  if (!toolName) throw new Error(`未知命令：${command}。用 --help 查看用法。`)
  let input, asJson = false, discovery
  while (args.length) {
    const flag = args.shift()
    if (flag === '--args' && input === undefined && args.length && !args[0].startsWith('--')) input = args.shift()
    else if (flag === '--json' && !asJson) asJson = true
    else if (['--help', '-h', '--schema'].includes(flag) && discovery === undefined) discovery = flag === '--schema' ? 'schema' : 'help'
    else throw new Error(`未知或重复参数：${flag}。用 --help 查看用法。`)
  }
  const tool = buildAcademicTools().find(item => item.name === toolName)
  if (discovery) {
    if (input !== undefined || asJson) throw new Error('--help / --schema 是参数查询，不能与 --args 或 --json 混用。')
    process.stdout.write(discovery === 'schema' ? JSON.stringify(toolSchemas[toolName], null, 2) + '\n' : commandHelp(command, tool, toolSchemas[toolName]))
    return
  }
  if (!input) throw new Error(`请提供 --args JSON_FILE；用 ${command} --help 或 ${command} --schema 查看该命令参数。`)
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
    const value = await tool.execute(payload, { signal: controller.signal, agent: { session: { header: { cwd: process.cwd() } } } })
    process.stdout.write(asJson ? JSON.stringify(value, null, 2) + '\n' : formatToolResult(toolName, value) + '\n')
    if (value?.ok === false) process.exitCode = 2
  } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
}

main().catch(error => {
  process.stderr.write(`${CLI_NAME}：${String(error?.message || error).slice(0, 1200)}\n`)
  process.exitCode = 1
})
