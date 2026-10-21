import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {deflateSync} from 'node:zlib';
import {PNG as PngCodec} from 'pngjs';
import PngCrc from 'pngjs/lib/crc.js';
import jpeg from 'jpeg-js';
import {imageDimensions,embedAssets,hash} from '../src/io.mjs';
import {createProject,updateRecords,buildProject} from '../src/core.mjs';
import {fixtureDesign,PNG,brief,paper,claim,asset,slides} from './fixtures.mjs';

const pngBytes=Buffer.from(PNG.split(',')[1],'base64');
const pixels=Buffer.from([240,40,20,255,20,130,220,255]);
const jpegBytes=jpeg.encode({width:2,height:1,data:pixels},90).data;
const dataUri=(bytes,mime='image/png')=>`data:${mime};base64,${bytes.toString('base64')}`;
function pngChunk(type,data){
 const name=Buffer.from(type),out=Buffer.alloc(data.length+12);
 out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);
 out.writeUInt32BE(PngCrc.crc32(Buffer.concat([name,data]))>>>0,out.length-4);return out;
}
function customPng({width=1,height=1,interlace=0,raw=Buffer.from([0,40,80,100,255]),compressed}={}){
 const ihdr=Buffer.from(pngBytes.subarray(16,29));ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[12]=interlace;
 return Buffer.concat([pngBytes.subarray(0,8),pngChunk('IHDR',ihdr),pngChunk('IDAT',compressed??deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);
}
function jpegFrameOffset(bytes){
 for(let p=2;p+4<bytes.length;){const marker=bytes[p+1],length=bytes.readUInt16BE(p+2);if(marker===0xc0)return p;p+=length+2;}
 throw new Error('test encoder did not produce a baseline JPEG');
}

test('real PNG fixture passes strict CRC decoding and embedding retains its bytes and source metadata',async()=>{
 const decoded=PngCodec.sync.read(pngBytes,{checkCRC:true});
 assert.equal(decoded.width,1);assert.equal(decoded.height,1);assert.equal(decoded.data.length,4);
 assert.deepEqual(imageDimensions(pngBytes),{mime:'image/png',width:1,height:1});
 const [embedded]=await embedAssets([asset],process.cwd());
 assert.equal(embedded.data,asset.data);assert.equal(embedded.sha256,hash(pngBytes));
 for(const field of ['paperId','figure','caption','sourceUrl','sourceVersion','license','cropNote'])assert.equal(embedded[field],asset[field]);
});

test('truncated PNGs, missing IEND and corrupt CRC are rejected even with a valid PNG header',()=>{
 assert.throws(()=>imageDimensions(pngBytes.subarray(0,24)),/INVALID_IMAGE/);
 assert.throws(()=>imageDimensions(pngBytes.subarray(0,pngBytes.length-1)),/truncated PNG/);
 assert.throws(()=>imageDimensions(pngBytes.subarray(0,pngBytes.length-12)),/complete IDAT and IEND/);
 assert.throws(()=>imageDimensions(Buffer.concat([pngBytes,Buffer.from([0])])),/final IEND/);
 const crcBad=Buffer.from(pngBytes);crcBad[crcBad.length-13]^=1;
 assert.throws(()=>imageDimensions(crcBad),/CRC mismatch/);
 // The old fixture really had an invalid IDAT CRC; do not restore it or disable CRC checks.
 const oldFixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSXkAAAAASUVORK5CYII=','base64');
 assert.throws(()=>imageDimensions(oldFixture),/CRC mismatch in IDAT/);
});

test('PNG image data must fully decode, not merely have valid chunks and CRCs',()=>{
 assert.throws(()=>imageDimensions(customPng({raw:Buffer.from([5,40,80,100,255])})),/PNG cannot be decoded/);
 assert.throws(()=>imageDimensions(customPng({raw:Buffer.from([0,40,80])})),/scanlines/);
 const compressed=deflateSync(Buffer.from([0,40,80,100,255]));
 assert.throws(()=>imageDimensions(customPng({compressed:compressed.subarray(0,compressed.length-2)})),/PNG cannot be decoded/);
 assert.throws(()=>imageDimensions(customPng({raw:Buffer.alloc(16*1024)})),/PNG cannot be decoded/);
});

test('interlaced PNGs retain support while their decompression budget is bounded',()=>{
 const interlaced=customPng({interlace:1});
 assert.equal(PngCodec.sync.read(interlaced,{checkCRC:true}).interlace,true);
 assert.deepEqual(imageDimensions(interlaced),{mime:'image/png',width:1,height:1});
 assert.throws(()=>imageDimensions(customPng({interlace:1,raw:Buffer.alloc(16*1024)})),/PNG cannot be decoded/);
});

test('header dimensions and input size reject oversized images before pixel decoding',()=>{
 assert.throws(()=>imageDimensions(customPng({width:16001})),/IMAGE_DIMENSION_LIMIT/);
 assert.throws(()=>imageDimensions(customPng({width:8000,height:8000})),/IMAGE_DIMENSION_LIMIT/);
 const oversizedJpeg=Buffer.from(jpegBytes),sof=jpegFrameOffset(oversizedJpeg);
 oversizedJpeg.writeUInt16BE(16001,sof+7);
 assert.throws(()=>imageDimensions(oversizedJpeg),/IMAGE_DIMENSION_LIMIT/);
 assert.throws(()=>imageDimensions(Buffer.alloc(8*1024*1024+1)),/IMAGE_LIMIT/);
});

test('JPEG bytes from a real encoder decode; truncated scan and missing EOI are rejected',async()=>{
 assert.deepEqual(imageDimensions(jpegBytes),{mime:'image/jpeg',width:2,height:1});
 const [embedded]=await embedAssets([{...asset,id:'J1',data:dataUri(jpegBytes,'image/jpeg')}],process.cwd());
 assert.equal(embedded.sha256,hash(jpegBytes));assert.equal(embedded.width,2);assert.equal(embedded.height,1);
 assert.throws(()=>imageDimensions(jpegBytes.subarray(0,jpegBytes.length-2)),/JPEG cannot be decoded/);
 assert.throws(()=>imageDimensions(jpegBytes.subarray(0,jpegBytes.length-30)),/JPEG cannot be decoded/);
 const sof=jpegFrameOffset(jpegBytes),length=jpegBytes.readUInt16BE(sof+2);
 assert.throws(()=>imageDimensions(jpegBytes.subarray(0,sof+2+length)),/complete frame and image scan/);
});

test('cached validation uses actual bytes and never trusts supplied hashes or caller-mutated results',async()=>{
 const first=imageDimensions(pngBytes);first.width=9000;
 assert.equal(imageDimensions(pngBytes).width,1);
 const [cached]=await embedAssets([asset],process.cwd());
 await assert.rejects(embedAssets([{...cached,sha256:'0'.repeat(64)}],process.cwd()),/ASSET_HASH_MISMATCH/);
 const different=PngCodec.sync.write({width:1,height:1,data:Buffer.from([200,100,30,255])});
 await assert.rejects(embedAssets([{...cached,data:dataUri(different)}],process.cwd()),/ASSET_HASH_MISMATCH/);
 const mutated=Buffer.from(pngBytes);imageDimensions(mutated);mutated[mutated.length-13]^=1;
 assert.throws(()=>imageDimensions(mutated),/CRC mismatch/);
});

test('invalid asset cannot save a revision; correcting it allows the same public API workflow to build',async t=>{
 const base=resolve('.test-output');await mkdir(base,{recursive:true});
 const cwd=await mkdtemp(join(base,'images-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const created=await createProject({cwd,projectDir:'project',title:'Synthetic image validation fixture',brief,design:fixtureDesign});
 const options={cwd,projectPath:created.projectPath},before=await readFile(created.projectPath);
 await assert.rejects(updateRecords({...options,expectedRevision:0,papers:[paper],claims:[claim],slides,assets:[{...asset,data:dataUri(pngBytes.subarray(0,24))}]}),/INVALID_IMAGE/);
 assert.deepEqual(await readFile(created.projectPath),before);
 const updated=await updateRecords({...options,expectedRevision:0,papers:[paper],claims:[claim],slides,assets:[asset]});
 assert.equal(updated.revision,1);
 const built=await buildProject({...options,expectedRevision:1});assert.equal(built.ok,true);
 const saved=await readFile(created.projectPath);
 await assert.rejects(updateRecords({...options,expectedRevision:1,assets:[{...asset,data:dataUri(jpegBytes,'image/jpeg')}]}),/IMMUTABLE_ASSET/);
 assert.deepEqual(await readFile(created.projectPath),saved);
});
