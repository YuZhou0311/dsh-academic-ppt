import test from 'node:test';
import assert from 'node:assert/strict';
import {designDialogueReport,designStudyIssues} from '../src/design-dialogue.mjs';
import {fixtureDesign} from './fixtures.mjs';

const study=()=>({status:'reviewed',paletteRationale:'Synthetic fixture: dark native labels retain contrast and comparison colors remain stable.',
  designStudies:[{source:'academic-style',referenceId:'research-seminar',previewPath:'synthetic-reviewed-page.png',
    readingOrder:'Synthetic observation: title, complete evidence and adjacent interpretation.',
    evidenceHierarchy:'The primary figure is distinguished from conditions by position and alignment.',
    adaptation:'Apply the observed reading relationship to this fixture without adding card frames.'}]});
const project=referenceStudy=>({design:{mode:'content-led',styleProfile:'research-seminar',
  consultation:{...structuredClone(fixtureDesign.consultation),workflowVersion:2,interaction:'checkpoints'},...(referenceStudy?{referenceStudy}:{})},
  storyboard:{pages:Array.from({length:6},(_,i)=>({slideId:'s'+i}))},slides:[{id:'s0',cards:[]}]});

test('a complete open-science report can learn from an actual page without card study',()=>{
  const report=designDialogueReport(project(study()));
  assert.equal(report.referenceStudy.designLearningRequired,true);
  assert.equal(report.summary.nativeCardCount,0);assert.equal(report.summary.componentStudyCount,0);assert.equal(report.summary.designStudyCount,1);
  assert.equal(report.issues.filter(i=>i.severity==='error').length,0,JSON.stringify(report.issues));
  const missing=designDialogueReport(project());
  assert.ok(missing.issues.some(i=>i.code==='design-reference-study-required'));
});

test('whole-page research does not falsely attest that a used card preset was reviewed',()=>{
  const p=project(study());p.slides[0].cards=[{id:'c',preset:'research-tab',title:'Synthetic',body:'Fixture only.'}];
  let report=designDialogueReport(p);
  assert.ok(report.issues.some(i=>i.code==='card-reference-used-unreviewed'&&i.presetIds.includes('research-tab')));
  p.design.referenceStudy.catalogIds=['research-tab'];
  report=designDialogueReport(p);assert.equal(report.issues.filter(i=>i.severity==='error').length,0,JSON.stringify(report.issues));
});

test('design research keeps source identifiers and preview observations independently checkable',()=>{
  for(const [patch,code]of [
    [{referenceId:'unknown-style'},'design-reference-unknown-style'],
    [{previewPath:''},'design-reference-study-incomplete'],
    [{source:'user-template',referenceId:'my report',previewPath:'preview.png'},'design-reference-template-page-missing'],
    [{source:'scientific-reference',referenceId:'someone said'},'design-reference-url-missing'],
  ]){
    const record=study();Object.assign(record.designStudies[0],patch);
    assert.ok(designStudyIssues(record).some(i=>i.code===code),code);
  }
  const record=study();Object.assign(record.designStudies[0],{source:'page-recipe',referenceId:'paired-comparison'});
  assert.deepEqual(designStudyIssues(record),[]);
});
