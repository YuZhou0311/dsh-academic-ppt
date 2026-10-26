/** Recorded research acquisition and source-figure gates. These checks bind
 * source records to actual exported carriers; they do not perform web search,
 * independently verify a publication, or infer scientific meaning from pixels. */
import { evidenceDesignReport, isReviewedSourceFigure } from './evidence-design.mjs';

const list=value=>Array.isArray(value)?value:[];
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const distinct=values=>[...new Set(values)];
const normalize=value=>String(value??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
const specificReason=value=>normalize(value).length>=18;
const figureIdentity=value=>normalize(String(value??'').normalize('NFKC').toLowerCase().replace(/\bfig(?:ure)?s?\.?\s*/gu,'').replace(/^(?:图|表)\s*/u,''));

export function researchEvidenceReport(project, scenes, visualReport = evidenceDesignReport(project,scenes)) {
  const mode=project.brief?.visualEvidence?.mode || 'legacy',sourceLed=mode==='source-led';
  const issues=[],sources=[],body=list(visualReport.slides),assets=new Map(list(project.assets).map(a=>[a.id,a]));
  const usedPaperIds=new Set(body.flatMap(s=>list(s.paperIds)));
  const corePapers=list(project.papers).filter(p=>usedPaperIds.has(p.id)&&['article','preprint'].includes(p.sourceType || 'article'));
  const add=(code,path,message,details={},severity=sourceLed?'error':'warning')=>issues.push({severity,code,path,message,...details});
  if(mode==='legacy'&&body.length)add('visual-evidence-policy-missing','brief.visualEvidence',
    '此旧工程尚未声明科学图策略。已统计实际正文源图和文字页；新的图文汇报应明确 source-led，并完成来源查证与原图盘点。',{},'warning');

  for(const paper of corePapers){
    const path=`papers.${paper.id}`,check=paper.sourceCheck,review=paper.figureReview;
    const source={paperId:paper.id,title:paper.title,bodySlideIds:body.filter(s=>list(s.paperIds).includes(paper.id)).map(s=>s.slideId),
      sourceCheckStatus:check?.status || 'missing',figureReviewStatus:review?.status || 'missing',selectedAssetIds:[],usedSelectedAssetIds:[],documentedNoSuitableFigure:false};
    // Legacy files remain readable; absence is reported once above. Explicit
    // records are still inspected so selected-but-unused sources stay visible.
    if(sourceLed||mode==='flexible'||check){
      if(!check)add('source-check-required',path+'.sourceCheck','正文核心论文尚无来源查证记录。实际打开出版方或作者来源，核对题名、作者、年份、DOI及全文版本，再登记sourceCheck。',{paperId:paper.id});
      else {
        if(check.status!=='verified')add('source-check-incomplete',path+'.sourceCheck','来源查证尚未完成；partial/unavailable不能作为已经核实。继续合法获取或明确保留材料缺口。',{paperId:paper.id,status:check.status});
        const missing=['metadataSource','fullTextSource','checkedAt','note'].filter(key=>!nonempty(check[key]));
        if(nonempty(check.checkedAt)&&!Number.isFinite(Date.parse(check.checkedAt)))missing.push('valid checkedAt');
        if(missing.length)add('source-check-record-incomplete',path+'.sourceCheck',`来源记录缺少可追溯依据：${missing.join(', ')}。全文位置与核对日期必须来自实际获取行为。`,{paperId:paper.id,fields:missing});
      }
    }
    if(!review){
      if(sourceLed||mode==='flexible')add('source-figure-review-required',path+'.figureReview','核心论文尚未盘点图像。查看全文图注和适用的原图，登记候选图、定位、采用决定与资产；不能直接以摘要文字替代。',{paperId:paper.id});
      sources.push(source);continue;
    }
    const checkedSources=list(review.checkedSources).filter(nonempty),candidates=list(review.candidates);
    let validReview=checkedSources.length>0&&nonempty(review.note);
    if(!validReview)add('source-figure-review-incomplete',path+'.figureReview','图像盘点需要实际查看的checkedSources和具体note；图号清单或“已看过”不能代替来源位置。',{paperId:paper.id});
    const selected=candidates.filter(c=>c.decision==='selected');
    if(review.status==='selected'&&!selected.length){validReview=false;add('selected-source-figure-missing',path+'.figureReview','figureReview标记selected，但没有已选择的候选图。登记真实候选及assetId，并在正文实际使用。',{paperId:paper.id});}
    if(review.status!=='selected'&&selected.length){validReview=false;add('source-figure-review-conflict',path+'.figureReview','盘点状态与selected候选冲突。按实际获取和采用情况统一记录，不能用无合适图状态隐藏已选原图。',{paperId:paper.id});}
    if(['no-suitable-figure','unavailable'].includes(review.status)&&!specificReason(review.note)){
      validReview=false;add('source-figure-exception-too-thin',path+'.figureReview.note','未采用或无法获取原图的原因过于笼统。说明实际检查的材料、图像内容或获取障碍，以及采用的替代表达。',{paperId:paper.id});
    }
    for(const [index,candidate] of candidates.entries()){
      const candidatePath=`${path}.figureReview.candidates.${index}`;
      if(candidate.decision!=='selected'){
        if(!specificReason(candidate.reason)){validReview=false;add('source-figure-candidate-reason-missing',candidatePath+'.reason','未采用/不可用候选需要具体原因，说明与本次问题的关系、可读性或真实获取障碍。',{paperId:paper.id,figure:candidate.figure});}
        continue;
      }
      const asset=assets.get(candidate.assetId);
      if(!candidate.assetId||!asset){validReview=false;add('selected-source-figure-asset-missing',candidatePath+'.assetId','已选择的论文图必须关联已经登记的真实资产，不能只写计划放图。',{paperId:paper.id,assetId:candidate.assetId || null});continue;}
      source.selectedAssetIds.push(asset.id);
      if(asset.paperId!==paper.id||asset.usage!=='figure'||![undefined,'source'].includes(asset.provenance)||!nonempty(asset.figure)){
        validReview=false;add('selected-source-figure-invalid',candidatePath+'.assetId','selected候选必须关联同一论文、有图号的来源原图；装饰、自绘或另一论文的资产不能替代。',{paperId:paper.id,assetId:asset.id});continue;
      }
      if(!isReviewedSourceFigure(asset)){
        validReview=false;add('selected-source-figure-not-reviewed',candidatePath+'.assetId','已选择原图尚未完成实际看图记录。reading须为evidence，注明内容类型并由human或vision-model核对；定位图和unverified不能抵扣源图。',{paperId:paper.id,assetId:asset.id});
      }
      const figure=figureIdentity(candidate.figure),identities=[figureIdentity(asset.figure),figureIdentity(asset.figure+(asset.panel || ''))];
      if(figure&&!identities.includes(figure)){
        validReview=false;add('selected-source-figure-identity-mismatch',candidatePath+'.figure','候选图号与资产图号/面板不一致。回到原文确认对应关系，不能把另一张图登记成已选择的证据。',{paperId:paper.id,assetId:asset.id});
      }
      const usedOn=body.filter(s=>list(s.paperIds).includes(paper.id)&&list(s.sourceFigureIds).includes(asset.id)).map(s=>s.slideId);
      if(!usedOn.length){validReview=false;add('selected-source-figure-not-used',candidatePath+'.assetId','已选择原图没有出现在关联正文的实际场景中。登记资产或仅写figureIds不等于入稿；把图放入真实面板，或据实际理由改为未采用。',{paperId:paper.id,assetId:asset.id});}
      else source.usedSelectedAssetIds.push(asset.id);
    }
    source.selectedAssetIds=distinct(source.selectedAssetIds);source.usedSelectedAssetIds=distinct(source.usedSelectedAssetIds);
    source.documentedNoSuitableFigure=review.status==='no-suitable-figure'&&validReview&&check?.status==='verified'&&
      ['metadataSource','fullTextSource','checkedAt','note'].every(key=>nonempty(check[key]))&&Number.isFinite(Date.parse(check.checkedAt));
    if(review.status==='unavailable'&&validReview)add('source-figure-acquisition-unavailable',path+'.figureReview',
      '此来源的原图仍不可用，获取原因已记录。继续保留缺口；不要用卡片生图冒充论文图，或把未完成的取图步骤写成已完成。',{paperId:paper.id},'warning');
    sources.push(source);
  }

  const corePaperIds=new Set(corePapers.map(p=>p.id));
  const usedCoreSourceIds=new Set(body.flatMap(s=>list(s.sourceFigures).filter(figure=>corePaperIds.has(figure.paperId)).map(figure=>figure.assetId)));
  const alternativeSlides=body.filter(s=>(s.hasScientificVisual||s.hasNativeTable)&&list(s.scientificCarrierPaperIds).some(id=>corePaperIds.has(id)));
  const alternativeCoveredPaperIds=distinct(alternativeSlides.flatMap(s=>list(s.scientificCarrierPaperIds)).filter(id=>corePaperIds.has(id)));
  const missingAlternativePaperIds=[...corePaperIds].filter(id=>!alternativeCoveredPaperIds.includes(id));
  for(const source of sources)source.alternativeSlideIds=alternativeSlides.filter(s=>list(s.scientificCarrierPaperIds).includes(source.paperId)).map(s=>s.slideId);
  const nonPaperSourceIds=new Set(list(project.papers).filter(p=>!['article','preprint'].includes(p.sourceType || 'article')).map(p=>p.id));
  const nonPaperVisuals=body.filter(s=>(s.hasScientificVisual||s.hasNativeTable)&&list(s.scientificCarrierPaperIds).some(id=>nonPaperSourceIds.has(id)));
  const documentedException=body.length>0&&usedCoreSourceIds.size===0&&sources.length>0&&sources.every(s=>s.documentedNoSuitableFigure)&&missingAlternativePaperIds.length===0;
  if(sourceLed&&body.length&&corePapers.length>0&&usedCoreSourceIds.size===0){
    if(documentedException)add('source-figure-documented-exception','brief.visualEvidence',
      '所有核心论文均有具体的无适用原图记录，并各自绑定正文中的科学图示或表格；一个综合载体可共同承载多篇来源。本稿按记录例外继续，仍需查看实际页面确认替代表达忠实且充分。',{alternativeSlideIds:alternativeSlides.map(s=>s.slideId),alternativeCoveredPaperIds},'warning');
    else add('source-figure-not-visible','slides',
      'source-led汇报的实际正文没有可计入的核心论文原图。先查找、获取并查看适用源图，再用于正文。只有所有核心来源确实无适用图且逐来源有完整盘点理由与实际绑定的科学替代表达时才可例外；其他来源的配图、卡片、图标、装饰、定位图及未看过的图片不抵扣。',{missingAlternativePaperIds});
  }
  if(sourceLed&&body.length&&corePapers.length===0&&!nonPaperVisuals.length)add('scientific-visual-not-visible','slides',
    '本稿没有作为核心证据的论文来源，不要求不存在的论文原图；但正文仍需有绑定实际数据集、报告、方案或学位材料的科学图示、数据图或表格。纯文字卡片和装饰不能替代研究内容。');
  const summary={...(visualReport.summary || {}),mode,coreSourceCount:sources.length,
    sourceFigureRequirement:corePapers.length?'paper-sources':'scientific-carriers',
    coreSourceFigureCount:usedCoreSourceIds.size,coreSourceFigureIds:[...usedCoreSourceIds],
    verifiedSourceCount:sources.filter(s=>s.sourceCheckStatus==='verified').length,
    selectedSourceFigureCount:distinct(sources.flatMap(s=>s.selectedAssetIds)).length,
    usedSelectedSourceFigureCount:distinct(sources.flatMap(s=>s.usedSelectedAssetIds)).length,
    selectedButUnusedAssetIds:distinct(sources.flatMap(s=>s.selectedAssetIds.filter(id=>!s.usedSelectedAssetIds.includes(id)))),
    documentedSourceFigureException:documentedException,alternativeCoveredPaperIds,missingAlternativePaperIds,
    blockingIssues:issues.filter(i=>i.severity==='error').length};
  return {basis:'recorded-source-checks-and-actual-scene-use-not-independent-web-verification',mode,
    ...(project.brief?.visualEvidence?.reason?{policyReason:project.brief.visualEvidence.reason}:{}),summary,sources,issues,
    limits:'sourceCheck、checkedSources和reading是宿主实际操作的可审查记录；此模块不联网，不证明DOI/正文或图像语义真实。正式交付仍需实际检索、读图及最终PPTX视觉复核。'};
}
