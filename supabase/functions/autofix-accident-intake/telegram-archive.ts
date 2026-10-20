// Stored ZIP preserves original bytes without an external compression service.
const crcTable=Uint32Array.from({length:256},(_,i)=>{
 let c=i;for(let bit=0;bit<8;bit++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;
});
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function header(length:number){const bytes=new Uint8Array(length);return {bytes,v:new DataView(bytes.buffer)};}
export async function photoArchive(entries:{name:string,blob:Blob}[]){
 const parts:BlobPart[]=[],directory:Uint8Array<ArrayBuffer>[]=[];let offset=0,total=0;
 for(const entry of entries){
  if(!/^[a-zA-Z0-9._-]+$/.test(entry.name))throw Error('INVALID_ARCHIVE_NAME');
  total+=entry.blob.size;if(total>25000000)throw Error('ARCHIVE_SIZE_LIMIT');
  const name=new TextEncoder().encode(entry.name),data=new Uint8Array(await entry.blob.arrayBuffer()),crc=crc32(data);
  const local=header(30+name.length);local.v.setUint32(0,0x04034b50,true);local.v.setUint16(4,20,true);
  local.v.setUint16(12,33,true);local.v.setUint32(14,crc,true);local.v.setUint32(18,data.length,true);
  local.v.setUint32(22,data.length,true);local.v.setUint16(26,name.length,true);local.bytes.set(name,30);
  const central=header(46+name.length);central.v.setUint32(0,0x02014b50,true);central.v.setUint16(4,20,true);central.v.setUint16(6,20,true);
  central.v.setUint16(14,33,true);central.v.setUint32(16,crc,true);central.v.setUint32(20,data.length,true);central.v.setUint32(24,data.length,true);
  central.v.setUint16(28,name.length,true);central.v.setUint32(42,offset,true);central.bytes.set(name,46);
  parts.push(local.bytes,entry.blob);directory.push(central.bytes);offset+=local.bytes.length+data.length;
 }
 const size=directory.reduce((n,p)=>n+p.length,0),end=header(22);end.v.setUint32(0,0x06054b50,true);
 end.v.setUint16(8,entries.length,true);end.v.setUint16(10,entries.length,true);end.v.setUint32(12,size,true);end.v.setUint32(16,offset,true);
 return new Blob([...parts,...directory,end.bytes],{type:'application/zip'});
}
