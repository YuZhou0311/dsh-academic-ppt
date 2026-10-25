/** Validate the complete offline replay bundle before creating any output. */
import { join, isAbsolute } from 'node:path';
import { safePath, readBounded, hash } from '../src/io.mjs';

async function readInput(bundle, name) {
  try {
    return await readBounded(await safePath(bundle, name, { mustExist: true }));
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.startsWith('FILE_NOT_FOUND:')) {
      throw new Error(`RESEARCH_DEMO_BUNDLE_MISSING: ${name}; use a complete checkout or package containing examples/research-native-v07.`, { cause: error });
    }
    throw error;
  }
}

export async function readResearchDemoInputs(bundle, author) {
  if (!['a', 'b'].includes(author)) throw new Error('Expected research demo author a or b.');
  const content = JSON.parse((await readInput(bundle, join(author, 'deck.json'))).toString('utf8'));
  const manifest = JSON.parse((await readInput(bundle, join(author, 'manifest.json'))).toString('utf8'));
  const files = manifest.rebuildFiles;
  if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length) {
    throw new Error('Expected unique declared rebuildFiles.');
  }
  const supportFiles = [];
  for (const name of files) {
    if (typeof name !== 'string' || isAbsolute(name) || !/^(?:assets|sources)\//.test(name)) {
      throw new Error('Unexpected support path: ' + name);
    }
    const bytes = await readInput(bundle, name), expected = manifest.sha256?.[name];
    if (!expected || hash(bytes) !== expected) throw new Error('SOURCE_HASH_MISMATCH: ' + name);
    supportFiles.push({ name, bytes });
  }
  const declared = new Set(files);
  for (const paper of content.papers) {
    if (!declared.has(paper.reading.source) && !/^https:\/\//.test(paper.reading.source)) {
      throw new Error('Undeclared paper source: ' + paper.id);
    }
  }
  for (const asset of content.assets) {
    if (asset.data || !declared.has(asset.path)) throw new Error('Use a declared source asset path: ' + asset.id);
  }
  return { content, manifest, supportFiles };
}
