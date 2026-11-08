import test from 'node:test';import assert from 'node:assert/strict';
import Ajv from 'ajv';
import {splitBox,anchor,nativeDrawing} from '../src/authoring-primitives.mjs';
import {drawingSchema} from '../src/schema.mjs';
test('weighted splitting preserves extent, shared axes and requested gap',()=>{const b=splitBox({x:50,y:20,w:1100,h:100},[1,2,1],{gap:20});assert.equal(b[0].x,50);assert.equal(b[2].x+b[2].w,1150);assert.equal(b[1].w,2*b[0].w);assert.equal(b[1].x-(b[0].x+b[0].w),20);});
test('native drawing text and attached lines satisfy actual schema',()=>{const d=nativeDrawing('method',{x:48,y:130,w:1184,h:520});const a={x:20,y:30,w:250,h:150},b={x:400,y:30,w:350,h:150};d.rect(a);d.text('真实输入与条件',{x:40,y:50,w:210});d.rect(b);d.edge(a,'right',b,'left');const ajv=new Ajv();assert.equal(ajv.validate(drawingSchema,d.drawing),true,JSON.stringify(ajv.errors));assert.deepEqual(d.drawing.elements.at(-1).points,[anchor(a,'right'),anchor(b,'left')]);});
test('overflows and invalid geometry fail without shrinking or losing text',()=>{const d=nativeDrawing('method',{x:48,y:130,w:1184,h:520});assert.throws(()=>d.text('本段文字不能为了过关静默缩字或删掉必要科学条件。'.repeat(5),{x:10,y:10,w:120,h:35}),/TEXT_NEEDS_MORE_HEIGHT/);assert.throws(()=>splitBox({x:0,y:0,w:10,h:50},[1,1],{gap:20}),/GAPS_EXCEED_BOX/);assert.throws(()=>d.rect({x:0,y:500,w:80,h:80}),/OUTSIDE_REGION/);});
