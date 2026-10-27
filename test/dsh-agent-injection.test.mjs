import test from 'node:test'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { checkDshAgentInjection, runtimeDirectoriesFromEnvironment } from '../scripts/check-dsh-agent-injection.mjs'

for (const runtimeDir of runtimeDirectoriesFromEnvironment()) {
  let available = false
  try {
    await access(join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh-tool-skill', 'package.json'))
    available = true
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  test(`published DSH agent injection through scripted provider: ${runtimeDir}`, {
    // A configured runtime is a required integration gate, never a silent skip.
    skip: available || process.env.DSH_AGENT_RUNTIME_DIRS ? false : 'Install the exact official DSH integration dependencies in an isolated runtime, then set DSH_AGENT_RUNTIME_DIRS.',
    timeout: 60000,
  }, async () => {
    await checkDshAgentInjection({ runtimeDir })
  })
}
