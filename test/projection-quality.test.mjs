import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionIssues, sceneContrastIssues, DEFAULT_PROJECTION } from '../src/projection-quality.mjs';

const page = nodes => ({id:'s',width:1280,height:720,background:'#FFFFFF',nodes});
const label = (extra={}) => ({id:'s/body',kind:'text',text:'Current evidence',lines:['Current evidence'],estimatedLineWidths:[210],x:80,y:150,w:500,h:200,fontSize:28,lineHeight:1.2,color:'#202A35',role:'body',...extra});
const box = (fill,extra={}) => ({id:'s/surface',kind:'rect',x:60,y:130,w:600,h:300,fill,...extra});

test('contrast uses the actual local dark and medium surfaces, not the page white',()=>{
  for(const [fill,color] of [['#254B6E','#FFFFFF'],['#CFD7DF','#202A35']]){
    const p=page([box(fill),label({color})]);
    assert.deepEqual(projectionIssues(p,DEFAULT_PROJECTION),[]);
  }
  const bad=projectionIssues(page([box('#254B6E'),label({color:'#254B6E'})]),DEFAULT_PROJECTION);
  assert.equal(bad[0].code,'text-contrast-too-low');
  assert.equal(bad[0].contrast,1);
  assert.equal(bad[0].objectId,'s/body');
  assert.deepEqual(bad[0].backgrounds,['#254B6E']);
});

test('pale body text creates an actionable warning before it becomes unreadable',()=>{
  const output=sceneContrastIssues(page([label({color:'#888888'})]));
  assert.equal(output.length,1);
  assert.equal(output[0].code,'text-contrast-review');
  assert.equal(output[0].severity,'warning');
  assert.equal(output[0].minimum,4.5);
  assert.match(output[0].message,/重渲染/);
  const error=sceneContrastIssues(page([label({color:'#DDDDDD'})]));
  assert.equal(error[0].severity,'error');
  assert.equal(error[0].code,'text-contrast-too-low');
});

test('allocated textbox whitespace cannot falsely move white title text outside its band',()=>{
  const p=page([box('#254B6E',{w:300,h:62}),label({color:'#FFFFFF',w:1000,h:300,role:'panel-title'})]);
  assert.deepEqual(sceneContrastIssues(p),[]);
});

test('transparent fills are composited and nested opaque paper restores a known background',()=>{
  const p=page([box('#000000'),box('#FFFFFF',{fillOpacity:.3}),label({color:'#FFFFFF'})]);
  assert.deepEqual(sceneContrastIssues(p),[]);
  const opaque=page([box('#FFFFFF',{kind:'image'}),box('#FFFFFF',{x:75,y:145,w:300,h:70}),label()]);
  assert.deepEqual(sceneContrastIssues(opaque),[]);
});

test('text on images requests a rendered review without inventing image contrast',()=>{
  const p=page([box(undefined,{kind:'image',assetId:'source'}),label()]);
  const output=sceneContrastIssues(p);
  assert.equal(output.length,1);
  assert.equal(output[0].code,'text-image-contrast-review');
  assert.equal(output[0].severity,'warning');
  assert.equal(output[0].contrast,undefined);
});

test('native emphasis runs are checked and legacy projects remain outside the projection gate',()=>{
  const p=page([box('#254B6E'),label({color:'#FFFFFF',richLines:[[{text:'Current ',color:'#FFFFFF'},{text:'evidence',color:'#254B6E',bold:true}]]})]);
  assert.ok(sceneContrastIssues(p).some(issue=>issue.code==='text-contrast-too-low'));
  assert.deepEqual(projectionIssues(p,undefined),[]);
  const overridden=page([box('#254B6E'),label({color:'#254B6E',richLines:[[{text:'Current evidence',color:'#FFFFFF'}]]})]);
  assert.deepEqual(sceneContrastIssues(overridden),[],'an unused base color must not create a false failure when every native run overrides it');
});

test('unpainted frames and later overlay objects do not become text backing',()=>{
  const p=page([box('none',{stroke:'#254B6E'}),label(),box('#202A35')]);
  assert.deepEqual(sceneContrastIssues(p),[]);
});

test('mixed known backings request review without a false uniform-background failure',()=>{
  const p=page([box('#254B6E',{x:70,w:100}),label({color:'#FFFFFF'})]);
  const output=sceneContrastIssues(p);
  assert.equal(output[0].severity,'warning');
  assert.equal(output[0].code,'text-contrast-review');
  assert.equal(output[0].backgrounds.length,2);
});
