import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { PAGE_RECIPES, PAGE_RECIPE_IDS, getPageRecipe, listPageRecipes, recommendPageRecipes, compilePageRecipe } from '../src/page-recipes.mjs';
import { assertToolArgs } from '../src/schema.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';
import { renderProject } from '../src/render.mjs';

const contentBox = {x:48,y:160,w:1184,h:450};
const bindingsFor = recipe => Object.fromEntries(recipe.slots.map(slot => [slot.id,{drawingIds:['d-'+slot.id]}]));
const compile = (id,options={}) => compilePageRecipe(id,{bindings:bindingsFor(getPageRecipe(id)),contentBox,...options});
const frame = (id,patch) => ({
  id,layout:'academic',title:'Synthetic composition study',paperIds:[],claimIds:[],figureIds:[],cards:[],
  notes:'Original geometric demonstration. No research measurements or findings.',seconds:30,
  heading:{box:{x:48,y:48,w:1184,h:64},fontSize:40},...patch,
});

test('original page grammars cover distinct academic relationships with selection and evidence guidance', () => {
  assert.equal(PAGE_RECIPE_IDS.length,32);
  assert.equal(new Set(PAGE_RECIPE_IDS).size,32);
  assert.ok(new Set(PAGE_RECIPES.map(recipe=>recipe.relationship)).size>=7);
  for (const recipe of PAGE_RECIPES) {
    for (const key of ['choose','avoid','evidenceNeed','grammar']) assert.ok(recipe[key].trim(),recipe.id+' '+key);
    assert.ok(recipe.purposes.length>=2);
    assert.ok(recipe.alternatives.every(id=>PAGE_RECIPE_IDS.includes(id)&&id!==recipe.id));
    assert.equal(new Set(recipe.slots.map(slot=>slot.id)).size,recipe.slots.length);
    for (const slot of recipe.slots) assert.ok(slot.accepts.length>=2);
    assert.ok(recipe.capacity.textChars>0);
  }
  assert.throws(()=>{PAGE_RECIPES[0].slots[0].box.w=0;},TypeError);
  const detached=getPageRecipe('hero-evidence'); detached.slots[0].box.w=.2;
  assert.equal(getPageRecipe('hero-evidence').slots[0].box.w,1);
  assert.throws(()=>getPageRecipe('invented-id'),/UNKNOWN_PAGE_RECIPE/);
});

test('all 32 grammars compile to the existing public slide contract without generated content', () => {
  for (const recipe of PAGE_RECIPES) {
    const sourceBindings=bindingsFor(recipe),before=structuredClone(sourceBindings);
    for (const mode of recipe.rows ? ['rows','regions'] : ['regions']) {
      const result=compilePageRecipe(recipe.id,{bindings:sourceBindings,contentBox,mode});
      const slide=frame(recipe.id,result.slidePatch);
      assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',{projectPath:'project.json',expectedRevision:0,slides:[slide]}));
      const panels=slide.composition.regions??slide.composition.rows.flatMap(row=>row.panels);
      assert.deepEqual(panels.map(panel=>panel.id),slide.visualPlan.readingOrder);
      assert.ok(panels.every(panel=>panel.drawingIds?.length===1));
      assert.deepEqual(sourceBindings,before);
      assert.ok(result.warnings.some(issue=>issue.code==='recipe-review-required'));
      assert.ok(!Object.hasOwn(slide,'assets')&&!Object.hasOwn(slide,'claims'));
    }
  }
});

test('selection reports capacity and shape tradeoffs rather than forcing a variety quota', () => {
  assert.ok(listPageRecipes({purpose:'assimilation'}).some(recipe=>recipe.id==='feedback-cycle'));
  assert.ok(listPageRecipes({relationship:'matrix'}).every(recipe=>recipe.relationship==='matrix'));
  assert.equal(listPageRecipes({purpose:'unmatched-purpose'}).length,0);
  const candidates=recommendPageRecipes({purpose:'results',carriers:['figure'],evidenceCount:4,figureAspect:1.4,limit:3});
  assert.equal(candidates[0].id,'small-multiples');
  const crowded=recommendPageRecipes({relationship:'sequence',evidenceCount:7,figureAspect:.1,textChars:1000,limit:32});
  assert.ok(crowded.every(candidate=>candidate.warnings.length>=2));
  assert.throws(()=>recommendPageRecipes({carriers:['invented']}),/CARRIERS/);
  assert.throws(()=>recommendPageRecipes({figureAspect:0}),/PAGE_RECIPE_QUERY/);
  assert.throws(()=>listPageRecipes({limit:0}),/PAGE_RECIPE_LIMIT/);
});

test('compiler accepts real carrier bindings but rejects empty, unsupported and duplicate consumption', () => {
  const actual=compilePageRecipe('paired-comparison',{contentBox,bindings:{
    a:{figureIds:['fig-a']},b:{plotId:'comparison-b'},conditions:{cardIds:['shared-conditions']},
  }});
  assert.equal(actual.slidePatch.composition.regions[0].figureIds[0],'fig-a');
  assert.equal(actual.slidePatch.composition.regions[1].plotId,'comparison-b');
  assert.throws(()=>compile('paired-comparison',{bindings:{a:{figureIds:['same']},b:{figureIds:['same']},conditions:{cardIds:['c']}}}),/PAGE_RECIPE_DUPLICATE/);
  assert.throws(()=>compile('paired-comparison',{bindings:{a:{table:true},b:{table:true},conditions:{cardIds:['c']}}}),/PAGE_RECIPE_DUPLICATE/);
  assert.throws(()=>compile('paired-comparison',{bindings:{a:{figureIds:['a']},b:{figureIds:['b']},conditions:{chart:true}}}),/does not accept chart/);
  assert.throws(()=>compile('hero-evidence',{bindings:{evidence:{chart:false}}}),/PAGE_RECIPE_EMPTY/);
  assert.throws(()=>compile('hero-evidence',{bindings:{evidence:{figureIds:['']}}}),/PAGE_RECIPE_CARRIER/);
  assert.throws(()=>compile('hero-evidence',{bindings:{evidence:{figureIds:['a']},unknown:{drawingIds:['x']}}}),/PAGE_RECIPE_SLOT/);
  assert.throws(()=>compile('hero-evidence',{bindings:{}}),/PAGE_RECIPE_BINDING/);
  assert.throws(()=>compile('hero-evidence',{bindings:{evidence:{plot:true,plotId:'p'}}}),/do not stack/);
});

test('authored geometry is preserved and collisions fail instead of squeezing carriers', () => {
  const authored={a:{box:{x:0,y:0,w:.40,h:.70}},b:{box:{x:.46,y:0,w:.54,h:.70}},conditions:{box:{x:0,y:.80,w:1,h:.20}}};
  const {slidePatch}=compile('paired-comparison',{overrides:authored,rationale:'Authored comparison retains shared units.',repetitionReason:'The same experiment is compared across two batches.'});
  assert.equal(slidePatch.composition.regions[0].box.w,contentBox.w*.4);
  assert.equal(slidePatch.visualPlan.repetitionReason,'The same experiment is compared across two batches.');
  assert.throws(()=>compile('paired-comparison',{overrides:{b:{box:{x:.2,y:0,w:.5,h:.7}}}}),/PAGE_RECIPE_OVERLAP/);
  assert.throws(()=>compile('hero-evidence',{contentBox:{x:48,y:160,w:1300,h:450}}),/PAGE_RECIPE_CONTENT_BOX/);
  assert.throws(()=>compile('hero-evidence',{overrides:{evidence:{box:{x:-.1,y:0,w:1,h:1}}}}),/PAGE_RECIPE_GEOMETRY/);
  assert.throws(()=>compile('hero-evidence',{mode:'rows',overrides:{evidence:{box:{x:0,y:0,w:1,h:1}}}}),/box overrides need regions/);
  assert.throws(()=>compile('evidence-ledger',{mode:'rows'}),/PAGE_RECIPE_ROWS/);
  assert.throws(()=>compile('hero-evidence',{overrides:{evidence:{fontSize:8}}}),/PAGE_RECIPE_OVERRIDE/);
  assert.throws(()=>compile('hero-evidence',{overrides:{evidence:{padding:100}}}),/PAGE_RECIPE_APPEARANCE/);
});

test('catalogue geometry renders as native editable shapes and text, not page screenshots', async () => {
  const slides=PAGE_RECIPES.map(recipe=>{
    const {slidePatch}=compile(recipe.id), regions=slidePatch.composition.regions;
    const drawings=regions.map((region,index)=>({id:'d-'+region.id,width:region.box.w,height:region.box.h,elements:[
      {id:'geometry',kind:'rect',x:5,y:5,w:Math.max(10,region.box.w-10),h:Math.max(10,region.box.h-10),fill:'#E9EFF4',stroke:'#D3DFE9',role:'group'},
      {id:'label',kind:'text',x:16,y:18,w:region.box.w-32,h:38,text:'Synthetic '+(index+1),fontSize:28,role:'body',color:'#23466A'},
    ]}));
    return frame(recipe.id,{...slidePatch,drawings});
  });
  const project={title:'Original academic page grammar tests',design:{...structuredClone(DEFAULT_DESIGN),chrome:{header:'plain',showBrand:false,showSection:false,showSources:false,showFooter:false,showPageNumber:false,showTopRule:false}},papers:[],claims:[],assets:[],slides};
  const result=await renderProject(project);
  assert.deepEqual(result.issues.filter(issue=>issue.severity==='error'),[]);
  const zip=unzipSync(result.pptx);
  for (let index=0;index<slides.length;index++) {
    const xml=strFromU8(zip['ppt/slides/slide'+(index+1)+'.xml']);
    assert.match(xml,/<p:sp>/);
    assert.ok(xml.includes('Synthetic 1'));
    assert.ok(!xml.includes('<p:pic>'));
  }
});
