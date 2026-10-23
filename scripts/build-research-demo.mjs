#!/usr/bin/env node
/** Replay one published author's exact records. This is not new model authoring. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProject, updateRecords, buildProject, renderProjectArtifact, checkProject } from '../src/core.mjs';
import { safePath, hash } from '../src/io.mjs';

const argv=process.argv.slice(2),cwd=process.cwd(),fontDirectories=[];
let author='a',output,render=false;
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--author'&&['a','b'].includes(argv[i+1]))author=argv[++i];
  else if(argv[i]==='--output'&&argv[i+1])output=argv[++i];
  else if(argv[i]==='--render')render=true;
  else if(argv[i]==='--font-dir'&&argv[i+1])fontDirectories.push(argv[++i]);
  else if(argv[i]==='--help'){
    console.log('node scripts/build-research-demo.mjs [--author a|b] [--output NEW_DIRECTORY] [--render] [--font-dir WORKSPACE_DIRECTORY]\nOffline replay of one published real-paper deck through the public record/build API. No model or network request. Existing files and review state are never overwritten or inherited.');
    process.exit(0);
  }else throw new Error('Unknown or incomplete argument: '+argv[i]);
}
if(fontDirectories.length>4)throw new Error('Use at most four font directories.');
const bundle=fileURLToPath(new URL('../examples/research-native-v07/',import.meta.url));
const content=JSON.parse(await readFile(join(bundle,author,'deck.json'),'utf8'));
const manifest=JSON.parse(await readFile(join(bundle,author,'manifest.json'),'utf8'));
const files=manifest.rebuildFiles;
if(!Array.isArray(files)||!files.length||new Set(files).size!==files.length)throw new Error('Expected unique declared rebuildFiles.');
const root=await safePath(cwd,output||`research-demo-${author}-${randomUUID().slice(0,8)}`);
await mkdir(root); // A new output is required; no cleanup of an existing path.
await mkdir(join(root,'records'));
for(const name of files){
  if(typeof name!=='string'||isAbsolute(name)||!(/^(?:assets|sources)\//.test(name)))throw new Error('Unexpected support path: '+name);
  const source=await safePath(bundle,name,{mustExist:true}),destination=await safePath(root,name);
  const bytes=await readFile(source),expected=manifest.sha256?.[name];
  if(!expected||hash(bytes)!==expected)throw new Error('SOURCE_HASH_MISMATCH: '+name);
  await mkdir(dirname(destination),{recursive:true});await copyFile(source,destination,constants.COPYFILE_EXCL);
}
const declared=new Set(files);
for(const paper of content.papers){
  if(declared.has(paper.reading.source))paper.reading.source=join(root,paper.reading.source);
  else if(!/^https:\/\//.test(paper.reading.source))throw new Error('Undeclared paper source: '+paper.id);
}
for(const asset of content.assets){
  if(asset.data||!declared.has(asset.path))throw new Error('Use a declared source asset path: '+asset.id);
  asset.path=join(root,asset.path);
  delete asset.sourcePath; // Public import records this replay's actual source path.
}
let state=await createProject({cwd,projectDir:join(root,'project'),title:content.title,brief:content.brief,design:content.design,
  capabilities:{imageInput:'unknown',source:'Offline replay of published author records; this command does not perform a new reading or visual review.'}});
let count=0;
for(const [key,limit] of [['papers',5],['claims',20],['assets',8],['slides',8]]){
  for(let offset=0;offset<content[key].length;offset+=limit){
    const recordsPath=join(root,'records',String(++count).padStart(2,'0')+'-'+key+'.json');
    await writeFile(recordsPath,JSON.stringify({[key]:content[key].slice(offset,offset+limit)},null,2)+'\n',{flag:'wx'});
    state=await updateRecords({cwd,projectPath:state.projectPath,expectedRevision:state.revision,recordsPath});
  }
}
const build=await buildProject({cwd,projectPath:state.projectPath,expectedRevision:state.revision,mode:'review'});
if(!build.ok){console.log(JSON.stringify(build,null,2));process.exitCode=1;}
else{
  const rendering=render?await renderProjectArtifact({cwd,projectPath:state.projectPath,expectedRevision:state.revision,...(fontDirectories.length?{fontDirectories}:{})}):{status:'not-requested'};
  const check=await checkProject({cwd,projectPath:state.projectPath});
  const result={ok:true,author,projectPath:state.projectPath,revision:state.revision,files:build.files,pptxSha256:build.pptxSha256,rendering,
    summary:check.summary,verification:check.verification,note:'Replayed authored records. No new model generation, source-reading attestation, or inherited visual approval.'};
  await writeFile(join(root,'rebuild-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
}
