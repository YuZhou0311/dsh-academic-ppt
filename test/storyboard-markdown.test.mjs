import test from 'node:test';
import assert from 'node:assert/strict';
import {storyboardMarkdown} from '../src/storyboard.mjs';

test('the user-readable storyboard exposes the actual argument, indispensable conditions and resolved evidence',()=>{
 const plan={objective:'Synthetic reviewable argument',audienceTakeaway:'Review conditions',throughline:'Question → evidence → boundary',decision:{status:'proposed'},pages:[{slideId:'s1',role:'evidence',title:'Synthetic conditional finding',question:'Which comparison supports the finding?',claimIds:['C1','future-claim'],assetIds:['A1'],warrant:'The unique observation supports the claim only under the shared comparison.',boundary:'Independent validation is still required.',mustShow:['Distinct unit and denominator must stay visible'],layoutFamily:'paired-comparison',layoutReason:'The two outcomes share the same comparator.',seconds:60,transition:'Next inspect the untested condition.'}]};
 const project={papers:[{id:'P1',title:'Original synthetic software fixture',doi:'10.0000/fixture'}],claims:[{id:'C1',paperId:'P1',kind:'reported',text:'Unique fixture observation, not a scientific result.',locator:'Synthetic Table 1'}],assets:[{id:'A1',paperId:'P1',figure:'Synthetic Figure 1',caption:'Explicit fixture image caption'}]};
 const markdown=storyboardMarkdown(plan,project);
 for(const exact of [plan.pages[0].warrant,...plan.pages[0].mustShow,project.claims[0].text,project.claims[0].locator,project.papers[0].title,project.assets[0].caption,'proposed','future-claim：计划证据'])assert.ok(markdown.includes(exact),exact);
 assert.ok(!markdown.includes('confirmed'));
});
