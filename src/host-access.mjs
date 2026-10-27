/** DSH current-directory resolution and standing write authority are separate.
 * This fence protects trusted in-process operations; it is not an OS sandbox.
 * Root semantics follow published DSH rc.2/rc.3 dsh-sandbox.writableRoots:
 * https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/packages/sandbox/sandbox/src/roots.ts
 */
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'

const readOnlyTools = new Set([
  'academic_ppt_context', 'academic_ppt_check', 'academic_ppt_reference',
  'academic_ppt_contract', 'academic_ppt_cards', 'academic_ppt_layouts',
])

export function operationWrites(name, args = {}) {
  if (readOnlyTools.has(name)) return false
  if (name === 'academic_ppt_prepare' || name === 'academic_ppt_portfolio') return Boolean(args.outputPath)
  if (name === 'academic_ppt_plan') return Boolean(args.requestPath)
  // New tools must opt into the read-only list; unknown effects stay fenced.
  return true
}

function beneath(root, path) {
  const part = relative(root, path)
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep))
}

export async function assertHostOperationAccess({ name, args, cwd, policy, signal }) {
  signal?.throwIfAborted()
  if (!operationWrites(name, args)) return
  if (policy?.mode === 'danger-full-access') return
  if (policy?.mode === 'read-only') {
    throw new Error('ACADEMIC_WRITE_DENIED: DSH 当前为 read-only；此操作会写入文件。读取工程与查询参考仍可继续，写入需由用户在宿主明确允许。')
  }
  if (policy?.mode !== 'workspace-write' || typeof policy.workspaceRoot !== 'string' || !isAbsolute(policy.workspaceRoot)) {
    throw new Error('ACADEMIC_WRITE_POLICY_REQUIRED: 无法取得有效的 DSH 会话写入策略，未执行文件写入。')
  }
  // Core safePath further confines every project/output path to this canonical
  // cwd. Checking cwd against the independent policy roots covers that subtree.
  const current = await realpath(cwd)
  for (const granted of [policy.workspaceRoot, '/tmp', tmpdir()]) {
    let root
    try { root = await realpath(granted) }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue
      throw error
    }
    signal?.throwIfAborted()
    if (beneath(root, current)) return
  }
  throw new Error('ACADEMIC_WRITE_DENIED: 当前目录不在 DSH 会话的可写工作区或平台临时目录内。切换目录不会扩大权限；请回到已授权目录，或由用户在宿主明确调整权限。')
}
