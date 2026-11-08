#!/usr/bin/env node
/** Build only synthetic teaching data, through the same normal tool entrypoints.
 * No model calls, source downloads, or approval records. Output must be new.
 */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildAcademicTools} from '../src/tools.mjs';
const a=process.argv.slice(2),get=n=>{const i=a.indexOf(n);return i<0?null:a[i+1];};
const dest=get('--output');if(!dest)throw new Error('Supply --output NEW_DIRECTORY and --font-dir LOCAL_FONT_DIRECTORY');
const cwd=resolve(dest);await mkdir(dirname(cwd),{recursive:true});await mkdir(cwd);
const root=fileURLToPath(new URL('../',import.meta.url));
// The caller may provide its own fonts in a bounded directory, but this script
// never distributes them, and never fetches fonts or reads model credentials.
const fonts=get('--font-dir');
if(fonts){const {readdir}=await import('node:fs/promises');await mkdir(join(cwd,'fonts'));for(const n of await readdir(fonts))if(/\.(ttf|otf|ttc)$/i.test(n))await copyFile(join(fonts,n),join(cwd,'fonts',basename(n)));}
const ts=new Map(buildAcademicTools({}, {resolveCwd:async()=>cwd}).map(t=>[t.name,t]));const log=[];
const run=async(n,args)=>{const r=await ts.get('academic_ppt_'+n).execute(args,{});log.push({tool:n,args,result:r});if(r.ok===false)throw new Error(JSON.stringify(r));return r;};
const palette={background:'#FFFFFF',paper:'#FFFFFF',ink:'#182F3A',muted:'#506874',accent:'#17675C',secondary:'#934722',line:'#C6D6D4',soft:'#EDF4F2',tint:'#EDF4F2'};
const project=await run('init',{projectDir:'project',title:'原创教学：关系与尺度',brief:{centralQuestion:'如何把内容关系落实到版面？',audience:'软件与构图教学',talkMinutes:2,targetPaperCount:0,requireFullText:false,visualEvidence:{mode:'flexible',reason:'合成教学值与抽象回路，不是科研结果或原图替代。'}},design:{authoringMode:'content-tree',artDirection:'structured',palette,chrome:{showSources:false,showBrand:false},fontFamily:'Noto Sans CJK SC',titleFontFamily:'Noto Sans CJK SC',annotationFontFamily:'Noto Sans CJK SC'}});
let revision=project.revision;
for(const name of ['compact-loop','count-ledger']){const file=join(cwd,name+'.json');await copyFile(join(root,'examples/content-authoring',name+'.json'),file);const r=await run('plan',{projectPath:project.projectPath,expectedRevision:revision,requestPath:file});revision=r.revision;}
const build=await run('build',{projectPath:project.projectPath,expectedRevision:revision,mode:'draft'});
const render=await run('render',{projectPath:project.projectPath,expectedRevision:revision,...(fonts?{fontDirectories:[join(cwd,'fonts')]}:{}),publishPreview:false});
await writeFile(join(cwd,'run.json'),JSON.stringify({build,render,scope:'Normal-tool deterministic replay, not DSH autonomous authorship, model judgment or user approval.',log},null,2));console.log(JSON.stringify({projectPath:project.projectPath,render:render.pngPaths}));
