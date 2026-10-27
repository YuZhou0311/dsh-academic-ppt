import test from 'node:test'
import assert from 'node:assert/strict'
import { delimiter, resolve } from 'node:path'
import { runtimeDirectoriesFromEnvironment } from '../scripts/check-dsh-agent-injection.mjs'

test('an explicit empty DSH integration matrix fails instead of running zero tests', () => {
  for (const value of ['', delimiter, delimiter.repeat(3)]) {
    assert.throws(() => runtimeDirectoriesFromEnvironment({ DSH_AGENT_RUNTIME_DIRS: value }), /must name at least one isolated runtime/)
  }
})

test('DSH integration defaults retain both releases and explicit paths remain required', () => {
  assert.equal(runtimeDirectoriesFromEnvironment({}).length, 2)
  assert.deepEqual(runtimeDirectoriesFromEnvironment({ DSH_AGENT_RUNTIME_DIRS: 'missing-runtime' }), [resolve('missing-runtime')])
})
