/** Render actual author-supplied alternatives without changing project or review state. */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { safePath, hash, clone, abort } from './io.mjs';
import { assertProject } from './schema.mjs';
import { buildScenes } from './scene.mjs';
import { renderProject } from './render.mjs';
import { contentCoverageReport } from './evidence-design.mjs';

const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export async function writeDesignStudy(project, args, { cwd, signal } = {}) {
  const candidates = args.candidates;
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('DUPLICATE_CANDIDATE');
  const draft = clone(project);
  draft.slides = candidates.map(c => ({ ...clone(c.slide), id: c.id }));
  assertProject(draft);
  // Study scope is geometry and visible content. Its source records are not a
  // new reading attestation or a complete report's evidence approval.
  const scenes = buildScenes(draft);
  const issues = [...scenes.issues, ...contentCoverageReport(draft, scenes).issues];
  if (issues.some(i => i.severity === 'error')) return { ok: false, status: 'blocked', issues,
    note: '修复候选的实际几何与内容问题；候选导出不等于正式成稿审查。' };
  const outputDir = await safePath(cwd, args.outputDir);
  await mkdir(outputDir); // Do not overwrite a previous study or arbitrary files.
  let complete = false;
  try {
    const generated = await renderProject(draft, { signal });
    abort(signal);
    const pptxPath = join(outputDir,'candidates.pptx');
    await writeFile(pptxPath, generated.pptx, { flag:'wx' });
    await writeFile(join(outputDir,'presentation.html'), generated.html, { flag:'wx' });
    await writeFile(join(outputDir,'candidates.json'), JSON.stringify(candidates,null,2)+'\n', { flag:'wx' });
    const svgPaths = [];
    for (let i=0; i<generated.svgPages.length; i++) {
      const path=join(outputDir, candidates[i].id+'.svg');
      await writeFile(path, generated.svgPages[i].svg, { flag:'wx' }); svgPaths.push(path);
    }
    const html = '<!doctype html><meta charset="utf-8"><title>设计候选</title><style>body{font-family:sans-serif;background:#eef1f5;margin:24px}main{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:24px}figure{margin:0}img{width:100%;background:white}figcaption{font-size:20px;padding:8px}</style><h1>实际设计候选</h1><main>'+candidates.map(c=>'<figure><img src="'+esc(c.id)+'.svg"><figcaption>'+esc(c.label)+'</figcaption></figure>').join('')+'</main>';
    const htmlPath=join(outputDir,'contact-sheet.html'); await writeFile(htmlPath,html,{flag:'wx'});
    let externalPromptsPath;
    if (args.externalReferencePrompts) {
      externalPromptsPath=join(outputDir,'external-reference-prompts.txt');
      const prompts=candidates.map(c=>`候选 ${c.id}：${c.label}\n为学术汇报“${c.slide.title}”探索图文布局与局部分组。参考附带SVG的真实证据结构，提出不同的主辅比例、邻接说明与阅读层级。保持研究变量、数据点、单位、坐标及对照语义，不生成虚构实验或替代科研图。输出仅作视觉参考，最终须重建为可编辑对象并逐项核对。`);
      await writeFile(externalPromptsPath,prompts.join('\n\n')+'\n',{flag:'wx'});
    }
    let rendering={status:'not-requested'};
    if (args.render) {
      const {renderDeck}=await import('./vendor/dsh-ppt-render.mjs');
      const fontDirectories=args.fontDirectories ? await Promise.all(args.fontDirectories.map(p=>safePath(cwd,p,{mustExist:true}))) : undefined;
      rendering=await renderDeck({pptxPath,outputDir:join(outputDir,'render'),format:'both',fontDirectories,signal});
      if (rendering.ok) {
        const {createContactSheets}=await import('./montage.mjs');
        rendering.contactSheetPaths=await createContactSheets(rendering.pngPaths,dirname(rendering.receiptPath),{signal});
      }
    }
    const result={ok:true,status:'candidates-created',outputDir,pptxPath,pptxSha256:hash(generated.pptx),htmlPath,svgPaths,
      candidateIds:candidates.map(c=>c.id),rendering,...(externalPromptsPath?{externalPromptsPath}:{}),
      projectRevision:project.revision,formalVisualApproval:false,projectModified:false,
      note:'真实候选来自作者提供的页面记录。SVG与PPTX共享原生场景；实际PPTX画面只有rendered时可查。请看图比较，候选不改变原工程、能力或正式批准。'};
    await writeFile(join(outputDir,'study-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    complete=true; return result;
  } finally { if (!complete) await rm(outputDir,{recursive:true,force:true}); }
}
