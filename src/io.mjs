import {readFile,writeFile,mkdir,rename,rm,stat,lstat,realpath,open} from 'node:fs/promises';
import {resolve,relative,dirname,join,isAbsolute,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const clone = value => structuredClone(value);
export function abort(signal) {signal?.throwIfAborted();}
export function stable(value) {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function beneath(root,path) {const r=relative(root,path);return r==='' || (!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));}
export async function safePath(cwd,input,{mustExist=false}={}) {
 if(typeof input!=='string'||!input.trim()||input.includes('\0')) throw new Error('INVALID_PATH');
 const root=await realpath(resolve(cwd||'.')),target=resolve(root,input);
 if(!beneath(root,target)) throw new Error('PATH_OUTSIDE_WORKSPACE: '+input);
 let current=target,missing=[];
 while(true){try{const actual=await realpath(current);if(!beneath(root,actual))throw new Error('SYMLINK_OUTSIDE_WORKSPACE: '+input);if(mustExist && missing.length)throw new Error('FILE_NOT_FOUND: '+input);return resolve(actual,...missing.reverse());}catch(e){if(e.code!=='ENOENT')throw e;const parent=dirname(current);if(parent===current)throw e;missing.push(current.slice(parent.length+ (parent.endsWith(sep)?0:1)));current=parent;}}
}
export async function readBounded(path,maxBytes=64*1024*1024) {
 const info=await stat(path);if(!info.isFile()||info.size>maxBytes)throw new Error('FILE_LIMIT: expected bounded regular file');
 const b=await readFile(path);if(b.length>maxBytes)throw new Error('FILE_LIMIT');return b;
}
export async function readJson(path) {const bytes=await readBounded(path);try{return {value:JSON.parse(bytes.toString('utf8')),fingerprint:hash(bytes)};}catch{throw new Error('INVALID_JSON: '+path);}}
export async function atomicJson(path,value,signal) {
 abort(signal);const temp=path+'.tmp-'+randomUUID();
 try{await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});abort(signal);await rename(temp,path);}finally{await rm(temp,{force:true});}
}
export async function locked(path,fn,signal) {
 abort(signal);const lockPath=path+'.lock';let handle;
 try{handle=await open(lockPath,'wx');}catch(e){if(e.code==='EEXIST')throw new Error('PROJECT_BUSY: another operation is running; do not delete an active lock');throw e;}
 try{await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));return await fn();}finally{await handle.close();await rm(lockPath,{force:true});}
}
export async function ensureNewDir(path) {await mkdir(dirname(path),{recursive:true});await mkdir(path,{recursive:false});}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 32_000_000;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
// Store only dimensions, never decoded pixel buffers. Keys are hashes of the actual bytes.
const validatedImages = new Map();
const CRC_TABLE = Uint32Array.from({length:256},(_,value)=>{
 let crc=value;for(let bit=0;bit<8;bit++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;
});
function invalidImage(message) {throw new Error('INVALID_IMAGE: '+message);}
function boundedDimensions(width,height) {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>16000||height>16000||width*height>MAX_IMAGE_PIXELS)throw new Error('IMAGE_DIMENSION_LIMIT');
 return {width,height};
}
function crc32(bytes) {
 let crc=0xffffffff;for(const value of bytes)crc=CRC_TABLE[(crc^value)&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0;
}
function pngHeaderAndChunks(bytes) {
 if(bytes.length<33||bytes.readUInt32BE(8)!==13||bytes.toString('latin1',12,16)!=='IHDR')invalidImage('PNG requires a complete initial IHDR');
 const dimensions=boundedDimensions(bytes.readUInt32BE(16),bytes.readUInt32BE(20));
 const depth=bytes[24],colorType=bytes[25],interlace=bytes[28];
 const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
 if(!depths[colorType]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||![0,1].includes(interlace))invalidImage('unsupported PNG header');
 const channels={0:1,2:3,3:1,4:2,6:4}[colorType];
 const idat=[];let position=8,seenData=false,dataEnded=false,seenEnd=false;
 while(position<bytes.length){
  if(position+12>bytes.length)invalidImage('truncated PNG chunk');
  const length=bytes.readUInt32BE(position),end=position+12+length;
  if(end>bytes.length)invalidImage('truncated PNG chunk data');
  const type=bytes.toString('latin1',position+4,position+8);
  if(!/^[A-Za-z]{4}$/.test(type))invalidImage('invalid PNG chunk type');
  if(type==='IHDR'&&(position!==8||length!==13))invalidImage('duplicate or malformed PNG IHDR');
  if(crc32(bytes.subarray(position+4,end-4))!==bytes.readUInt32BE(end-4))invalidImage('PNG CRC mismatch in '+type);
  if(type==='IDAT'){
   if(dataEnded)invalidImage('PNG IDAT chunks must be consecutive');
   seenData=true;idat.push(bytes.subarray(position+8,end-4));
  }else if(seenData)dataEnded=true;
  if(type==='IEND'){
   if(length!==0||!seenData||end!==bytes.length)invalidImage('PNG requires a final IEND after image data');
   seenEnd=true;
  }
  position=end;
 }
 if(!seenData||!seenEnd)invalidImage('PNG requires complete IDAT and IEND chunks');
 return {...dimensions,depth,channels,interlace,idat};
}
function validatePngInflate(header) {
 // pngjs uses an unbounded inflate for interlaced PNGs. Preflight the exact scanline
 // budget first, including Adam7 passes, so malicious IDAT data cannot expand freely.
 const passes=header.interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
 let expected=0;
 for(const [x,y,dx,dy] of passes){
  const width=Math.max(0,Math.ceil((header.width-x)/dx)),height=Math.max(0,Math.ceil((header.height-y)/dy));
  if(width&&height)expected+=(Math.ceil(width*header.channels*header.depth/8)+1)*height;
 }
 const compressed=Buffer.concat(header.idat);
 const inflated=inflateSync(compressed,{maxOutputLength:expected,info:true});
 if(inflated.buffer.length!==expected||inflated.engine.bytesWritten!==compressed.length)invalidImage('PNG decompressed scanlines do not match IHDR');
}
function jpegHeader(bytes) {
 let position=2,dimensions;
 while(position<bytes.length){
  if(bytes[position]!==0xff)invalidImage('invalid JPEG marker');
  while(bytes[position]===0xff)position++;
  const marker=bytes[position++];
  if(marker===0xd9)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(position+2>bytes.length)invalidImage('truncated JPEG segment');
  const length=bytes.readUInt16BE(position);
  if(length<2||position+length>bytes.length)invalidImage('truncated JPEG segment data');
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<8)invalidImage('invalid JPEG frame header');
   dimensions=boundedDimensions(bytes.readUInt16BE(position+5),bytes.readUInt16BE(position+3));
  }
  if(marker===0xda){if(!dimensions)invalidImage('JPEG scan has no frame dimensions');return dimensions;}
  position+=length;
 }
 invalidImage('JPEG requires a complete frame and image scan');
}
function validatedDimensions(bytes,digest) {
 const cached=validatedImages.get(digest);if(cached)return {...cached};
 let mime,header,decoded;
 if(bytes.length>=8&&bytes.subarray(0,8).equals(PNG_SIGNATURE)){
  mime='image/png';header=pngHeaderAndChunks(bytes);
  try{validatePngInflate(header);decoded=PNG.sync.read(bytes,{checkCRC:true});}
  catch(error){invalidImage('PNG cannot be decoded: '+String(error.message).slice(0,200));}
 }else if(bytes[0]===0xff&&bytes[1]===0xd8){
  mime='image/jpeg';header=jpegHeader(bytes);
  try{decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:32,maxMemoryUsageInMB:256});}
  catch(error){invalidImage('JPEG cannot be decoded: '+String(error.message).slice(0,200));}
 }else invalidImage('only actual PNG/JPEG bytes are supported');
 if(decoded.width!==header.width||decoded.height!==header.height||decoded.data?.length!==header.width*header.height*4)invalidImage('decoded pixels do not match image dimensions');
 const info=Object.freeze({mime,width:header.width,height:header.height});
 if(validatedImages.size>=256)validatedImages.delete(validatedImages.keys().next().value);
 validatedImages.set(digest,info);return {...info};
}
export function imageDimensions(bytes) {
 if(!(bytes instanceof Uint8Array))invalidImage('expected image bytes');
 const input=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(input.length>MAX_IMAGE_BYTES)throw new Error('IMAGE_LIMIT: 8 MiB per image');
 return validatedDimensions(input,hash(input));
}
export async function embedAssets(assets,cwd,signal) {
 let total=0;const result=[];
 for(const asset of assets){abort(signal);let bytes;
  if(asset.data){const m=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]*={0,2})$/.exec(asset.data);if(!m||m[2].length%4)throw new Error('INVALID_IMAGE_DATA: '+asset.id);bytes=Buffer.from(m[2],'base64');}
  else if(asset.path){const path=await safePath(cwd,asset.path,{mustExist:true});bytes=await readBounded(path,8*1024*1024);}
  else throw new Error('MISSING_IMAGE: '+asset.id);
  if(bytes.length>8*1024*1024)throw new Error('IMAGE_LIMIT: 8 MiB per image');total+=bytes.length;if(total>32*1024*1024)throw new Error('ASSET_LIMIT: 32 MiB per project');
  const digest=hash(bytes);if(asset.sha256&&asset.sha256!==digest)throw new Error('ASSET_HASH_MISMATCH: '+asset.id);
  const info=validatedDimensions(bytes,digest);abort(signal);
  const embedded={...asset,data:`data:${info.mime};base64,${bytes.toString('base64')}`,width:info.width,height:info.height,sha256:digest};delete embedded.path;result.push(embedded);
 }
 return result;
}
