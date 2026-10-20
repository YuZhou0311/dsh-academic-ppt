import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAcademicTools } from './tools.mjs'

export const name = 'dsh-academic-ppt'
export const inject = ['tools', 'skills']

export function readBundledSkill() {
  const directory = fileURLToPath(new URL('../skills/dsh-academic-ppt/', import.meta.url))
  const source = readFileSync(new URL('../skills/dsh-academic-ppt/SKILL.md', import.meta.url), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const header = /^---\n([\s\S]*?)\n---\s*\n/.exec(source)
  if (!header) throw new Error('学术汇报技能缺少 YAML 元数据。')
  const field = key => {
    const row = header[1].split('\n').find(line => line.startsWith(key + ':'))
    if (!row) return ''
    const value = row.slice(key.length + 1).trim()
    if (value.startsWith('"')) return JSON.parse(value)
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'")
    return value
  }
  const skillName = field('name'), description = field('description'), content = source.slice(header[0].length).trim()
  if (skillName !== name || typeof description !== 'string' || !description.trim() || !content) throw new Error('学术汇报技能的 name、description 或正文无效。')
  return { name: skillName, description, content, resourceBase: { kind: 'directory', path: directory }, source: 'runtime' }
}

export function apply(ctx, config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).length) {
    throw new Error('dsh-academic-ppt 当前不接受全局配置；请在工具参数和工程 brief/design 中指定需求。')
  }
  const disposers = []
  let disposed = false
  const release = () => {
    if (disposed) return
    disposed = true
    for (const dispose of disposers.reverse()) {
      try { dispose() } catch { /* The remaining registrations still need cleanup. */ }
    }
  }
  try {
    try { disposers.push(ctx.skills.register(readBundledSkill())) }
    catch (error) { ctx.logger?.warn?.(`[dsh-academic-ppt] 技能加载失败：${String(error?.message || error).slice(0, 500)}`) }
    for (const definition of buildAcademicTools()) disposers.push(ctx.tools.register(definition))
    ctx.on?.('dispose', release)
  } catch (error) {
    release()
    throw error
  }
}

export { buildAcademicTools, TOOL_COMMANDS } from './tools.mjs'
