import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMIC_PALETTES, ACADEMIC_PALETTE_IDS, DEFAULT_ACADEMIC_PALETTE_ID, getAcademicPalette } from '../src/academic-palette.mjs';
import { buildScenes, DEFAULT_DESIGN } from '../src/scene.mjs';
import { DEFAULT_PROJECTION } from '../src/projection-quality.mjs';

const luminance = color => [1,3,5].map(i => Number.parseInt(color.slice(i,i+2),16)/255)
  .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4)
  .reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('academic palettes supply readable text roles and visible subdued card boundaries', () => {
  assert.ok(ACADEMIC_PALETTE_IDS.length >= 4);
  const accents = new Set();
  for (const id of ACADEMIC_PALETTE_IDS) {
    const entry=ACADEMIC_PALETTES[id], p=getAcademicPalette(id);
    assert.equal(entry.id,id); assert.ok(entry.label); assert.ok(entry.description);
    for (const role of ['background','paper','ink','accent','secondary','muted','line','soft','tint','gold']) assert.match(p[role],/^#[0-9A-F]{6}$/);
    for (const fg of ['ink','accent','secondary','muted','gold']) for (const bg of ['background','paper','tint']) {
      assert.ok(contrast(p[fg],p[bg])>=4.5,`${id}: ${fg} must remain readable on ${bg}`);
    }
    assert.ok(contrast('#FFFFFF',p.accent)>=4.5,`${id}: explicit solid surfaces retain readable white text`);
    assert.ok(contrast(p.line,p.paper)>=1.5,`${id}: an outlined white card must be perceptible`);
    assert.ok(contrast(p.line,p.paper)<3,`${id}: borders must not compete with text`);
    assert.equal(new Set([p.accent,p.secondary,p.gold]).size,3,'existing chart roles must not collapse into one paint');
    accents.add(p.accent);
  }
  assert.equal(accents.size,ACADEMIC_PALETTE_IDS.length,'the catalogue offers genuinely different color choices');
});

test('palette lookup isolates per-deck changes and rejects unknown or inherited ids', () => {
  const before=getAcademicPalette(), changed=getAcademicPalette(DEFAULT_ACADEMIC_PALETTE_ID);
  changed.ink='#000000'; changed.accent='#FFFFFF';
  assert.deepEqual(getAcademicPalette(),before);
  assert.ok(Object.isFrozen(ACADEMIC_PALETTES));
  assert.ok(Object.isFrozen(ACADEMIC_PALETTES[DEFAULT_ACADEMIC_PALETTE_ID].palette));
  for (const id of ['unknown','toString','__proto__',null]) assert.throws(()=>getAcademicPalette(id),RangeError);
});

test('each academic palette offers usable dark, partial-fill and intermediate surfaces with readable native text',()=>{
  for(const entry of Object.values(ACADEMIC_PALETTES)){
    const p=entry.palette;
    const options=entry.surfaceOptions;
    const dark=options.find(o=>o.id==='dark-anchor'),mid=options.find(o=>o.id==='tonal-group');
    assert.ok(contrast(dark.cardAppearance.fill,'#FFFFFF')>=4.5);
    assert.ok(contrast(mid.cardAppearance.fill,p.paper)>contrast(p.tint,p.paper)+.15,'intermediate fill must be visibly distinct from the nearly white tint');
    assert.ok(contrast(mid.cardAppearance.fill,p.ink)>=4.5);
    for(const option of options){
      const project={title:'Color-role regression',design:{...structuredClone(DEFAULT_DESIGN),palette:p,projection:DEFAULT_PROJECTION,system:{preset:'academic-report',header:'plain',bodySize:28,panelTitleSize:30,captionSize:18}},papers:[],assets:[],claims:[],slides:[{
        id:'s',layout:'synthesis',title:'Evidence and its scope',paperIds:[],claimIds:[],figureIds:[],notes:'Original software fixture.',seconds:40,
        cards:[{id:'c',kind:'result',title:'Supported conclusion',body:'Keep the comparison and boundary visible.',claimIds:[],appearance:option.cardAppearance,box:{x:80,y:150,w:1000,h:240}}],
      }]};
      const scenes=buildScenes(project),nodes=scenes.pages[0].nodes;
      assert.ok(nodes.some(n=>n.cardId==='c'&&n.kind==='text'));
      assert.equal(scenes.issues.some(i=>/text-(?:contrast|image-contrast)/.test(i.code)),false,`${entry.id}/${option.id} must render readable native text`);
    }
  }
});
