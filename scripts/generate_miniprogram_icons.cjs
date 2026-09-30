// Deterministic 64px tab icons; no external image or package dependencies.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const size = 64;
const shapes = {
  workbench: [[12,12,28,12],[28,12,28,28],[28,28,12,28],[12,28,12,12],[36,12,52,12],[52,12,52,28],[52,28,36,28],[36,28,36,12],[12,36,28,36],[28,36,28,52],[28,52,12,52],[12,52,12,36],[36,36,52,36],[52,36,52,52],[52,52,36,52],[36,52,36,36]],
  job: [[10,22,54,22],[54,22,54,50],[54,50,10,50],[10,50,10,22],[24,22,24,14],[24,14,40,14],[40,14,40,22],[10,34,54,34],[29,34,29,40],[29,40,35,40],[35,40,35,34]],
  follow: [[32,52,12,33],[12,33,10,22],[10,22,16,14],[16,14,25,14],[25,14,32,21],[32,21,39,14],[39,14,48,14],[48,14,54,22],[54,22,52,33],[52,33,32,52]],
  calendar: [[12,17,52,17],[52,17,52,52],[52,52,12,52],[12,52,12,17],[12,27,52,27],[23,11,23,22],[41,11,41,22],[23,37,27,37],[37,37,41,37],[23,44,27,44],[37,44,41,44]],
  my: [[12,53,12,48],[12,48,18,39],[18,39,26,36],[26,36,38,36],[38,36,46,39],[46,39,52,48],[52,48,52,53]]
};
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
function chunk(type, data) { const t=Buffer.from(type), n=Buffer.alloc(4), crc=Buffer.alloc(4); n.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([n,t,data,crc]); }
function render(name, rgb) {
  const lines=shapes[name].slice();
  if(name==='my') for(let i=0;i<32;i++) { const a=i*2*Math.PI/32,b=(i+1)*2*Math.PI/32; lines.push([32+10*Math.cos(a),22+10*Math.sin(a),32+10*Math.cos(b),22+10*Math.sin(b)]); }
  const pixels=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    let opacity=0;
    for(const [x1,y1,x2,y2] of lines) { const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy))); const distance=Math.hypot(x-x1-t*dx,y-y1-t*dy); opacity=Math.max(opacity,Math.max(0,Math.min(1,2.4-distance))); }
    const o=y*(size*4+1)+1+x*4; pixels[o]=rgb[0]; pixels[o+1]=rgb[1]; pixels[o+2]=rgb[2]; pixels[o+3]=Math.round(opacity*255);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
for(const name of Object.keys(shapes)) for(const active of [false,true]) fs.writeFileSync(path.join(__dirname,'../miniprogram/icons',name+(active?'-active':'')+'.png'),render(name,active?[50,134,238]:[138,160,183]));
